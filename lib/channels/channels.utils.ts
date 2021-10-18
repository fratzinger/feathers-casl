import getAvailableFields from "../utils/getAvailableFields";
import { getContextPath } from "../utils/getDefaultModelName";

import type { Ability, AnyAbility } from "@casl/ability";

import type { Application, HookContext } from "@feathersjs/feathers";
import type { RealTimeConnection } from "@feathersjs/transport-commons/lib/channels/channel/base";

import type {
  ChannelOptions,
  EventName,
  InitOptions
} from "../types";

export const makeOptions = (
  app: Application, 
  options?: Partial<ChannelOptions>
): ChannelOptions => {
  options = options || {};
  return Object.assign({}, defaultOptions, getAppOptions(app), options);
};

const defaultOptions: ChannelOptions = {
  activated: true,
  channelOnError: ["authenticated"],
  channels: undefined,
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  ability: ((app: Application, connection: RealTimeConnection, data: Record<string, unknown>, context: HookContext): Ability => {
    return connection.ability;
  }),
  modelName: getContextPath,
  restrictFields: true,
  availableFields: (context: HookContext): string[] => {
    const availableFields: string[] | ((context: HookContext) => string[]) = context.service.options?.casl?.availableFields;
    return getAvailableFields(context, { availableFields });
  },
  useActionName: "get"
};

export const makeDefaultOptions = (options?: Partial<ChannelOptions>): ChannelOptions => {
  return Object.assign({}, defaultOptions, options);
};

const getAppOptions = (app: Application): ChannelOptions | Record<string, never> => {
  const caslOptions: InitOptions = app?.get("casl");
  return (caslOptions && caslOptions.channels)
    ? caslOptions.channels
    : {};
};

export const getAbility = (
  app: Application, 
  data: Record<string, unknown>,
  connection: RealTimeConnection,
  context: HookContext,
  options: Partial<ChannelOptions>
): undefined | AnyAbility => {
  if (options.ability) {
    return (typeof options.ability === "function") ?
      options.ability(app, connection, data, context) :
      options.ability;
  } else {
    return connection.ability;
  }
};

export const getEventName = (
  method: "find" | "get" | "create" | "update" | "patch" | "remove"
): EventName => {
  if (method === "create") { return "created"; }
  else if (method === "update") { return "updated"; }
  else if (method === "patch") { return "patched"; }
  else if (method === "remove") { return "removed"; }
  return undefined;
};