import assert from "assert";
import feathers from "@feathersjs/feathers";
import { createAliasResolver, defineAbility } from "@casl/ability";

const resolveAction = createAliasResolver({
  update: "patch",
  read: ["get", "find"],
  delete: "remove",
});

import { Application } from "@feathersjs/feathers";

import authorize from "../../../../../lib/hooks/authorize/authorize.hook";
import { Adapter, AuthorizeHookOptions } from "../../../../../lib/types";

export default async function (
  adapterName: Adapter,
  makeService: () => unknown,
  clean: (app, service) => Promise<void>,
  authorizeHookOptions: Partial<AuthorizeHookOptions>,
  afterHooks?: unknown[]
): Promise<void> {
  let app: Application;
  let service;
  let id;

  const itSkip = (
    adapterToTest: Adapter | Adapter[]
  ): Mocha.TestFunction | Mocha.PendingTestFunction => {
    const condition = (typeof adapterToTest === "string")
      ? adapterName === adapterToTest
      : adapterToTest.includes(adapterName);
    return (condition)
      ? it.skip
      : it;
  };
      
  beforeEach(async function () {
    app = feathers();
    app.use(
      "tests",
      makeService()
    );
    service = app.service("tests");

    // eslint-disable-next-line prefer-destructuring
    id = service.options.id;

    const options = Object.assign({
      availableFields: [id, "userId", "hi", "test", "published", "supersecret", "hidden"] 
    }, authorizeHookOptions);
    const allAfterHooks = [];
    if (afterHooks) {
      allAfterHooks.push(...afterHooks);
    }
    allAfterHooks.push(authorize(options));
    //@ts-ignore
    service.hooks({
      before: {
        all: [ authorize(options) ],
      },
      after: {
        all: allAfterHooks
      },
    });

    await clean(app, service);
  });
      
  describe(`${adapterName}: beforeAndAfter - update`, function () {
    it("can update one item and returns 'undefined' for not allowed read", async function () {
      const item = await service.create({ test: true, userId: 1 });
      
      const updatedItem = await service.update(item[id], { test: false, userId: 1 }, {
        //@ts-ignore
        ability: defineAbility(can => {
          can("update", "tests");
        }, { resolveAction })
      });
      
      assert.deepStrictEqual(updatedItem, undefined, "updated item is undefined");
      
      const realItem = await service.get(item[id]);
      assert.deepStrictEqual(
        realItem,
        { [id]: item[id], test: false, userId: 1 },
        "updated item correctly"
      );
    });
      
    it("can update one item and returns complete item", async function () {
      const item = await service.create({ test: true, userId: 1 });
      
      const readMethod = ["read", "get"];
      
      for (const read of readMethod) {
        const updatedItem = await service.update(item[id], { test: false, userId: 1 }, {
          //@ts-ignore
          ability: defineAbility(can => {
            can("update", "tests");
            can(read, "tests");
          }, { resolveAction })
        });
        
        assert.deepStrictEqual(updatedItem, { [id]: item[id], test: false, userId: 1 }, `updated item correctly for read: '${read}'`);
      }
    });
      
    it("tests against original data, not updated data", async function () {
      const item = await service.create({ test: true, userId: 2 });
      
      const promise = service.update(item[id], { test: false, userId: 1 }, {
        //@ts-ignore
        ability: defineAbility((can, cannot) => {
          can("update", "tests");
          cannot("update", "tests", { userId: 1 });
        }, { resolveAction })
      });
      
      assert.rejects(promise, err => err.name === "Forbidden", "cannot update item");
    });
      
    it("throws if update with restricted fields leads to empty update", async function () {
      const item = await service.create({ test: true, userId: 1 });
      
      const promise = service.update(item[id], { test: false, userId: 1 }, {
        //@ts-ignore
        ability: defineAbility((can, cannot) => {
          can("update", "tests");
          cannot("update", "tests", ["test"]);
        }, { resolveAction })
      });
      
      assert.rejects(promise, err => err.name === "Forbidden", "rejects request");
    });
      
    it("assigns original data with updated data for restricted fields", async function () {
      const item = await service.create({ test: true, userId: 1 });
      
      const updatedItem = await service.update(item[id], { test: false, userId: 2 }, {
        //@ts-ignore
        ability: defineAbility((can) => {
          can("update", "tests", ["test"], { userId: 1 });
          can("read", "tests");
        }, { resolveAction })
      });
      
      const realItem = await service.get(item[id]);
      const expected = { [id]: item[id], test: false, userId: 1 };
      
      assert.deepStrictEqual(realItem, expected, "updated item correctly");
      assert.deepStrictEqual(updatedItem, realItem, "result of update is real item");
    });
      
    it("throws if cannot update item", async function () {
      const item = await service.create({ test: true, userId: 1 });
      
      const promise = service.update(item[id], { test: false, userId: 2 }, {
        //@ts-ignore
        ability: defineAbility((can, cannot) => {
          can("update", "tests");
          cannot("update", "tests", { userId: 1 });
        }, { resolveAction })
      });
      
      assert.rejects(promise, err => err.name === "Forbidden", "cannot update item");
    });

    //TODO: skip weird feathers-knex bug
    itSkip("feathers-knex")("updates item and returns empty object for not overlapping '$select' and 'restricting fields'", async function() {
      let item = { test: true, userId: 1, supersecret: true, hidden: true };
      
      item = await service.create(item);
      //@ts-ignore
      const updatedItem = { [id]: item[id], test: false, userId: 1, supersecret: true, hidden: true };
      //@ts-ignore
      const result = await service.update(item[id], updatedItem, {
        query: { $select: [id, "supersecret", "hidden"] },
        //@ts-ignore
        ability: defineAbility((can) => {
          can("read", "tests", ["test", "userId"]);
          can(["create", "update"], "tests");
        }, { resolveAction }),
      });
      assert.deepStrictEqual(result, {}, "returned item is empty because of $select and restricting fields");
      //@ts-ignore
      const itemInDb = await service.get(item[id]);
      
      assert.deepStrictEqual(itemInDb, updatedItem, "item in db is complete");
    });
  });
}