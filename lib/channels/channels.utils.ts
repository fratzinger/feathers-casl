import { Ability } from "@casl/ability";

import { Application, HookContext } from "@feathersjs/feathers";
import { RealTimeConnection } from "@feathersjs/transport-commons/lib/channels/channel/base";

import {
  ChannelOptions,
  InitOptions
} from "../types";

import { getContextPath } from "../utils/getDefaultModelName";

export const makeOptions = (app: Application, options?: Partial<ChannelOptions>): ChannelOptions => {
  if (!app) {
    throw new Error("feathers-casl: You need to provide an 'app' to the channels:makeOptions function");
  }
  options = options || {};
  const caslOptions: InitOptions|undefined = app.get("casl");
  const appOptions = caslOptions?.channels || makeDefaultOptions();
  return Object.assign(appOptions, options);
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
    if (!availableFields) return undefined;
    return (typeof availableFields === "function")
      ? availableFields(context)
      : availableFields;
  }
};

export const makeDefaultOptions = (options?: Partial<ChannelOptions>): ChannelOptions => {
  return Object.assign({}, defaultOptions, options || {});
};