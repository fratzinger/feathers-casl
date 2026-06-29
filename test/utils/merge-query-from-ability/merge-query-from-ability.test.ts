import { defineAbility } from '@casl/ability'
import assert from 'node:assert'
import { mergeQueryFromAbility } from '../../../src/index.js'
import type { Adapter } from '../../../src/index.js'

// `app` is only used by `getAdapter` when `options.adapter` is not set, and
// `service` is unused by `mergeQueryFromAbility` - so plain stubs are enough.
const app = {} as any
const service = {} as any

const build = (ability: any, adapter: Adapter, originalQuery?: any) =>
  mergeQueryFromAbility(
    app,
    ability,
    'read',
    'tests',
    originalQuery as any,
    service,
    { adapter },
  )

describe('utils - mergeQueryFromAbility', function () {
  it('returns the original query untouched when there are no restricting conditions', function () {
    const ability = defineAbility((can) => {
      can('read', 'tests')
    })
    const originalQuery = { test: true }
    assert.deepStrictEqual(
      build(ability, '@feathersjs/memory', originalQuery),
      originalQuery,
    )
  })

  it('intersects the casl query with a non-empty original query', function () {
    const ability = defineAbility((can) => {
      can('read', 'tests', { userId: 1 })
    })
    assert.deepStrictEqual(
      build(ability, '@feathersjs/memory', { test: true }),
      {
        test: true,
        userId: 1,
      },
    )
  })

  // Allowing (`can`) rules are adapter-independent - the per-adapter callback
  // only kicks in for inverted (`cannot`) rules.
  describe('allowing rules', function () {
    it('returns the bare conditions for a single allowing rule', function () {
      const ability = defineAbility((can) => {
        can('read', 'tests', { userId: 1 })
      })
      assert.deepStrictEqual(build(ability, '@feathersjs/knex'), { userId: 1 })
    })

    it('combines multiple allowing rules with $or', function () {
      const ability = defineAbility((can) => {
        can('read', 'tests', { userId: 1 })
        can('read', 'tests', { userId: 2 })
      })
      assert.deepStrictEqual(build(ability, '@feathersjs/knex'), {
        $or: [{ userId: 2 }, { userId: 1 }],
      })
    })
  })

  describe('@feathersjs/knex (default: inverts operators)', function () {
    it('inverts an equality condition to $ne', function () {
      const ability = defineAbility((can, cannot) => {
        can('read', 'tests')
        cannot('read', 'tests', { userId: 4 })
      })
      assert.deepStrictEqual(build(ability, '@feathersjs/knex'), {
        userId: { $ne: 4 },
      })
    })

    it('inverts a comparison operator ($gt -> $lte)', function () {
      const ability = defineAbility((can, cannot) => {
        can('read', 'tests')
        cannot('read', 'tests', { age: { $gt: 18 } })
      })
      assert.deepStrictEqual(build(ability, '@feathersjs/knex'), {
        age: { $lte: 18 },
      })
    })

    it('flattens the inverted rule into the top-level query (no nested $and)', function () {
      const ability = defineAbility((can, cannot) => {
        can('read', 'tests', { userId: 1 })
        can('read', 'tests', { userId: 2 })
        cannot('read', 'tests', { userId: 4 })
      })
      assert.deepStrictEqual(build(ability, '@feathersjs/knex'), {
        $or: [{ userId: 2 }, { userId: 1 }],
        userId: { $ne: 4 },
      })
    })

    it('negates a multi-field cannot with $or (De Morgan)', function () {
      const ability = defineAbility((can, cannot) => {
        can('read', 'tests')
        cannot('read', 'tests', { userId: 4, status: 'archived' })
      })
      assert.deepStrictEqual(build(ability, '@feathersjs/knex'), {
        $or: [{ userId: { $ne: 4 } }, { status: { $ne: 'archived' } }],
      })
    })

    it('negates multiple operators on one field with $or', function () {
      const ability = defineAbility((can, cannot) => {
        can('read', 'tests')
        cannot('read', 'tests', { age: { $gt: 18, $lt: 65 } })
      })
      assert.deepStrictEqual(build(ability, '@feathersjs/knex'), {
        $or: [{ age: { $lte: 18 } }, { age: { $gte: 65 } }],
      })
    })

    it('combines two multi-field cannots into an $and of $or branches', function () {
      const ability = defineAbility((can, cannot) => {
        can('read', 'tests')
        cannot('read', 'tests', { userId: 4, status: 'archived' })
        cannot('read', 'tests', { userId: 5, status: 'draft' })
      })
      assert.deepStrictEqual(build(ability, '@feathersjs/knex'), {
        $and: [
          { $or: [{ userId: { $ne: 5 } }, { status: { $ne: 'draft' } }] },
          { $or: [{ userId: { $ne: 4 } }, { status: { $ne: 'archived' } }] },
        ],
      })
    })

    it('intersects allowing $or rules with a multi-field cannot', function () {
      const ability = defineAbility((can, cannot) => {
        can('read', 'tests', { userId: 1 })
        can('read', 'tests', { userId: 2 })
        cannot('read', 'tests', { userId: 4, status: 'archived' })
      })
      assert.deepStrictEqual(build(ability, '@feathersjs/knex'), {
        $or: [{ userId: 2 }, { userId: 1 }],
        $and: [
          { $or: [{ userId: { $ne: 4 } }, { status: { $ne: 'archived' } }] },
        ],
      })
    })
  })

  describe('feathers-kysely ($not object)', function () {
    it('expresses an inverted rule as $not', function () {
      const ability = defineAbility((can, cannot) => {
        can('read', 'tests')
        cannot('read', 'tests', { userId: 4 })
      })
      assert.deepStrictEqual(build(ability, 'feathers-kysely'), {
        $not: { userId: 4 },
      })
    })

    it('wraps an inverted operator condition in $not as-is', function () {
      const ability = defineAbility((can, cannot) => {
        can('read', 'tests')
        cannot('read', 'tests', { age: { $gt: 18 } })
      })
      assert.deepStrictEqual(build(ability, 'feathers-kysely'), {
        $not: { age: { $gt: 18 } },
      })
    })

    it('combines allowing ($or) and inverted ($not) rules', function () {
      const ability = defineAbility((can, cannot) => {
        can('read', 'tests', { userId: 1 })
        can('read', 'tests', { userId: 2 })
        cannot('read', 'tests', { userId: 4 })
      })
      assert.deepStrictEqual(build(ability, 'feathers-kysely'), {
        $or: [{ userId: 2 }, { userId: 1 }],
        $not: { userId: 4 },
      })
    })
  })

  describe('feathers-sequelize ($not array)', function () {
    it('expresses an inverted rule as $not with an array', function () {
      const ability = defineAbility((can, cannot) => {
        can('read', 'tests')
        cannot('read', 'tests', { userId: 4 })
      })
      assert.deepStrictEqual(build(ability, 'feathers-sequelize'), {
        $not: [{ userId: 4 }],
      })
    })

    it('combines allowing ($or) and inverted ($not) rules', function () {
      const ability = defineAbility((can, cannot) => {
        can('read', 'tests', { userId: 1 })
        can('read', 'tests', { userId: 2 })
        cannot('read', 'tests', { userId: 4 })
      })
      assert.deepStrictEqual(build(ability, 'feathers-sequelize'), {
        $or: [{ userId: 2 }, { userId: 1 }],
        $not: [{ userId: 4 }],
      })
    })
  })

  describe('@feathersjs/memory & @feathersjs/mongodb ($nor)', function () {
    it('expresses an inverted rule as $nor', function () {
      const ability = defineAbility((can, cannot) => {
        can('read', 'tests')
        cannot('read', 'tests', { userId: 4 })
      })
      assert.deepStrictEqual(build(ability, '@feathersjs/memory'), {
        $nor: [{ userId: 4 }],
      })
    })

    it('combines allowing ($or) and inverted ($nor) rules', function () {
      const ability = defineAbility((can, cannot) => {
        can('read', 'tests', { userId: 1 })
        can('read', 'tests', { userId: 2 })
        cannot('read', 'tests', { userId: 4 })
      })
      assert.deepStrictEqual(build(ability, '@feathersjs/mongodb'), {
        $or: [{ userId: 2 }, { userId: 1 }],
        $nor: [{ userId: 4 }],
      })
    })
  })
})
