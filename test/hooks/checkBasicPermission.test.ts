import assert from 'node:assert'
import { defineAbility } from '@casl/ability'
import { checkBasicPermission } from '../../src'
import type { HookContext } from '@feathersjs/feathers'
import { markHookForSkip } from '@fratzinger/feathers-utils'
import { resolveAction } from '../test-utils'

describe('checkBasicPermission.test.ts', function () {
  describe('general', function () {
    it('passes if no ability', async function () {
      const makeContext = (method: string, type: string): HookContext => {
        return {
          service: {
            modelName: 'Test',
          },
          path: 'tests',
          method,
          type,
          data: {
            id: 1,
            userId: 1,
            test: true,
          },
          params: {
            query: {},
          },
        } as unknown as HookContext
      }

      const types = ['before']
      const methods = ['find', 'get', 'create', 'update', 'patch', 'remove']
      const promises: Promise<any>[] = []
      types.forEach((type) => {
        methods.forEach((method) => {
          const context = makeContext(method, type)
          const query = Object.assign({}, context.params.query)
          const promise = checkBasicPermission()(context).then((result) => {
            assert.deepStrictEqual(
              result.params.query,
              query,
              `'${type}:${method}': does not change query object`,
            )
          })
          promises.push(promise)
        })
      })
      await Promise.all(promises)
    })

    it('throws forbidden for no permissions', async function () {
      const makeContext = (method = 'find', type = 'before') => {
        return {
          service: {
            modelName: 'Test',
            get(id) {
              return { id, userId: 1 }
            },
          },
          path: 'tests',
          method,
          type,
          id: 1,
          data: {
            id: 1,
            userId: 1,
            test: true,
          },
          params: {
            ability: defineAbility(() => {}, { resolveAction }),
            query: {},
          },
        } as unknown as HookContext
      }

      const types = ['before']
      const methods = ['find', 'get', 'create', 'update', 'patch', 'remove']
      const promises: Promise<any>[] = []
      types.forEach((type) => {
        methods.forEach((method) => {
          const context = makeContext(method, type)
          const promise = assert.rejects(
            checkBasicPermission()(context),
            (err: Error) => err.name === 'Forbidden',
            `'${type}:${method}': with no permissions returns 'Forbidden' error`,
          )
          promises.push(promise)
        })
      })
      await Promise.all(promises)
    })

    it("passes for 'manage' 'all' permission", async function () {
      const makeContext = (method, type) => {
        return {
          service: {
            modelName: 'Test',
          },
          path: 'tests',
          method,
          type,
          data: {
            id: 1,
            userId: 1,
            test: true,
          },
          params: {
            ability: defineAbility(
              (can) => {
                can('manage', 'all')
              },
              { resolveAction },
            ),
            query: {},
          },
        } as unknown as HookContext
      }

      const types = ['before']
      const methods = ['find', 'get', 'create', 'update', 'patch', 'remove']
      const promises: Promise<any>[] = []
      types.forEach((type) => {
        methods.forEach((method) => {
          const context = makeContext(method, type)
          const query = Object.assign({}, context.params.query)
          const promise = checkBasicPermission()(context).then((result) => {
            assert.deepStrictEqual(
              result.params.query,
              query,
              'does not change query object',
            )
          })
          promises.push(promise)
        })
      })
      await Promise.all(promises)
    })

    it('passes for general individual permission', async function () {
      const makeContext = (method, type) => {
        const path = 'tests'
        return {
          service: {
            modelName: 'Test',
          },
          path: 'tests',
          method,
          type,
          data: {
            id: 1,
            userId: 1,
            test: true,
          },
          params: {
            ability: defineAbility(
              (can) => {
                can(method, path)
              },
              { resolveAction },
            ),
            query: {},
          },
        } as unknown as HookContext
      }

      const types = ['before']
      const methods = ['find', 'get', 'create', 'update', 'patch', 'remove']
      const promises: Promise<any>[] = []
      types.forEach((type) => {
        methods.forEach((method) => {
          const context = makeContext(method, type)
          const query = Object.assign({}, context.params.query)
          const promise = checkBasicPermission()(context).then((result) => {
            assert.deepStrictEqual(
              result.params.query,
              query,
              'does not change query object',
            )
          })
          promises.push(promise)
        })
      })
      await Promise.all(promises)
    })

    it('passes if skip', async function () {
      const makeContext = (method: string, type: string): HookContext => {
        const context = {
          service: {
            modelName: 'Test',
          },
          path: 'tests',
          method,
          type,
          data: {
            id: 1,
            userId: 1,
            test: true,
          },
          params: {
            ability: defineAbility(() => {}, { resolveAction }),
            skipHooks: ['checkBasicPermission'],
            query: {},
          },
        } as unknown as HookContext
        markHookForSkip('checkBasicPermission', 'all', context)
        return context
      }

      const types = ['before']
      const methods = ['find', 'get', 'create', 'update', 'patch', 'remove']
      const promises: Promise<any>[] = []
      types.forEach((type) => {
        methods.forEach((method) => {
          const context = makeContext(method, type)
          const query = Object.assign({}, context.params.query)
          const promise = checkBasicPermission()(context).then((result) => {
            assert.deepStrictEqual(
              result.params.query,
              query,
              `'${type}:${method}': does not change query object`,
            )
          })
          promises.push(promise)
        })
      })
      await Promise.all(promises)
    })
  })

  describe('create', function () {
    it("'create:single' passes which should not fail", async function () {
      const context = {
        service: {
          modelName: 'Test',
        },
        path: 'tests',
        method: 'create',
        type: 'before',
        data: {
          id: 1,
          userId: 1,
          test: true,
        },
        params: {
          ability: defineAbility(
            (can) => {
              can('create', 'tests', { userId: 2 })
            },
            { resolveAction },
          ),
          query: {},
        },
      } as unknown as HookContext

      await assert.doesNotReject(
        checkBasicPermission()(context),
        'passes checkBasicPermission hook',
      )
    })

    it("'create:multi' passes which should not fail", async function () {
      const context = {
        service: {
          modelName: 'Test',
        },
        path: 'tests',
        method: 'create',
        type: 'before',
        data: [
          {
            id: 1,
            userId: 2,
            test: true,
          },
          {
            id: 2,
            userId: 2,
            test: true,
          },
          {
            id: 3,
            userId: 2,
            test: true,
          },
        ],
        params: {
          ability: defineAbility(
            (can) => {
              can('create', 'tests', { userId: 1 })
            },
            { resolveAction },
          ),
          query: {},
        },
      } as unknown as HookContext

      await assert.doesNotReject(
        checkBasicPermission()(context),
        'passes checkBasicPermission hook',
      )
    })

    it("'create:multi' fails with 'checkMultiActions: true'", async function () {
      const context = {
        service: {
          modelName: 'Test',
        },
        path: 'tests',
        method: 'create',
        type: 'before',
        data: [
          {
            id: 1,
            userId: 1,
            test: true,
          },
          {
            id: 2,
            userId: 1,
            test: true,
          },
          {
            id: 3,
            userId: 1,
            test: true,
          },
        ],
        params: {
          ability: defineAbility(
            (can) => {
              can('create', 'tests', { userId: 1 })
            },
            { resolveAction },
          ),
          query: {},
        },
      } as unknown as HookContext

      await assert.rejects(
        checkBasicPermission({ checkMultiActions: true })(context),
        'checkBasicPermission hook rejects',
      )
    })

    it("'create:single' fails which should fail - with 'checkCreateForData: true'", async function () {
      const context = {
        service: {
          modelName: 'Test',
        },
        path: 'tests',
        method: 'create',
        type: 'before',
        data: {
          id: 1,
          userId: 2,
          test: true,
        },
        params: {
          ability: defineAbility(
            (can) => {
              can('create', 'tests', { userId: 1 })
            },
            { resolveAction },
          ),
          query: {},
        },
      } as unknown as HookContext

      await assert.rejects(
        checkBasicPermission({ checkCreateForData: true })(context),
        (err: Error) => err.name === 'Forbidden',
        "rejects with 'Forbidden' error",
      )
    })

    it("'create:multi' fails which should fail - with 'checkCreateForData: true'", async function () {
      const context = {
        service: {
          modelName: 'Test',
        },
        path: 'tests',
        method: 'create',
        type: 'before',
        data: [
          {
            id: 1,
            userId: 1,
            test: true,
          },
          {
            id: 1,
            userId: 2,
            test: true,
          },
          {
            id: 1,
            userId: 1,
            test: true,
          },
        ],
        params: {
          ability: defineAbility(
            (can) => {
              can('create', 'tests', { userId: 1 })
            },
            { resolveAction },
          ),
          query: {},
        },
      } as unknown as HookContext

      await assert.rejects(
        checkBasicPermission({ checkCreateForData: true })(context),
        (err: Error) => err.name === 'Forbidden',
        "rejects with 'Forbidden' error",
      )
    })

    it("'create:single' passes which should fail - with 'checkCreateForData: false'", async function () {
      const context = {
        service: {
          modelName: 'Test',
        },
        path: 'tests',
        method: 'create',
        type: 'before',
        data: {
          id: 1,
          userId: 2,
          test: true,
        },
        params: {
          ability: defineAbility(
            (can) => {
              can('create', 'tests', { userId: 1 })
            },
            { resolveAction },
          ),
          query: {},
        },
      } as unknown as HookContext

      await assert.doesNotReject(
        checkBasicPermission({ checkCreateForData: false })(context),
        (err: Error) => err.name === 'Forbidden',
        'does not reject',
      )
    })

    it("'create:multi' passes which should fail - with 'checkCreateForData: false'", async function () {
      const context = {
        service: {
          modelName: 'Test',
        },
        path: 'tests',
        method: 'create',
        type: 'before',
        data: [
          {
            id: 1,
            userId: 1,
            test: true,
          },
          {
            id: 1,
            userId: 2,
            test: true,
          },
          {
            id: 1,
            userId: 1,
            test: true,
          },
        ],
        params: {
          ability: defineAbility(
            (can) => {
              can('create', 'tests', { userId: 1 })
            },
            { resolveAction },
          ),
          query: {},
        },
      } as unknown as HookContext

      await assert.doesNotReject(
        checkBasicPermission({ checkCreateForData: false })(context),
        (err: Error) => err.name === 'Forbidden',
        'does not reject',
      )
    })
  })

  describe('patch', function () {
    it("'patch:multi' passes with 'patch-multi' and 'checkMultiActions: true'", async function () {
      const context = {
        service: {
          modelName: 'Test',
        },
        path: 'tests',
        method: 'patch',
        type: 'before',
        id: null,
        data: { id: 1 },
        params: {
          ability: defineAbility(
            (can) => {
              can('patch-multi', 'tests')
            },
            { resolveAction },
          ),
          query: {},
        },
      } as unknown as HookContext

      await assert.rejects(
        checkBasicPermission({ checkMultiActions: true })(context),
        'checkBasicPermission rejects',
      )
    })

    it("'patch:multi' fails with 'checkMultiActions: true'", async function () {
      const context = {
        service: {
          modelName: 'Test',
        },
        path: 'tests',
        method: 'patch',
        type: 'before',
        id: null,
        data: { id: 1 },
        params: {
          ability: defineAbility(
            (can) => {
              can('patch', 'tests')
            },
            { resolveAction },
          ),
          query: {},
        },
      } as unknown as HookContext

      await assert.rejects(
        checkBasicPermission({ checkMultiActions: true })(context),
        'checkBasicPermission rejects',
      )
    })
  })

  describe('remove', function () {
    it("'remove:multi' passes with 'remove-multi' and 'checkMultiActions: true'", async function () {
      const context = {
        service: {
          modelName: 'Test',
        },
        path: 'tests',
        method: 'remove',
        type: 'before',
        id: null,
        params: {
          ability: defineAbility(
            (can) => {
              can('remove-multi', 'tests')
            },
            { resolveAction },
          ),
          query: {},
        },
      } as unknown as HookContext

      await assert.rejects(
        checkBasicPermission({ checkMultiActions: true })(context),
        'checkBasicPermission rejects',
      )
    })

    it("'remove:multi' fails with 'checkMultiActions: true'", async function () {
      const context = {
        service: {
          modelName: 'Test',
        },
        path: 'tests',
        method: 'remove',
        type: 'before',
        id: null,
        params: {
          ability: defineAbility(
            (can) => {
              can('remove', 'tests')
            },
            { resolveAction },
          ),
          query: {},
        },
      } as unknown as HookContext

      await assert.rejects(
        checkBasicPermission({ checkMultiActions: true })(context),
        'checkBasicPermission rejects',
      )
    })
  })
})
