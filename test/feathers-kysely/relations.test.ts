import { defineAbility } from '@casl/ability'
import { checkCan } from '../../src/index.js'
import { resolveAction } from '../test-utils.js'
import { names, setup } from './setup.js'

/**
 * Rules whose conditions reach through a relation (`artist.name`). Querying, feathers-casl hands
 * the conditions on and feathers-kysely joins. Checking a row or data in memory, the relation
 * isn't there to read: feathers-casl asks the database, a stored row by its id, data by the key
 * it holds for the relation.
 */
const ability = (define: Parameters<typeof defineAbility>[0]) =>
  defineAbility(define, { resolveAction })

describe('feathers-kysely: rules through relations', () => {
  describe('find', () => {
    it('one relation, $eq', async () => {
      const { albums } = await setup()
      const found = await albums.find({
        paginate: false,
        ability: ability((can) =>
          can('read', 'albums', { 'artist.name': 'Blink182' }),
        ),
      })
      expect(names(found)).toEqual(['California', 'Enema of the State'])
    })

    it('two relations, $in and $nin', async () => {
      const { albums } = await setup()
      const punk = await albums.find({
        paginate: false,
        ability: ability((can) =>
          can('read', 'albums', {
            'artist.label.name': { $in: ['Punk Records'] },
          }),
        ),
      })
      expect(names(punk)).toEqual([
        'All Killer No Filler',
        'California',
        'Enema of the State',
      ])

      const notPunk = await albums.find({
        paginate: false,
        ability: ability((can) =>
          can('read', 'albums', {
            'artist.label.name': { $nin: ['Punk Records'] },
          }),
        ),
      })
      expect(names(notPunk)).toEqual(['Purpose'])
    })

    it('a has-many, $some', async () => {
      const { albums } = await setup()
      const found = await albums.find({
        paginate: false,
        ability: ability((can) =>
          can('read', 'albums', {
            'artist.members': { $some: { userId: 1 } },
          }),
        ),
      })
      expect(names(found)).toEqual(['California', 'Enema of the State'])
    })

    it('rules on own columns and through a relation, either one', async () => {
      const { albums } = await setup()
      const found = await albums.find({
        paginate: false,
        ability: ability((can) => {
          can('read', 'albums', { stars: 5 })
          can('read', 'albums', { 'artist.name': 'Sum 41' })
        }),
      })
      expect(names(found)).toEqual([
        'All Killer No Filler',
        'Enema of the State',
      ])
    })

    it('an inverted rule through a relation', async () => {
      const { albums } = await setup()
      const found = await albums.find({
        paginate: false,
        ability: ability((can, cannot) => {
          can('read', 'albums')
          cannot('read', 'albums', { 'artist.name': 'Justin Bieber' })
        }),
      })
      expect(names(found)).toEqual([
        'All Killer No Filler',
        'California',
        'Enema of the State',
      ])
    })

    it('picks the fields of the rule the row matches through a relation', async () => {
      const { albums } = await setup()
      const found = await albums.find({
        paginate: false,
        ability: ability((can) => {
          can('read', 'albums', ['id', 'name'], { 'artist.name': 'Blink182' })
          can('read', 'albums', { 'artist.name': 'Sum 41' })
        }),
      })
      expect(found).toHaveLength(3)
      for (const album of found) {
        if (album.name === 'All Killer No Filler') expect(album.stars).toBe(4)
        else expect(Object.keys(album).sort()).toEqual(['id', 'name'])
      }
    })

    it('with $select, without selecting the path through the relation', async () => {
      const { albums } = await setup()
      const found = await albums.find({
        paginate: false,
        query: { $select: ['name'] },
        ability: ability((can) => {
          can('read', 'albums', ['id', 'name', 'stars'], {
            'artist.name': 'Blink182',
          })
        }),
      })
      expect(names(found)).toEqual(['California', 'Enema of the State'])
      for (const album of found) {
        expect(Object.keys(album).sort()).toEqual(['id', 'name'])
      }
    })
  })

  describe('find, beside the id', () => {
    it('a rule naming ids and a relation', async () => {
      const { albums, allAlbums } = await setup()
      const ids = allAlbums.map((album: any) => album.id)
      const found = await albums.find({
        paginate: false,
        ability: ability((can) => {
          can('read', 'albums', ['id', 'name'], {
            id: { $in: ids.slice(0, 3) },
            'artist.name': 'Blink182',
          })
        }),
      })
      expect(names(found)).toEqual(['California', 'Enema of the State'])
    })
  })

  describe('get', () => {
    it('one through a relation, else NotFound', async () => {
      const { albums, albumsOf, artists } = await setup()
      const rules = ability((can) =>
        can('read', 'albums', { 'artist.name': 'Blink182' }),
      )
      const [enema] = albumsOf(artists.blink182)
      const [killer] = albumsOf(artists.sum41)

      expect((await albums.get(enema.id, { ability: rules })).name).toBe(
        'Enema of the State',
      )
      await expect(
        albums.get(killer.id, { ability: rules }),
      ).rejects.toMatchObject({ name: 'NotFound' })
    })

    it('with the fields of the rule it matches through a relation', async () => {
      const { albums, albumsOf, artists } = await setup()
      const [enema] = albumsOf(artists.blink182)
      const found = await albums.get(enema.id, {
        ability: ability((can) => {
          can('read', 'albums', ['id', 'name'], { 'artist.name': 'Blink182' })
        }),
      })
      expect(found).toEqual({ id: enema.id, name: 'Enema of the State' })
    })
  })

  describe('patch', () => {
    const updateBlink = () =>
      ability((can) => {
        can('read', 'albums')
        can('update', 'albums', { 'artist.name': 'Blink182' })
      })

    it('one through a relation, else NotFound', async () => {
      const { albums, albumsOf, artists } = await setup()
      const [enema] = albumsOf(artists.blink182)
      const [killer] = albumsOf(artists.sum41)

      const patched = await albums.patch(
        enema.id,
        { stars: 1 },
        { ability: updateBlink() },
      )
      expect(patched).toMatchObject({ stars: 1 })
      await expect(
        albums.patch(killer.id, { stars: 1 }, { ability: updateBlink() }),
      ).rejects.toMatchObject({ name: 'NotFound' })
    })

    it('only the fields of the rule it matches through a relation', async () => {
      const { albums, albumsOf, artists } = await setup()
      const [enema] = albumsOf(artists.blink182)
      const patched = await albums.patch(
        enema.id,
        { stars: 1, name: 'Enema' },
        {
          ability: ability((can) => {
            can('read', 'albums')
            can('update', 'albums', ['stars'], { 'artist.name': 'Blink182' })
          }),
        },
      )
      expect(patched).toMatchObject({ stars: 1, name: 'Enema of the State' })
    })

    it('many: only those through the relation', async () => {
      const { albums } = await setup()
      const patched = await albums.patch(
        null,
        { stars: 1 },
        { ability: updateBlink() },
      )
      expect(names(patched)).toEqual(['California', 'Enema of the State'])
    })

    it('many: returns only those it may read through a relation', async () => {
      const { albums } = await setup()
      const patched = await albums.patch(
        null,
        { stars: 1 },
        {
          ability: ability((can) => {
            can('read', 'albums', { 'artist.name': 'Blink182' })
            can('update', 'albums')
          }),
        },
      )
      expect(names(patched)).toEqual(['California', 'Enema of the State'])
    })

    describe('usePatchData', () => {
      // as the docs have it: a general `patch-data`, what's not allowed of the data inverted
      const notToSum41 = () =>
        ability((can, cannot) => {
          can('read', 'albums')
          can('update', 'albums')
          can('patch-data', 'albums')
          cannot('patch-data', 'albums', { 'artist.name': 'Sum 41' })
        })

      it('data through a relation: not to what it forbids', async () => {
        const { albums, albumsOf, artists } = await setup({
          usePatchData: true,
        })
        const [enema] = albumsOf(artists.blink182)

        await expect(
          albums.patch(
            enema.id,
            { artistId: artists.sum41.id },
            { ability: notToSum41() },
          ),
        ).rejects.toMatchObject({ name: 'Forbidden' })
        await expect(
          albums.patch(
            enema.id,
            { artistId: artists.bieber.id },
            { ability: notToSum41() },
          ),
        ).resolves.toMatchObject({ artistId: artists.bieber.id })
      })

      it('data without the key of the relation: as missing', async () => {
        const { albums, albumsOf, artists } = await setup({
          usePatchData: true,
        })
        const [killer] = albumsOf(artists.sum41)

        // the data names no artist, so it can't be one the rule forbids
        await expect(
          albums.patch(killer.id, { stars: 1 }, { ability: notToSum41() }),
        ).resolves.toMatchObject({ stars: 1 })
      })
    })
  })

  describe('remove', () => {
    const removeBlink = () =>
      ability((can) => {
        can('read', 'albums')
        can('remove', 'albums', { 'artist.name': 'Blink182' })
      })

    it('one through a relation, else NotFound', async () => {
      const { albums, albumsOf, artists } = await setup()
      const [enema] = albumsOf(artists.blink182)
      const [killer] = albumsOf(artists.sum41)

      await albums.remove(enema.id, { ability: removeBlink() })
      await expect(
        albums.remove(killer.id, { ability: removeBlink() }),
      ).rejects.toMatchObject({ name: 'NotFound' })
    })

    it('one: returned where it may be read through a relation', async () => {
      const { albums, albumsOf, artists } = await setup()
      const [enema] = albumsOf(artists.blink182)
      const removed = await albums.remove(enema.id, {
        ability: ability((can) => {
          can('read', 'albums', { 'artist.name': 'Blink182' })
          can('remove', 'albums')
        }),
      })
      expect(removed).toMatchObject({
        id: enema.id,
        name: 'Enema of the State',
      })
    })

    it('many: only those through the relation', async () => {
      const { albums } = await setup()
      const removed = await albums.remove(null, { ability: removeBlink() })
      expect(names(removed)).toEqual(['California', 'Enema of the State'])
    })

    it('many: returns only those it may read through a relation, asked before they went', async () => {
      const { app, albums } = await setup()
      const removed = await albums.remove(null, {
        ability: ability((can) => {
          can('read', 'albums', { 'artist.name': 'Blink182' })
          can('remove', 'albums')
        }),
      })
      expect(names(removed)).toEqual(['California', 'Enema of the State'])
      expect(await app.service('albums').find({ paginate: false })).toEqual([])
    })
  })

  describe('create', () => {
    it('data through a relation', async () => {
      const { albums, artists } = await setup()
      const rules = ability((can) => {
        can('read', 'albums')
        can('create', 'albums', { 'artist.name': 'Blink182' })
      })

      const created = await albums.create(
        { name: 'Neighborhoods', artistId: artists.blink182.id },
        { ability: rules },
      )
      expect(created.name).toBe('Neighborhoods')
      await expect(
        albums.create(
          { name: 'Chuck', artistId: artists.sum41.id },
          { ability: rules },
        ),
      ).rejects.toMatchObject({ name: 'Forbidden' })
    })

    it('many, through two relations and a has-many', async () => {
      const { albums, artists } = await setup()
      const rules = ability((can) => {
        can('read', 'albums')
        can('create', 'albums', {
          'artist.label.name': 'Punk Records',
          'artist.members': { $some: { userId: 1 } },
        })
      })

      const created = await albums.create(
        [
          { name: 'Neighborhoods', artistId: artists.blink182.id },
          { name: 'Nine', artistId: artists.blink182.id },
        ],
        { ability: rules },
      )
      expect(names(created)).toEqual(['Neighborhoods', 'Nine'])
      // Sum 41 is on the label, but no member of theirs is user 1
      await expect(
        albums.create(
          [
            { name: 'One More', artistId: artists.blink182.id },
            { name: 'Chuck', artistId: artists.sum41.id },
          ],
          { ability: rules },
        ),
      ).rejects.toMatchObject({ name: 'Forbidden' })
    })
  })

  describe('checkCan', () => {
    it('a stored row through a relation', async () => {
      const { app, albumsOf, artists } = await setup()
      const rules = ability((can) =>
        can('update', 'albums', { 'artist.name': 'Blink182' }),
      )
      const service = app.service('albums')
      const [enema] = albumsOf(artists.blink182)
      const [killer] = albumsOf(artists.sum41)

      expect(
        await checkCan(rules, enema.id, 'update', 'albums', service, {
          skipThrow: true,
        }),
      ).toBe(true)
      expect(
        await checkCan(rules, killer.id, 'update', 'albums', service, {
          skipThrow: true,
        }),
      ).toBe(false)
    })
  })
})
