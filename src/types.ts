import type { HookContext, Application } from "@feathersjs/feathers";
import type { AnyAbility, AnyMongoAbility } from "@casl/ability";
import "@feathersjs/transport-commons";
import type {
  Channel,
  RealTimeConnection,
} from "@feathersjs/transport-commons";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export type AnyData = Record<string, any>;

export type Adapter =
  | "@feathersjs/memory"
  | "@feathersjs/knex"
  | "@feathersjs/mongodb"
  // | "feathers-mongoose"
  // | "feathers-nedb"
  // | "feathers-objection"
  | "feathers-sequelize";

export interface ServiceCaslOptions {
  availableFields: string[];
}

export interface CaslParams<A extends AnyMongoAbility = AnyMongoAbility> {
  ability?: A;
  casl?: {
    ability: A | (() => A);
  };
}

export interface HookBaseOptions<H extends HookContext = HookContext> {
  ability: AnyAbility | ((context: H) => AnyAbility | Promise<AnyAbility>);
  actionOnForbidden: undefined | (() => void);
  checkAbilityForInternal: boolean;
  checkMultiActions: boolean;
  modelName: GetModelName;
  idField: string;
  notSkippable: boolean;
  method?: string | ((context: H) => string);
}

export interface CheckBasicPermissionHookOptions<
  H extends HookContext = HookContext
> extends HookBaseOptions<H> {
  checkCreateForData: boolean | ((context: H) => boolean);
  storeAbilityForAuthorize: boolean;
}

export type CheckBasicPermissionUtilsOptions<
  H extends HookContext = HookContext
> = Omit<CheckBasicPermissionHookOptions<H>, "notSkippable">;

export type CheckBasicPermissionHookOptionsExclusive<
  H extends HookContext = HookContext
> = Pick<
  CheckBasicPermissionHookOptions<H>,
  Exclude<keyof CheckBasicPermissionHookOptions, keyof HookBaseOptions>
>;

export type AvailableFieldsOption<H extends HookContext = HookContext> =
  | string[]
  | ((context: H) => string[] | undefined)
  | undefined;

export interface AuthorizeChannelCommonsOptions<
  H extends HookContext = HookContext
> {
  availableFields: AvailableFieldsOption<H>;
}

export interface AuthorizeHookOptions<H extends HookContext = HookContext>
  extends HookBaseOptions<H>,
    AuthorizeChannelCommonsOptions<H> {
  adapter: Adapter;
  checkRequestData: boolean;
  checkRequestDataSameRules: boolean;
}

export type AuthorizeHookOptionsExclusive<H extends HookContext = HookContext> =
  Pick<
    AuthorizeHookOptions<H>,
    Exclude<keyof AuthorizeHookOptions<H>, keyof HookBaseOptions<H>>
  >;

export type GetModelName<H extends HookContext = HookContext> =
  | string
  | ((context: H) => string);

export type EventName = "created" | "updated" | "patched" | "removed";

export interface ChannelOptions extends AuthorizeChannelCommonsOptions {
  ability:
    | AnyAbility
    | ((
        app: Application,
        connection: RealTimeConnection,
        data: unknown,
        context: HookContext
      ) => AnyAbility);
  /** Easy way to disable filtering, default: `false` */
  activated: boolean;
  /** Channel that's used when there occurs an error, default: `['authenticated']` */
  channelOnError: string[];
  /** Prefiltered channels, default: `app.channel(app.channels)` */
  channels?: Channel | Channel[];
  modelName: GetModelName;
  restrictFields: boolean;
  /** change action to use for events. For example: `'receive'`, default: `'get'` */
  useActionName: string | { [e in EventName]?: string };
}

export interface GetConditionalQueryOptions {
  actionOnForbidden?(): void;
}

export interface HasRestrictingFieldsOptions {
  availableFields: string[] | undefined;
}

export interface InitOptions<H extends HookContext = HookContext> {
  defaultAdapter: Adapter;
  authorizeHook: AuthorizeHookOptions<H>;
  channels: ChannelOptions;
}

export interface GetMinimalFieldsOptions {
  availableFields?: string[];
  checkCan?: boolean;
}

export type Path = string | Array<string | number>;

export interface ThrowUnlessCanOptions
  extends Pick<HookBaseOptions, "actionOnForbidden"> {
  skipThrow: boolean;
}

export interface UtilCheckCanOptions extends ThrowUnlessCanOptions {
  checkGeneral?: boolean;
  useConditionalSelect?: boolean;
}
