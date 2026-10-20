import { createMongoAbility, subject } from '@casl/ability'
import * as fc from 'fast-check'
import { simplifyQuery } from 'feathers-utils/utils'
import siftModule from 'sift'

import { convertRuleToQuery } from '../../src/utils/convertRuleToQuery.js'
import { rulesToQuery } from '../../src/utils/rules-to-query.js'

import type { RawRuleOf, MongoAbility } from '@casl/ability'
import type { Query } from '@feathersjs/feathers'

/**
 * Property test: the query `rulesToQuery` builds must select exactly the
 * records `ability.can()` allows - checked with a real casl ability (v6 or v7,
 * see `CASL_VERSION`) against `sift` as an independent mongo query matcher.
 */

type Rule = RawRuleOf<MongoAbility>

// sift is CommonJS - depending on the interop its default import is the
// matcher itself or the module object holding it
const sift: typeof siftModule.default =
  (siftModule as any).default ?? siftModule

// fast-check creates null-prototype objects by default, which casl does not match
const plain = { noNullPrototype: true } as const

const values = {
  a: fc.integer({ min: 0, max: 3 }),
  b: fc.constantFrom('x', 'y', 'z'),
  c: fc.boolean(),
}
type Field = keyof typeof values

const fieldCondition = (field: Field) => {
  const value: fc.Arbitrary<unknown> = values[field]
  const ops: fc.Arbitrary<unknown>[] = [
    value,
    fc.record({ $ne: value }, plain),
    fc.record({ $in: fc.array(value, { minLength: 1, maxLength: 2 }) }, plain),
    fc.record({ $nin: fc.array(value, { minLength: 1, maxLength: 2 }) }, plain),
  ]
  if (field !== 'c') {
    ops.push(
      fc.record({ $gt: value }, plain),
      fc.record({ $gte: value }, plain),
      fc.record({ $lt: value }, plain),
      fc.record({ $lte: value }, plain),
      fc.record({ $gt: value, $lt: value }, plain),
    )
  }
  return fc.oneof(...ops)
}

const conditions = fc.record(
  {
    a: fieldCondition('a'),
    b: fieldCondition('b'),
    c: fieldCondition('c'),
  },
  { ...plain, requiredKeys: [] },
)

const rule = (opts: { emptyConditions: boolean }): fc.Arbitrary<Rule> =>
  fc
    .record(
      {
        inverted: fc.boolean(),
        conditions: fc.option(conditions, { freq: 4, nil: undefined }),
      },
      plain,
    )
    .filter(
      ({ conditions }) =>
        opts.emptyConditions ||
        conditions === undefined ||
        Object.keys(conditions).length > 0,
    )
    .map(({ inverted, conditions }) => ({
      action: 'read',
      subject: 'posts',
      inverted,
      ...(conditions ? { conditions } : {}),
    }))

const record = fc.record({ a: values.a, b: values.b, c: values.c }, plain)

/** `cannot` as `{ $nor: [conditions] }`, like `@feathersjs/memory` & `@feathersjs/mongodb` */
const norConvert = (r: any): Query =>
  r.inverted ? { $nor: [r.conditions] } : r.conditions

/** `cannot` with inverted operators, like `@feathersjs/knex` */
const invertConvert = (r: any): Query =>
  r.inverted ? convertRuleToQuery(r)! : r.conditions

const check = (
  convert: (r: any) => Query,
  rules: Rule[],
  records: Record<string, unknown>[],
) => {
  const ability = createMongoAbility(rules)
  const query = rulesToQuery(ability, 'read', 'posts', convert)
  const matches = query === null ? () => false : sift(simplifyQuery(query))

  for (const r of records) {
    const expected = ability.can('read', subject('posts', { ...r }))
    if (matches(r) !== expected) {
      throw new Error(
        `record ${JSON.stringify(r)}: ability.can() = ${expected}, query = ${JSON.stringify(query)}`,
      )
    }
  }
}

describe('rulesToQuery matches ability.can()', () => {
  const runs = { numRuns: 3000 }

  // https://sergiy-stotskiy.medium.com/casl-v7-closing-the-gap-between-runtime-and-database-queries-2ccfe48b238f
  it('example from the casl v7 announcement', () => {
    const rules: Rule[] = [
      { action: 'read', subject: 'posts' },
      {
        action: 'read',
        subject: 'posts',
        inverted: true,
        conditions: { private: true },
      },
      { action: 'read', subject: 'posts', conditions: { authorId: 1 } },
    ]
    const records = [
      { private: false, authorId: 2 },
      { private: true, authorId: 2 },
      { private: true, authorId: 1 },
    ]

    check(norConvert, rules, records)
    check(invertConvert, rules, records)
  })

  for (const [name, convert] of [
    ['$nor', norConvert],
    ['inverted operators', invertConvert],
  ] as const) {
    describe(`cannot as ${name}`, () => {
      it('random rules', () => {
        fc.assert(
          fc.property(
            fc.array(rule({ emptyConditions: false }), { maxLength: 5 }),
            fc.array(record, { minLength: 1, maxLength: 10 }),
            (rules, records) => check(convert, rules, records),
          ),
          runs,
        )
      })

      it('random rules incl. empty conditions `{}`', () => {
        fc.assert(
          fc.property(
            fc.array(rule({ emptyConditions: true }), { maxLength: 5 }),
            fc.array(record, { minLength: 1, maxLength: 10 }),
            (rules, records) => check(convert, rules, records),
          ),
          runs,
        )
      })
    })
  }
})
