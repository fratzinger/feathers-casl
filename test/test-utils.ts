import { createAliasResolver } from '@casl/ability'
import { BadRequest } from '@feathersjs/errors'
import type { FilterQueryOptions } from '@feathersjs/adapter-commons'

export const resolveAction = createAliasResolver({
  update: 'patch',
  read: ['get', 'find'],
  delete: 'remove',
})

// `filterArray` and its helpers are vendored from `@fratzinger/feathers-utils`.
// They are only needed in tests to allow array query operators (e.g. `$nor`,
// `$and`, `$not`) via a service's `filters` option.

const isObject = (item: unknown): item is Record<string, any> =>
  !!item && typeof item === 'object' && !Array.isArray(item)

const validateQueryProperty = (query: any, operators: string[] = []): any => {
  if (!isObject(query)) {
    return query
  }
  for (const key of Object.keys(query)) {
    if (key.startsWith('$') && !operators.includes(key)) {
      throw new BadRequest(`Invalid query parameter ${key}`, query)
    }
    const value = query[key]
    if (isObject(value)) {
      query[key] = validateQueryProperty(value, operators)
    }
  }
  return { ...query }
}

const filterQueryArray =
  (key: string) =>
  (arr: any, { operators }: FilterQueryOptions) => {
    if (arr && !Array.isArray(arr)) {
      throw new Error(`Invalid query parameter '${key}'. It has to be an array`)
    }
    if (Array.isArray(arr)) {
      return arr.map((current) => validateQueryProperty(current, operators))
    }
    return arr
  }

export const filterArray = <T extends string[]>(
  ...keys: T
): { [key in T[number]]: (value: any, options: FilterQueryOptions) => any } => {
  const result = {} as {
    [key in T[number]]: (value: any, options: FilterQueryOptions) => any
  }
  for (const key of keys) {
    result[key as T[number]] = filterQueryArray(key)
  }
  return result
}

const filterQueryObject =
  (key: string) =>
  (obj: any, { operators }: FilterQueryOptions) => {
    if (obj && !isObject(obj)) {
      throw new Error(
        `Invalid query parameter: '${key}'. It has to be an object`,
      )
    }
    return validateQueryProperty(obj, operators)
  }

export const filterObject = <T extends string[]>(
  ...keys: T
): { [key in T[number]]: (value: any, options: FilterQueryOptions) => any } => {
  const result = {} as {
    [key in T[number]]: (value: any, options: FilterQueryOptions) => any
  }
  for (const key of keys) {
    result[key as T[number]] = filterQueryObject(key)
  }
  return result
}
