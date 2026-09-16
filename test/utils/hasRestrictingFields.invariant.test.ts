import { defineAbility, subject } from '@casl/ability'
import assert from 'node:assert'
import {
  couldHaveRestrictingFields,
  hasRestrictingFields,
} from '../../src/index.js'

/**
 * The `authorize` after-hook resolves `couldHaveRestrictingFields` once per
 * request and skips the per-item `hasRestrictingFields` when it comes back
 * false. That's only sound if a ruleset without a single `fields` entry can
 * never restrict anything - including when `availableFields` is set.
 */

const CONDITIONS: (Record<string, any> | undefined)[] = [
  undefined,
  { userId: 1 },
  { status: 'a' },
  { userId: { $in: [1, 2] } },
]

const AVAILABLE_FIELDS: (string[] | undefined)[] = [
  undefined,
  ['id', 'userId', 'status', 'secret'],
  ['id'],
  [],
]

const ITEM = { id: 1, userId: 1, status: 'a', secret: true }

const makeRandom = (seed: number) => (max: number) => {
  seed = (seed * 1103515245 + 12345) & 0x7fffffff
  return seed % max
}

it('rules without fields can never restrict fields', function () {
  const random = makeRandom(7)
  const violations: string[] = []

  for (let c = 0; c < 3000; c++) {
    const spec: { inverted: boolean; conditions: any }[] = []
    for (let i = 0, n = 1 + random(4); i < n; i++) {
      spec.push({
        inverted: random(3) === 0,
        conditions: CONDITIONS[random(CONDITIONS.length)],
      })
    }

    const ability = defineAbility((can, cannot) => {
      for (const { inverted, conditions } of spec) {
        const add = inverted ? cannot : can
        if (conditions) {
          add('read', 'tests', conditions)
        } else {
          add('read', 'tests')
        }
      }
    })

    assert.strictEqual(
      couldHaveRestrictingFields(ability, 'read', 'tests'),
      false,
      'no generated rule carries fields',
    )

    const availableFields = AVAILABLE_FIELDS[random(AVAILABLE_FIELDS.length)]
    const fields = hasRestrictingFields(
      ability,
      'read',
      subject('tests', { ...ITEM }),
      { availableFields },
    )

    if (fields !== false) {
      violations.push(
        `${JSON.stringify(spec)} availableFields=${JSON.stringify(availableFields)} -> ${JSON.stringify(fields)}`,
      )
    }
  }

  assert.deepStrictEqual(
    violations.slice(0, 3),
    [],
    `${violations.length} violations`,
  )
})
