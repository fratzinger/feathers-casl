import assert from 'node:assert'
import { defineAbility, subject } from '@casl/ability'
import { getForbiddenFields } from '../../src/index.js'

describe('getForbiddenFields', function () {
  const item = (data: Record<string, unknown>) => subject('tests', data)

  it('lists the fields an inverted rule forbids where its conditions match', function () {
    const ability = defineAbility((can, cannot) => {
      can('read', 'tests')
      cannot('read', 'tests', ['secret', 'token'], { userId: 2 })
      cannot('read', 'tests', ['hash'])
    })

    assert.deepStrictEqual(
      getForbiddenFields(ability, 'read', item({ userId: 2 })).toSorted(),
      ['hash', 'secret', 'token'],
    )
    assert.deepStrictEqual(
      getForbiddenFields(ability, 'read', item({ userId: 1 })),
      ['hash'],
    )
  })

  it('leaves out a field a later rule allows again', function () {
    const ability = defineAbility((can, cannot) => {
      can('read', 'tests')
      cannot('read', 'tests', ['secret'])
      can('read', 'tests', { userId: 1 })
    })

    assert.deepStrictEqual(
      getForbiddenFields(ability, 'read', item({ userId: 1 })),
      [],
    )
    assert.deepStrictEqual(
      getForbiddenFields(ability, 'read', item({ userId: 2 })),
      ['secret'],
    )
  })

  it('lists nothing without an inverted rule naming fields', function () {
    const ability = defineAbility((can, cannot) => {
      can('read', 'tests', ['title'])
      cannot('read', 'tests', { userId: 2 })
    })

    assert.deepStrictEqual(
      getForbiddenFields(ability, 'read', item({ userId: 2 })),
      [],
    )
  })
})
