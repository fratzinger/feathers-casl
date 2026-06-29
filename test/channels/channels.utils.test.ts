import assert from 'node:assert'
import {
  getAbility,
  getEventName,
  makeChannelOptions,
  makeDefaultOptions,
} from '../../src/index.js'

describe('channels.utils.test.ts', function () {
  it('defaultOptions', function () {
    const options = makeDefaultOptions()

    assert.strictEqual(options.activated, true, 'is activated by default')
    assert.deepStrictEqual(
      options.channelOnError,
      ['authenticated'],
      "returns 'authenticated' by default",
    )
    assert.strictEqual(
      options.restrictFields,
      true,
      'restrict Fields by default',
    )
    assert.strictEqual(
      options.useActionName,
      'get',
      'use native eventName by default',
    )
  })

  it('default ability resolves to the connection ability', function () {
    const { ability } = makeDefaultOptions()
    const connection = { ability: 'connection-ability' } as any
    assert.strictEqual(ability({} as any, connection), 'connection-ability')
  })

  it('getEventName', function () {
    assert.strictEqual(getEventName('find'), undefined, 'no event for find')
    assert.strictEqual(getEventName('get'), undefined, 'no event for find')
    assert.strictEqual(getEventName('create'), 'created', 'no event for find')
    assert.strictEqual(getEventName('update'), 'updated', 'no event for find')
    assert.strictEqual(getEventName('patch'), 'patched', 'no event for find')
    assert.strictEqual(getEventName('remove'), 'removed', 'no event for find')
  })

  describe('makeChannelOptions', function () {
    it('merges app-level casl channel options over the defaults', function () {
      const app = {
        get: () => ({ channels: { useActionName: 'find', activated: false } }),
      } as any
      const options = makeChannelOptions(app)
      assert.strictEqual(options.useActionName, 'find')
      assert.strictEqual(options.activated, false)
      // untouched defaults remain
      assert.strictEqual(options.restrictFields, true)
    })

    it('falls back to the defaults when the app has no casl channel options', function () {
      const app = { get: () => undefined } as any
      const options = makeChannelOptions(app, { useActionName: 'patch' })
      assert.strictEqual(options.useActionName, 'patch')
      assert.strictEqual(options.activated, true)
    })
  })

  describe('getAbility', function () {
    const app = {} as any
    const context = {} as any
    const data = {}

    it('calls a function ability with app, connection, data and context', function () {
      const connection = { id: 'conn' } as any
      const args: any[] = []
      const ability = getAbility(app, data, connection, context, {
        ability: (...a: any[]) => {
          args.push(...a)
          return 'fn-ability' as any
        },
      })
      assert.strictEqual(ability, 'fn-ability')
      assert.deepStrictEqual(args, [app, connection, data, context])
    })

    it('returns a static (non-function) ability as-is', function () {
      const ability = getAbility(app, data, {} as any, context, {
        ability: 'static-ability' as any,
      })
      assert.strictEqual(ability, 'static-ability')
    })

    it('falls back to the connection ability when no option is set', function () {
      const connection = { ability: 'conn-ability' } as any
      const ability = getAbility(app, data, connection, context, {})
      assert.strictEqual(ability, 'conn-ability')
    })
  })
})
