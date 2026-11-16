import { createMongoAbility, subject } from '@casl/ability'

import { getIdFields } from './getIdFields.js'

import type { AnyAbility } from '@casl/ability'
import type { HookContext, Params } from '@feathersjs/feathers'
import type { ServiceRelation } from '../types.js'

type Relations = Record<string, ServiceRelation>
const NO_RELATIONS: Relations = Object.freeze({})
const NO_RULES: Rule[] = []
type Rule = ReturnType<AnyAbility['possibleRulesFor']>[number]
type Item = Record<string, unknown>
/** Whether a rule's conditions match an object; `undefined` where that can't be told. */
type Match = (object: Item) => boolean | undefined

/** The operators whose value holds conditions of their own. */
const NESTING = new Set(['$and', '$or', '$nor', '$not'])

/**
 * The relations a rule's condition may reach through (`'artist.name'`): the service's
 * `options.relations`, as feathers-kysely declares them.
 */
export const getRelations = (service: unknown): Relations =>
  (service as { options?: { relations?: Relations } } | undefined)?.options
    ?.relations ?? NO_RELATIONS

/** Whether a service declares any relation: without, no rule reaches through one. */
export const hasRelations = (relations: Relations): boolean => {
  for (const _name in relations) return true
  return false
}

const relationOf = (key: string, relations: Relations) => {
  const name = key.split('.', 1)[0]
  return Object.hasOwn(relations, name) ? name : undefined
}

/** Whether `field`, as a rule's condition names it, reaches through one of `relations`. */
export const isRelationPath = (field: string, relations: Relations): boolean =>
  !!relationOf(field, relations)

/** Whether `conditions` reach through one of `relations`, in `$and`, `$or`, `$nor` and `$not` too. */
const reachesRelation = (
  conditions: unknown,
  relations: Relations,
): boolean => {
  if (!conditions || typeof conditions !== 'object') return false
  if (Array.isArray(conditions)) {
    return conditions.some((value) => reachesRelation(value, relations))
  }
  for (const [key, value] of Object.entries(conditions)) {
    if (
      NESTING.has(key)
        ? reachesRelation(value, relations)
        : relationOf(key, relations)
    ) {
      return true
    }
  }
  return false
}

/**
 * Per ability, by its rules (an `update` makes new ones), and per service's relations: asked for
 * each connection on each event, so worked out once.
 */
const rulesThroughRelationsOf = new WeakMap<
  object,
  WeakMap<Relations, Map<string, Rule[]>>
>()

/**
 * Whether `conditions` reach through a relation inside `$and`, `$or`, `$nor` or `$not`, which
 * CASL's own matcher doesn't have: only the database can answer them.
 */
const nestsRelation = (conditions: unknown, relations: Relations): boolean =>
  !!conditions &&
  typeof conditions === 'object' &&
  Object.entries(conditions).some(
    ([key, value]) => NESTING.has(key) && reachesRelation(value, relations),
  )

/** The rules for `actions` on `modelName` whose conditions reach through a relation. */
const rulesThroughRelations = (
  ability: AnyAbility,
  actions: string[],
  modelName: string,
  relations: Relations,
): Rule[] => {
  // the cheapest first: one lookup per ability
  if (!mayReachRelations(ability) || !hasRelations(relations)) return NO_RULES
  let byRelations = rulesThroughRelationsOf.get(ability.rules)
  if (!byRelations) {
    byRelations = new WeakMap()
    rulesThroughRelationsOf.set(ability.rules, byRelations)
  }
  let cached = byRelations.get(relations)
  if (!cached) {
    cached = new Map()
    byRelations.set(relations, cached)
  }
  const key = `${actions.length === 1 ? actions[0] : actions.join(',')}\0${modelName}`
  let found = cached.get(key)
  if (!found) {
    const rules = new Set<Rule>()
    for (const action of actions) {
      for (const rule of ability.possibleRulesFor(action, modelName)) {
        if (reachesRelation(rule.conditions, relations)) rules.add(rule)
      }
    }
    found = [...rules]
    cached.set(key, found)
  }
  return found
}

/**
 * Whether `ability` may have a rule through one of `service`'s relations: if not, there's nothing
 * to resolve, and nothing is awaited. Two lookups, for every call through `authorize`.
 */
export const mayResolveRelations = (
  service: unknown,
  ability: AnyAbility,
): boolean => hasRelations(getRelations(service)) && mayReachRelations(ability)

