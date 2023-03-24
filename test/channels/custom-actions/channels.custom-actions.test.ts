import assert from "node:assert";
import type { Application } from "@feathersjs/feathers";
import { feathers } from "@feathersjs/feathers";
import socketio from "@feathersjs/socketio-client";
import type { Server } from "node:http";
import { io } from "socket.io-client";

import { mockServer } from "../.mockServer";
import channels1 from "./mockChannels.custom-actions";
import services1 from "./mockServices.custom-actions";
import getPort from "get-port";
import { promiseTimeout } from "../../test-utils";

describe("channels.custom-actions.test.ts", function () {
  let server: Server;
  let app: Application;

  const clients: Application[] = [];
  let users: Record<string, unknown>[] = [
    { id: 0, email: "1", password: "1" },
    { id: 1, email: "2", password: "2" },
    { id: 2, email: "3", password: "3" },
    { id: 3, email: "4", password: "4" },
    { id: 4, email: "5", password: "5" },
  ];

  beforeAll(async function () {
    const mock = mockServer({
      channels: channels1,
      services: services1,
    });
    // eslint-disable-next-line prefer-destructuring
    app = mock.app;

    const port = await getPort();
    app.set("port", port);

    server = await app.listen(port);
    await new Promise((resolve) => {
      server.on("listening", resolve);
    });

    users = await app.service("users").create(users);

    const promises = users.map(async (user) => {
      const socket = io(`http://localhost:${port}`);
      const client = feathers();
      client.configure(socketio(socket));
      clients.push(client);
      await client.service("authentication").create({
        strategy: "local",
        email: user.email,
        password: user.email,
      });
    });

    const socket = io(`http://localhost:${port}`);
    const client = feathers();
    client.configure(socketio(socket));
    clients.push(client);

    await Promise.all(promises);
  });

  afterAll(async function () {
    server.close();
  });

  const checkClient = async (
    servicePath: string,
    methodName: string,
    event: string,
    expectedPerClient: unknown,
    i: number
  ) => {
    assert.ok(
      Object.prototype.hasOwnProperty.call(expectedPerClient, i),
      `client${i} has expected value`
    );
    const expected = expectedPerClient[i];
    const fulFill = new Promise((resolve) => {
      clients[i].service(servicePath).on(event, (result) => {
        if (expected) {
          assert.deepStrictEqual(
            result,
            expected,
            `'client${i}:${servicePath}:${methodName}': result is expected`
          );
        }
        resolve(result);
      });
    });

    if (expected) {
      await assert.doesNotReject(
        promiseTimeout(
          100,
          fulFill,
          `'client${i}:${servicePath}:${methodName}': timeout`
        ).finally(() => {
          clients[i].service(servicePath).removeAllListeners(event);
        }),
        `'client${i}:${servicePath}:${methodName}': receives message`
      );
    } else {
      await assert.rejects(
        promiseTimeout(
          80,
          fulFill,
          `'client${i}:${servicePath}:${methodName}': timeout`
        ).finally(() => {
          clients[i].service(servicePath).removeAllListeners(event);
        }),
        () => true,
        `'client${i}:${servicePath}:${methodName}': does not receive message`
      );
    }
  };

  it("users receive events", async function () {
    const services = ["articles", "comments"];

    for (let i = 0, n = services.length; i < n; i++) {
      const servicePath = services[i];

      const methods = {
        create: {
          params: [{ id: 0, published: true, test: true, userId: 4 }],
          event: "created",
          expectedPerClient: {
            0: { id: 0, published: true, test: true, userId: 4 },
            1:
              servicePath === "articles"
                ? { id: 0, published: true, test: true, userId: 4 }
                : false,
            2: false,
            3: { id: 0, published: true, test: true, userId: 4 },
            4: servicePath === "articles" ? false : { id: 0 },
            5: false,
          },
        },
        update: {
          params: [0, { test: false, userId: 4 }],
          event: "updated",
          expectedPerClient: {
            0: { id: 0, test: false, userId: 4 },
            1: servicePath === "comments" ? { test: false } : false,
            2: false,
            3: { id: 0, test: false, userId: 4 },
            4: false,
            5: false,
          },
        },
        patch: {
          params: [0, { test: true, userId: 1, title: "test" }],
          event: "patched",
          expectedPerClient: {
            0: { id: 0, test: true, userId: 1, title: "test" },
            1:
              servicePath === "comments"
                ? { id: 0, test: true, userId: 1, title: "test" }
                : false,
            2: false,
            3: { id: 0, test: true, userId: 1, title: "test" },
            4: false,
            5: false,
          },
        },
        remove: {
          params: [0],
          event: "removed",
          expectedPerClient: {
            0: { id: 0, test: true, userId: 1, title: "test" },
            1:
              servicePath === "articles"
                ? { id: 0, test: true, userId: 1, title: "test" }
                : { id: 0 },
            2: false,
            3: { id: 0, test: true, userId: 1, title: "test" },
            4: false,
            5: false,
          },
        },
      };

      const methodNames = Object.keys(methods);
      for (let j = 0, o = methodNames.length; j < o; j++) {
        const methodName = methodNames[j];
        const method = methods[methodName];
        const service = app.service(servicePath);
        const { event, params, expectedPerClient } = method;

        const promises = clients.map((client, i) =>
          checkClient(servicePath, methodName, event, expectedPerClient, i)
        );

        service[methodName](...params);

        await Promise.all(promises);
      }
    }
  });
});
