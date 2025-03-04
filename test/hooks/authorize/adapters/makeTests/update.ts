import assert from 'node:assert'
import { feathers } from '@feathersjs/feathers'
import { defineAbility } from '@casl/ability'

import type { Application } from '@feathersjs/feathers'

import { authorize } from '../../../../../src/index.js'
import type { Adapter, AuthorizeHookOptions } from '../../../../../src/index.js'
import { resolveAction } from '../../../../test-utils.js'
import type { MakeTestsOptions } from './_makeTests.types.js'

export default (
  adapterName: Adapter | string,
  makeService: () => any,
  clean: (app, service) => Promise<void>,
  authorizeHookOptions: Partial<AuthorizeHookOptions>,
  { around, afterHooks }: MakeTestsOptions = { around: false, afterHooks: [] },
): void => {
  let app: Application
  let service
  let id

  const itSkip = (adapterToTest: string | string[]) => {
    const condition =
      typeof adapterToTest === 'string'
        ? adapterName === adapterToTest
        : adapterToTest.includes(adapterName)
    return condition ? it.skip : it
  }

  describe(`${adapterName}: beforeAndAfter - update`, function () {
    beforeEach(async function () {
      app = feathers()
      app.use('tests', makeService())
      service = app.service('tests')

      id = service.options.id

      const options = Object.assign(
        {
          availableFields: [
            id,
            'userId',
            'hi',
            'test',
            'published',
            'supersecret',
            'hidden',
          ],
        },
        authorizeHookOptions,
      )

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
          after: {
            all: afterHooks,
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

    it("can update one item and returns 'undefined' for not allowed read", async function () {
      const item = await service.create({ test: true, userId: 1 })

      const updatedItem = await service.update(
        item[id],
        { test: false, userId: 1 },
        {
          ability: defineAbility(
            (can) => {
              can('update', 'tests')
            },
            { resolveAction },
          ),
        },
      )

      assert.deepStrictEqual(
        updatedItem,
        undefined,
        'updated item is undefined',
      )

      const realItem = await service.get(item[id])
      assert.deepStrictEqual(
        realItem,
        { [id]: item[id], test: false, userId: 1 },
        'updated item correctly',
      )
    })

    it('can update one item and returns complete item', async function () {
      const item = await service.create({ test: true, userId: 1 })

      const readMethod = ['read', 'get']

      for (const read of readMethod) {
        const updatedItem = await service.update(
          item[id],
          { test: false, userId: 1 },
          {
            ability: defineAbility(
              (can) => {
                can('update', 'tests')
                can(read, 'tests')
              },
              { resolveAction },
            ),
          },
        )

        assert.deepStrictEqual(
          updatedItem,
          { [id]: item[id], test: false, userId: 1 },
          `updated item correctly for read: '${read}'`,
        )
      }
    })

    it('tests against original data, not updated data and rejects', async function () {
      const item = await service.create({ test: true, userId: 1 })

      const promise = service.update(
        item[id],
        { test: false, userId: 2 },
        {
          ability: defineAbility(
            (can, cannot) => {
              can('update', 'tests')
              cannot('update', 'tests', { userId: 1 })
            },
            { resolveAction },
          ),
        },
      )

      await assert.rejects(
        promise,
        (err: Error) => err.name === 'NotFound',
        'cannot update item',
      )
    })

    it.skip('tests against original data, not updated data and does not reject', async function () {
      const item = await service.create({ test: true, userId: 2 })

      const promise = service.update(
        item[id],
        { test: false, userId: 1 },
        {
          ability: defineAbility(
            (can, cannot) => {
              can('read', 'tests')
              can('update', 'tests')
              cannot('update', 'tests', { userId: 1 })
            },
            { resolveAction },
          ),
        },
      )

      await assert.doesNotReject(promise, 'can update item')
    })

    //TODO!
    it.skip('throws if update with restricted fields leads to empty update', async function () {
      const item = await service.create({ test: true, userId: 1 })

      const promise = service.update(
        item[id],
        { test: false, userId: 1 },
        {
          ability: defineAbility(
            (can, cannot) => {
              can('update', 'tests')
              cannot('update', 'tests', ['test'])
            },
            { resolveAction },
          ),
        },
      )

      await assert.rejects(
        promise,
        (err: Error) => err.name === 'Forbidden',
        'rejects request',
      )
    })

    it('assigns original data with updated data for restricted fields', async function () {
      const item = await service.create({ test: true, userId: 1 })

      const updatedItem = await service.update(
        item[id],
        { test: false, userId: 2 },
        {
          ability: defineAbility(
            (can) => {
              can('update', 'tests', ['test'], { userId: 1 })
              can('read', 'tests')
            },
            { resolveAction },
          ),
        },
      )

      const realItem = await service.get(item[id])
      const expected = { [id]: item[id], test: false, userId: 1 }

      assert.deepStrictEqual(realItem, expected, 'updated item correctly')
      assert.deepStrictEqual(
        updatedItem,
        realItem,
        'result of update is real item',
      )
    })

    it('throws if cannot update item but passes with other item', async function () {
      const item1 = await service.create({ test: true, userId: 1 })
      const item2 = await service.create({ test: true, userId: 2 })

      const promise = service.update(
        item1[id],
        { test: false, userId: 2 },
        {
          ability: defineAbility(
            (can, cannot) => {
              can('read', 'tests')
              can('update', 'tests')
              cannot('update', 'tests', { userId: 1 })
            },
            { resolveAction },
          ),
        },
      )

      await assert.rejects(
        promise,
        (err: Error) => err.name === 'NotFound',
        'cannot update item',
      )

      // TODO: Does not work with `userId: 1` for knex, memory, mongodb and nedb ?!
      const updatedItem2 = await service.update(
        item2[id],
        { test: false, userId: 3 },
        {
          ability: defineAbility(
            (can, cannot) => {
              can('read', 'tests')
              can('update', 'tests')
              cannot('update', 'tests', { userId: 1 })
            },
            { resolveAction },
          ),
        },
      )

      assert.deepStrictEqual(
        updatedItem2,
        { [id]: item2[id], test: false, userId: 3 },
        'updated item correctly',
      )
    })

    //TODO: skip weird feathers-knex bug
    itSkip('@feathersjs/knex')(
      "updates item and returns empty object for not overlapping '$select' and 'restricting fields'",
      async function () {
        let item = { test: true, userId: 1, supersecret: true, hidden: true }

        item = await service.create(item)

        const updatedItem = {
          [id]: item[id],
          test: false,
          userId: 1,
          supersecret: true,
          hidden: true,
        }

        const result = await service.update(item[id], updatedItem, {
          query: { $select: [id, 'supersecret', 'hidden'] },
          ability: defineAbility(
            (can) => {
              can('read', 'tests', ['test', 'userId'])
              can(['create', 'update'], 'tests')
            },
            { resolveAction },
          ),
        })
        assert.deepStrictEqual(
          result,
          {},
          'returned item is empty because of $select and restricting fields',
        )

        const itemInDb = await service.get(item[id])

        assert.deepStrictEqual(itemInDb, updatedItem, 'item in db is complete')
      },
    )
  })
}
