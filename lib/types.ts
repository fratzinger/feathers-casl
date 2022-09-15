import type { HookContext } from "@feathersjs/feathers";
import type { AnyAbility } from "@casl/ability";
import type { Application } from "@feathersjs/feathers";
import "@feathersjs/transport-commons";
import type { Channel, RealTimeConnection } from "@feathersjs/transport-commons/lib/channels/channel/base";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export type AnyData = Record<string, any>


export type Adapter = 
  "feathers-knex" |
  "feathers-memory" |
  "feathers-mongodb" |
  "feathers-mongoose" |
  "feathers-nedb" |
  "feathers-objection" |
  "feathers-sequelize";

export interface ServiceCaslOptions {
  availableFields: string[]
}

export interface HookBaseOptions {
  ability: AnyAbility | ((context: HookContext) => AnyAbility | Promise<AnyAbility>)
  actionOnForbidden: undefined | (() => void)
  checkAbilityForInternal: boolean
  checkMultiActions: boolean
  modelName: GetModelName
  notSkippable: boolean
}

export interface CheckBasicPermissionHookOptions extends HookBaseOptions {
  checkCreateForData: boolean | ((context: HookContext) => boolean)
  storeAbilityForAuthorize: boolean
}

export type CheckBasicPermissionUtilsOptions = Omit<CheckBasicPermissionHookOptions, "notSkippable">;

export type CheckBasicPermissionHookOptionsExclusive = Pick<CheckBasicPermissionHookOptions, Exclude<keyof CheckBasicPermissionHookOptions, keyof HookBaseOptions>>

export type AvailableFieldsOption = string[] | ((context: HookContext) => string[]);

export interface AuthorizeChannelCommonsOptions {
  availableFields: AvailableFieldsOption
}

export interface AuthorizeHookOptions extends HookBaseOptions, AuthorizeChannelCommonsOptions {
  adapter: Adapter
  useUpdateData: boolean
  usePatchData: boolean
}

export type AuthorizeHookOptionsExclusive = Pick<AuthorizeHookOptions, Exclude<keyof AuthorizeHookOptions, keyof HookBaseOptions>>


export type GetModelName = string | ((context: HookContext) => string)

export type EventName = "created" | "updated" | "patched" | "removed";


export interface ChannelOptions extends AuthorizeChannelCommonsOptions {
  ability: AnyAbility | ((app: Application, connection: RealTimeConnection, data: unknown, context: HookContext) => AnyAbility)
  /** Easy way to disable filtering, default: `false` */
  activated: boolean
  /** Channel that's used when there occures an error, default: `['authenticated']` */
  channelOnError: string[]
  /** Prefiltered channels, default: `app.channel(app.channels)` */
  channels: Channel | Channel[]
  modelName: GetModelName
  restrictFields: boolean
  /** change action to use for events. For example: `'receive'`, default: `'get'` */
  useActionName: string | { [e in EventName]?: string }
}

export interface GetConditionalQueryOptions {
  actionOnForbidden?(): void
}

export interface HasRestrictingFieldsOptions {
  availableFields: string[]
}

export interface InitOptions {
  defaultAdapter: Adapter
  authorizeHook: AuthorizeHookOptions
  channels: ChannelOptions
}

export interface GetMinimalFieldsOptions {
  availableFields?: string[],
  checkCan?: boolean
}

export type Path = string|Array<string|number>;

export interface ThrowUnlessCanOptions extends Pick<HookBaseOptions, "actionOnForbidden"> {
  skipThrow: boolean
}

export interface UtilCheckCanOptions extends ThrowUnlessCanOptions {
  checkGeneral?: boolean,
  useConditionalSelect?: boolean
}