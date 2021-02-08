import assert from "assert";
import feathers from "@feathersjs/feathers";
import { Service } from "feathers-memory";
import { createAliasResolver, defineAbility } from "@casl/ability";

const resolveAction = createAliasResolver({
  update: "patch",
  read: ["get", "find"],
  delete: "remove",
});

import { Application } from "@feathersjs/feathers";

import authorize from "../../lib/hooks/authorize/authorize.hook";

describe("authorize.options.test.ts", function () {
  let app: Application;
  let service: Service;

  describe("checkMultiActions", function () {
    beforeEach(function () {
      app = feathers();
      app.use(
        "test",
        new Service({
          multi: true,
          paginate: {
            default: 10,
            max: 50
          }
        })
      );
      service = app.service("test");
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
              ability: defineAbility({ resolveAction }, (can) => {
                can(["create-multi", "read-multi", "update-multi", "delete-multi"], "Test");
              }),
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
              ability: defineAbility({ resolveAction }, (can) => {
                can(["create-multi", "read-multi", "update-multi", "delete-multi"], "Test");
              }),
            },
          ],
        },
        {
          method: "remove",
          params: [
            null,
            {
              query: { userId: 1 },
              ability: defineAbility({ resolveAction }, (can) => {
                can(["create-multi", "read-multi", "update-multi", "delete-multi"], "Test");
              }),
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
              ability: defineAbility({ resolveAction }, (can) => {
                can(["create", "read", "update", "delete"], "Test");
              }),
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
              ability: defineAbility({ resolveAction }, (can) => {
                can(["create", "read", "update", "delete"], "Test");
              }),
            },
          ],
        },
        {
          method: "remove",
          params: [
            null,
            {
              query: { userId: 1 },
              ability: defineAbility({ resolveAction }, (can) => {
                can(["create", "read", "update", "delete"], "Test");
              }),
            },
          ],
        },
      ];
      methods.forEach(async ({ method, params }) => {
        const promise = service[method](...params);
        await assert.rejects(promise, err => err.name === "Forbidden", "rejects because 'method-multi' not defined");
      });
    });
  });

  describe("modelName", function() {
    it("use service.modelName with string", async function() {
      const app = feathers();
      app.use(
        "test",
        new Service({
          multi: true,
          paginate: {
            default: 10,
            max: 50
          }
        })
      );
      service = app.service("test");
      //@ts-ignore
      service.modelName = "Test";
      //@ts-ignore
      service.hooks({
        before: {
          all: [authorize({
            //@ts-ignore
            ability: defineAbility({ resolveAction }, (can) => {
              can("create", "Test");
            }),
            modelName: "Test"
          })],
        }
      });

      const result = await service.create({ id: 0, test: true });
      assert.ok(result);
      await assert.rejects(() => {
        return service.update(0, { test: false });
      }, err => err.name === "Forbidden", "update throws Forbidden");
    });
    it("use service.modelName with function", async function() {
      const app = feathers();
      app.use(
        "test",
        new Service({
          multi: true,
          paginate: {
            default: 10,
            max: 50
          }
        })
      );
      service = app.service("test");
      //@ts-ignore
      service.modelName = "Test";
      //@ts-ignore
      service.hooks({
        before: {
          all: [authorize({
            //@ts-ignore
            ability: defineAbility({ resolveAction }, (can) => {
              can("create", "Test");
            }),
            modelName: (context) => context.service.modelName
          })],
        }
      });

      const result = await service.create({ id: 0, test: true });
      assert.ok(result);
      await assert.rejects(() => {
        return service.update(0, { test: false });
      }, err => err.name === "Forbidden", "update throws Forbidden");
    });
  });

  describe("ability", function() {
    it("works if no ability is set at all", async function() {
      const app = feathers();
      app.use(
        "test",
        new Service({
          multi: true,
          paginate: {
            default: 10,
            max: 50
          }
        })
      );
      service = app.service("test");
      //@ts-ignore
      service.hooks({
        before: {
          all: [authorize()],
        }
      });

      const item = await service.create({ test: true });
      assert.ok(item.test, "item was created");
    });

    it("uses ability in options", async function() {
      const app = feathers();
      app.use(
        "test",
        new Service({
          multi: true,
          paginate: {
            default: 10,
            max: 50
          }
        })
      );
      service = app.service("test");
      //@ts-ignore
      service.hooks({
        before: {
          all: [authorize({
            //@ts-ignore
            // eslint-disable-next-line @typescript-eslint/no-empty-function
            ability: defineAbility({ resolveAction }, () => {})
          })],
        }
      });

      await assert.rejects(
        service.create({ test: true }),
        err => err.name === "Forbidden",
        "throws even if no ability is set in params"
      );
    });

    it("uses params.ability over options.ability", async function() {
      const app = feathers();
      app.use(
        "test",
        new Service({
          multi: true,
          paginate: {
            default: 10,
            max: 50
          }
        })
      );
      service = app.service("test");
      //@ts-ignore
      service.hooks({
        before: {
          all: [authorize({
            //@ts-ignore
            // eslint-disable-next-line @typescript-eslint/no-empty-function
            ability: defineAbility({ resolveAction }, () => {}),
          })],
        }
      });

      const params = {
        ability: defineAbility({ resolveAction }, (can) => {
          can("manage", "all");
        }),
      };

      const result = await service.create({ test: true }, params);
      assert.ok(result);
    });

    it("uses ability as Promise", async function() {
      const app = feathers();
      app.use(
        "test",
        new Service({
          multi: true,
          paginate: {
            default: 10,
            max: 50
          }
        })
      );
      service = app.service("test");
      //@ts-ignore
      service.hooks({
        before: {
          all: [authorize({
            //@ts-ignore
            ability: Promise.resolve(defineAbility({ resolveAction }, (can) => {
              can("manage", "all");
            }))
          })],
        }
      });

      const result = await service.create({ test: true });
      assert.ok(result);
    });

    it("uses ability as function", async function() {
      const app = feathers();
      app.use(
        "test",
        new Service({
          multi: true,
          paginate: {
            default: 10,
            max: 50
          }
        })
      );
      service = app.service("test");
      //@ts-ignore
      service.hooks({
        before: {
          all: [authorize({
            //@ts-ignore
            ability: () => defineAbility({ resolveAction }, (can) => {
              can("manage", "all");
            }),
          })],
        }
      });

      const result = await service.create({ test: true });
      assert.ok(result);
    });

    it("uses ability as Promise", async function() {
      const app = feathers();
      app.use(
        "test",
        new Service({
          multi: true,
          paginate: {
            default: 10,
            max: 50
          }
        })
      );
      service = app.service("test");
      //@ts-ignore
      service.hooks({
        before: {
          all: [
            authorize({
            //@ts-ignore
              ability: () => {
                return Promise.resolve(defineAbility({ resolveAction }, (can) => {
                  can("manage", "all");
                }));
              }
            })
          ],
        }
      });

      const result = await service.create({ test: true });
      assert.ok(result);
    });

    it("fails for empty ability in options", async function() {
      const makeContext = (method, type) => {
        return {
          service: {
            modelName: "Test",
          },
          path: "tests",
          method,
          type,
          data: {
            id: 1,
            userId: 1,
            test: true
          },
          params: {
            query: {},
          }
        };
      };
  
      const types = ["before"];
      const methods = ["find", "get", "create", "update", "patch", "remove"];
      const promises = [];
      types.forEach(type => {
        methods.forEach(method => {
          const context = makeContext(method, type);
          const query = Object.assign({}, context.params.query);
          
          const promise = assert.rejects(
            authorize({ 
              availableFields: ["id", "userId", "test"],
              //@ts-ignore
              // eslint-disable-next-line @typescript-eslint/no-empty-function
              ability: () => defineAbility({ resolveAction }, () => {})
            //@ts-ignore
            })(context),
            err => err.name === "Forbidden",
            `'${type}:${method}' throws Forbidden`
          );
          promises.push(promise);
        });
      });
      await Promise.all(promises);
    });
  });
});
