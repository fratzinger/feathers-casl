import { Ability, AnyAbility } from "@casl/ability";

import { Application, HookContext } from "@feathersjs/feathers";
import { RealTimeConnection } from "@feathersjs/transport-commons/lib/channels/channel/base";

import {
  ChannelOptions,
  InitOptions
} from "../types";
import getAvailableFields from "../utils/getAvailableFields";

import { getContextPath } from "../utils/getDefaultModelName";

export const makeOptions = (app: Application, options?: Partial<ChannelOptions>): ChannelOptions => {
  if (!app) {
    throw new Error("feathers-casl: You need to provide an 'app' to the channels:makeOptions function");
  }
  options = options || {};
  return Object.assign({}, defaultOptions, getAppOptions(app), options);
};

const defaultOptions: ChannelOptions = {
  activated: true,
  channelOnError: ["authenticated"],
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  ability: ((app: Application, connection: RealTimeConnection, data: Record<string, unknown>, context: HookContext): Ability => {
    return connection.ability;
  }),
  modelName: getContextPath,
  restrictFields: true,
  availableFields: (context: HookContext): string[] => {
    const availableFields: string[] | ((context: HookContext) => string[]) = context.service.options?.casl?.availableFields;
    return getAvailableFields(context, { availableFields });
  }
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