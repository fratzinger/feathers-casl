type Path = Array<string | number>

type Handle = 'target' | 'source' | 'combine' | 'intersect' | 'intersectOrFull'

type ActionOnEmptyIntersect = (
  target: unknown,
  source: unknown,
  prependKey: Path,
) => void

/**
 * Merges two arrays depending on the `handle` strategy:
 * - `target`: returns `targetArr`
 * - `source`: returns `sourceArr`
 * - `combine`: union of both (deduplicated)
 * - `intersect`: items present in both; if either is not an array,
 *   `actionOnEmptyIntersect` is called and `undefined` is returned
 * - `intersectOrFull`: like `intersect`, but if either is not an array the
 *   other array is returned instead of `undefined`
 *
 * Vendored from `@fratzinger/feathers-utils`.
 */
export const mergeArrays = <T>(
  targetArr: T[] | undefined,
  sourceArr: T[] | undefined,
  handle: Handle,
  prependKey?: Path,
  actionOnEmptyIntersect?: ActionOnEmptyIntersect,
): T[] | undefined => {
  if (!sourceArr && !targetArr) {
    return
  }
  if (handle === 'target') {
    return targetArr
  } else if (handle === 'source') {
    return sourceArr
  } else if (handle === 'combine') {
    if (!Array.isArray(sourceArr)) {
      return targetArr
    }
    if (!Array.isArray(targetArr)) {
      return sourceArr
    }
    return [...new Set(targetArr.concat(sourceArr))]
  } else if (handle === 'intersect' || handle === 'intersectOrFull') {
    if (!Array.isArray(targetArr) || !Array.isArray(sourceArr)) {
      if (handle === 'intersect') {
        if (actionOnEmptyIntersect) {
          actionOnEmptyIntersect(targetArr, sourceArr, prependKey || [])
        }
        return
      }
      // intersectOrFull -> return whichever side is an array
      return Array.isArray(targetArr) ? targetArr : sourceArr
    }
    return targetArr.filter((val) => sourceArr.includes(val))
  }
  return undefined
}
