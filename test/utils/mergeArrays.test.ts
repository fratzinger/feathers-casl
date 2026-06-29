import assert from 'node:assert'
import { mergeArrays } from '../../src/index.js'

describe('utils - mergeArrays', function () {
  it('returns undefined when both arrays are missing', function () {
    assert.strictEqual(mergeArrays(undefined, undefined, 'combine'), undefined)
  })

  it("'target' returns the target array", function () {
    assert.deepStrictEqual(mergeArrays([1, 2], [3, 4], 'target'), [1, 2])
  })

  it("'source' returns the source array", function () {
    assert.deepStrictEqual(mergeArrays([1, 2], [3, 4], 'source'), [3, 4])
  })

  describe("'combine'", function () {
    it('unions and deduplicates both arrays', function () {
      assert.deepStrictEqual(mergeArrays([1, 2], [2, 3], 'combine'), [1, 2, 3])
    })

    it('returns the target when the source is not an array', function () {
      assert.deepStrictEqual(mergeArrays([1, 2], undefined, 'combine'), [1, 2])
    })

    it('returns the source when the target is not an array', function () {
      assert.deepStrictEqual(mergeArrays(undefined, [3, 4], 'combine'), [3, 4])
    })
  })

  describe("'intersect'", function () {
    it('returns items present in both arrays', function () {
      assert.deepStrictEqual(
        mergeArrays([1, 2, 3], [2, 3, 4], 'intersect'),
        [2, 3],
      )
    })

    it('calls actionOnEmptyIntersect and returns undefined when a side is missing', function () {
      let called: any[] | undefined
      const result = mergeArrays(
        [1, 2],
        undefined,
        'intersect',
        ['a', 'b'],
        (target, source, prependKey) => {
          called = [target, source, prependKey]
        },
      )
      assert.strictEqual(result, undefined)
      assert.deepStrictEqual(called, [[1, 2], undefined, ['a', 'b']])
    })

    it('defaults prependKey to [] and tolerates a missing callback', function () {
      let prepend: unknown
      mergeArrays([1, 2], undefined, 'intersect', undefined, (_t, _s, p) => {
        prepend = p
      })
      assert.deepStrictEqual(prepend, [])

      assert.strictEqual(mergeArrays([1, 2], undefined, 'intersect'), undefined)
    })
  })

  describe("'intersectOrFull'", function () {
    it('returns items present in both arrays', function () {
      assert.deepStrictEqual(
        mergeArrays([1, 2, 3], [2, 3, 4], 'intersectOrFull'),
        [2, 3],
      )
    })

    it('returns the target when the source is not an array', function () {
      assert.deepStrictEqual(
        mergeArrays([1, 2], undefined, 'intersectOrFull'),
        [1, 2],
      )
    })

    it('returns the source when the target is not an array', function () {
      assert.deepStrictEqual(
        mergeArrays(undefined, [3, 4], 'intersectOrFull'),
        [3, 4],
      )
    })
  })

  it('returns undefined for an unknown handle', function () {
    assert.strictEqual(mergeArrays([1, 2], [3, 4], 'unknown' as any), undefined)
  })
})
