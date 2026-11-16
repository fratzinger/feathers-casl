import { defineAbility } from '@casl/ability'
import { getChannelsWithReadAbility } from '../../src/index.js'
import { resolveAction } from '../test-utils.js'
import { setup } from './setup.js'

import type { Application } from '@feathersjs/feathers'

/**
 * Events of a row to the connections whose ability may read it through a relation, as Feathers
 * publishes them. Channels stay synchronous: `authorize` asks the database for the write,
 * `getChannelsWithReadAbility` answers by that.
 */
const ability = (define: Parameters<typeof defineAbility>[0]) =>
  defineAbility(define, { resolveAction })

type Define = Parameters<typeof ability>[0]
type Tables = Awaited<ReturnType<typeof setup>>

/** What an event reached: the connections by name, each with the data it got. */
type Published = { event: string; to: Record<string, unknown> }

/**
 * The albums service, its events published to `connections` (name -> rules), and what they
 * reach. A connection joins `join(name)`; `channels`: the app's, per event's data.
 */
async function withEvents(
  connections: Record<string, Define>,
  {
    authorized = true,
    restrictFields = false,
    debug = false,
    join = (_name: string, _tables: Tables) => 'everyone',
    channels,
  }: {
    authorized?: boolean
    restrictFields?: boolean
    debug?: boolean
    join?: (name: string, tables: Tables) => string
    channels?: (app: Application) => (data: any) => any
  } = {},
) {
  const tables = await setup(
    {},
    { prefix: 'casl_rel_ch', channels: true, authorized },
  )
  const { app } = tables
  const service = app.service('albums')
  if (channels) app.set('casl', { channels: { channels: channels(app) } })

  const nameOf = new Map<unknown, string>()
  for (const [name, define] of Object.entries(connections)) {
    const connection = { ability: ability(define) }
    nameOf.set(connection, name)
    app.channel(join(name, tables)).join(connection)
  }
  service.publish((data: any, context: any) =>
    getChannelsWithReadAbility(app, data, context, { restrictFields, debug }),
  )

  const published: Published[] = []
  app.on('publish', (event: string, channel: any) => {
    const to: Record<string, unknown> = {}
    for (const connection of channel.connections) {
      to[nameOf.get(connection)!] = channel.dataFor(connection)
    }
    published.push({ event, to })
  })
  // events go out once the method returned
  const settled = () => new Promise((resolve) => setTimeout(resolve, 20))

  return { ...tables, service, published, settled }
}

const toBlink: Define = (can) =>
  can('get', 'albums', { 'artist.name': 'Blink182' })
const toSum41: Define = (can) =>
  can('get', 'albums', { 'artist.name': 'Sum 41' })

const reached = (published: Published[]) =>
  published.map(({ event, to }) => [event, Object.keys(to).sort()])

