import { feathers } from '@feathersjs/feathers'
import { channels as realTime } from '@feathersjs/transport-commons'
import { KyselyService } from '@fratzinger/feathers-kysely'
import { Kysely, PostgresDialect } from 'kysely'
import { Pool } from 'pg'
import { authorize } from '../../src/index.js'
import type { AuthorizeHookOptions } from '../../src/index.js'

/**
 * Albums of artists of labels, an artist's members: rules on an album reach through
 * `artist.…`, one relation (`artist.name`), two (`artist.label.name`) or a has-many
 * (`artist.members: { $some }`). Each test file has tables of its own (`prefix`), as the files
 * run side by side.
 */
export const db = new Kysely<any>({
  dialect: new PostgresDialect({
    pool: new Pool({
      host: process.env.POSTGRES_HOST ?? 'localhost',
      user: process.env.POSTGRES_USER ?? 'postgres',
      password:
        'POSTGRES_PASSWORD' in process.env
          ? process.env.POSTGRES_PASSWORD
          : 'password',
      database: process.env.POSTGRES_DB ?? 'test',
      port: process.env.POSTGRES_PORT
        ? Number(process.env.POSTGRES_PORT)
        : 5432,
      max: 5,
    }),
  }),
})

type Table = 'labels' | 'artists' | 'albums' | 'members'

const COLUMNS: Record<Table, string[]> = {
  labels: ['id', 'name'],
  artists: ['id', 'name', 'labelId'],
  albums: ['id', 'name', 'artistId', 'stars'],
  members: ['id', 'artistId', 'userId'],
}

async function createTables(table: (name: Table) => string) {
  for (const name of ['members', 'albums', 'artists', 'labels'] as const) {
    await db.schema.dropTable(table(name)).ifExists().execute()
  }
  await db.schema
    .createTable(table('labels'))
    .addColumn('id', 'serial', (col) => col.primaryKey())
    .addColumn('name', 'text', (col) => col.notNull())
    .execute()
  await db.schema
    .createTable(table('artists'))
    .addColumn('id', 'serial', (col) => col.primaryKey())
    .addColumn('name', 'text', (col) => col.notNull())
    .addColumn('labelId', 'integer')
    .execute()
  await db.schema
    .createTable(table('albums'))
    .addColumn('id', 'serial', (col) => col.primaryKey())
    .addColumn('name', 'text', (col) => col.notNull())
    .addColumn('artistId', 'integer')
    .addColumn('stars', 'integer')
    .execute()
  await db.schema
    .createTable(table('members'))
    .addColumn('id', 'serial', (col) => col.primaryKey())
    .addColumn('artistId', 'integer', (col) => col.notNull())
    .addColumn('userId', 'integer', (col) => col.notNull())
    .execute()
}

export async function setup(
  options: Partial<AuthorizeHookOptions> = {},
  {
    prefix = 'casl_rel',
    // without them, inverted rules' fields are omitted instead of the permitted ones picked
    availableFields = true,
    // events published to channels, before the services that publish them
    channels = false,
    // `authorize` on the albums
    authorized = true,
  } = {},
) {
  const table = (name: Table) => `${prefix}_${name}`
  await createTables(table)

  const relation = (
    service: Table,
    keyHere: string,
    keyThere: string,
    asArray = false,
  ) => ({
    service,
    keyHere,
    keyThere,
    asArray,
    databaseTableName: table(service),
  })
  const service = (
    name: Table,
    relations?: Record<string, ReturnType<typeof relation>>,
  ) =>
    new KyselyService({
      Model: db,
      name: table(name),
      multi: true,
      properties: Object.fromEntries(
        COLUMNS[name].map((column) => [column, true]),
      ),
      relations,
      casl: availableFields ? { availableFields: COLUMNS[name] } : {},
    })

  const app = feathers()
  if (channels) app.configure(realTime())
  app.use('labels', service('labels'))
  app.use(
    'artists',
    service('artists', {
      label: relation('labels', 'labelId', 'id'),
      members: relation('members', 'id', 'artistId', true),
    }),
  )
  app.use(
    'albums',
    service('albums', { artist: relation('artists', 'artistId', 'id') }),
  )
  app.use('members', service('members'))

  if (authorized) {
    const casl = authorize({ adapter: 'feathers-kysely', ...options })
    app
      .service('albums')
      .hooks({ before: { all: [casl] }, after: { all: [casl] } })
  }
  // a relation's relations are found through the app's services
  await app.setup()

  // a label with one artist, one without; each artist with albums, Blink182 with a member
  const [punk, pop] = await app
    .service('labels')
    .create([{ name: 'Punk Records' }, { name: 'Pop Records' }])
  const [blink182, sum41, bieber] = await app.service('artists').create([
    { name: 'Blink182', labelId: punk.id },
    { name: 'Sum 41', labelId: punk.id },
    { name: 'Justin Bieber', labelId: pop.id },
  ])
  await app.service('members').create({ artistId: blink182.id, userId: 1 })
  const albums = await app.service('albums').create([
    { name: 'Enema of the State', artistId: blink182.id, stars: 5 },
    { name: 'California', artistId: blink182.id, stars: 3 },
    { name: 'All Killer No Filler', artistId: sum41.id, stars: 4 },
    { name: 'Purpose', artistId: bieber.id, stars: 2 },
  ])
  const albumsOf = (artist: { id: number }) =>
    albums.filter((album: any) => album.artistId === artist.id)

  /** An artist on no label, with an album: a relation that isn't there. */
  const addUnsigned = async () => {
    const unsigned = await app
      .service('artists')
      .create({ name: 'Unsigned', labelId: null })
    const demo = await app
      .service('albums')
      .create({ name: 'Demo', artistId: unsigned.id, stars: 1 })
    return { unsigned, demo }
  }

  return {
    app,
    albums: app.service('albums'),
    artists: { blink182, sum41, bieber },
    allAlbums: albums,
    albumsOf,
    addUnsigned,
  }
}

/** The names of `albums`, sorted: what a test compares. */
export const names = (albums: { name: string }[]) =>
  albums.map((album) => album.name).sort()