/** Whether any of `ability`'s rules for `actions` on `modelName` reaches through a relation. */
export const hasRulesThroughRelations = (
  ability: AnyAbility,
  actions: string[],
  modelName: string,
  relations: Relations,
): boolean =>
  rulesThroughRelations(ability, actions, modelName, relations).length > 0

/**
 * On an ability: whether any of its rules may reach through a relation, for the rules it was
 * worked out for (an `update` makes new ones). On the ability rather than in a `WeakMap`, as it's
 * asked of every connection on every event.
 */
const MAY_REACH_RELATIONS = Symbol('feathers-casl: may reach relations')

/** Operators only a relation's rows answer: `artist.members: { $some }` without a dot. */
const RELATION_OPERATORS = new Set(['$some', '$none', '$every'])

const mayReach = (conditions: unknown): boolean => {
  if (!conditions || typeof conditions !== 'object') return false
  if (Array.isArray(conditions)) return conditions.some(mayReach)
  for (const [key, value] of Object.entries(conditions)) {
    if (key.includes('.') || NESTING.has(key) || RELATION_OPERATORS.has(key)) {
      return true
    }
    if (value && typeof value === 'object' && mayReach(value)) return true
  }
  return false
}

/**
 * Whether any of `ability`'s rules may reach through a relation: a dotted key, a relation's
 * operator, `$and` and the like. Worked out once per ability's rules, for any model: what the
 * channels ask of every connection on every write, so it has to be cheap.
 */
export const mayReachRelations = (ability: AnyAbility): boolean => {
  const holder = ability as unknown as Record<
    symbol,
    { rules: unknown; may: boolean } | undefined
  >
  const known = holder[MAY_REACH_RELATIONS]
  if (known?.rules === ability.rules) return known.may
  const may = ability.rules.some((rule: { conditions?: unknown }) =>
    mayReach(rule.conditions),
  )
  holder[MAY_REACH_RELATIONS] = { rules: ability.rules, may }
  return may
}

/**
 * `ability`, but the rules of `matches` answer `matchesConditions` by it: CASL's `can`,
 * `relevantRuleFor` and `permittedFieldsOf` all ask the rules so, by `possibleRulesFor`. What
 * can't be told counts as the worst: a `can` doesn't match, a `cannot` does.
 */
const withMatches = (
  ability: AnyAbility,
  matches: Map<Rule, Match>,
): AnyAbility => {
  if (!matches.size) return ability
  const wrapped = new Map<Rule, Rule>()
  const wrap = (rule: Rule): Rule => {
    const match = matches.get(rule)
    if (!match) return rule
    let answering = wrapped.get(rule)
    if (!answering) {
      answering = Object.create(rule) as Rule
      answering.matchesConditions = (object: unknown) => {
        // a subject type, not an object: as CASL tells it
        if (!object || typeof object !== 'object') {
          return rule.matchesConditions(object as any)
        }
        return match(object as Item) ?? rule.inverted
      }
      wrapped.set(rule, answering)
    }
    return answering
  }

  return new Proxy(ability, {
    get(target, property, receiver) {
      if (property === 'possibleRulesFor') {
        return (...args: Parameters<AnyAbility['possibleRulesFor']>) =>
          target.possibleRulesFor(...args).map(wrap)
      }
      return Reflect.get(target, property, receiver)
    },
  })
}

/** A rule's conditions as text, keys sorted: two rules with the same conditions read alike. */
const conditionsText = (conditions: unknown) =>
  JSON.stringify(conditions ?? null, (_key, value) =>
    value && typeof value === 'object' && !Array.isArray(value)
      ? Object.fromEntries(
          Object.entries(value).sort(([a], [b]) => (a < b ? -1 : 1)),
        )
      : value,
  )

/** The fields of a row `conditions` depend on: its own, and the key of each relation. */
const dependsOn = (
  conditions: unknown,
  relations: Relations,
  fields = new Set<string>(),
): Set<string> => {
  if (!conditions || typeof conditions !== 'object') return fields
  if (Array.isArray(conditions)) {
    for (const value of conditions) dependsOn(value, relations, fields)
    return fields
  }
  for (const [key, value] of Object.entries(conditions)) {
    if (NESTING.has(key)) {
      dependsOn(value, relations, fields)
      continue
    }
    const name = relationOf(key, relations)
    fields.add(name ? relations[name].keyHere : key.split('.', 1)[0])
  }
  return fields
}

/**
 * Whether the rows a write's query took are readable without asking: each rule that allows the
 * write is one to read by too (the same, or with the same conditions), no rule keeps a row from
 * being read or limits its fields, and `data` changes no field the rules to read by depend on,
 * its own or the key of a relation.
 */
