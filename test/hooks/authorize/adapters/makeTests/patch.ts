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
      
  describe(`${adapterName}: beforeAndAfter - patch:single`, function () {
    
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
    
    it("can patch one item and returns 'undefined' for not allowed read", async function () {
      const item = await service.create({ test: true, userId: 1 });
      
      const patchedItem = await service.patch(item[id], { test: false }, {
        //@ts-ignore
        ability: defineAbility(can => {
          can("patch", "tests");
        }, { resolveAction })
      });
      
      assert.deepStrictEqual(patchedItem, undefined, "patched item is undefined");
      
      const realItem = await service.get(item[id]);
      assert.deepStrictEqual(
        realItem,
        { [id]: item[id], test: false, userId: 1 },
        "patched item correctly"
      );
    });
      
    it("can patch one item and returns complete item", async function () {
      const readMethod = ["read", "get"];
      
      for (const read of readMethod) {
        await clean(app, service);
        const item = await service.create({ test: true, userId: 1 });
        const patchedItem = await service.patch(item[id], { test: false }, {
          //@ts-ignore
          ability: defineAbility(can => {
            can("patch", "tests");
            can(read, "tests");
          }, { resolveAction })
        });
        
        assert.deepStrictEqual(patchedItem, { [id]: item[id], test: false, userId: 1 }, `patched item correctly for read: '${read}'`);
      }
    });
      
    it("throws if patch with restricted fields leads to empty patch", async function () {
      const item = await service.create({ test: true, userId: 1 });
      
      const promise = service.patch(item[id], { test: false }, {
        //@ts-ignore
        ability: defineAbility((can, cannot) => {
          can("patch", "tests");
          cannot("patch", "tests", ["test"]);
        }, { resolveAction })
      });
      
      assert.rejects(promise, err => err.name === "Forbidden", "rejects request");
    });
      
    it("assigns original data with patched data for restricted fields", async function () {
      const item = await service.create({ test: true, userId: 1 });
      
      const patchedItem = await service.patch(item[id], { test: false, userId: 2 }, {
        //@ts-ignore
        ability: defineAbility((can) => {
          can("patch", "tests", ["test"], { userId: 1 });
          can("read", "tests");
        }, { resolveAction })
      });
      
      const realItem = await service.get(item[id]);
      const expected = { [id]: item[id], test: false, userId: 1 };
      
      assert.deepStrictEqual(realItem, expected, "patched item correctly");
      assert.deepStrictEqual(patchedItem, realItem, "result of patch is real item");
    });
      
    it("throws if cannot patch item", async function () {
      const item = await service.create({ test: true, userId: 1 });
      
      const promise = service.patch(item[id], { test: false }, {
        //@ts-ignore
        ability: defineAbility((can, cannot) => {
          can("patch", "tests");
          cannot("patch", "tests", { userId: 1 });
        }, { resolveAction })
      });
      
      assert.rejects(promise, err => err.name === "Forbidden", "cannot patch item");
    });
      
    it("patches item and returns empty object for not overlapping '$select' and 'restricting fields'", async function() {
      let item = { test: true, userId: 1, supersecret: true, hidden: true };
      
      item = await service.create(item);
      //@ts-ignore
      const result = await service.patch(item[id], { test: false }, {
        query: { $select: [id, "supersecret", "hidden"] },
        //@ts-ignore
        ability: defineAbility((can) => {
          can("read", "tests", ["test", "userId"]);
          can(["create", "update"], "tests");
        }, { resolveAction }),
      });
      assert.deepStrictEqual(result, {}, "returned item is empty because of $select and restricting fields");
      // @ts-ignore
      const itemInDb = await service.get(item[id]);
      // @ts-ignore
      const updatedItem = { [id]: item[id], test: false, userId: 1, supersecret: true, hidden: true };
      assert.deepStrictEqual(itemInDb, updatedItem, "item in db is complete");
    });

    it("basic cannot 'patch-data'", async function() {
      const readMethod = ["read", "get"];
      
      for (const read of readMethod) {
        await clean(app, service);
        const item = await service.create({ test: true, userId: 1 });
        try {
          await service.patch(item[id], { test: false }, {
            //@ts-ignore
            ability: defineAbility((can, cannot) => {
              can("patch", "tests");
              cannot("patch-data", "tests", { test: false });
              can(read, "tests");
            }, { resolveAction })
          });
          assert.fail("should not get here");
              
        } catch (err) {
          assert.ok(err, "should get here");
        }
      }
    });

    it("basic can 'patch-data' with fail", async function() {
      const readMethod = ["read", "get"];
      
      for (const read of readMethod) {
        await clean(app, service);
        const item = await service.create({ test: true, userId: 1 });
        try {
          await service.patch(item[id], { test: false }, {
            //@ts-ignore
            ability: defineAbility((can) => {
              can("patch", "tests");
              can("patch-data", "tests", { test: true });
              can(read, "tests");
            }, { resolveAction })
          });
          assert.fail("should not get here");
              
        } catch (err) {
          assert.ok(err, "should get here");
        }
      }
    });

    it("basic can 'patch-data'", async function () {
      const readMethod = ["read", "get"];
      
      for (const read of readMethod) {
        await clean(app, service);
        const item = await service.create({ test: true, userId: 1 });
        const patchedItem = await service.patch(item[id], { test: false }, {
          //@ts-ignore
          ability: defineAbility(can => {
            can("patch", "tests");
            can("patch-data", "tests", { test: false });
            can(read, "tests");
          }, { resolveAction })
        });
        
        assert.deepStrictEqual(patchedItem, { [id]: item[id], test: false, userId: 1 }, `patched item correctly for read: '${read}'`);
      }
    });
  });
};