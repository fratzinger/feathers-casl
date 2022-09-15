import assert from "assert";
import feathers from "@feathersjs/feathers";
import { createAliasResolver, defineAbility } from "@casl/ability";
import _sortBy from "lodash/sortBy";

const resolveAction = createAliasResolver({
  update: "patch",
  read: ["get", "find"],
  delete: "remove",
});

import type { Application } from "@feathersjs/feathers";

import authorize from "../../../../../lib/hooks/authorize/authorize.hook";
import type { Adapter, AuthorizeHookOptions } from "../../../../../lib/types";

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
      
  describe(`${adapterName}: beforeAndAfter - remove:multiple`, function () {
    
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
    
    it("can remove multiple items and returns [] for not allowed read", async function () {
      // eslint-disable-next-line @typescript-eslint/no-unused-vars
      const item1 = await service.create({ test: true, userId: 1 });
      // eslint-disable-next-line @typescript-eslint/no-unused-vars
      const item2 = await service.create({ test: true, userId: 1 });
      const item3 = await service.create({ test: true, userId: 2 });
      
      const removedItems = await service.remove(null, {
        ability: defineAbility(can => {
          can("remove", "tests");
        }, { resolveAction }),
        query: {
          userId: 1
        }
      });
      
      assert.deepStrictEqual(removedItems, [], "result is empty array");
      
      const realItems = await service.find({ paginate: false });
      const expected = [
        { [id]: item3[id], test: true, userId: 2 }
      ];
      assert.deepStrictEqual(
        realItems,
        expected,
        "removed items correctly"
      );
    });
      
    it("can remove multiple items and returns result", async function () {
      const readMethods = ["read", "find"];
      
      for (const read of readMethods) {
        await clean(app, service);
        const item1 = await service.create({ test: true, userId: 1 });
        const item2 = await service.create({ test: true, userId: 1 });
        const item3 = await service.create({ test: true, userId: 2 });
            
        const removedItems = await service.remove(null, {
          ability: defineAbility(can => {
            can("remove", "tests");
            can(read, "tests");
          }, { resolveAction }),
          query: {
            userId: 1
          }
        });
        
        const expectedResult = [
          { [id]: item1[id], test: true, userId: 1 },
          { [id]: item2[id], test: true, userId: 1 }
        ];
        
        assert.deepStrictEqual(
          _sortBy(removedItems, id),
          _sortBy(expectedResult, id),
          `result is right array for read: '${read}'`
        );
        
        const realItems = await service.find({ paginate: false });
        const expected = [
          { [id]: item3[id], test: true, userId: 2 }
        ];
        assert.deepStrictEqual(
          realItems,
          expected,
          `removed items correctly for read: '${read}'`
        );
      }
    });
      
    it("removes only allowed items", async function () {
      const item1 = await service.create({ test: true, userId: 1 });
      const item2 = await service.create({ test: true, userId: 1 });
      const item3 = await service.create({ test: true, userId: 2 });
      
      const removedItems = await service.remove(null, {
        ability: defineAbility(can => {
          can("remove", "tests", { userId: 1 });
          can("read", "tests");
        }, { resolveAction }),
        query: {}
      });
      
      const expectedResult = [
        { [id]: item1[id], test: true, userId: 1 },
        { [id]: item2[id], test: true, userId: 1 }
      ];
      
      assert.deepStrictEqual(
        _sortBy(removedItems, id), 
        _sortBy(expectedResult, id), 
        "result is right array"
      );
      
      const realItems = await service.find({ paginate: false });
      const expected = [
        { [id]: item3[id], test: true, userId: 2 }
      ];
      assert.deepStrictEqual(
        _sortBy(realItems, id),
        _sortBy(expected, id),
        "removed items correctly"
      );
    });
      
    it("removes allowed items and returns subset for read", async function () {
      await service.create({ published: false, test: true, userId: 1 });
      const item2 = await service.create({ published: true, test: true, userId: 1 });
      const item3 = await service.create({ published: true, test: true, userId: 2 });
      const item4 = await service.create({ published: true, test: true, userId: 2 });
      const item5 = await service.create({ published: false, test: true, userId: 2 });
      
      const removedItems = await service.remove(null, {
        ability: defineAbility(can => {
          can("remove", "tests", { userId: 1 });
          can("read", "tests", { published: true });
        }, { resolveAction }),
        query: {}
      });
      
      const expectedResult = [
        { [id]: item2[id], published: true, test: true, userId: 1 }
      ];
      
      assert.deepStrictEqual(removedItems, expectedResult, "result is right array");
      
      const realItems = await service.find({ paginate: false });
      const expected = [
        { [id]: item3[id], published: true, test: true, userId: 2 },
        { [id]: item4[id], published: true, test: true, userId: 2 },
        { [id]: item5[id], published: false, test: true, userId: 2 }
      ];
      assert.deepStrictEqual(
        _sortBy(realItems, id),
        _sortBy(expected, id),
        "removed items correctly"
      );
    });
      
    it("removes allowed items and returns subset for read with restricted fields", async function () {
      let items = [
        { published: false, test: true, userId: 1 },
        { published: true, test: true, userId: 1 },
        { published: true, test: true, userId: 2 },
        { published: true, test: true, userId: 2 },
        { published: false, test: true, userId: 2 }
      ];
      items = await service.create(items);
      
      const removedItems = await service.remove(null, {
        ability: defineAbility(can => {
          can("remove", "tests", { userId: 1 });
          can("read", "tests", [id], { published: false });
          can("read", "tests", { published: true });
        }, { resolveAction })
      });
      
      const expectedResult = [
        { [id]: items[0][id] },
        { [id]: items[1][id], published: true, test: true, userId: 1 }
      ];
      
      assert.deepStrictEqual(
        _sortBy(removedItems, id), 
        _sortBy(expectedResult, id), 
        "result is right array"
      );
      
      const realItems = await service.find({ paginate: false });
      const expected = [
        { [id]: items[2][id], published: true, test: true, userId: 2 },
        { [id]: items[3][id], published: true, test: true, userId: 2 },
        { [id]: items[4][id], published: false, test: true, userId: 2 }
      ];
      assert.deepStrictEqual(
        _sortBy(realItems, id),
        _sortBy(expected, id),
        "removed items correctly"
      );
    });
  });
};