import assert from "node:assert";
import "@feathersjs/transport-commons";
import type {
  HookContext,
  Params,
  RealTimeConnection,
} from "@feathersjs/feathers";

import { getChannelsWithReadAbility, makeChannelOptions } from "../../../src";
import type { Application } from "@feathersjs/express";

export default function (app: Application): void {
  if (typeof app.channel !== "function") {
    return;
  }

  app.on("connection", (connection: RealTimeConnection): void => {
    app.channel("anonymous").join(connection);
  });

  app.on("login", (authResult: any, params: Params): void => {
    const { connection } = params;
    if (connection) {
      if (authResult.ability) {
        connection.ability = authResult.ability;
        connection.rules = authResult.rules;
      }

      app.channel("anonymous").leave(connection);
      app.channel("authenticated").join(connection);
    }
  });

  const caslOptions = makeChannelOptions(app, {
    useActionName: {
      created: "receive-created",
      patched: "receive-patched",
      removed: "receive-removed",
      updated: "receive-updated",
    },
  });

  //@ts-ignore
  const fields = caslOptions.availableFields({
    service: app.service("users"),
  });

  assert.deepStrictEqual(
    fields,
    ["id", "email", "password"],
    "gets availableFields from service correctly"
  );

  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  app.publish((data: unknown, context: HookContext) => {
    const result = getChannelsWithReadAbility(
      app,
      data as Record<string, unknown>,
      context,
      caslOptions
    );

    // e.g. to publish all service events to all authenticated users use
    return result;
  });
}
