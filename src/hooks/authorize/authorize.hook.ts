import { shouldSkip } from 'feathers-utils'

import { HOOKNAME, makeOptions } from './authorize.hook.utils.js'
import { authorizeAfter } from './authorize.hook.after.js'
import { authorizeBefore } from './authorize.hook.before.js'

import type { HookContext, NextFunction } from '@feathersjs/feathers'

import type { AuthorizeHookOptions } from '../../types.js'

export const authorize =
  <H extends HookContext = HookContext>(
    _options?: Partial<AuthorizeHookOptions>,
  ) =>
  async (context: H, next?: NextFunction) => {
    if (
      shouldSkip(HOOKNAME, context, _options) ||
      !context.params ||
      context.type === 'error'
    ) {
      return next ? await next() : context
    }

    const options = makeOptions(context.app, _options)

    // around hook
    if (next) {
      await authorizeBefore(context, options)
      await next()
      await authorizeAfter(context, options)
      return context
    }

    return context.type === 'before'
      ? await authorizeBefore(context, options)
      : await authorizeAfter(context, options)
  }
