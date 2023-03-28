import { getAvailableFields } from "../utils";

import type { Ability, AnyAbility } from "@casl/ability";

import type { Application, HookContext } from "@feathersjs/feathers";
import type { RealTimeConnection } from "@feathersjs/transport-commons";

import type { ChannelOptions, EventName, InitOptions } from "../types";

export const makeChannelOptions = (
  app: Application,
  options?: Partial<ChannelOptions>
): ChannelOptions => {
  options = options || {};
  return Object.assign({}, defaultOptions, getAppOptions(app), options);
};

const defaultOptions: Omit<ChannelOptions, "channels"> = {
  activated: true,
  channelOnError: ["authenticated"],
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  ability: (
    app: Application,
    connection: RealTimeConnection,
    data: any,
    context: HookContext
  ): Ability => {
    return connection.ability;
  },
  modelName: (context) => context.path,
  restrictFields: true,
  availableFields: (context: HookContext): string[] | undefined => {
    const availableFields: string[] | ((context: HookContext) => string[]) =
      context.service.options?.casl?.availableFields;
    return getAvailableFields(context, { availableFields });
  },
  useActionName: "get",
};

export const makeDefaultOptions = (
  options?: Partial<ChannelOptions>
): ChannelOptions => {
  return Object.assign({}, defaultOptions, options);
};

const getAppOptions = (
  app: Application
): ChannelOptions | Record<string, never> => {
  const caslOptions: InitOptions = app?.get("casl");
  return caslOptions && caslOptions.channels ? caslOptions.channels : {};
};

export const getAbility = (
  app: Application,
  data: Record<string, unknown>,
  connection: RealTimeConnection,
  context: HookContext,
  options: Partial<ChannelOptions>
): undefined | AnyAbility => {
  if (options.ability) {
    return typeof options.ability === "function"
      ? options.ability(app, connection, data, context)
      : options.ability;
  } else {
    return connection.ability;
  }
};

export const getEventName = (method: string): EventName | undefined => {
  if (method === "create") {
    return "created";
  } else if (method === "update") {
    return "updated";
  } else if (method === "patch") {
    return "patched";
  } else if (method === "remove") {
    return "removed";
  }
  return undefined;
};
