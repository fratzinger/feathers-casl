import "@feathersjs/transport-commons";

import { Channel } from "@feathersjs/transport-commons/lib/channels/channel/base";

import { 
  makeOptions
} from "./channels.utils";

import getModelName from "../utils/getModelName";

import type { HookContext, Application } from "@feathersjs/feathers";
import type { ChannelOptions } from "../types";
import filterChannels from "./filterChannels";

export default (
  app: Application, 
  data: Record<string, any>, 
  context: HookContext, 
  _options?: Partial<ChannelOptions>
): Channel | Channel[] => {
  const { channels } = app;
  
  // skip if there are no channels
  if (!channels?.length) { return undefined; }

  const options = makeOptions(app, _options);
  const { channelOnError, activated } = options;
  const modelName = getModelName(options.modelName, context);

  if (!activated || !modelName) {
    return (!channelOnError) ? new Channel() : app.channel(channelOnError);
  }

  return filterChannels(
    app,
    data,
    context,
    app.channel(channels),
    options
  );
};