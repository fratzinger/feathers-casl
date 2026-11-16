import type { HookContext, Application } from '@feathersjs/feathers'
import type { AnyAbility, AnyMongoAbility } from '@casl/ability'
import '@feathersjs/transport-commons'
import type { Channel, RealTimeConnection } from '@feathersjs/transport-commons'

export type AnyData = Record<string, any>

export type Adapter =
  | '@feathersjs/memory'
  | '@feathersjs/knex'
  | '@feathersjs/mongodb'
  | 'feathers-sequelize'
  | 'feathers-kysely'

export interface ServiceCaslOptions {
  availableFields?: string[]
}

/**
 * A relation of a service, as feathers-kysely declares it in `options.relations`: a rule's
 * condition reaches through it by its name (`'artist.name'`).
 */
export interface ServiceRelation {
  service: string
  keyHere: string
  keyThere: string
  asArray?: boolean
}

export interface CaslParams<A extends AnyMongoAbility = AnyMongoAbility> {
  ability?: A | ((context: HookContext) => A | Promise<A>)
  casl?: {
    ability: A | (() => A)
  }
}

export interface HookBaseOptions<H extends HookContext = HookContext> {
  ability: AnyAbility | ((context: H) => AnyAbility | Promise<AnyAbility>)
  actionOnForbidden: undefined | (() => void)
  checkAbilityForInternal: boolean
  checkMultiActions: boolean
  modelName: GetModelName
  notSkippable: boolean
  method?: string | ((context: H) => string)
  debug?: boolean
}

export interface CheckBasicPermissionHookOptions<
  H extends HookContext = HookContext,
> extends HookBaseOptions<H> {
  checkCreateForData: boolean | ((context: H) => boolean)
  storeAbilityForAuthorize: boolean
}

export type CheckBasicPermissionUtilsOptions<
  H extends HookContext = HookContext,
> = Omit<CheckBasicPermissionHookOptions<H>, 'notSkippable'>

export type CheckBasicPermissionHookOptionsExclusive<
  H extends HookContext = HookContext,
> = Pick<
  CheckBasicPermissionHookOptions<H>,
  Exclude<keyof CheckBasicPermissionHookOptions, keyof HookBaseOptions>
>

export type AvailableFieldsOption<H extends HookContext = HookContext> =
  string[] | ((context: H) => string[] | undefined) | undefined

export interface AuthorizeChannelCommonsOptions<
  H extends HookContext = HookContext,
> {
  availableFields: AvailableFieldsOption<H>
}

export interface AuthorizeHookOptions<H extends HookContext = HookContext>
  extends HookBaseOptions<H>, AuthorizeChannelCommonsOptions<H> {
  adapter: Adapter
  useUpdateData: boolean
  usePatchData: boolean
}

export type AuthorizeHookOptionsExclusive<H extends HookContext = HookContext> =
  Pick<
    AuthorizeHookOptions<H>,
    Exclude<keyof AuthorizeHookOptions<H>, keyof HookBaseOptions<H>>
  >

export type GetModelName<H extends HookContext = HookContext> =
  string | ((context: H) => string)

export type EventName = 'created' | 'updated' | 'patched' | 'removed'

export interface ChannelOptions extends AuthorizeChannelCommonsOptions {
  ability:
    | AnyAbility
    | ((
        app: Application,
        connection: RealTimeConnection,
        data: unknown,
        context: HookContext,
      ) => AnyAbility)
  /** Easy way to disable filtering, default: `false` */
  activated: boolean
  /** Channel that's used when there occurs an error, default: `['authenticated']` */
  channelOnError: string[]
  /**
   * Prefiltered channels, or per event's data, default: `app.channel(app.channels)`. In the app's
   * options, it's also whose rules `authorize` answers for a write's events.
   */
  channels?:
    | Channel
    | Channel[]
    | ((data: AnyData, context: HookContext) => Channel | Channel[])
  modelName: GetModelName
  restrictFields: boolean
  /** Warns once per event of a rule through a relation without an answer, default: `false` */
  debug?: boolean
  /** change action to use for events. For example: `'receive'`, default: `'get'` */
  useActionName: string | { [e in EventName]?: string }
}

export interface GetConditionalQueryOptions {
  actionOnForbidden?(): void
}

export interface HasRestrictingFieldsOptions {
  availableFields: string[] | undefined
}

export interface InitOptions<H extends HookContext = HookContext> {
  defaultAdapter: Adapter
  authorizeHook: AuthorizeHookOptions<H>
  channels: ChannelOptions
}

export interface GetMinimalFieldsOptions {
  availableFields?: string[]
  checkCan?: boolean
}

export type Path = string | Array<string | number>

export interface ThrowUnlessCanOptions extends Pick<
  HookBaseOptions,
  'actionOnForbidden' | 'debug'
> {
  skipThrow: boolean
}

export interface UtilCheckCanOptions extends ThrowUnlessCanOptions {
  checkGeneral?: boolean
  useConditionalSelect?: boolean
}
