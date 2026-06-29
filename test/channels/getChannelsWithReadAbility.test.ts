import assert from 'node:assert'
import { Channel } from '@feathersjs/transport-commons'
import { defineAbility } from '@casl/ability'

import { getChannelsWithReadAbility } from '../../src/index.js'

const context = (overrides: Record<string, unknown> = {}) =>
  ({ path: 'tests', method: 'create', ...overrides }) as any

const makeApp = (overrides: Record<string, unknown> = {}) =>
  ({
    get: () => undefined,
    channels: [],
    channel: () => new Channel(),
    ...overrides,
  }) as any

describe('getChannelsWithReadAbility', function () {
  it('returns undefined when there are no channels at all', function () {
    const result = getChannelsWithReadAbility(makeApp(), {}, context(), {})
    assert.strictEqual(result, undefined)
  })

  describe('not activated / no modelName', function () {
    it('returns the channelOnError channel when deactivated', function () {
      const onError = new Channel()
      const app = makeApp({ channel: () => onError })
      const result = getChannelsWithReadAbility(app, {}, context(), {
        channels: new Channel([]),
        activated: false,
      })
      assert.strictEqual(result, onError)
    })

    it('returns an empty Channel when channelOnError is falsy', function () {
      const result = getChannelsWithReadAbility(makeApp(), {}, context(), {
        channels: new Channel([]),
        activated: false,
        channelOnError: false as any,
      })
      assert.ok(result instanceof Channel)
      assert.strictEqual((result as Channel).connections.length, 0)
    })
  })

  describe('restrictFields: false (full data for everyone allowed)', function () {
    it('keeps only connections whose ability can read the data', function () {
      const allow = defineAbility((can) => {
        can('get', 'tests')
      })
      const deny = defineAbility(() => {})
      const connAllow = { ability: allow } as any
      const connDeny = { ability: deny } as any

      const result = getChannelsWithReadAbility(
        makeApp(),
        { id: 1 },
        context(),
        {
          channels: new Channel([connAllow, connDeny]),
          restrictFields: false,
        },
      ) as Channel

      assert.ok(result instanceof Channel)
      assert.deepStrictEqual(result.connections, [connAllow])
    })
  })

  describe('restrictFields: true', function () {
    const availableFields = ['id', 'title', 'secret']

    it('drops connections with a full field restriction', function () {
      // can read the record, but no readable fields remain -> full restriction
      const ability = defineAbility((can) => {
        can('get', 'tests', ['nope'])
      })
      const conn = { ability } as any

      const result = getChannelsWithReadAbility(
        makeApp(),
        { id: 1, title: 't', secret: 's' },
        context(),
        {
          channels: new Channel([conn]),
          availableFields,
        },
      )

      assert.deepStrictEqual(result, [])
    })

    it('dedupes the same connection appearing in multiple channels', function () {
      const ability = defineAbility((can) => {
        can('get', 'tests', ['title'])
      })
      const conn = { ability } as any

      const result = getChannelsWithReadAbility(
        makeApp(),
        { id: 1, title: 't', secret: 's' },
        context({ service: { options: { id: 'id' } } }),
        {
          channels: [new Channel([conn]), new Channel([conn])],
          availableFields,
        },
      ) as Channel

      assert.ok(result instanceof Channel)
      assert.deepStrictEqual(result.connections, [conn])
      // id is always kept, plus the single restricted field
      assert.deepStrictEqual(result.data, { id: 1, title: 't' })
    })
  })
})
