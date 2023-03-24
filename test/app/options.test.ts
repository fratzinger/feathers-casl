import assert from "node:assert";
import type { Application, HookContext } from "@feathersjs/feathers";
import { feathers } from "@feathersjs/feathers";
import { MemoryService } from "@feathersjs/memory";
import casl, { authorize } from "../../src";
import type { RealTimeConnection } from "@feathersjs/transport-commons";
import type { InitOptions } from "../../src";
import { defineAbility } from "@casl/ability";

const mockApp = () => {
  const app = feathers();
  app.use(
    "users",
    new MemoryService({
      multi: true,
      paginate: {
        default: 10,
        max: 50,
      },
    })
  );
  const service = app.service("users");
  service.hooks({
    before: {
      all: [
        authorize({
          availableFields: ["id", "userId", "hi", "test", "published"],
        }),
      ],
    },
    after: {
      all: [
        authorize({
          availableFields: ["id", "userId", "hi", "test", "published"],
        }),
      ],
    },
  });
  return {
    app,
    service,
  };
};

interface CalledOptions {
  calledActionOnForbidden?: boolean;
  calledAbility?: boolean;
  calledModelName?: boolean;
}

describe("app-options / service-options", function () {
  describe("authorize hook", function () {
    it("calls app options for authorize hook", async function () {
      const { app, service } = mockApp();
      let calledActionOnForbidden = false;
      let calledAbility = false;
      let calledModelName = false;

      let calledChannelAbility = false;
      let calledChannelModelName = false;
      app.configure(
        casl({
          authorizeHook: {
            actionOnForbidden: () => {
              calledActionOnForbidden = true;
            },
            checkMultiActions: true,
            ability: (context: HookContext) => {
              calledAbility = true;
              return defineAbility(() => {});
            },
            modelName: (context: HookContext): string => {
              calledModelName = true;
              return "Test";
            },
            checkAbilityForInternal: true,
          },
          channels: {
            activated: false,
            channelOnError: ["Test"],
            ability: (
              app: Application,
              connection: RealTimeConnection,
              data: unknown,
              context: HookContext
            ) => {
              calledChannelAbility = true;
              return defineAbility(() => {});
            },
            modelName: (context: HookContext): string => {
              calledChannelModelName = true;
              return "Test";
            },
            restrictFields: false,
          },
        })
      );

      const caslOptions: InitOptions = app.get("casl");

      assert.ok(caslOptions.authorizeHook, "authorizeHook options is set");
      assert.ok(caslOptions.channels, "channels options is set");

      await assert.rejects(
        service.find({
          query: {},
        }),
        (err: Error) => err.name === "Forbidden",
        "throws Forbidden for no ability"
      );

      assert.ok(calledAbility, "called ability function");
      assert.ok(calledActionOnForbidden, "called actionOnForbidden function");
      assert.ok(calledModelName, "called modelName function");

      //assert.ok(calledChannelAbility, "called ability function on channels");
      //assert.ok(calledChannelModelName, "called modelName function on channels");
    });

    it("calls service options over app options", async function () {
      const app = feathers();
      app.use(
        "users",
        new MemoryService({
          multi: true,
          paginate: {
            default: 10,
            max: 50,
          },
        })
      );
      const appCalled: CalledOptions = {};
      const serviceCalled: CalledOptions = {};
      const service = app.service("users");
      service.hooks({
        before: {
          all: [
            authorize({
              availableFields: ["id", "userId", "hi", "test", "published"],
              actionOnForbidden: () => {
                serviceCalled.calledActionOnForbidden = true;
              },
              checkMultiActions: true,
              ability: (context: HookContext) => {
                serviceCalled.calledAbility = true;
                return defineAbility(() => {});
              },
              modelName: (context: HookContext): string => {
                serviceCalled.calledModelName = true;
                return "Test";
              },
            }),
          ],
        },
      });

      app.configure(
        casl({
          authorizeHook: {
            actionOnForbidden: () => {
              appCalled.calledActionOnForbidden = true;
            },
            checkAbilityForInternal: true,
            checkMultiActions: true,
            ability: (context: HookContext) => {
              appCalled.calledAbility = true;
              return defineAbility(() => {});
            },
            modelName: (context: HookContext): string => {
              appCalled.calledModelName = true;
              return "Test";
            },
          },
        })
      );

      await assert.rejects(
        service.find({
          query: {},
        }),
        (err: Error) => err.name === "Forbidden",
        "throws Forbidden for no ability"
      );

      assert.ok(
        serviceCalled.calledAbility,
        "called ability function from service options"
      );
      assert.ok(
        serviceCalled.calledActionOnForbidden,
        "called actionOnForbidden function from service options"
      );
      assert.ok(
        serviceCalled.calledModelName,
        "called modelName function from service options"
      );

      assert.ok(
        !appCalled.calledAbility,
        "not called ability function from app options"
      );
      assert.ok(
        !appCalled.calledActionOnForbidden,
        "not called actionOnForbidden function from app options"
      );
      assert.ok(
        !appCalled.calledModelName,
        "not called modelName function from app options"
      );

      //assert.ok(calledChannelAbility, "called ability function on channels");
      //assert.ok(calledChannelModelName, "called modelName function on channels");
    });
  });

  describe("channels", function () {
    it.skip("test channel options", function () {});
  });
});
