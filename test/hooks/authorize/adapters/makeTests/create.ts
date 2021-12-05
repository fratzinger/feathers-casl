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

export default (
  adapterName: Adapter,
  makeService: () => unknown,
  clean: (app, service) => Promise<void>,
  authorizeHookOptions: Partial<AuthorizeHookOptions>,
  afterHooks?: unknown[]
): void => {
  let app: Application;
  let service;
  let id;

  // eslint-disable-next-line @typescript-eslint/no-unused-vars
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
      
  describe(`${adapterName}: beforeAndAfter - create:single`, function () {
    
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
    
    it("can create one item and return 'undefined' for not allowed read", async function () {
      const allItems = (await service.find({ paginate: false })) as unknown[];
      assert.strictEqual(allItems.length, 0, "has no items before");
      const item = await service.create(
        { test: true, userId: 1 },
        {
          ability: defineAbility((can) => {
            can("create", "tests", { userId: 1 });
          }, { resolveAction }),
        }
      );
      
      assert.deepStrictEqual(item, undefined, "created item is undefined");
      
      const [realItem] = await service.find({ paginate: false });
      assert.deepStrictEqual(
        realItem,
        { [id]: realItem[id], test: true, userId: 1 },
        "created item"
      );
    });
      
    it("can create one item and return all properties", async function () {
      const allItems = (await service.find({ paginate: false })) as unknown[];
      assert.strictEqual(allItems.length, 0, "has no items before");
      const item = await service.create(
        { test: true, userId: 1 },
        {
          ability: defineAbility((can) => {
            can("create", "tests", { userId: 1 }), can("read", "tests");
          }, { resolveAction }),
        }
      );
      
      assert.deepStrictEqual(
        item,
        { [id]: item[id], test: true, userId: 1 },
        "created item with all properties"
      );
    });
      
    it("can't create not allowed item", async function () {
      const promise = service.create(
        { test: true, userId: 1 },
        {
          ability: defineAbility((can) => {
            can("create", "tests", { userId: 2 });
          }, { resolveAction }),
        }
      );
      
      await assert.rejects(
        promise,
        (err: Error) => err.name === "Forbidden",
        "rejects"
      );
    });
      
    it("can create one item and just returns id", async function () {
      const item = await service.create(
        { test: true, userId: 1 },
        {
          ability: defineAbility((can) => {
            can("create", "tests", { userId: 1 }),
            can("read", "tests", [id], { userId: 1 });
          }, { resolveAction }),
        }
      );
      
      assert.deepStrictEqual(item, { [id]: item[id] }, "just returns with id");
    });
      
    it("throws if cannot create item but passes with other item", async function () {
      await assert.rejects(
        service.create({ test: true, userId: 1 }, {
          ability: defineAbility((can, cannot) => {
            can("create", "tests");
            cannot("create", "tests", { userId: 1 });
          }, { resolveAction })
        }), 
        (err: Error) => err.name === "Forbidden", 
        "cannot create item"
      );

      await assert.doesNotReject(
        service.create({ test: true, userId: 2 }, {
          ability: defineAbility((can, cannot) => {
            can("create", "tests");
            cannot("create", "tests", { userId: 1 });
          }, { resolveAction })
        }),
        "can create 'userId:2'"
      );
    });
      
    it("creates item and returns empty object for not overlapping '$select' and 'restricting fields'", async function() {
      let item = { test: true, userId: 1, supersecret: true, hidden: true };
      const result = await service.create(
        item,
        {
          query: { $select: [id, "supersecret", "hidden"] },
          ability: defineAbility((can) => {
            can("read", "tests", ["test", "userId"]);
            can("create", "tests");
          }, { resolveAction }),
        }
      );
      [item] = await service.find({ paginate: false });
      assert.deepStrictEqual(result, {}, "returned item is empty because of $select and restricting fields");
      // @ts-ignore
      const itemInDb = await service.get(item[id]);
      assert.deepStrictEqual(itemInDb, item, "item in db is complete");
    });
  });
};