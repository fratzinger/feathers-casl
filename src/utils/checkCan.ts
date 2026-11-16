import { subject } from '@casl/ability'
import { throwUnlessCan } from '../hooks/authorize/authorize.hook.utils.js'

import { getFieldsForConditions } from './getFieldsForConditions.js'
import {
  getRelations,
  isRelationPath,
  mayResolveRelations,
  resolveRelationsOfItems,
} from './relations.js'

import type { AnyAbility } from '@casl/ability'
import type { HookContext, Id, Service } from '@feathersjs/feathers'
import type { UtilCheckCanOptions } from '../types.js'

const makeOptions = (
  providedOptions?: Partial<UtilCheckCanOptions>,
): UtilCheckCanOptions => {
  return {
    actionOnForbidden: () => {},
    checkGeneral: true,
    skipThrow: false,
    useConditionalSelect: true,
    ...providedOptions,
  }
}

export const checkCan = async <S>(
  ability: AnyAbility,
  id: Id,
  method: string,
  modelName: string,
  service: Service<S>,
  providedOptions?: Partial<UtilCheckCanOptions>,
): Promise<boolean> => {
  const options = makeOptions(providedOptions)
  if (options.checkGeneral) {
    const can = throwUnlessCan(ability, method, modelName, modelName, options)
    if (!can) {
      return false
    }
  }

  const relations = getRelations(service)
  let params
  if (options.useConditionalSelect) {
    // a condition through a relation is the database's to answer, not a field of the row
    const $select = getFieldsForConditions(ability, method, modelName).filter(
      (field) => !isRelationPath(field, relations),
    )
    params = {
      query: { $select },
    }
  }

  //@ts-expect-error _get is not exposed
  const getMethod = service._get ? '_get' : 'get'

  // @ts-expect-error _get is not exposed
  const item = await service[getMethod](id, params)

  const context = { service, params: {} } as unknown as HookContext
  const itemAbility = mayResolveRelations(service, ability)
    ? await resolveRelationsOfItems(context, ability, [method], modelName, [
        item,
      ])
    : ability

  const can = throwUnlessCan(
    itemAbility,
    method,
    subject(modelName, item),
    modelName,
    options,
  )

  return can
}
