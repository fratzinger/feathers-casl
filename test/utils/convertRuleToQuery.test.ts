import { defineAbility } from '@casl/ability'
import assert from 'node:assert'
import { convertRuleToQuery } from '../../src/index.js'

const cannotNegate = /cannot negate/
const moreRestrictive = /more restrictive than the rule/

describe('utils - convertRuleToQuery', function () {
  it('', function () {
    const ability = defineAbility((can, cannot) => {
      can('create', 'tests', { id: 1, test: true })

      can('create', 'tests', { id: 1 })
      can('create', 'tests', { id: { $gt: 1 } })
      can('create', 'tests', { id: { $gte: 1 } })
      can('create', 'tests', { id: { $lt: 1 } })
      can('create', 'tests', { id: { $lte: 1 } })
      can('create', 'tests', { id: { $in: [1] } })
      can('create', 'tests', { id: { $nin: [1] } })
      can('create', 'tests', { id: { $ne: 1 } })

      cannot('create', 'tests', { id: 1 })
      cannot('create', 'tests', { id: { $gt: 1 } })
      cannot('create', 'tests', { id: { $gte: 1 } })
      cannot('create', 'tests', { id: { $lt: 1 } })
      cannot('create', 'tests', { id: { $lte: 1 } })
      cannot('create', 'tests', { id: { $in: [1] } })
      cannot('create', 'tests', { id: { $nin: [1] } })
      cannot('create', 'tests', { id: { $ne: 1 } })

      cannot('create', 'tests')
      can('create', 'tests')

      can('create', 'tests', { $sort: { id: 1 } })
    })
    const expected = [
      { id: 1, test: true },

      { id: 1 },
      { id: { $gt: 1 } },
      { id: { $gte: 1 } },
      { id: { $lt: 1 } },
      { id: { $lte: 1 } },
      { id: { $in: [1] } },
      { id: { $nin: [1] } },
      { id: { $ne: 1 } },

      { id: { $ne: 1 } },
      { id: { $lte: 1 } },
      { id: { $lt: 1 } },
      { id: { $gte: 1 } },
      { id: { $gt: 1 } },
      { id: { $nin: [1] } },
      { id: { $in: [1] } },
      { id: 1 },

      undefined,
      undefined,

      { $sort: { id: 1 } },
    ]
    const { rules } = ability

    rules.forEach((rule, i) => {
      assert.deepStrictEqual(
        convertRuleToQuery(rule),
        expected[i],
        `${i}: expected result for rule is: '${JSON.stringify(expected[i])}'`,
      )
    })
  })

  // leaving these out would hand back a query that restricts nothing, which
  // the caller reads as "everything is allowed"
  it('throws when an inverted rule has nothing invertible in it', function () {
    const rules = defineAbility((can, cannot) => {
      cannot('create', 'tests', { $sort: { id: 1 } })
      cannot('create', 'tests', { id: { $sort: 1 } })
    }).rules

    for (const rule of rules) {
      assert.throws(() => convertRuleToQuery(rule), cannotNegate)
    }
  })

  it('warns and narrows when only part of an inverted rule is invertible', function () {
    const [rule] = defineAbility((can, cannot) => {
      cannot('create', 'tests', { id: { $ne: 1, $sort: 1 } })
    }).rules

    const warnings: string[] = []
    const warn = console.warn
    console.warn = (message: string) => warnings.push(message)
    try {
      assert.deepStrictEqual(convertRuleToQuery(rule), { id: 1 })
    } finally {
      console.warn = warn
    }

    assert.strictEqual(warnings.length, 1)
    assert.match(warnings[0], moreRestrictive)
  })

  it('calls actionOnForbidden', function () {
    let actionOnForbiddenCalled = false
    const [rule] = defineAbility((can, cannot) => {
      cannot('create', 'tests')
    }).rules
    convertRuleToQuery(rule, {
      actionOnForbidden: () => {
        actionOnForbiddenCalled = true
      },
    })

    assert.ok(actionOnForbiddenCalled)
  })

  describe('negation of inverted rules (De Morgan)', function () {
    it('inverts a single field to a bare $ne (no wrapping $or)', function () {
      const [rule] = defineAbility((can, cannot) => {
        cannot('read', 'tests', { userId: 4 })
      }).rules
      assert.deepStrictEqual(convertRuleToQuery(rule), { userId: { $ne: 4 } })
    })

    it('negates a multi-field rule with $or', function () {
      // `cannot({ userId: 4, status: 'archived' })` forbids records where BOTH
      // conditions hold, so the negation must allow records where EITHER differs:
      // `NOT (a AND b)` === `(NOT a) OR (NOT b)`.
      const [rule] = defineAbility((can, cannot) => {
        cannot('read', 'tests', { userId: 4, status: 'archived' })
      }).rules
      assert.deepStrictEqual(convertRuleToQuery(rule), {
        $or: [{ userId: { $ne: 4 } }, { status: { $ne: 'archived' } }],
      })
    })

    it('negates multiple operators on one field with $or', function () {
      // `cannot({ age: { $gt: 18, $lt: 65 } })` forbids 18 < age < 65, so the
      // negation is age <= 18 OR age >= 65 - the old code kept only the last
      // operator and dropped the rest.
      const [rule] = defineAbility((can, cannot) => {
        cannot('read', 'tests', { age: { $gt: 18, $lt: 65 } })
      }).rules
      assert.deepStrictEqual(convertRuleToQuery(rule), {
        $or: [{ age: { $lte: 18 } }, { age: { $gte: 65 } }],
      })
    })

    it('negates a field value combined with a field operator', function () {
      const [rule] = defineAbility((can, cannot) => {
        cannot('read', 'tests', { userId: 4, age: { $gt: 30 } })
      }).rules
      assert.deepStrictEqual(convertRuleToQuery(rule), {
        $or: [{ userId: { $ne: 4 } }, { age: { $lte: 30 } }],
      })
    })
  })
})
