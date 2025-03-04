import assert from 'node:assert'
import { simplifyQuery } from '../../src/index.js'

describe('utils - simplifyQuery', function () {
  it('makes $and simpler', function () {
    const result = simplifyQuery({
      $and: [{ id: 1 }, { id: 1 }, { id: 1 }],
    })
    assert.deepStrictEqual(result, { id: 1 })
  })

  it('makes $or simpler', function () {
    const result = simplifyQuery({
      $or: [{ id: 1 }, { id: 1 }, { id: 1 }],
    })
    assert.deepStrictEqual(result, { id: 1 })
  })

  it('makes $and and $or simpler', function () {
    const result = simplifyQuery({
      $and: [{ id: 1 }, { id: 1 }, { id: 1 }],
      $or: [{ id: 1 }, { id: 1 }, { id: 1 }],
    })
    assert.deepStrictEqual(result, { $and: [{ id: 1 }], $or: [{ id: 1 }] })
  })

  it('removes empty $and', function () {
    const result = simplifyQuery({
      $and: [],
      id: 1,
    })
    assert.deepStrictEqual(result, { id: 1 })
  })

  it('removes empty $or', function () {
    const result = simplifyQuery({
      $or: [],
      id: 1,
    })
    assert.deepStrictEqual(result, { id: 1 })
  })
})
