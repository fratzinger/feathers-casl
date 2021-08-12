import assert from "assert";
import feathers from "@feathersjs/feathers";
import { createAliasResolver, defineAbility } from "@casl/ability";
import _sortBy from "lodash/sortBy";
import _isEqual from "lodash/isEqual";

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
      
  describe(`${adapterName}: beforeAndAfter - patch:multiple`, function () {
    
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
    
    it("patch:multi can patch multiple items and returns [] for not allowed read", async function () {
      const item1 = await service.create({ test: true, userId: 1 });
      const item2 = await service.create({ test: true, userId: 1 });
      const item3 = await service.create({ test: true, userId: 2 });
      
      const patchedItems = await service.patch(null, { test: false }, {
        ability: defineAbility(can => {
          can("patch", "tests");
        }, { resolveAction }),
        query: {
          userId: 1
        }
      });
      
      assert.deepStrictEqual(patchedItems, [], "result is empty array");
      
      const realItems = await service.find({ paginate: false });
      const expected = [
        { [id]: item1[id], test: false, userId: 1 },
        { [id]: item2[id], test: false, userId: 1 },
        { [id]: item3[id], test: true, userId: 2 }
      ];
      assert.deepStrictEqual(
        _sortBy(realItems, id),
        _sortBy(expected, id),
        "patched items correctly"
      );
    });
      
    it("patch:multi can patch multiple items and returns result", async function () {
      const readMethods = ["read", "find"];
      
      for (const read of readMethods) {
        await clean(app, service);
        const item1 = await service.create({ test: true, userId: 1 });
        const item2 = await service.create({ test: true, userId: 1 });
        const item3 = await service.create({ test: true, userId: 2 });
        
        const patchedItems = await service.patch(null, { test: false }, {
          ability: defineAbility(can => {
            can("patch", "tests");
            can(read, "tests");
          }, { resolveAction }),
          query: {
            userId: 1
          }
        });
        
        const expectedResult = [
          { [id]: item1[id], test: false, userId: 1 },
          { [id]: item2[id], test: false, userId: 1 }
        ];
        
        assert.deepStrictEqual(
          _sortBy(patchedItems, id),
          _sortBy(expectedResult, id),
          `result is right array for read: '${read}'`
        );
        
        const realItems = await service.find({ paginate: false });
        const expected = [
          { [id]: item1[id], test: false, userId: 1 },
          { [id]: item2[id], test: false, userId: 1 },
          { [id]: item3[id], test: true, userId: 2 }
        ];
        assert.deepStrictEqual(
          _sortBy(realItems, id),
          _sortBy(expected, id),
          "patched items correctly"
        );
      }
    });
      
    it("patch:multi assigns original data with patched data for restricted fields", async function () {
      await clean(app, service);
      const item1 = await service.create({ test: true, userId: 1 });
      const item2 = await service.create({ test: false, userId: 5 });
      
      const patchedItems = await service.patch(null, { test: false, userId: 2 }, {
        ability: defineAbility((can) => {
          can("patch", "tests", ["test"], { userId: 1 });
          can("read", "tests");
        }, { resolveAction })
      });
      
      const realItems = await service.find({ paginate: false });
      const expected = [
        { [id]: item1[id], test: false, userId: 1 },
        item2
      ];
      
      assert.deepStrictEqual(
        _sortBy(realItems, id),
        _sortBy(expected, id),
        "patched item correctly"
      );

      assert.deepStrictEqual(
        _sortBy(patchedItems, id), 
        realItems.filter(x => _isEqual(x[id], item1[id])), 
        "result of patch is real item"
      );
    });
      
    it("patch:multi patches only allowed items", async function () {
      const item1 = await service.create({ test: true, userId: 1 });
      const item2 = await service.create({ test: true, userId: 1 });
      const item3 = await service.create({ test: true, userId: 2 });
      
      const patchedItems = await service.patch(null, { test: false }, {
        ability: defineAbility(can => {
          can("patch", "tests", { userId: 1 });
          can("read", "tests");
        }, { resolveAction }),
        query: {}
      });
      
      const expectedResult = [
        { [id]: item1[id], test: false, userId: 1 },
        { [id]: item2[id], test: false, userId: 1 }
      ];
      
      assert.deepStrictEqual(
        _sortBy(patchedItems, id), 
        _sortBy(expectedResult, id), 
        "result is right array"
      );
      
      const realItems = await service.find({ paginate: false });
      const expected = [
        { [id]: item1[id], test: false, userId: 1 },
        { [id]: item2[id], test: false, userId: 1 },
        { [id]: item3[id], test: true, userId: 2 }
      ];
      assert.deepStrictEqual(
        _sortBy(realItems, id),
        _sortBy(expected, id),
        "patched items correctly"
      );
    });
      
    it("patch:multi patches allowed items and returns subset for read", async function () {
      let items = [
        { published: false, test: true, userId: 1 },
        { published: true, test: true, userId: 1 },
        { published: true, test: true, userId: 2 },
        { published: true, test: true, userId: 2 },
        { published: false, test: true, userId: 2 }
      ];
      items = await service.create(items);
      
      const patchedItems = await service.patch(null, { test: false }, {
        ability: defineAbility(can => {
          can("patch", "tests", { userId: 1 });
          can("read", "tests", { published: true });
        }, { resolveAction }),
        query: {}
      });
      
      const expectedResult = [
        { [id]: items[1][id], published: true, test: false, userId: 1 }
      ];
      
      assert.deepStrictEqual(patchedItems, expectedResult, "result is right array");
      
      const realItems = await service.find({ paginate: false });
      const expected = [
        { [id]: items[0][id], published: false, test: false, userId: 1 },
        { [id]: items[1][id], published: true, test: false, userId: 1 },
        { [id]: items[2][id], published: true, test: true, userId: 2 },
        { [id]: items[3][id], published: true, test: true, userId: 2 },
        { [id]: items[4][id], published: false, test: true, userId: 2 }
      ];
      assert.deepStrictEqual(
        _sortBy(realItems, id),
        _sortBy(expected, id),
        "patched items correctly"
      );
    });
      
    it("patch:multi patches allowed items and returns subset for read", async function () {
      let items = [
        { published: false, test: true, userId: 1 },
        { published: true, test: true, userId: 1 },
        { published: true, test: true, userId: 2 },
        { published: true, test: true, userId: 2 },
        { published: false, test: true, userId: 2 }
      ];
      items = await service.create(items);
      
      const patchedItems = await service.patch(null, { test: false }, {
        ability: defineAbility(can => {
          can("patch", "tests", { userId: 1 });
          can("read", "tests", [id], { published: false });
          can("read", "tests", { published: true });
        }, { resolveAction }),
        query: {}
      });
      
      const expectedResult = [
        { [id]: items[0][id] },
        { [id]: items[1][id], published: true, test: false, userId: 1 }
      ];
      
      assert.deepStrictEqual(
        _sortBy(patchedItems, id),
        _sortBy(expectedResult, id),
        "result is right array"
      );
      
      const realItems = await service.find({ paginate: false });
      const expected = [
        { [id]: items[0][id], published: false, test: false, userId: 1 },
        { [id]: items[1][id], published: true, test: false, userId: 1 },
        { [id]: items[2][id], published: true, test: true, userId: 2 },
        { [id]: items[3][id], published: true, test: true, userId: 2 },
        { [id]: items[4][id], published: false, test: true, userId: 2 }
      ];
      assert.deepStrictEqual(
        _sortBy(realItems, id),
        _sortBy(expected, id),
        "patched items correctly"
      );
    });
  });
};