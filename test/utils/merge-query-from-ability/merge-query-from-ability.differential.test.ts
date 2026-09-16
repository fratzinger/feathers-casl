import { defineAbility, subject } from '@casl/ability'
import assert from 'node:assert'
import { MemoryService } from '@feathersjs/memory'
import { mergeQueryFromAbility } from '../../../src/index.js'
import type { Adapter } from '../../../src/index.js'

/**
 * `mergeQueryFromAbility` has to answer the same question the adapter can't:
 * which records may this ability read? This checks that against the source of
 * truth - running `ability.can()` over every record - for a few thousand
 * generated rulesets, so a regression in rule precedence or in the inverted
 * rule handling shows up as a mismatch instead of as a subtly wrong query.
 */

const ITEMS: Record<string, any>[] = []
let nextId = 0
for (const userId of [1, 2, 3]) {
  for (const status of ['a', 'b']) {
    for (const flag of [true, false]) {
      ITEMS.push({ id: ++nextId, userId, status, flag })
    }
  }
}

const CONDITIONS: (Record<string, any> | undefined)[] = [
  undefined,
  { userId: 1 },
  { userId: 2 },
  { status: 'a' },
  { flag: true },
  { userId: { $in: [1, 2] } },
  { userId: 3, status: 'b' },
  { userId: { $ne: 1 } },
]

const makeService = () =>
  new MemoryService({
    id: 'id',
    multi: true,
    filters: {
      $and: (value: any) => value,
      $or: (value: any) => value,
      $not: (value: any) => value,
      $nor: (value: any) => value,
    },
    operators: ['$and', '$or', '$not', '$nor', '$ne', '$in', '$nin'],
    store: Object.fromEntries(ITEMS.map((item) => [item.id, { ...item }])),
  })

/** deterministic, so a failure is reproducible */
const makeRandom = (seed: number) => (max: number) => {
  seed = (seed * 1103515245 + 12345) & 0x7fffffff
  return seed % max
}

type RuleSpec = {
  inverted: boolean
  conditions: Record<string, any> | undefined
}

const buildAbility = (spec: RuleSpec[]) =>
  defineAbility((can, cannot) => {
    for (const { inverted, conditions } of spec) {
      const add = inverted ? cannot : can
      if (conditions) {
        add('read', 'tests', conditions)
      } else {
        add('read', 'tests')
      }
    }
  })

const idsOf = (items: Record<string, any>[]) =>
  items
    .map((item) => item.id as number)
    .sort((a, b) => a - b)
    .join(',')

const compare = async (adapter: Adapter, seed: number, cases: number) => {
  const random = makeRandom(seed)
  const mismatches: string[] = []
  let denyAll = 0

  for (let c = 0; c < cases; c++) {
    const spec: RuleSpec[] = []
    for (let i = 0, n = 1 + random(4); i < n; i++) {
      spec.push({
        inverted: random(3) === 0,
        conditions: CONDITIONS[random(CONDITIONS.length)],
      })
    }

    const ability = buildAbility(spec)
    const service = makeService()

    const query = mergeQueryFromAbility(
      {} as any,
      ability,
      'read',
      'tests',
      {},
      service as any,
      { adapter },
    )

    const expected = idsOf(
      ITEMS.filter((item) =>
        ability.can('read', subject('tests', { ...item })),
      ),
    )

    let actual: string
    try {
      const found = (await service.find({
        query: query as any,
        paginate: false,
      })) as unknown as Record<string, any>[]
      actual = idsOf(found)
    } catch (err: any) {
      mismatches.push(`${JSON.stringify(spec)} -> ${err.name}: ${err.message}`)
      continue
    }

    if (actual === expected) {
      continue
    }

    if (expected === '' && Object.keys(query as any).length === 0) {
      // casl denies every record and no query can express "none of them", so
      // `mergeQueryFromAbility` leaves the query alone. The hooks never get
      // here - the basic permission check rejects the request first.
      denyAll++
      continue
    }

    mismatches.push(
      `rules=${JSON.stringify(spec)} query=${JSON.stringify(query)} casl=[${expected}] got=[${actual}]`,
    )
  }

  return { mismatches, denyAll }
}

describe('utils - mergeQueryFromAbility - differential', function () {
  it('matches ability.can() for $nor adapters', async function () {
    const { mismatches, denyAll } = await compare(
      '@feathersjs/memory',
      12345,
      2000,
    )
    assert.deepStrictEqual(
      mismatches.slice(0, 3),
      [],
      `${mismatches.length} mismatches`,
    )
    assert.ok(denyAll > 0, 'expected the deny-all case to be generated')
  })

  it('matches ability.can() when operators get inverted', async function () {
    const { mismatches } = await compare('@feathersjs/knex', 999, 2000)
    assert.deepStrictEqual(
      mismatches.slice(0, 3),
      [],
      `${mismatches.length} mismatches`,
    )
  })
})
