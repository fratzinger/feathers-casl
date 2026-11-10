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
})
