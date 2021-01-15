import { Ability } from "@casl/ability";

import { Application, HookContext } from "@feathersjs/feathers";
import { RealTimeConnection } from "@feathersjs/transport-commons/lib/channels/channel/base";

import {
  ChannelOptions,
  InitOptions
} from "../types";

import { getContextPath } from "../utils/getDefaultModelName";

export const makeOptions = (app: Application, options?: Partial<ChannelOptions>): ChannelOptions => {
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
  restrictFields: true
};

export const makeDefaultOptions = (options?: Partial<ChannelOptions>): ChannelOptions => {
  return Object.assign({}, defaultOptions, options || {});
};