import assert from "node:assert";
import type { Application } from "@feathersjs/feathers";
import { feathers } from "@feathersjs/feathers";
import socketio from "@feathersjs/socketio-client";
import type { Server } from "node:http";
import { io } from "socket.io-client";

import { mockServer } from "../.mockServer";
import channels1 from "./mockChannels.default";
import services1 from "./mockServices.default";
import getPort from "get-port";
import { promiseTimeout } from "../../test-utils";

describe("channels.default.test.ts", function () {
  let server: Server;
  let app: Application;

  let client1: Application;
  let client2: Application;
  let client3: Application;
  let client4: Application;
  let user1: Record<string, unknown>;
  let user2: Record<string, unknown>;
  let users = [
    { id: 0, email: "1", password: "1" },
    { id: 1, email: "2", password: "2" },
    { id: 2, email: "3", password: "3" },
  ];

  beforeAll(async function () {
    const mock = mockServer({
      channels: channels1,
      services: services1,
    });

    app = mock.app;

    const port = await getPort();
    app.set("port", port);

    server = await app.listen(port);

    users = await app.service("users").create(users);

    const promises: Promise<any>[] = [];

    users.forEach((user, i) => {
      const socket = io(`http://localhost:${port}`);
      const client = feathers();
      client.configure(socketio(socket));
      if (i === 0) {
        client1 = client;
        user1 = user;
        const promise = client1.service("authentication").create({
          strategy: "local",
          email: "1",
          password: "1",
        });
        promises.push(promise);
      } else if (i === 1) {
        client2 = client;
        user2 = user;
        const promise = client2.service("authentication").create({
          strategy: "local",
          email: "2",
          password: "2",
        });
        promises.push(promise);
      } else if (i === 2) {
        client3 = client;

        const promise = client3.service("authentication").create({
          strategy: "local",
          email: "3",
          password: "3",
        });
        promises.push(promise);
      }
    });

    const socket = io(`http://localhost:${port}`);
    client4 = feathers();
    client4.configure(socketio(socket));
    await Promise.all(promises);
  });

  afterAll(async function () {
    server.close();
  });

  it("user1 receives events", async function () {
    const services = ["articles", "comments"];
    const methods = {
      create: {
        params: [{ id: 0, test: true }],
        event: "created",
        expected: { id: 0, test: true },
      },
      update: {
        params: [0, { test: false }],
        event: "updated",
        expected: { id: 0, test: false },
      },
      patch: {
        params: [0, { test: true }],
        event: "patched",
        expected: { id: 0, test: true },
      },
      remove: {
        params: [0],
        event: "removed",
        expected: { id: 0, test: true },
      },
    };
    const methodNames = Object.keys(methods);
    for (let i = 0, n = services.length; i < n; i++) {
      const servicePath = services[i];
      for (let j = 0, o = methodNames.length; j < o; j++) {
        const methodName = methodNames[j];
        const method = methods[methodName];
        const service = app.service(servicePath);
        const { event, params, expected } = method;
        const fulFill = new Promise((resolve) => {
          client1.service(servicePath).on(event, (result) => {
            assert.deepStrictEqual(result, expected, "result is full");
            resolve(result);
          });

          service[methodName](...params);
        });

        await assert.doesNotReject(
          promiseTimeout(
            100,
            fulFill,
            `timeout - '${servicePath}:${methodName}'`,
          ).finally(() => {
            client1.service(servicePath).removeAllListeners(event);
          }),
          "client1 receives message",
        );
      }
    }
  });

  it("user2 doesn't receive unpublished articles", async function () {
    const services = ["articles"];
    const methods = {
      create: {
        params: [{ id: 1, test: true, published: false }],
        event: "created",
        expected: { id: 1, test: true, published: false },
      },
      update: {
        params: [1, { test: false, published: false }],
        event: "updated",
        expected: { id: 1, test: false, published: false },
      },
      patch: {
        params: [1, { test: true, published: false }],
        event: "patched",
        expected: { id: 1, test: true, published: false },
      },
      remove: {
        params: [1],
        event: "removed",
        expected: { id: 1, test: true, published: false },
      },
    };
    const methodNames = Object.keys(methods);
    for (let i = 0, n = services.length; i < n; i++) {
      const servicePath = services[i];
      for (let j = 0, o = methodNames.length; j < o; j++) {
        const methodName = methodNames[j];
        const method = methods[methodName];
        const service = app.service(servicePath);
        const { event, params, expected } = method;
        const fulFill1 = new Promise((resolve) => {
          client1.service(servicePath).on(event, (result) => {
            assert.deepStrictEqual(result, expected, "result is full article");
            resolve(result);
          });
        });

        const fulFill2 = new Promise((resolve) => {
          client2.service(servicePath).on(event, resolve);
        });

        service[methodName](...params);

        await Promise.all([
          assert.doesNotReject(
            promiseTimeout(
              60,
              fulFill1,
              `timeout '${servicePath}:${methodName}'`,
            ).finally(() => {
              client1.service(servicePath).removeAllListeners(event);
            }),
            "client1 receives message",
          ),
          assert.rejects(
            promiseTimeout(
              60,
              fulFill2,
              `timeout '${servicePath}:${methodName}'`,
            ).finally(() => {
              client2.service(servicePath).removeAllListeners(event);
            }),
            () => true,
            "client2 does not receive message",
          ),
        ]);
      }
    }
  });

  it("user2 receives published articles", async function () {
    const services = ["articles"];
    const methods = {
      create: {
        params: [{ id: 2, test: true, published: true }],
        event: "created",
        expected: { id: 2, test: true, published: true },
      },
      update: {
        params: [2, { test: false, published: true }],
        event: "updated",
        expected: { id: 2, test: false, published: true },
      },
      patch: {
        params: [2, { test: true }],
        event: "patched",
        expected: { id: 2, test: true, published: true },
      },
      remove: {
        params: [2],
        event: "removed",
        expected: { id: 2, test: true, published: true },
      },
    };
    const methodNames = Object.keys(methods);
    for (let i = 0, n = services.length; i < n; i++) {
      const servicePath = services[i];
      for (let j = 0, o = methodNames.length; j < o; j++) {
        const methodName = methodNames[j];
        const method = methods[methodName];
        const service = app.service(servicePath);
        const { event, params, expected } = method;

        const fulFill2 = new Promise((resolve) => {
          client2.service(servicePath).on(event, (result) => {
            assert.deepStrictEqual(result, expected, "result is full article");
            resolve(result);
          });
        });

        service[methodName](...params);

        await assert.doesNotReject(
          promiseTimeout(
            100,
            fulFill2,
            `timeout '${servicePath}:${methodName}'`,
          ).finally(() => {
            client1.service(servicePath).removeAllListeners(event);
          }),
          () => true,
          "client2 receives message",
        );
      }
    }
  });

  it("user2 receives subset of comments", async function () {
    const services = ["comments"];
    const methods = {
      create: {
        params: [{ id: 1, title: "test", userId: 1 }],
        event: "created",
        user1Expected: { id: 1, title: "test", userId: 1 },
        user2Expected: { id: 1, title: "test" },
      },
      update: {
        params: [1, { title: "test2", userId: 1 }],
        event: "updated",
        user1Expected: { id: 1, title: "test2", userId: 1 },
        user2Expected: { id: 1, title: "test2" },
      },
      patch: {
        params: [1, { title: "t" }],
        event: "patched",
        user1Expected: { id: 1, title: "t", userId: 1 },
        user2Expected: { id: 1, title: "t" },
      },
      remove: {
        params: [1],
        event: "removed",
        user1Expected: { id: 1, title: "t", userId: 1 },
        user2Expected: { id: 1, title: "t" },
      },
    };
    const methodNames = Object.keys(methods);
    for (let i = 0, n = services.length; i < n; i++) {
      const servicePath = services[i];
      for (let j = 0, o = methodNames.length; j < o; j++) {
        const methodName = methodNames[j];
        const method = methods[methodName];
        const service = app.service(servicePath);
        const { event, params, user1Expected, user2Expected } = method;

        const fulFill1 = new Promise((resolve) => {
          client1.service(servicePath).on(event, (result) => {
            assert.deepStrictEqual(
              result,
              user1Expected,
              `user1 with id '${user1.id}' with receives full comment for '${servicePath}:${methodName}'`,
            );
            resolve(result);
          });
        });

        const fulFill2 = new Promise((resolve) => {
          client2.service(servicePath).on(event, (result) => {
            assert.deepStrictEqual(
              result,
              user2Expected,
              `user2 with id '${user2.id}' receives subset for '${servicePath}:${methodName}'`,
            );
            resolve(result);
          });
        });

        service[methodName](...params);

        await Promise.all([
          assert.doesNotReject(
            promiseTimeout(
              100,
              fulFill1,
              `timeout '${servicePath}:${methodName}'`,
            ).finally(() => {
              client1.service(servicePath).removeAllListeners(event);
            }),
            "client1 receives event",
          ),
          assert.doesNotReject(
            promiseTimeout(
              100,
              fulFill2,
              `timeout '${servicePath}:${methodName}'`,
            ).finally(() => {
              client2.service(servicePath).removeAllListeners(event);
            }),
            "client2 receives event",
          ),
        ]);
      }
    }
  });
});
