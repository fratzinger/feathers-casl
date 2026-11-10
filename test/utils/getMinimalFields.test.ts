import assert from 'node:assert'

import { defineAbility, subject } from '@casl/ability'

import { getMinimalFields } from '../../src/index.js'

const methods = ['find', 'get', 'create', 'update', 'patch', 'remove']

describe('utils - getMinimalFields', function () {
  it('returns full array for manage all', function () {
    const ability = defineAbility((can) => {
      can('manage', 'all')
    })
    const availableFields = ['id', 'test']
    for (const method of methods) {
      const record: Record<string, unknown> = { id: 1, test: true }
      const fields = getMinimalFields(
        ability,
        method,
        subject('tests', record),
        { availableFields },
      )
      assert.deepStrictEqual(
        fields,
        ['id', 'test'],
        `full array for method '${method}'`,
      )
    }
  })

  it('returns subset of array', function () {
    const ability = defineAbility((can) => {
      can('manage', 'all', ['id'])
    })
    const availableFields = ['id', 'test']
    for (const method of methods) {
      const record: Record<string, unknown> = { id: 1, test: true }
      const fields = getMinimalFields(
        ability,
        method,
        subject('tests', record),
        { availableFields },
      )
      assert.deepStrictEqual(
        fields,
        ['id'],
        `subset of array for method '${method}'`,
      )
    }
  })

  it('returns subset of array with availableFields: undefined', function () {
    const ability = defineAbility((can) => {
      can('manage', 'all', ['id'])
    })
    const availableFields = undefined
    for (const method of methods) {
      const record: Record<string, unknown> = { id: 1, test: true }
      const fields = getMinimalFields(
        ability,
        method,
        subject('tests', record),
        { availableFields },
      )
      assert.deepStrictEqual(
        fields,
        ['id'],
        `subset of array for method '${method}'`,
      )
    }
  })

  it('returns empty array with availableFields: []', function () {
    const ability = defineAbility((can) => {
      can('manage', 'all', ['id'])
    })
    const availableFields: string[] = []
    for (const method of methods) {
      const record: Record<string, unknown> = { id: 1, test: true }
      const fields = getMinimalFields(
        ability,
        method,
        subject('tests', record),
        { availableFields },
      )
      assert.deepStrictEqual(fields, [], `empty array for method '${method}'`)
    }
  })

  it('returns empty array when not allowed', function () {
    const ability = defineAbility((can, cannot) => {
      cannot('manage', 'all')
    })

    for (const method of methods) {
      const record: Record<string, unknown> = { id: 1, test: true }
      const fields = getMinimalFields(
        ability,
        method,
        subject('tests', record),
        { checkCan: true },
      )
      assert.deepStrictEqual(fields, [], `empty array for method '${method}'`)
    }
  })

  it('returns subset of array for more complex rules', function () {
    const ability = defineAbility((can, cannot) => {
      can('manage', 'tests', ['id', 'name', 'email'], { id: { $ne: 1 } })
      can('manage', 'tests', { id: 1 })
      cannot('manage', 'tests', ['supersecret'])
    })
    const availableFields = ['id', 'name', 'email', 'supersecret', 'password']
    interface Pair {
      input: Record<string, unknown>
      expected: string[]
    }
    const pairs: Pair[] = [
      {
        input: { id: 1 },
        expected: ['id', 'name', 'email', 'password'],
      },
      {
        input: {},
        expected: ['id', 'name', 'email'],
      },
      {
        input: { id: 2 },
        expected: ['id', 'name', 'email'],
      },
    ]
    for (const [index, pair] of pairs.entries()) {
      for (const method of methods) {
        const fields = getMinimalFields(
          ability,
          method,
          subject('tests', pair.input),
          { availableFields },
        )
        assert.deepStrictEqual(
          fields,
          pair.expected,
          `result for input '${index}' and method '${method}' is correct`,
        )
      }
    }
  })

  describe('field patterns', function () {
    const availableFields = ['id', 'title', 'address', 'address.city']
    const record: Record<string, unknown> = {
      id: 1,
      title: 't',
      address: { city: 'c' },
    }
    const item = subject('tests', record)

    it('removes what an inverted pattern matches', function () {
      const ability = defineAbility((can, cannot) => {
        can('read', 'tests')
        cannot('read', 'tests', ['address.*'])
      })

      assert.deepStrictEqual(
        getMinimalFields(ability, 'read', item, { availableFields }),
        ['id', 'title'],
      )
    })

    it('removes what a deep pattern matches', function () {
      const deep = [
        'id',
        'address',
        'address.geo',
        'address.geo.lat',
        'title',
        'titleText',
      ]
      const record: Record<string, unknown> = { id: 1 }
      const forbidden = (pattern: string) => {
        const ability = defineAbility((can, cannot) => {
          can('read', 'tests')
          cannot('read', 'tests', [pattern])
        })
        return getMinimalFields(ability, 'read', subject('tests', record), {
          availableFields: deep,
        })
      }

      assert.deepStrictEqual(forbidden('address.**'), [
        'id',
        'title',
        'titleText',
      ])
      assert.deepStrictEqual(forbidden('address.*.lat'), [
        'id',
        'address',
        'address.geo',
        'title',
        'titleText',
      ])
      assert.deepStrictEqual(forbidden('title*'), [
        'id',
        'address',
        'address.geo',
        'address.geo.lat',
      ])
    })

    it('keeps what a pattern permits', function () {
      const ability = defineAbility((can) => {
        can('read', 'tests', ['address.*'])
      })

      assert.deepStrictEqual(
        getMinimalFields(ability, 'read', item, { availableFields }),
        ['address', 'address.city'],
      )
    })
  })
})
