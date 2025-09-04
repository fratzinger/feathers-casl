import { shouldSkip } from '@fratzinger/feathers-utils'

import type { HookContext } from '@feathersjs/feathers'
import type { CheckBasicPermissionHookOptions } from '../types.js'
import { checkBasicPermissionUtil } from '../utils/index.js'

const HOOKNAME = 'checkBasicPermission'

export const checkBasicPermission = <H extends HookContext>(
  _options?: Partial<CheckBasicPermissionHookOptions>,
): ((context: H) => Promise<H>) => {
  return async (context: H): Promise<H> => {
    if (
      !_options?.notSkippable &&
      (shouldSkip(HOOKNAME, context) ||
        context.type !== 'before' ||
        !context.params)
    ) {
      return context
    }

    return await checkBasicPermissionUtil(context, _options)
  }
}
