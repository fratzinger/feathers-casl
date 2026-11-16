import { shouldSkip } from 'feathers-utils/predicates'

import { HOOKNAME, makeOptions } from './authorize.hook.utils.js'
import { authorizeAfter } from './authorize.hook.after.js'
import { authorizeBefore } from './authorize.hook.before.js'
import {
  mayResolveChannelRelations,
  resolveChannelRelations,
} from '../../channels/resolveChannelRelations.js'

import type { HookContext, NextFunction } from '@feathersjs/feathers'

import type { AuthorizeHookOptions } from '../../types.js'

export const authorize =
  <H extends HookContext = HookContext>(
    _options?: Partial<AuthorizeHookOptions>,
  ) =>
  async (context: H, next?: NextFunction) => {
    if (
      shouldSkip(HOOKNAME)(context) ||
      !context.params ||
      context.type === 'error'
    ) {
      return next ? await next() : context
    }

    const options = makeOptions(context.app, _options)

    // around hook; the write's events get its rows' answers to rules through relations
    if (next) {
      await authorizeBefore(context, options)
      if (mayResolveChannelRelations(context, 'before')) {
        await resolveChannelRelations(context)
      }
      await next()
      await authorizeAfter(context, options)
      if (mayResolveChannelRelations(context, 'after')) {
        await resolveChannelRelations(context)
      }
      return context
    }

    const phase = context.type === 'before' ? 'before' : 'after'
    const result =
      phase === 'before'
        ? await authorizeBefore(context, options)
        : await authorizeAfter(context, options)
    if (mayResolveChannelRelations(context, phase)) {
      await resolveChannelRelations(context)
    }
    return result
  }
