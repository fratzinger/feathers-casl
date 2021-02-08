import { HookContext } from "@feathersjs/feathers";
import { PureAbility } from "@casl/ability";
import { Application } from "@feathersjs/feathers";
import "@feathersjs/transport-commons";
import { RealTimeConnection } from "@feathersjs/transport-commons/lib/channels/channel/base";

export interface ServiceCaslOptions {
  availableFields: string[]
}

export interface AuthorizeHookOptions {
  ability?: PureAbility | ((context: HookContext) => PureAbility | Promise<PureAbility>)
  actionOnForbidden?: (() => void)
  availableFields?: string[] | ((context: HookContext) => string[])
  checkMultiActions?: boolean
  modelName?: GetModelName
}

export type GetModelName = string | ((context: HookContext) => string)

export interface ChannelOptions {
  ability?: PureAbility | ((app: Application, connection: RealTimeConnection, data: unknown, context: HookContext) => PureAbility)
  activated?: boolean
  availableFields?: string[] | ((context: HookContext) => string[])
  channelOnError?: string[]
  modelName?: GetModelName
  restrictFields?: boolean
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