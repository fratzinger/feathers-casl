import { subject } from '@casl/ability'
import { throwUnlessCan } from '../hooks/authorize/authorize.hook.utils.js'

import { getFieldsForConditions } from './getFieldsForConditions.js'

import type { AnyAbility } from '@casl/ability'
import type { Id, Service } from '@feathersjs/feathers'
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

  let params
  if (options.useConditionalSelect) {
    const $select = getFieldsForConditions(ability, method, modelName)
    params = {
      query: { $select },
    }
  }

  //@ts-expect-error _get is not exposed
  const getMethod = service._get ? '_get' : 'get'

  // @ts-expect-error _get is not exposed
  const item = await service[getMethod](id, params)

  const can = throwUnlessCan(
    ability,
    method,
    subject(modelName, item),
    modelName,
    options,
  )

  return can
}
