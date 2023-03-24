import assert from "node:assert";
import { feathers } from "@feathersjs/feathers";
import { MemoryService } from "@feathersjs/memory";
import type { AnyMongoAbility } from "@casl/ability";
import { createAliasResolver, defineAbility } from "@casl/ability";

import type { Application, HookContext } from "@feathersjs/feathers";

import { authorize } from "../../../src";
import { resolveAction } from "../../test-utils";

declare module "@feathersjs/adapter-commons" {
  interface AdapterParams {
    ability?: AnyMongoAbility;
    casl?: {
      ability: AnyMongoAbility | (() => AnyMongoAbility);
    };
  }
}

describe("authorize.options.test.ts", function () {
  type TestApplication = Application<{ tests: MemoryService }>;
  let app: TestApplication;
  let service: MemoryService;

  describe("checkMultiActions", function () {
    beforeEach(function () {
      app = feathers();
      app.use(
        "tests",
        new MemoryService({
          multi: true,
          paginate: {
            default: 10,
            max: 50,
          },
        })
      );
      service = app.service("tests");

      //@ts-ignore
      service.hooks({
        before: {
          all: [authorize({ checkMultiActions: true })],
        },
        after: {
          all: [authorize({ checkMultiActions: true })],
        },
      });
    });

    it("passes multi if explicitly defined", async function () {
      const methods = [
        {
          method: "create",
          params: [
            [{ id: 0 }, { id: 1 }],
            {
              ability: defineAbility(
                (can) => {
                  can(["create-multi", "create"], "tests");
                },
                { resolveAction }
              ),
            },
          ],
        },
        {
          method: "patch",
          params: [
            null,
            { test: true },
            {
              query: { userId: 1 },
              ability: defineAbility(
                (can) => {
                  can(["patch-multi", "patch"], "tests");
                },
                { resolveAction }
              ),
            },
          ],
        },
        {
          method: "remove",
          params: [
            null,
            {
              query: { userId: 1 },
              ability: defineAbility(
                (can) => {
                  can(["remove-multi", "remove"], "tests");
                },
                { resolveAction }
              ),
            },
          ],
        },
      ];
      methods.forEach(async ({ method, params }) => {
        const result = await service[method](...params);
        assert.ok(result, "passes request");
      });
    });

    it("rejects multi if not defined", async function () {
      const methods = [
        {
          method: "create",
          params: [
            [{ id: 0 }, { id: 1 }],
            {
              ability: defineAbility(
                (can) => {
                  can(["create"], "tests");
                },
                { resolveAction }
              ),
            },
          ],
        },
        {
          method: "patch",
          params: [
            null,
            { test: true },
            {
              query: { userId: 1 },
              ability: defineAbility(
                (can) => {
                  can(["patch"], "tests");
                },
                { resolveAction }
              ),
            },
          ],
        },
        {
          method: "remove",
          params: [
            null,
            {
              query: { userId: 1 },
              ability: defineAbility(
                (can) => {
                  can(["remove"], "tests");
                },
                { resolveAction }
              ),
            },
          ],
        },
      ];
      methods.forEach(async ({ method, params }) => {
        const promise = service[method](...params);
        await assert.rejects(
          promise,
          (err: Error) => err.name === "Forbidden",
          "rejects because 'method-multi' not defined"
        );
      });
    });
  });

  describe("modelName", function () {
    it("use service.modelName with string", async function () {
      const app: TestApplication = feathers();
      app.use(
        "tests",
        new MemoryService({
          multi: true,
          paginate: {
            default: 10,
            max: 50,
          },
        })
      );
      service = app.service("tests");
      //@ts-ignore
      service.modelName = "Test";
      //@ts-ignore
      service.hooks({
        before: {
          all: [
            authorize({
              ability: defineAbility(
                (can) => {
                  can("create", "Test");
                },
                { resolveAction }
              ),
              modelName: "Test",
              checkAbilityForInternal: true,
            }),
          ],
        },
      });

      const result = await service.create({ id: 0, test: true });
      assert.ok(result);
      await assert.rejects(
        () => {
          return service.update(0, { test: false });
        },
        (err: Error) => err.name === "Forbidden",
        "update throws Forbidden"
      );
    });

    it("use service.modelName with function", async function () {
      const app: TestApplication = feathers();
      app.use(
        "tests",
        new MemoryService({
          multi: true,
          paginate: {
            default: 10,
            max: 50,
          },
        })
      );
      service = app.service("tests");
      //@ts-ignore
      service.modelName = "Test";
      //@ts-ignore
      service.hooks({
        before: {
          all: [
            authorize({
              ability: defineAbility(
                (can) => {
                  can("create", "Test");
                },
                { resolveAction }
              ),
              modelName: (context) => context.service.modelName,
              checkAbilityForInternal: true,
            }),
          ],
        },
      });

      const result = await service.create({ id: 0, test: true });
      assert.ok(result);
      await assert.rejects(
        () => {
          return service.update(0, { test: false });
        },
        (err: Error) => err.name === "Forbidden",
        "update throws Forbidden"
      );
    });
  });

  describe("ability", function () {
    it("works if no ability is set at all", async function () {
      const app: TestApplication = feathers();
      app.use(
        "tests",
        new MemoryService({
          multi: true,
          paginate: {
            default: 10,
            max: 50,
          },
        })
      );
      service = app.service("tests");
      //@ts-ignore
      service.hooks({
        before: {
          all: [authorize()],
        },
      });

      const item = await service.create({ test: true });
      assert.ok(item.test, "item was created");
    });

    it("uses ability in options", async function () {
      const app: TestApplication = feathers();
      app.use(
        "tests",
        new MemoryService({
          multi: true,
          paginate: {
            default: 10,
            max: 50,
          },
        })
      );
      service = app.service("tests");
      //@ts-ignore
      service.hooks({
        before: {
          all: [
            authorize({
              // eslint-disable-next-line @typescript-eslint/no-empty-function
              ability: defineAbility(() => {}, { resolveAction }),
              checkAbilityForInternal: true,
            }),
          ],
        },
      });

      await assert.rejects(
        service.create({ test: true }),
        (err: Error) => err.name === "Forbidden",
        "throws even if no ability is set in params"
      );
    });

    it("uses params.ability over options.ability", async function () {
      const app: TestApplication = feathers();
      app.use(
        "tests",
        new MemoryService({
          multi: true,
          paginate: {
            default: 10,
            max: 50,
          },
        })
      );
      service = app.service("tests");
      //@ts-ignore
      service.hooks({
        before: {
          all: [
            authorize({
              // eslint-disable-next-line @typescript-eslint/no-empty-function
              ability: defineAbility(() => {}, { resolveAction }),
            }),
          ],
        },
      });

      const params = {
        ability: defineAbility(
          (can) => {
            can("manage", "all");
          },
          { resolveAction }
        ),
      };

      const result = await service.create({ test: true }, params);
      assert.ok(result);
    });

    it("uses ability as Promise", async function () {
      const app: TestApplication = feathers();
      app.use(
        "tests",
        new MemoryService({
          multi: true,
          paginate: {
            default: 10,
            max: 50,
          },
        })
      );
      service = app.service("tests");
      //@ts-ignore
      service.hooks({
        before: {
          all: [
            authorize({
              //@ts-ignore
              ability: Promise.resolve(
                defineAbility(
                  (can) => {
                    can("manage", "all");
                  },
                  { resolveAction }
                )
              ),
            }),
          ],
        },
      });

      const result = await service.create({ test: true });
      assert.ok(result);
    });

    it("uses ability as function", async function () {
      const app: TestApplication = feathers();
      app.use(
        "tests",
        new MemoryService({
          multi: true,
          paginate: {
            default: 10,
            max: 50,
          },
        })
      );
      service = app.service("tests");
      //@ts-ignore
      service.hooks({
        before: {
          all: [
            authorize({
              ability: () =>
                defineAbility(
                  (can) => {
                    can("manage", "all");
                  },
                  { resolveAction }
                ),
            }),
          ],
        },
      });

      const result = await service.create({ test: true });
      assert.ok(result);
    });

    it("uses ability as Promise", async function () {
      const app: TestApplication = feathers();
      app.use(
        "tests",
        new MemoryService({
          multi: true,
          paginate: {
            default: 10,
            max: 50,
          },
        })
      );
      service = app.service("tests");
      //@ts-ignore
      service.hooks({
        before: {
          all: [
            authorize({
              ability: () => {
                return Promise.resolve(
                  defineAbility(
                    (can) => {
                      can("manage", "all");
                    },
                    { resolveAction }
                  )
                );
              },
            }),
          ],
        },
      });

      const result = await service.create({ test: true });
      assert.ok(result);
    });

    it("uses persisted ability from 'context.params.casl.ability'", async function () {
      const app = feathers();
      app.use(
        "tests",
        new MemoryService({
          multi: true,
          paginate: {
            default: 10,
            max: 50,
          },
        })
      );
      //@ts-ignore
      service = app.service("tests");
      //@ts-ignore
      service.hooks({
        before: {
          all: [authorize()],
        },
      });

      await assert.doesNotReject(service.create({ test: true }));

      await assert.rejects(
        service.create(
          { test: true },
          {
            casl: {
              // eslint-disable-next-line @typescript-eslint/no-empty-function
              ability: defineAbility(() => {}),
            },
          }
        ),
        (err: Error) => err.name === "Forbidden",
        "throws Forbidden"
      );
    });

    it("uses persisted ability as function from 'context.params.casl.ability'", async function () {
      const app = feathers();
      app.use(
        "tests",
        new MemoryService({
          multi: true,
          paginate: {
            default: 10,
            max: 50,
          },
        })
      );
      //@ts-ignore
      service = app.service("tests");
      //@ts-ignore
      service.hooks({
        before: {
          all: [authorize()],
        },
      });

      await assert.doesNotReject(service.create({ test: true }));

      await assert.rejects(
        service.create(
          { test: true },
          {
            casl: {
              // eslint-disable-next-line @typescript-eslint/no-empty-function
              ability: () => defineAbility(() => {}),
            },
          }
        ),
        (err: Error) => err.name === "Forbidden",
        "throws Forbidden"
      );
    });

    it("fails for empty ability in options", async function () {
      const makeContext = (method, type) => {
        return {
          path: "tests",
          method,
          type,
          data: {
            id: 1,
            userId: 1,
            test: true,
          },
          params: {
            query: {},
          },
        };
      };

      const types = ["before"];
      const methods = ["find", "get", "create", "update", "patch", "remove"];
      const promises: Promise<any>[] = [];
      types.forEach((type) => {
        methods.forEach((method) => {
          const context = makeContext(method, type);

          const promise = assert.rejects(
            authorize({
              availableFields: ["id", "userId", "test"],
              // eslint-disable-next-line @typescript-eslint/no-empty-function
              ability: () => defineAbility(() => {}, { resolveAction }),
              checkAbilityForInternal: true,
              //@ts-ignore
            })(context),
            (err: Error) => err.name === "Forbidden",
            `'${type}:${method}' throws Forbidden`
          );
          promises.push(promise);
        });
      });
      await Promise.all(promises);
    });

    it("fails for not defined ability on external", async function () {
      const makeContext = (
        method: "find" | "get" | "create" | "update" | "patch" | "remove",
        type: "before" | "after"
      ): HookContext => {
        return {
          path: "tests",
          method,
          type,
          data: {
            id: 1,
            userId: 1,
            test: true,
          },
          params: {
            provider: "rest",
            query: {},
          },
        } as unknown as HookContext;
      };

      const types: ("before" | "after")[] = ["before"];
      const methods: (
        | "find"
        | "get"
        | "create"
        | "update"
        | "patch"
        | "remove"
      )[] = ["find", "get", "create", "update", "patch", "remove"];
      const promises: Promise<any>[] = [];
      types.forEach((type) => {
        methods.forEach((method) => {
          const context = makeContext(method, type);

          const promise = assert.rejects(
            authorize()(context),
            (err: Error) => err.name === "Forbidden",
            `'${type}:${method}' throws Forbidden`
          );
          promises.push(promise);
        });
      });
      await Promise.all(promises);
    });
  });

  describe("checkAbilityForInternal", function () {
    it("passes for internal call without params.ability and not allowed options.params by default", async function () {
      const app: TestApplication = feathers();
      app.use(
        "tests",
        new MemoryService({
          multi: true,
          paginate: {
            default: 10,
            max: 50,
          },
        })
      );
      service = app.service("tests");
      //@ts-ignore
      service.hooks({
        before: {
          all: [
            authorize({
              // eslint-disable-next-line @typescript-eslint/no-empty-function
              ability: defineAbility(() => {}),
            }),
          ],
        },
      });

      await assert.doesNotReject(
        service.create({ test: true }),
        "does not throw Forbidden"
      );
    });

    it("throws for external call without params.ability and not allowed options.params by default", async function () {
      const app: TestApplication = feathers();
      app.use(
        "tests",
        new MemoryService({
          multi: true,
          paginate: {
            default: 10,
            max: 50,
          },
        })
      );
      service = app.service("tests");
      //@ts-ignore
      service.hooks({
        before: {
          all: [
            authorize({
              // eslint-disable-next-line @typescript-eslint/no-empty-function
              ability: defineAbility(() => {}),
            }),
          ],
        },
      });

      await assert.rejects(
        service.create({ test: true }, { provider: "rest" }),
        (err: Error) => err.name === "Forbidden",
        "request throws Forbidden"
      );
    });

    it("throws for internal call without params.ability and not allowed options.params with checkAbilityForInternal: true", async function () {
      const app: TestApplication = feathers();
      app.use(
        "tests",
        new MemoryService({
          multi: true,
          paginate: {
            default: 10,
            max: 50,
          },
        })
      );
      service = app.service("tests");
      //@ts-ignore
      service.hooks({
        before: {
          all: [
            authorize({
              // eslint-disable-next-line @typescript-eslint/no-empty-function
              ability: defineAbility(() => {}),
              checkAbilityForInternal: true,
            }),
          ],
        },
      });

      await assert.rejects(
        service.create({ test: true }),
        (err: Error) => err.name === "Forbidden",
        "request throws Forbidden"
      );
    });
  });
});