describe('feathers-kysely: events through relations', () => {
  describe('answered by authorize for the write', () => {
    it('to the connections that may read the row through a relation', async () => {
      const { service, albumsOf, artists, published, settled } =
        await withEvents({ blink: toBlink, sum41: toSum41 })
      const [enema] = albumsOf(artists.blink182)

      await service.patch(enema.id, { stars: 1 })
      await settled()
      expect(reached(published)).toEqual([['patched', ['blink']]])
    })

    it('with the fields of the rule it matches through a relation', async () => {
      const { service, albumsOf, artists, published, settled } =
        await withEvents(
          {
            names: (can) =>
              can('get', 'albums', ['id', 'name'], {
                'artist.name': 'Blink182',
              }),
          },
          { restrictFields: true },
        )
      const [enema] = albumsOf(artists.blink182)

      await service.patch(enema.id, { stars: 1 })
      await settled()
      expect(published).toEqual([
        {
          event: 'patched',
          to: { names: { id: enema.id, name: 'Enema of the State' } },
        },
      ])
    })

    it('not to a connection an inverted rule through a relation keeps it from', async () => {
      const { service, albumsOf, artists, published, settled } =
        await withEvents({
          all: (can) => can('get', 'albums'),
          notBlink: (can, cannot) => {
            can('get', 'albums')
            cannot('get', 'albums', { 'artist.name': 'Blink182' })
          },
        })
      const [enema] = albumsOf(artists.blink182)
      const [killer] = albumsOf(artists.sum41)

      await service.patch(enema.id, { stars: 1 })
      await service.patch(killer.id, { stars: 1 })
      await settled()
      expect(reached(published)).toEqual([
        ['patched', ['all']],
        ['patched', ['all', 'notBlink']],
      ])
    })

    it('per user, through a has-many: the artists they are a member of', async () => {
      const ofMember: (userId: number) => Define = (userId) => (can) =>
        can('get', 'albums', { 'artist.members': { $some: { userId } } })
      const { service, albumsOf, artists, published, settled } =
        await withEvents({ member: ofMember(1), stranger: ofMember(2) })
      const [enema] = albumsOf(artists.blink182)

      await service.patch(enema.id, { stars: 1 })
      await settled()
      expect(reached(published)).toEqual([['patched', ['member']]])
    })

    it('a create, and a remove asked before its rows went', async () => {
      const { service, artists, published, settled } = await withEvents({
        blink: toBlink,
        sum41: toSum41,
      })

      const created = await service.create({
        name: 'Neighborhoods',
        artistId: artists.blink182.id,
      })
      await service.remove(created.id)
      await settled()
      expect(reached(published)).toEqual([
        ['created', ['blink']],
        ['removed', ['blink']],
      ])
    })
  })

  describe('what it asks', () => {
    /** The queries a write makes for its events: beyond the same without `authorize`. */
    async function queriesFor(
      write: (
        events: Awaited<ReturnType<typeof withEvents>>,
      ) => Promise<unknown>,
      ...args: Parameters<typeof withEvents>
    ) {
      const count = async (authorized: boolean) => {
        const events = await withEvents(args[0], { ...args[1], authorized })
        const finds = vi.spyOn(events.service as any, '_find')
        await write(events)
        await events.settled()
        return { calls: finds.mock.calls.length, published: events.published }
      }
      const without = await count(false)
      const { calls, published } = await count(true)
      return { extra: calls - without.calls, published }
    }

    it('a multi patch: once per distinct condition, for all its rows', async () => {
      const { extra, published } = await queriesFor(
        ({ service }) => service.patch(null, { stars: 1 }),
        { blink: toBlink, blinkToo: toBlink, sum41: toSum41 },
      )
      // two conditions among three connections, four rows
      expect(extra).toBe(2)
      expect(reached(published)).toEqual([
        ['patched', ['blink', 'blinkToo']],
        ['patched', ['blink', 'blinkToo']],
        ['patched', ['sum41']],
      ])
    })

    it('only for the connections of the channels the write goes to', async () => {
      // a channel per artist, as one per company: each fan in their artist's
      const perArtist = {
        join: (name: string, { artists }: Tables) =>
          `artists/${name === 'blinkFan' ? artists.blink182.id : artists.sum41.id}`,
      }
      const patchEnema = ({ service, albumsOf, artists }: any) =>
        service.patch(albumsOf(artists.blink182)[0].id, { stars: 1 })
      const fans = { blinkFan: toBlink, sumFan: toSum41 }

      const all = await queriesFor(patchEnema, fans, perArtist)
      const narrowed = await queriesFor(patchEnema, fans, {
        ...perArtist,
        channels: (app) => (data) => app.channel(`artists/${data.artistId}`),
      })
      expect(all.extra).toBe(2)
      expect(narrowed.extra).toBe(1)
      expect(reached(narrowed.published)).toEqual([['patched', ['blinkFan']]])
    })
  })

  describe('without authorize', () => {
    it('with debug: a warning once per event, none where authorize answered', async () => {
      const warn = vi.spyOn(console, 'warn').mockImplementation(() => {})
      const connections = { blink: toBlink, alsoBlink: toBlink, sum41: toSum41 }
      for (const authorized of [false, true]) {
        warn.mockClear()
        const { service, albumsOf, artists, settled } = await withEvents(
          connections,
          { authorized, debug: true },
        )
        await service.patch(albumsOf(artists.blink182)[0].id, { stars: 1 })
        await service.patch(albumsOf(artists.sum41)[0].id, { stars: 1 })
        await settled()
        expect(warn).toHaveBeenCalledTimes(authorized ? 0 : 2)
        if (!authorized) {
          expect(warn.mock.calls[0][0]).toContain(
            "rules through a relation without an answer for 'albums' (patch)",
          )
        }
      }
      warn.mockRestore()
    })

    it('a rule through a relation counts as the worst: nothing that might leak', async () => {
      const { service, albumsOf, artists, published, settled } =
        await withEvents(
          {
            all: (can) => can('get', 'albums'),
            blink: toBlink,
            notBlink: (can, cannot) => {
              can('get', 'albums')
              cannot('get', 'albums', { 'artist.name': 'Blink182' })
            },
          },
          { authorized: false },
        )
      const [enema] = albumsOf(artists.blink182)
      const [killer] = albumsOf(artists.sum41)

      await service.patch(enema.id, { stars: 1 })
      await service.patch(killer.id, { stars: 1 })
      await settled()
      // not even Sum 41's album to `notBlink`: unasked, the cannot might match
      expect(reached(published)).toEqual([
        ['patched', ['all']],
        ['patched', ['all']],
      ])
    })
  })
})
