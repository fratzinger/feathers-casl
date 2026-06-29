import assert from 'node:assert'
import { getMethodName } from '../../src/utils/getMethodName.js'

import type { HookContext } from '@feathersjs/feathers'

const context = { method: 'find' } as HookContext

describe('utils - getMethodName', function () {
  it('returns the context method when no options are given', function () {
    assert.strictEqual(getMethodName(context), 'find')
  })

  it('returns the context method when options have no method override', function () {
    assert.strictEqual(getMethodName(context, {}), 'find')
  })

  it('returns a string method override', function () {
    assert.strictEqual(getMethodName(context, { method: 'patch' }), 'patch')
  })

  it('resolves a function method override with the context', function () {
    assert.strictEqual(
      getMethodName(context, { method: (c) => `${c.method}-custom` }),
      'find-custom',
    )
  })
})
