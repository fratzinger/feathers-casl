import assert from 'node:assert'
import { getIdFields } from '../../src/index.js'

import type { HookContext } from '@feathersjs/feathers'

const contextWithId = (id: unknown): HookContext =>
  ({ service: { options: { id } } }) as any

describe('utils - getIdFields', function () {
  it('wraps a single string id in an array', function () {
    assert.deepStrictEqual(getIdFields(contextWithId('_id')), ['_id'])
  })

  it('returns a compound (array) id as-is', function () {
    assert.deepStrictEqual(getIdFields(contextWithId(['a', 'b'])), ['a', 'b'])
  })

  it('returns an empty array when the service exposes no id', function () {
    assert.deepStrictEqual(getIdFields(contextWithId(undefined)), [])
  })

  it('returns an empty array when there is no service', function () {
    assert.deepStrictEqual(getIdFields({} as HookContext), [])
  })
})
