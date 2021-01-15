import { HookContext } from "@feathersjs/feathers";
import { PureAbility } from "@casl/ability";
import { Application } from "@feathersjs/feathers";
import "@feathersjs/transport-commons";
import { RealTimeConnection } from "@feathersjs/transport-commons/lib/channels/channel/base";

export interface AuthorizeHookOptions {
  actionOnForbidden?(): void
  checkMultiActions?: boolean
  ability?: PureAbility | ((context: HookContext) => PureAbility | Promise<PureAbility>)
  getModelName?: GetModelName
}

export type SubjectHelper = (type: string, object: Record<string, unknown>, context?: HookContext) => Record<string, unknown>;
export type GetModelName = (context: HookContext) => string

export interface ChannelOptions {
  activated?: boolean
  channelOnError?: string[]
  ability?: PureAbility | ((app: Application, connection: RealTimeConnection, data: unknown, context: HookContext) => PureAbility)
  getModelName?: GetModelName
  restrictFields?: boolean
}

export interface GetConditionalQueryOptions {
  actionOnForbidden?(): void
}

export interface GetQueryOptions {
  skipConditional?: boolean
  skipFields?: boolean
}

export interface InitOptions {
  authorizeHook: AuthorizeHookOptions
  channels: ChannelOptions
}

export type Path = string|Array<string|number>;