import { HookContext, Application } from "@feathersjs/feathers";
import _isEqual from "lodash/isEqual";
import _pick from "lodash/pick";
import _isEmpty from "lodash/isEmpty";
import "@feathersjs/transport-commons";
import { subject } from "@casl/ability";

import { makeOptions } from "./channels.utils";

import getModelName from "../utils/getModelName";
import hasRestrictingFields from "../utils/hasRestrictingFields";

import { Channel, RealTimeConnection } from "@feathersjs/transport-commons/lib/channels/channel/base";
import { ChannelOptions } from "../types";

export default (app: Application, data: unknown, context: HookContext, options?: Partial<ChannelOptions>): Channel|Channel[] => {
  options = makeOptions(app, options);
  const { channelOnError, activated } = options;
  const modelName = getModelName(options.modelName, context);

  if (!activated || !modelName) {
    return (!channelOnError) ? new Channel() : app.channel(channelOnError);
  }

  const { channels } = app;
  //return app.channel(channels);
  const allConnections = app.channel(channels).connections;

  const dataToTest = subject(modelName, data as Record<string, unknown>);

  if (!options.restrictFields) {
    // return all fields for allowed 
    let connections = allConnections
      .filter(connection => {
        if (!options.ability) return false;
        const ability = 
          (typeof options.ability === "function") ?
            options.ability(app, connection, data, context) :
            options.ability;
        return ability && ability.can("read", dataToTest);
      });
    connections = [...new Set(connections)];
    return new Channel(connections, data);
  } else {
    // filter by restricted Fields
    const connectionsPerFields: { fields: string[]|false, connections: RealTimeConnection[]}[] = [];
    for (let i = 0, n = allConnections.length; i < n; i++) {
      const connection = allConnections[i];
      const { ability } = connection;
      if (!ability || !ability.can("read", dataToTest)) {
        // connection cannot read item -> don't send data
        continue; 
      }
      const fields = hasRestrictingFields(ability, "read", dataToTest);
      const connField = connectionsPerFields.find(x => _isEqual(x.fields, fields));
      if (connField) {
        if (connField.connections.indexOf(connection) !== -1) {
          // connection is already in array -> skip
          continue; 
        }
        connField.connections.push(connection);
      } else {
        connectionsPerFields.push({
          connections: [connection],
          fields: fields
        });
      }
    }
    const channels: Channel[] = [];
    for (let i = 0, n = connectionsPerFields.length; i < n; i++) {
      const { fields, connections } = connectionsPerFields[i];
      const restrictedData = 
      (fields) 
        ? _pick(data, fields)
        : data;
      if (!_isEmpty(restrictedData)) {
        channels.push(new Channel(connections, restrictedData));
      }
    }
    return channels.length === 1 
      ? channels[0]
      : channels;
  }
};