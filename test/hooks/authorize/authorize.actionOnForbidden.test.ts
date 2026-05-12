import assert from 'node:assert'
import { feathers } from '@feathersjs/feathers'
import { MemoryService } from '@feathersjs/memory'
import { defineAbility } from '@casl/ability'

import type { Application } from '@feathersjs/feathers'

import { authorize } from '../../../src/index.js'
import { resolveAction } from '../../test-utils.js'

const availableFields = [
  'id',
  'userId',
  'hi',
  'test',
  'published',
  'supersecret',
  'hidden',
]

const mockApp = (actionOnForbidden?: () => void) => {
  const app = feathers() as Application
  app.use(
    'tests',
    new MemoryService({
      multi: true,
      paginate: { default: 10, max: 50 },
    }),
  )
  const service = app.service('tests')
  const options = { availableFields, actionOnForbidden }
  service.hooks({
    before: { all: [authorize(options)] },
    after: { all: [authorize(options)] },
  })
  return service
}

describe('authorize hook - actionOnForbidden', function () {
  it('calls actionOnForbidden when $select and restricted fields do not overlap (after-hook, get)', async function () {
    let called = false
    const service = mockApp(() => {
      called = true
    })

    const item = await service.create({
      test: true,
      userId: 1,
      supersecret: true,
      hidden: true,
    })

    await assert.rejects(
      service.get(item.id, {
        query: { $select: ['id', 'supersecret', 'hidden'] },
        ability: defineAbility(
          (can) => {
            can('read', 'tests', ['test', 'userId'])
          },
          { resolveAction },
        ),
      }),
      (err: Error) => err.name === 'Forbidden',
    )

    assert.ok(called, 'actionOnForbidden was called')
  })

  it('calls actionOnForbidden when single patch has all fields restricted (before-hook)', async function () {
    let called = false
    const service = mockApp(() => {
      called = true
    })

    const item = await service.create({ test: true, userId: 1 })

    // conflicting field rules -> hasRestrictingFields returns `true` -> throw in handleSingle
    await assert.rejects(
      service.patch(
        item.id,
        { test: false },
        {
          ability: defineAbility(
            (can) => {
              can('manage', 'all', ['id'])
              can('manage', 'all', ['test'])
            },
            { resolveAction },
          ),
        },
      ),
      (err: Error) => err.name === 'Forbidden',
    )

    assert.ok(called, 'actionOnForbidden was called')
  })

  it('calls actionOnForbidden when patch data is empty after picking restricted fields', async function () {
    let called = false
    const service = mockApp(() => {
      called = true
    })

    const item = await service.create({ test: true, userId: 1 })

    await assert.rejects(
      service.patch(
        item.id,
        { userId: 2 },
        {
          ability: defineAbility(
            (can, cannot) => {
              can('patch', 'tests')
              cannot('patch', 'tests', ['userId'])
            },
            { resolveAction },
          ),
        },
      ),
      (err: Error) => err.name === 'Forbidden',
    )

    assert.ok(called, 'actionOnForbidden was called')
  })

  it('calls actionOnForbidden when multi-patch has all fields restricted', async function () {
    let called = false
    const service = mockApp(() => {
      called = true
    })

    await service.create({ test: true, userId: 1 })

    // can + cannot on same field -> permittedFieldsOf returns [] -> fields === true
    await assert.rejects(
      service.patch(
        null,
        { test: false },
        {
          query: {},
          ability: defineAbility(
            (can, cannot) => {
              can('patch', 'tests', ['userId'])
              cannot('patch', 'tests', ['userId'])
            },
            { resolveAction },
          ),
        },
      ),
      (err: Error) => err.name === 'Forbidden',
    )

    assert.ok(called, 'actionOnForbidden was called')
  })

  it('throws Forbidden without actionOnForbidden when single patch has all fields restricted', async function () {
    const service = mockApp()
    const item = await service.create({ test: true, userId: 1 })

    // pass ability as a function to also cover the function-ability branch in getAbility
    await assert.rejects(
      service.patch(
        item.id,
        { test: false },
        {
          ability: () =>
            defineAbility(
              (can) => {
                can('manage', 'all', ['id'])
                can('manage', 'all', ['test'])
              },
              { resolveAction },
            ),
        },
      ),
      (err: Error) => err.name === 'Forbidden',
    )
  })

  it('throws Forbidden without actionOnForbidden when multi-patch has all fields restricted', async function () {
    const service = mockApp()
    await service.create({ test: true, userId: 1 })

    await assert.rejects(
      service.patch(
        null,
        { test: false },
        {
          query: {},
          ability: defineAbility(
            (can, cannot) => {
              can('patch', 'tests', ['userId'])
              cannot('patch', 'tests', ['userId'])
            },
            { resolveAction },
          ),
        },
      ),
      (err: Error) => err.name === 'Forbidden',
    )
  })
})
