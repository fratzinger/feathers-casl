import { subject } from '@casl/ability'
import _pick from 'lodash/pick.js'
import _isEmpty from 'lodash/isEmpty.js'

import { getResultIsArray, mutateResult } from 'feathers-utils'
import { shouldSkip, mergeArrays } from '@fratzinger/feathers-utils'

import {
  getPersistedConfig,
  getAbility,
  makeOptions,
  getConditionalSelect,
  refetchItems,
  HOOKNAME,
} from './authorize.hook.utils.js'

import {
  getAvailableFields,
  hasRestrictingFields,
  getModelName,
} from '../../utils/index.js'

import { Forbidden } from '@feathersjs/errors'

import type { HookContext } from '@feathersjs/feathers'
import type {
  AuthorizeHookOptions,
  HasRestrictingFieldsOptions,
} from '../../types.js'
import { getMethodName } from '../../utils/getMethodName.js'

export const authorizeAfter = async <H extends HookContext = HookContext>(
  context: H,
  options: AuthorizeHookOptions,
) => {
  if (shouldSkip(HOOKNAME, context, options) || !context.params) {
    return context
  }

  // eslint-disable-next-line prefer-const
  let { isArray, result: items } = getResultIsArray(context)
  if (!items.length) {
    return context
  }

  options = makeOptions(context.app, options)

  const modelName = getModelName(options.modelName, context)
  if (!modelName) {
    return context
  }

  const skipCheckConditions = getPersistedConfig(
    context,
    'skipRestrictingRead.conditions',
  )
  const skipCheckFields = getPersistedConfig(
    context,
    'skipRestrictingRead.fields',
  )

  if (skipCheckConditions && skipCheckFields) {
    return context
  }

  const { params } = context

  params.ability = await getAbility(context, options)
  if (!params.ability) {
    // Ignore internal or not authenticated requests
    return context
  }

  const { ability } = params

  const availableFields = getAvailableFields(context, options)

  const hasRestrictingFieldsOptions: HasRestrictingFieldsOptions = {
    availableFields: availableFields,
  }

  const getOrFind = isArray ? 'find' : 'get'

  const $select: string[] | undefined = params.query?.$select

  const method = getMethodName(context, options)

  if (method !== 'remove') {
    const $newSelect = getConditionalSelect(
      $select,
      ability,
      getOrFind,
      modelName,
    )
    if ($newSelect) {
      const _items = await refetchItems(context)
      if (_items) {
        items = _items as typeof items
      }
    }
  }

  const pickFieldsForItem = (item: Record<string, unknown>) => {
    if (
      !skipCheckConditions &&
      !ability.can(getOrFind, subject(modelName, item))
    ) {
      return undefined
    }

    const restrictingFields = hasRestrictingFields(
      ability,
      getOrFind,
      subject(modelName, item),
      hasRestrictingFieldsOptions,
    )

    if (restrictingFields === true) {
      // full restriction
      return {}
    } else if (skipCheckFields || (!restrictingFields && !$select)) {
      // no restrictions
      return item
    }

    const pickFields: string[] =
      restrictingFields && $select
        ? (mergeArrays(restrictingFields, $select, 'intersect') as string[])
        : ((restrictingFields || $select) as string[])

    return _pick(item, pickFields)
  }

  const newResult = isArray
    ? items
        .map(pickFieldsForItem)
        .filter((x): x is Record<string, unknown> => !!x)
    : [pickFieldsForItem(items[0])]

  if (!isArray && method === 'get' && _isEmpty(newResult[0])) {
    if (options.actionOnForbidden) options.actionOnForbidden()
    if (options.debug) {
      console.error(
        'Feathers-CASL: authorizeAfter hook - all fields are restricted for this action',
        method,
        modelName,
        items[0],
      )
    }
    throw new Forbidden(`You're not allowed to ${method} ${modelName}`)
  }

  await mutateResult(context, (item) => item, {
    transform: () => newResult as any[],
  })

  return context
}
