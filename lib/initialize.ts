import { 
  makeDefaultOptions as makeDefaultAuthorizeHookOptions
} from "./hooks/authorize/authorize.hook.utils";

import { 
  makeDefaultOptions as makeDefaultChannelsOptions
} from "./channels/channels.utils";

import type { Application } from "@feathersjs/feathers";
import type { PartialDeep } from "type-fest";
import type { AuthorizeHookOptions, ChannelOptions, InitOptions } from "./types";

export default (options?: PartialDeep<InitOptions>): ((app: Application) => void) => {
  // eslint-disable-next-line @typescript-eslint/ban-ts-comment
  //@ts-ignore
  if (options?.version) {
    // asserts that you call app.configure(casl({})) instead of app.configure(casl)
    throw new Error("You passed 'feathers-casl' to app.configure() without a function. You probably wanted to call app.configure(casl({}))!");
  }
  options = {
    defaultAdapter: options?.defaultAdapter || "feathers-memory",
    authorizeHook: makeDefaultAuthorizeHookOptions(options?.authorizeHook as undefined|Partial<AuthorizeHookOptions>),
    channels: makeDefaultChannelsOptions(options?.channels as undefined|Partial<ChannelOptions>)
  };
  return (app: Application): void => {
    if (app.get("casl")) { 
      return;
    }
    app.set("casl", options);
  };
};

