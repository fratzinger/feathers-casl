import { defineAbility } from '@casl/ability'
import assert from 'node:assert'
import { convertRuleToQuery } from '../../src/index.js'

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
      cannot('create', 'tests', { $sort: { id: 1 } })
      cannot('create', 'tests', { id: { $sort: 1 } })
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
      {},
      {},
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
