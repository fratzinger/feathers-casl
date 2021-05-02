import { HookContext } from "@feathersjs/feathers";
import { AnyAbility } from "@casl/ability";
import { Application } from "@feathersjs/feathers";
import "@feathersjs/transport-commons";
import { RealTimeConnection } from "@feathersjs/transport-commons/lib/channels/channel/base";


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

export type CheckBasicPermissionHookOptionsExclusive = Pick<CheckBasicPermissionHookOptions, Exclude<keyof CheckBasicPermissionHookOptions, keyof HookBaseOptions>>

export interface AuthorizeHookOptions extends HookBaseOptions {
  adapter: Adapter
  availableFields: string[] | ((context: HookContext) => string[])
}

export type AuthorizeHookOptionsExclusive = Pick<AuthorizeHookOptions, Exclude<keyof AuthorizeHookOptions, keyof HookBaseOptions>>


export type GetModelName = string | ((context: HookContext) => string)

export interface ChannelOptions {
  ability: AnyAbility | ((app: Application, connection: RealTimeConnection, data: unknown, context: HookContext) => AnyAbility)
  activated: boolean
  availableFields: string[] | ((context: HookContext) => string[])
  channelOnError: string[]
  modelName: GetModelName
  restrictFields: boolean
}

export interface GetConditionalQueryOptions {
  actionOnForbidden?(): void
}

// eslint-disable-next-line @typescript-eslint/no-empty-interface
export interface GetFieldsQueryOptions extends HasRestrictingFieldsOptions {
  
}

export interface GetQueryOptions 
  extends GetConditionalQueryOptions, GetFieldsQueryOptions {
  skipConditional?: boolean
  skipFields?: boolean
}

export interface HasRestrictingFieldsOptions {
  availableFields: string[]
}

export interface InitOptions {
  authorizeHook: AuthorizeHookOptions
  channels: ChannelOptions
}

export interface GetMinimalFieldsOptions {
  availableFields?: string[],
  checkCan?: boolean
}

export type Path = string|Array<string|number>;