const isReadGuaranteed = (
  ability: AnyAbility,
  writeAction: string,
  readActions: string[],
  modelName: string,
  data: unknown,
  relations: Relations,
): boolean => {
  const read: Rule[] = []
  for (const action of readActions) {
    read.push(...ability.possibleRulesFor(action, modelName))
  }
  if (read.some((rule) => rule.inverted || rule.fields)) return false

  const readsAll = read.some((rule) => !rule.conditions)
  if (!readsAll) {
    const readConditions = new Set(
      read.map((rule) => conditionsText(rule.conditions)),
    )
    for (const rule of ability.possibleRulesFor(writeAction, modelName)) {
      if (rule.inverted || read.includes(rule)) continue
      if (
        !rule.conditions ||
        !readConditions.has(conditionsText(rule.conditions))
      ) {
        return false
      }
    }
  }

  const changed = new Set(
    Object.keys(data ?? {}).map((key) => key.split('.', 1)[0]),
  )
  for (const rule of read) {
    for (const field of dependsOn(rule.conditions, relations)) {
      if (changed.has(field)) return false
    }
  }
  return true
}

/**
 * Whether CASL only asks if any of the rules matches: each a `can` without `fields`, and no
 * `cannot` among the actions' rules. Else the order decides, which rule matches matters.
 */
const anyMatchDecides = (
  ability: AnyAbility,
  actions: string[],
  modelName: string,
  rules: Rule[],
) =>
  rules.every((rule) => !rule.fields) &&
  actions.every((action) =>
    ability.possibleRulesFor(action, modelName).every((rule) => !rule.inverted),
  )

/** The params a check's own query runs with: the caller's, as a transaction, without its query. */
const checkParams = (context: HookContext, query: Record<string, unknown>) => {
  const params: Params = { ...context.params, query, paginate: false }
  delete params.ability
  return params
}

const findRows = async (
  service: any,
  params: Params,
): Promise<Record<string, unknown>[]> => {
  const rows = service._find
    ? await service._find(params)
    : await service.find(params)
  return Array.isArray(rows) ? rows : rows.data
}

/** The ids among `ids` of the rows `conditions` match: one query. */
const findMatchingIds = async (
  context: HookContext,
  idField: string,
  ids: unknown[],
  conditions: Record<string, unknown>,
): Promise<Set<unknown>> => {
  if (!ids.length) return new Set()
  const byId = { [idField]: { $in: ids } }
  const query =
    idField in conditions
      ? { $and: [conditions, byId], $select: [idField] }
      : { ...conditions, ...byId, $select: [idField] }
  const rows = await findRows(context.service, checkParams(context, query))
  return new Set(rows.map((row) => row[idField]))
}

/** The ids of the rows a remove takes away: its id, or what its query finds. */
export const idsToRemove = async (context: HookContext, idField: string) =>
  context.id != null
    ? [context.id]
    : (
        await findRows(
          context.service,
          checkParams(context, { ...context.params.query, $select: [idField] }),
        )
      ).map((row) => row[idField])

/** The rows a remove takes away, whole: by its id and query, or its query. */
export const rowsToRemove = (context: HookContext, idField: string) =>
  findRows(
    context.service,
    checkParams(
      context,
      context.id != null
        ? { ...context.params.query, [idField]: context.id }
        : { ...context.params.query },
    ),
  )

/**
 * `ability`, its rules for `actions` that reach through a relation answered by the database for
 * the stored `items`: one query for all items by their ids, per rule, or for all rules at once
 * where only whether any matches counts. `written`: the items are what a write's query took, so
 * where that guarantees reading them, nothing is asked.
 */
export const resolveRelationsOfItems = async (
  context: HookContext,
  ability: AnyAbility,
  actions: string[],
  modelName: string,
  items: Item[],
  written?: { action: string; data: unknown },
): Promise<AnyAbility> => {
  const relations = getRelations(context.service)
  const rules = rulesThroughRelations(ability, actions, modelName, relations)
  if (!rules.length) return ability

  const matches = new Map<Rule, Match>()
  const answerAll = (match: Match) => {
    for (const rule of rules) matches.set(rule, match)
    return withMatches(ability, matches)
  }
  if (
    written &&
    isReadGuaranteed(
      ability,
      written.action,
      actions,
      modelName,
      written.data,
      relations,
    )
  ) {
    return answerAll(() => true)
  }

  const [idField, ...compound] = getIdFields(context)
  if (!idField || compound.length) return answerAll(() => undefined)

  const ids: unknown[] = [
    ...new Set(items.map((item) => item[idField]).filter((id) => id != null)),
  ]
  const asked = new Set(ids)
  const matchesOf = async (
    conditions: Record<string, unknown>,
  ): Promise<Match> => {
    const found = await findMatchingIds(context, idField, ids, conditions)
    return (object) =>
      asked.has(object[idField]) ? found.has(object[idField]) : undefined
  }

  if (rules.length > 1 && anyMatchDecides(ability, actions, modelName, rules)) {
    return answerAll(
      await matchesOf({ $or: rules.map((rule) => rule.conditions) }),
    )
  }
  for (const rule of rules) {
    matches.set(
      rule,
      await matchesOf(rule.conditions as Record<string, unknown>),
    )
  }
  return withMatches(ability, matches)
}

