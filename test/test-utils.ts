import { createAliasResolver } from '@casl/ability'

export const promiseTimeout = function (
  ms: number,
  promise: Promise<unknown>,
  rejectMessage?: string,
): Promise<unknown> {
  // Create a promise that rejects in <ms> milliseconds
  const timeout = new Promise((resolve, reject) => {
    const id = setTimeout(() => {
      clearTimeout(id)
      reject(rejectMessage || 'timeout')
    }, ms)
  })

  // Returns a race between our timeout and the passed in promise
  return Promise.race([promise, timeout])
}

export const resolveAction = createAliasResolver({
  update: 'patch',
  read: ['get', 'find'],
  delete: 'remove',
})
