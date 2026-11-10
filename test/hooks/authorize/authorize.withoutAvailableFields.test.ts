import assert from 'node:assert'
import { feathers } from '@feathersjs/feathers'
import { MemoryService } from '@feathersjs/memory'
import { defineAbility } from '@casl/ability'
import type { AnyAbility } from '@casl/ability'
import type { HookContext } from '@feathersjs/feathers'
import { authorize } from '../../../src/index.js'
import { resolveAction } from '../../test-utils.js'

// Without `availableFields` the hook can't list the permitted fields of an item, so a field an
// inverted rule forbids is dropped instead - and everything else stays, populated data included.
describe('authorize without availableFields', function () {
  const populate = (context: HookContext) => {
    const add = (item: any) => ({
      ...item,
      related: { name: `related ${item.id}` },
    })
    context.result = Array.isArray(context.result)
      ? context.result.map(add)
      : add(context.result)
  }

  const setup = async () => {
    const app = feathers()
    app.use('tests', new MemoryService({ multi: true }))
    const service = app.service('tests')
    service.hooks({
      before: { all: [authorize()] },
      after: { all: [populate, authorize()] },
    })
    await service.create([
      { id: 1, userId: 1, title: 'one', secret: 'a' },
      { id: 2, userId: 2, title: 'two', secret: 'b' },
    ])
    return service
  }

  const forbidSecretOf = (userId: number, extra?: (can: any) => void) =>
    defineAbility(
      (can, cannot) => {
        can('read', 'tests')
        cannot('read', 'tests', ['secret'], { userId })
        extra?.(can)
      },
      { resolveAction },
    )

  const find = (service: any, ability: AnyAbility, query = {}) =>
    service.find({ ability, query, paginate: false }) as Promise<any[]>

  it('drops a field an inverted rule forbids, and keeps every other', async function () {
    const service = await setup()

    const items = await find(service, forbidSecretOf(2))

    assert.deepStrictEqual(items, [
      {
        id: 1,
        userId: 1,
        title: 'one',
        secret: 'a',
        related: { name: 'related 1' },
      },
      { id: 2, userId: 2, title: 'two', related: { name: 'related 2' } },
    ])
    assert.deepStrictEqual(
      await service.get(2, { ability: forbidSecretOf(2) }),
      {
        id: 2,
        userId: 2,
        title: 'two',
        related: { name: 'related 2' },
      },
    )
  })

  it('keeps a field a later rule allows again', async function () {
    const service = await setup()

    const ability = forbidSecretOf(2, (can) => can('read', 'tests', { id: 2 }))

    const items = await find(service, ability)
    assert.strictEqual(items[1].secret, 'b')
  })

  it('drops the forbidden field from what `$select` asks for', async function () {
    const service = await setup()

    const items = await find(service, forbidSecretOf(2), {
      $select: ['title', 'secret'],
    })

    assert.deepStrictEqual(
      items.map(({ related: _related, ...item }) => item),
      [
        { id: 1, title: 'one', secret: 'a' },
        { id: 2, title: 'two' },
      ],
    )
  })

  it('drops the fields a pattern forbids', async function () {
    const service = await setup()
    await service.patch(1, { address: { city: 'c', street: 's' } })

    const ability = defineAbility(
      (can, cannot) => {
        can('read', 'tests')
        cannot('read', 'tests', ['address.*'])
      },
      { resolveAction },
    )

    const item = await service.get(1, { ability })
    // CASL counts the object itself as matched by its pattern
    assert.ok(!('address' in item))
    assert.strictEqual(item.title, 'one')
  })

  describe('writes', function () {
    const forbidChangingSecretOf = (userId?: number) =>
      defineAbility(
        (can, cannot) => {
          can('manage', 'tests')
          cannot('update', 'tests', ['secret'], userId ? { userId } : undefined)
        },
        { resolveAction },
      )

    const stored = async (service: any, id: number) => service.get(id)

    it('keeps a field an inverted rule forbids from being patched', async function () {
      const service = await setup()
      const ability = forbidChangingSecretOf(2)

      await service.patch(1, { title: 'new', secret: 'x' }, { ability })
      await service.patch(2, { title: 'new', secret: 'x' }, { ability })

      assert.deepStrictEqual(
        [await stored(service, 1), await stored(service, 2)].map(
          ({ title, secret }) => ({ title, secret }),
        ),
        [
          { title: 'new', secret: 'x' },
          { title: 'new', secret: 'b' },
        ],
      )
    })

    it('keeps the stored value of a forbidden field on update', async function () {
      const service = await setup()

      await service.update(
        2,
        { userId: 2, title: 'new', secret: 'x' },
        { ability: forbidChangingSecretOf(2) },
      )

      const { title, secret } = await stored(service, 2)
      assert.deepStrictEqual({ title, secret }, { title: 'new', secret: 'b' })
    })

    it('forbids a patch of forbidden fields only', async function () {
      const service = await setup()

      await assert.rejects(
        service.patch(
          2,
          { secret: 'x' },
          { ability: forbidChangingSecretOf(2) },
        ),
        { name: 'Forbidden' },
      )
    })

    it('keeps a forbidden field from being patched on many', async function () {
      const service = await setup()

      await service.patch(
        null,
        { title: 'new', secret: 'x' },
        { ability: forbidChangingSecretOf() },
      )

      const items = await service.find({ paginate: false })
      assert.deepStrictEqual(
        items.map(({ title, secret }: any) => ({ title, secret })),
        [
          { title: 'new', secret: 'a' },
          { title: 'new', secret: 'b' },
        ],
      )
    })
  })
})