/** A condition through a relation, replaced by the key its answer is stored under. */
interface Asked {
  key: string
  relation: ServiceRelation
  rest: string
  value: unknown
}

/**
 * `conditions` with each one through a relation replaced by `{ [key]: true }`, `asked` gets what
 * to ask for it. Flat, as CASL's conditions are: CASL has no `$or`, a rule each does; one through
 * a relation in it isn't replaced, see `nestsRelation`.
 */
const replaceRelations = (
  conditions: Record<string, unknown>,
  relations: Relations,
  asked: Asked[],
): Record<string, unknown> => {
  const replaced: Record<string, unknown> = {}
  for (const [key, value] of Object.entries(conditions)) {
    const name = relationOf(key, relations)
    const relation = name ? relations[name] : undefined
    const rest = name ? key.slice(name.length + 1) : ''
    if (!relation || !rest) {
      replaced[key] = value
      continue
    }
    const answer = `__casl_relation_${asked.length}`
    asked.push({ key: answer, relation, rest, value })
    replaced[answer] = true
  }
  return replaced
}

/**
 * `ability`, its rules for `actions` that reach through a relation answered for `data` not stored
 * yet, as a create's: each condition through a relation is asked of the related service, by the
 * keys `data` holds for it (`artistId` for `'artist.name'`), once for all of `data` and every rule
 * with it. The related service reaches further relations itself (`'artist.label.name'`). As the
 * adapter queries: without a related row, `data` without the key included, a condition through it
 * doesn't match, not even `$nin`. One on the relation itself (`artist: null`) is CASL's to read.
 */
export const resolveRelationsOfData = async (
  context: HookContext,
  ability: AnyAbility,
  actions: string[],
  modelName: string,
  data: Item[],
): Promise<AnyAbility> => {
  const relations = getRelations(context.service)
  const rules = rulesThroughRelations(ability, actions, modelName, relations)
  if (!rules.length) return ability

  // per condition through a relation, the keys of the related rows it matches, as text
  const matchingKeys = new Map<string, Promise<Set<string>>>()
  const keysMatching = ({ relation, rest, value }: Asked) => {
    const text = conditionsText([
      relation.service,
      relation.keyThere,
      rest,
      value,
    ])
    let keys = matchingKeys.get(text)
    if (!keys) {
      const asking = [
        ...new Set(
          data
            .map((item) => item[relation.keyHere])
            .filter((key) => key != null),
        ),
      ]
      keys = asking.length
        ? findRows(
            context.app.service(relation.service),
            // apart: a condition on the key itself (`'artist.id'`) mustn't replace it
            checkParams(context, {
              $and: [
                { [relation.keyThere]: { $in: asking } },
                { [rest]: value },
              ],
              $select: [relation.keyThere],
            }),
          ).then(
            (rows) =>
              new Set(rows.map((row) => String(row[relation.keyThere]))),
          )
        : Promise.resolve(new Set<string>())
      matchingKeys.set(text, keys)
    }
    return keys
  }

  const matches = new Map<Rule, Match>()
  for (const rule of rules) {
    // in CASL's matcher, a cannot with `$or` would never match: the worst instead
    if (nestsRelation(rule.conditions, relations)) {
      matches.set(rule, () => undefined)
      continue
    }
    const asked: Asked[] = []
    const conditions = replaceRelations(
      rule.conditions as Record<string, unknown>,
      relations,
      asked,
    )
    const check = createMongoAbility([
      { action: 'match', subject: modelName, conditions } as any,
    ])
    const answers = new Map<Item, boolean>()
    for (const item of data) {
      const answered: Item = { ...item }
      for (const condition of asked) {
        const key = item[condition.relation.keyHere]
        // as the database compares them: `'1'` as `1`
        answered[condition.key] =
          key != null && (await keysMatching(condition)).has(String(key))
      }
      answers.set(item, check.can('match', subject(modelName, answered)))
    }
    matches.set(rule, (object) => answers.get(object))
  }
  return withMatches(ability, matches)
}

