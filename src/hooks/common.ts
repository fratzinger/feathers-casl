import { subject } from '@casl/ability'
import { getDataIsArray } from 'feathers-utils'

import { throwUnlessCan } from './authorize/authorize.hook.utils.js'

import type { AnyAbility } from '@casl/ability'
import type { HookContext } from '@feathersjs/feathers'
import type {
  CheckBasicPermissionHookOptions,
  HookBaseOptions,
  ThrowUnlessCanOptions,
} from '../types.js'
import { getMethodName } from '../utils/getMethodName.js'

export const makeDefaultBaseOptions = (): HookBaseOptions => {
  return {
    ability: undefined,
    actionOnForbidden: undefined,
    checkMultiActions: false,
    checkAbilityForInternal: false,
    modelName: (context: Pick<HookContext, 'path'>): string => {
      return context.path
    },
    notSkippable: false,
    debug: false,
  } as unknown as HookBaseOptions
}

export const checkCreatePerItem = (
  context: HookContext,
  ability: AnyAbility,
  modelName: string,
  options: Partial<
    Pick<ThrowUnlessCanOptions, 'actionOnForbidden' | 'skipThrow'>
  > &
    Partial<
      Pick<CheckBasicPermissionHookOptions, 'checkCreateForData' | 'method'>
    >,
): HookContext => {
  const method = getMethodName(context, options)
  if (method !== 'create' || !options.checkCreateForData) {
    return context
  }

  const checkCreateForData =
    typeof options.checkCreateForData === 'function'
      ? options.checkCreateForData(context)
      : true

  if (!checkCreateForData) {
    return context
  }

  // we have all information we need (maybe we need populated data?)
  const { data: items } = getDataIsArray(context)

  for (let i = 0, n = items.length; i < n; i++) {
    throwUnlessCan(
      ability,
      method,
      subject(modelName, items[i]),
      modelName,
      options,
    )
  }

  return context
}
