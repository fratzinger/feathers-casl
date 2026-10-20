import assert from 'node:assert'
import { feathers } from '@feathersjs/feathers'
import { defineAbility } from '@casl/ability'

import type { Application } from '@feathersjs/feathers'

import { authorize } from '../../../../../src/index.js'
import type { Adapter, AuthorizeHookOptions } from '../../../../../src/index.js'
import { resolveAction, sortBy } from '../../../../test-utils.js'
import type { MakeTestsOptions } from './_makeTests.types.js'

/**
 * Rule sets that allow nothing must never fall back to the unrestricted query:
 * a `remove(null)` would remove every record before any after-hook runs.
 */
const forbiddingRules: Record<string, (can: any, cannot: any) => void> = {
  'can with conditions, overruled by `cannot` with empty conditions': (
    can,
    cannot,
  ) => {
    can('manage', 'tests', { userId: 1 })
    cannot('manage', 'tests', {})
  },
  'can with conditions, overruled by `cannot` without conditions': (
    can,
    cannot,
  ) => {
    can('manage', 'tests', { userId: 1 })
    cannot('manage', 'tests')
  },
}

export default (
  adapterName: Adapter | string,
  makeService: () => any,
  clean: (app: Application, service: any) => Promise<void>,
  authorizeHookOptions: Partial<AuthorizeHookOptions>,
  { around, afterHooks }: MakeTestsOptions = { around: false, afterHooks: [] },
): void => {
  let app: Application
  let service: any
  let id: any

  describe(`${adapterName}: beforeAndAfter - forbidden`, function () {
    beforeEach(async function () {
      app = feathers()
      app.use('tests', makeService())
      service = app.service('tests')

      id = service.options.id

      const options = {
        availableFields: [
          id,
          'userId',
          'hi',
          'test',
          'published',
          'supersecret',
          'hidden',
        ],
        ...authorizeHookOptions,
      }

      afterHooks = Array.isArray(afterHooks)
        ? afterHooks
        : afterHooks
          ? [afterHooks]
          : []

      if (around) {
        service.hooks({
          around: {
            all: [authorize(options)],
          },
          before: {},
          after: {
            all: [...afterHooks],
          },
        })
      } else {
        service.hooks({
          before: {
            all: [authorize(options)],
          },
          after: {
            all: [...afterHooks, authorize(options)],
          },
        })
      }

      await clean(app, service)
    })

    for (const [name, rules] of Object.entries(forbiddingRules)) {
      describe(name, function () {
        const calls: Record<
          string,
          (item: any, params: Record<string, unknown>) => Promise<unknown>
        > = {
          find: (_item, params) => service.find(params),
          get: (item, params) => service.get(item[id], params),
          update: (item, params) =>
            service.update(item[id], { test: false, userId: 1 }, params),
          patch: (item, params) =>
            service.patch(item[id], { test: false }, params),
          'patch multi': (_item, params) =>
            service.patch(null, { test: false }, params),
          remove: (item, params) => service.remove(item[id], params),
          'remove multi': (_item, params) => service.remove(null, params),
        }

        for (const [method, call] of Object.entries(calls)) {
          it(`${method} is forbidden and changes nothing`, async function () {
            const item1 = await service.create({ test: true, userId: 1 })
            const item2 = await service.create({ test: true, userId: 2 })

            const ability = defineAbility(rules, { resolveAction })

            await assert.rejects(
              call(item1, { ability, paginate: false }),
              (err: Error) => err.name === 'Forbidden',
              `'${method}' throws Forbidden`,
            )

            const realItems = await service.find({ paginate: false })
            assert.deepStrictEqual(
              sortBy(realItems, id),
              sortBy([item1, item2], id),
              'no item changed',
            )
          })
        }
      })
    }
  })
}