/**
 * Per remove, its rules to read by answered before its rows went. Not on `params`: a hook that
 * calls another service with them would hand the answers on.
 */
const answeredBeforeRemove = new WeakMap<HookContext, AnyAbility>()

/** The ability a remove's rules to read by were answered with, before its rows went. */
export const relationsAnsweredBeforeRemove = (context: HookContext) =>
  answeredBeforeRemove.get(context)

/**
 * For a remove, whose rows can't be asked once they're gone: its rules for reading that reach
 * through a relation answered now, for the rows its query finds.
 */
export const resolveRelationsBeforeRemove = async (
  context: HookContext,
  ability: AnyAbility,
  modelName: string,
): Promise<void> => {
  const answered = await answerBeforeRemove(context, ability, modelName)
  if (answered) answeredBeforeRemove.set(context, answered)
}

const answerBeforeRemove = async (
  context: HookContext,
  ability: AnyAbility,
  modelName: string,
): Promise<AnyAbility | undefined> => {
  const actions = ['get', 'find']
  const relations = getRelations(context.service)
  if (!rulesThroughRelations(ability, actions, modelName, relations).length)
    return undefined
  // the rows its query takes are readable, if that guarantees it: nothing to ask then
  const written = { action: 'remove', data: undefined }
  if (
    isReadGuaranteed(
      ability,
      written.action,
      actions,
      modelName,
      written.data,
      relations,
    )
  ) {
    return resolveRelationsOfItems(
      context,
      ability,
      actions,
      modelName,
      [],
      written,
    )
  }

  const [idField] = getIdFields(context)
  if (!idField)
    return resolveRelationsOfItems(context, ability, actions, modelName, [])
  const ids = await idsToRemove(context, idField)
  const items = ids.map((id) => ({ [idField]: id }))
  return resolveRelationsOfItems(context, ability, actions, modelName, items)
}

/** For an event's rows: the ids asked, and per condition of a rule through a relation the ones it matches. */
export interface RelationAnswers {
  ids: Set<unknown>
  matches: Map<string, Set<unknown>>
}

/**
 * For an event, whose channels don't wait for the database: which of its rows (`ids`) each
 * condition through a relation of the `abilities`' rules for `action` matches. Once per distinct
 * condition, for all rows at once.
 */
export const resolveRelationsOfEvent = async (
  context: HookContext,
  abilities: AnyAbility[],
  action: string,
  modelName: string,
  ids: unknown[],
): Promise<RelationAnswers | undefined> => {
  const relations = getRelations(context.service)
  const [idField, ...compound] = getIdFields(context)
  if (!idField || compound.length) return undefined

  const conditions = new Map<string, Record<string, unknown>>()
  for (const ability of abilities) {
    for (const rule of rulesThroughRelations(
      ability,
      [action],
      modelName,
      relations,
    )) {
      conditions.set(
        conditionsText(rule.conditions),
        rule.conditions as Record<string, unknown>,
      )
    }
  }
  if (!conditions.size) return undefined

  const answers: RelationAnswers = { ids: new Set(ids), matches: new Map() }
  for (const [text, condition] of conditions) {
    answers.matches.set(
      text,
      await findMatchingIds(context, idField, ids, condition),
    )
  }
  return answers
}

/**
 * `ability`, its rules for `actions` through a relation answered by `answers`, for the rows they
 * were asked for. What wasn't asked counts as the worst: a `can` doesn't match, a `cannot` does;
 * `onUnanswered` hears of it.
 */
export const answerRelations = (
  context: HookContext,
  ability: AnyAbility,
  actions: string[],
  modelName: string,
  answers: RelationAnswers | undefined,
  onUnanswered?: () => void,
): AnyAbility => {
  if (!mayReachRelations(ability)) return ability
  const relations = getRelations(context.service)
  const rules = rulesThroughRelations(ability, actions, modelName, relations)
  if (!rules.length) return ability

  const [idField] = getIdFields(context)
  const matches = new Map<Rule, Match>()
  for (const rule of rules) {
    const found = answers?.matches.get(conditionsText(rule.conditions))
    matches.set(rule, (object) => {
      if (found && answers!.ids.has(object[idField])) {
        return found.has(object[idField])
      }
      onUnanswered?.()
      return undefined
    })
  }
  return withMatches(ability, matches)
}
