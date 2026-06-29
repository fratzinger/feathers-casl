import type { HookContext } from '@feathersjs/feathers'

/**
 * Resolves the service's id field(s) as an array.
 *
 * Feathers' `service.options.id` can be a `string` or a `string[]` (compound id).
 * Returns an empty array if the service exposes no id.
 */
export const getIdFields = (context: HookContext): string[] => {
  const idField = context.service?.options?.id
  if (!idField) {
    return []
  }
  return Array.isArray(idField) ? idField : [idField]
}
