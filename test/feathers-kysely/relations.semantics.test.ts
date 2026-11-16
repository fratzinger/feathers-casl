import { defineAbility } from '@casl/ability'
import { runInTransaction } from '@fratzinger/feathers-kysely'
import { resolveAction } from '../test-utils.js'
import { db, names, setup as setupTables } from './setup.js'
import type { AuthorizeHookOptions } from '../../src/index.js'

/**
 * Rules through a relation beyond the plain case: inverted ones and their order, a relation
 * that isn't there, a create's data at the edges, `update`, and how the database is asked.
 */
const ability = (define: Parameters<typeof defineAbility>[0]) =>
  defineAbility(define, { resolveAction })

const setup = (
  options: Partial<AuthorizeHookOptions> = {},
  { availableFields = true } = {},
) => setupTables(options, { prefix: 'casl_rel_sem', availableFields })

describe('feathers-kysely: rules through relations, the edges', () => {
  describe('inverted rules and their order', () => {
    for (const availableFields of [true, false]) {
      it(`drops the fields a cannot through a relation names, ${availableFields ? 'with' : 'without'} availableFields`, async () => {
        const { albums } = await setup({}, { availableFields })
        const found = await albums.find({
          paginate: false,
          ability: ability((can, cannot) => {
            can('read', 'albums')
            cannot('read', 'albums', ['stars'], { 'artist.name': 'Blink182' })
          }),
        })
        expect(found).toHaveLength(4)
        for (const album of found) {
          const blink = ['Enema of the State', 'California'].includes(
            album.name,
          )
          expect('stars' in album).toBe(!blink)
        }
      })
    }

    it('a cannot on its own column after a can through a relation', async () => {
      const { albums } = await setup()
      const found = await albums.find({
        paginate: false,
        ability: ability((can, cannot) => {
          can('read', 'albums', ['id', 'name'], { 'artist.name': 'Blink182' })
          cannot('read', 'albums', { stars: 5 })
        }),
      })
      expect(found).toEqual([{ id: expect.any(Number), name: 'California' }])
    })
  })

  describe('a relation that is not there', () => {
    // as feathers-kysely queries: a condition through a relation needs the related row
    const notPunk = { 'artist.label.name': { $nin: ['Punk Records'] } }

    it('matches nothing through it, not even $nin: querying and checking alike', async () => {
      const { albums, addUnsigned } = await setup()
      await addUnsigned()

      const found = await albums.find({
        paginate: false,
        ability: ability((can) => can('read', 'albums', notPunk)),
      })
      expect(names(found)).toEqual(['Purpose'])

      // the rows a patch returns are checked by the database, after the query that patched them
      const patched = await albums.patch(
        null,
        { stars: 1 },
        {
          ability: ability((can) => {
            can('read', 'albums', notPunk)
            can('update', 'albums')
          }),
        },
      )
      expect(names(patched)).toEqual(['Purpose'])
    })

    it("matches nothing through it in a create's data, with or without the key", async () => {
      const { albums, addUnsigned, artists } = await setup()
      const { unsigned } = await addUnsigned()
      const rules = ability((can) => {
        can('read', 'albums')
        can('create', 'albums', notPunk)
      })

      for (const data of [{ artistId: unsigned.id }, {}]) {
        await expect(
          albums.create({ name: 'Second Demo', ...data }, { ability: rules }),
        ).rejects.toMatchObject({ name: 'Forbidden' })
      }
      await expect(
        albums.create(
          { name: 'Believe', artistId: artists.bieber.id },
          { ability: rules },
        ),
      ).resolves.toMatchObject({ name: 'Believe' })
    })
  })

  describe('create', () => {
    it('a condition on the key of the relation itself', async () => {
      const { albums, artists } = await setup()
      const rules = ability((can) => {
        can('read', 'albums')
        can('create', 'albums', { 'artist.id': artists.blink182.id })
      })

      await expect(
        albums.create(
          { name: 'Wrong', artistId: artists.sum41.id },
          { ability: rules },
        ),
      ).rejects.toMatchObject({ name: 'Forbidden' })
      await expect(
        albums.create(
          { name: 'Right', artistId: artists.blink182.id },
          { ability: rules },
        ),
      ).resolves.toMatchObject({ name: 'Right' })
    })

    it('a cannot through a relation', async () => {
      const { albums, artists } = await setup()
      const rules = ability((can, cannot) => {
        can('read', 'albums')
        can('create', 'albums')
        cannot('create', 'albums', { 'artist.name': 'Sum 41' })
      })

      await expect(
        albums.create(
          { name: 'Nine', artistId: artists.blink182.id },
          { ability: rules },
        ),
      ).resolves.toMatchObject({ name: 'Nine' })
      await expect(
        albums.create(
          { name: 'Chuck', artistId: artists.sum41.id },
          { ability: rules },
        ),
      ).rejects.toMatchObject({ name: 'Forbidden' })
    })

    it('without the key of the relation: a can through it does not match', async () => {
      const { albums } = await setup()
      await expect(
        albums.create(
          { name: 'Untitled' },
          {
            ability: ability((can) => {
              can('read', 'albums')
              can('create', 'albums', { 'artist.name': 'Blink182' })
            }),
          },
        ),
      ).rejects.toMatchObject({ name: 'Forbidden' })
    })

    it('a key to no row: as no relation', async () => {
      const { albums } = await setup()
      const nobody = 999_999

      await expect(
        albums.create(
          { name: 'Ghost', artistId: nobody },
          {
            ability: ability((can, cannot) => {
              can('read', 'albums')
              can('create', 'albums')
              cannot('create', 'albums', { 'artist.name': 'Sum 41' })
            }),
          },
        ),
      ).resolves.toMatchObject({ name: 'Ghost' })
      await expect(
        albums.create(
          { name: 'Ghost', artistId: nobody },
          {
            ability: ability((can) => {
              can('read', 'albums')
              can('create', 'albums', { 'artist.name': 'Blink182' })
            }),
          },
        ),
      ).rejects.toMatchObject({ name: 'Forbidden' })
    })
  })

  describe('$or through a relation', () => {
    // CASL's own matcher has no $or: where the database can't answer, the worst
    const orBlink = { $or: [{ 'artist.name': 'Blink182' }, { stars: 5 }] }
    const orSum41 = { $or: [{ 'artist.name': 'Sum 41' }, { stars: 1 }] }

    it('stored rows: the database answers, as it queries', async () => {
      const { albums } = await setup()
      const found = await albums.find({
        paginate: false,
        ability: ability((can) =>
          can('read', 'albums', ['id', 'name'], orBlink),
        ),
      })
      expect(names(found)).toEqual(['California', 'Enema of the State'])
      for (const album of found) {
        expect(Object.keys(album).sort()).toEqual(['id', 'name'])
      }
    })

    it('data not stored yet: a can does not match, a cannot does', async () => {
      const { albums, artists } = await setup()
      const create = (define: Parameters<typeof ability>[0]) =>
        albums.create(
          { name: 'Nine', artistId: artists.blink182.id, stars: 3 },
          { ability: ability(define) },
        )

      await expect(
        create((can) => {
          can('read', 'albums')
          can('create', 'albums', orBlink)
        }),
      ).rejects.toMatchObject({ name: 'Forbidden' })
      // not Sum 41's, yet the cannot can't be told apart: refused, never let through
      await expect(
        create((can, cannot) => {
          can('read', 'albums')
          can('create', 'albums')
          cannot('create', 'albums', orSum41)
        }),
      ).rejects.toMatchObject({ name: 'Forbidden' })
    })
  })

  describe('update', () => {
    it('one through a relation, else NotFound', async () => {
      const { albums, albumsOf, artists } = await setup()
      const rules = ability((can) => {
        can('read', 'albums')
        can('update', 'albums', { 'artist.name': 'Blink182' })
      })
      const [enema] = albumsOf(artists.blink182)
      const [killer] = albumsOf(artists.sum41)

      await expect(
        albums.update(
          enema.id,
          { name: 'Enema', artistId: artists.blink182.id, stars: 4 },
          { ability: rules },
        ),
      ).resolves.toMatchObject({ name: 'Enema', stars: 4 })
      await expect(
        albums.update(
          killer.id,
          { name: 'Killer', artistId: artists.sum41.id, stars: 4 },
          { ability: rules },
        ),
      ).rejects.toMatchObject({ name: 'NotFound' })
    })

    it('useUpdateData: data through a relation', async () => {
      const { albums, albumsOf, artists } = await setup({ useUpdateData: true })
      const rules = ability((can, cannot) => {
        can('read', 'albums')
        can('update', 'albums')
        can('update-data', 'albums')
        cannot('update-data', 'albums', { 'artist.name': 'Sum 41' })
      })
      const [enema] = albumsOf(artists.blink182)

      await expect(
        albums.update(
          enema.id,
          { name: 'Enema', artistId: artists.sum41.id, stars: 5 },
          { ability: rules },
        ),
      ).rejects.toMatchObject({ name: 'Forbidden' })
      await expect(
        albums.update(
          enema.id,
          { name: 'Enema', artistId: artists.bieber.id, stars: 5 },
          { ability: rules },
        ),
      ).resolves.toMatchObject({ artistId: artists.bieber.id })
    })
  })

  describe('how the database is asked', () => {
    it('once per rule, not per row', async () => {
      const { app, albums, artists } = await setup()
      const rules = () =>
        ability((can) => {
          can('read', 'albums', ['id', 'name'], { 'artist.name': 'Blink182' })
          can('read', 'albums', ['id', 'name', 'stars'], {
            'artist.name': 'Sum 41',
          })
        })
      const service = app.service('albums')
      const finds = vi.spyOn(service as any, '_find')

      await albums.find({ paginate: false, ability: rules() })
      const few = finds.mock.calls.length

      await service.create(
        Array.from({ length: 20 }, (_, i) => ({
          name: `B-Side ${i}`,
          artistId: artists.blink182.id,
        })),
      )
      finds.mockClear()
      const found = await albums.find({ paginate: false, ability: rules() })
      expect(found).toHaveLength(23)
      // the find itself, and one for each rule through the relation
      expect(finds.mock.calls.length).toBe(few)
      expect(few).toBe(3)
    })

    it('a bulk create: once per condition, for all its items', async () => {
      const { app, albums, artists } = await setup()
      const rules = ability((can) => {
        can('read', 'albums')
        can(['create', 'create-multi'], 'albums', {
          'artist.label.name': 'Punk Records',
        })
      })
      const finds = vi.spyOn(app.service('artists') as any, '_find')

      // one artist for all, then several; one, its key as text, as a client may send it
      const blink = Array.from({ length: 50 }, (_, i) => ({
        name: `B-Side ${i}`,
        artistId: artists.blink182.id,
      }))
      const mixed = [
        ...blink.slice(0, 5),
        { name: 'Chuck', artistId: artists.sum41.id },
        { name: 'Does', artistId: String(artists.sum41.id) },
      ]
      for (const data of [blink, mixed]) {
        finds.mockClear()
        await expect(
          albums.create(data, { ability: rules }),
        ).resolves.toHaveLength(data.length)
        expect(finds).toHaveBeenCalledTimes(1)
      }

      finds.mockClear()
      await expect(
        albums.create(
          [
            ...blink.slice(0, 2),
            { name: 'Believe', artistId: artists.bieber.id },
          ],
          { ability: rules },
        ),
      ).rejects.toMatchObject({ name: 'Forbidden' })
      expect(finds).toHaveBeenCalledTimes(1)
    })

    it('sees what its transaction wrote', async () => {
      const { app, albums } = await setup()
      const patched = await runInTransaction(db, async (transaction) => {
        // `transaction` is feathers-kysely's param, not in Feathers' own
        const params = { transaction } as any
        const unsigned = await app
          .service('artists')
          .create({ name: 'Unsigned' }, params)
        await app
          .service('albums')
          .create({ name: 'Demo', artistId: unsigned.id }, params)
        return albums.patch(null, { stars: 2 }, {
          transaction,
          ability: ability((can) => {
            can('read', 'albums', { 'artist.name': 'Unsigned' })
            can('update', 'albums')
          }),
        } as any)
      })
      expect(names(patched)).toEqual(['Demo'])
    })

    describe('after a write, as little as it takes', () => {
      type Define = Parameters<typeof ability>[0]
      type Albums = Awaited<ReturnType<typeof setup>>['albums']

      /** The queries `run` makes with `rules` beyond those it makes with `baseline`. */
      async function extraQueries(
        run: (
          albums: Albums,
          rules: ReturnType<typeof ability>,
        ) => Promise<unknown>,
        baseline: Define,
        rules: Define,
      ) {
        const counted = async (define: Define) => {
          const { app, albums } = await setup()
          const finds = vi.spyOn(app.service('albums') as any, '_find')
          const result = await run(albums, ability(define))
          return { calls: finds.mock.calls.length, result: result as any }
        }
        const before = await counted(baseline)
        const { calls, result } = await counted(rules)
        return { extra: calls - before.calls, result }
      }

      const patchAll = (albums: Albums, rules: ReturnType<typeof ability>) =>
        albums.patch(null, { stars: 1 }, { ability: rules })
      // reading all asks nothing: the baseline
      const updateBlink: Define = (can) => {
        can('read', 'albums')
        can('update', 'albums', { 'artist.name': 'Blink182' })
      }

      it('the rules to update by are the rules to read by: nothing asked', async () => {
        const { extra, result } = await extraQueries(
          patchAll,
          updateBlink,
          (can) => {
            can('read', 'albums', { 'artist.name': 'Blink182' })
            can('update', 'albums', { 'artist.name': 'Blink182' })
          },
        )
        expect(names(result)).toEqual(['California', 'Enema of the State'])
        expect(extra).toBe(0)
      })

      it('one rule for both, read and update: nothing asked', async () => {
        const { extra, result } = await extraQueries(
          patchAll,
          updateBlink,
          (can) =>
            can(['read', 'update'], 'albums', { 'artist.name': 'Blink182' }),
        )
        expect(names(result)).toEqual(['California', 'Enema of the State'])
        expect(extra).toBe(0)
      })

      it('a patch moving rows elsewhere: asked, and not returned', async () => {
        const { extra, result } = await extraQueries(
          (albums, rules) =>
            albums.patch(
              null,
              { artistId: 0 },
              { query: { name: 'California' }, ability: rules },
            ),
          updateBlink,
          (can) =>
            can(['read', 'update'], 'albums', { 'artist.name': 'Blink182' }),
        )
        expect(result).toEqual([])
        expect(extra).toBe(1)
      })

      it('rules that only ask whether any matches: one query for them all', async () => {
        const { extra, result } = await extraQueries(
          patchAll,
          updateBlink,
          (can) => {
            can('read', 'albums', { 'artist.name': 'Sum 41' })
            can('read', 'albums', { 'artist.label.name': 'Punk Records' })
            can('update', 'albums', { 'artist.name': 'Blink182' })
          },
        )
        expect(names(result)).toEqual(['California', 'Enema of the State'])
        expect(extra).toBe(1)
      })

      it('a cannot among them: asked rule by rule, as the order decides', async () => {
        const { extra, result } = await extraQueries(
          patchAll,
          updateBlink,
          (can, cannot) => {
            can('read', 'albums', { 'artist.name': 'Sum 41' })
            can('read', 'albums', { 'artist.label.name': 'Punk Records' })
            cannot('read', 'albums', { name: 'California' })
            can('update', 'albums', { 'artist.name': 'Blink182' })
          },
        )
        expect(names(result)).toEqual(['Enema of the State'])
        expect(extra).toBe(2)
      })

      it('a remove the rules guarantee reading: nothing asked before', async () => {
        const { extra, result } = await extraQueries(
          (albums, rules) => albums.remove(null, { ability: rules }),
          (can) => {
            can('read', 'albums')
            can('remove', 'albums', { 'artist.name': 'Blink182' })
          },
          (can) =>
            can(['read', 'remove'], 'albums', { 'artist.name': 'Blink182' }),
        )
        expect(names(result)).toEqual(['California', 'Enema of the State'])
        expect(extra).toBe(0)
      })
    })

    it('a paginated find', async () => {
      const { albums } = await setup()
      const page = await albums.find({
        paginate: { default: 10, max: 10 },
        ability: ability((can) => {
          can('read', 'albums', ['id', 'name'], { 'artist.name': 'Blink182' })
        }),
      })
      expect(page.total).toBe(2)
      expect(names(page.data)).toEqual(['California', 'Enema of the State'])
      for (const album of page.data) {
        expect(Object.keys(album).sort()).toEqual(['id', 'name'])
      }
    })
  })
})
