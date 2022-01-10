import assert from "assert";
import { feathers, Paginated } from "@feathersjs/feathers";
import { createAliasResolver, defineAbility } from "@casl/ability";
import _sortBy from "lodash/sortBy";

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
      
  describe(`${adapterName}: beforeAndAfter - find`, function () {

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

    describe("without query", function() {
      it("returns full items", async function () {
        const readMethods = ["read", "find"];
        
        for (const read of readMethods) {
          await clean(app, service);
        
          await service.create({ test: true, userId: 1 });
          await service.create({ test: true, userId: 2 });
          await service.create({ test: true, userId: 3 });
          const items = (await service.find({ paginate: false })) as unknown[];
          assert.strictEqual(items.length, 3, `has three items for read: '${read}'`);
          
          const returnedItems = await service.find({
            ability: defineAbility((can) => {
              can(read, "tests");
            }, { resolveAction }),
            paginate: false,
          });
          
          assert.deepStrictEqual(returnedItems, items, `items are the same for read: '${read}'`);
        }
      });

      it("returns only allowed items", async function () {
        const item1 = await service.create({ test: true, userId: 1 });
        await service.create({ test: true, userId: 2 });
        await service.create({ test: true, userId: 3 });
        const items = await service.find({ paginate: false });
        assert.strictEqual(items.length, 3, "has three items");
        
        const returnedItems = await service.find({
          ability: defineAbility((can) => {
            can("read", "tests", { userId: 1 });
          }, { resolveAction }),
          paginate: false
        }) as Paginated<unknown>;
        
        assert.deepStrictEqual(
          returnedItems,
          [{ [id]: item1[id], test: true, userId: 1 }],
          "just returned one item"
        );
      });

      it("returns only allowed items with individual subset of fields", async function () {
        const item1 = await service.create({ test: true, userId: 1 });
        const item2 = await service.create({ test: true, userId: 2 });
        await service.create({ test: true, userId: 3 });
        const items = (await service.find({ paginate: false })) as unknown[];
        assert.strictEqual(items.length, 3, "has three items");
        
        const returnedItems = await service.find({
          ability: defineAbility((can) => {
            can("read", "tests", { userId: 1 }),
            can("read", "tests", [id], { userId: 2 });
          }, { resolveAction }),
          paginate: false,
        });
        
        assert.deepStrictEqual(
          _sortBy(returnedItems, id),
          _sortBy([
            { [id]: item1[id], test: true, userId: 1 }, 
            { [id]: item2[id] }
          ], id),
          "just returned one item"
        );
      });

      it("returns only allowed items with cannot", async function () {
        const item1 = await service.create({ test: true, userId: 1 });
        const item2 = await await service.create({ test: true, userId: 2 });
        await await service.create({ test: true, userId: 3 });
        const items = (await service.find({ paginate: false })) as unknown[];
        assert.strictEqual(items.length, 3, "has three items");
        
        const returnedItems = await service.find({
          ability: defineAbility((can, cannot) => {
            can("read", "tests");
            cannot("read", "tests", { userId: 3 });
          }, { resolveAction }),
          paginate: false
        }) as Paginated<unknown>;
        
        assert.deepStrictEqual(
          _sortBy(returnedItems, id),
          _sortBy([
            { [id]: item1[id], test: true, userId: 1 },
            { [id]: item2[id], test: true, userId: 2 },
          ], id),
          "just returned two items without userId: 3"
        );
      });

      it("throws for non 'can'", async function () {
        await service.create({ test: true, userId: 1 });
        await service.create({ test: true, userId: 2 });
        await service.create({ test: true, userId: 3 });
        const items = (await service.find({ paginate: false })) as unknown[];
        assert.strictEqual(items.length, 3, "has three items");
        
        const returnedItems = service.find({
          // eslint-disable-next-line @typescript-eslint/no-empty-function
          ability: defineAbility(() => {}, { resolveAction }),
          paginate: false,
        });
        
        await assert.rejects(
          returnedItems,
          (err: Error) => err.name === "Forbidden",
          "throws on find"
        );
      });

      it("throws for explicit 'cannot'", async function () {
        await service.create({ test: true, userId: 1 });
        await service.create({ test: true, userId: 2 });
        await service.create({ test: true, userId: 3 });
        const items = (await service.find({ paginate: false })) as unknown[];
        assert.strictEqual(items.length, 3, "has three items");
        
        const returnedItems = service.find({
          ability: defineAbility((can, cannot) => {
            cannot("read", "tests");
          }, { resolveAction }),
          paginate: false,
        });
        
        await assert.rejects(
          returnedItems,
          (err: Error) => err.name === "Forbidden",
          "throws on find"
        );
      });

      it("returns all items for conditions -> 'all'", async function () {
        await service.create({ test: true, userId: 1 });
        await service.create({ test: true, userId: 2 });
        await service.create({ test: true, userId: 3 });
        const items = await service.find({ paginate: false });
        assert.strictEqual(items.length, 3, "has three items");
        
        const returnedItems = await service.find({
          ability: defineAbility((can) => {
            can("read", "tests", { userId: 1 });
            can("manage", "all");
          }, { resolveAction }),
          paginate: false
        }) as Paginated<unknown>;
        
        assert.deepStrictEqual(
          _sortBy(returnedItems, id),
          _sortBy(items, id),
          "returns all items"
        );
      });

      it("returns all items for 'all' -> conditions", async function () {
        await service.create({ test: true, userId: 1 });
        await service.create({ test: true, userId: 2 });
        await service.create({ test: true, userId: 3 });
        const items = await service.find({ paginate: false });
        assert.strictEqual(items.length, 3, "has three items");
        
        const returnedItems = await service.find({
          ability: defineAbility((can) => {
            can("manage", "all");
            can("read", "tests", { userId: 1 });
          }, { resolveAction }),
          paginate: false
        }) as Paginated<unknown>;
        
        assert.deepStrictEqual(
          _sortBy(returnedItems, id),
          _sortBy(items, id),
          "returns all items"
        );
      });
  
      it("'manage:all' and 'cannot' combined", async function() {
        await service.create({ test: true, userId: 1 });
        const item2 = await service.create({ test: true, userId: 2 });
        const item3 = await service.create({ test: true, userId: 3 });
        const items = await service.find({ paginate: false });
        assert.strictEqual(items.length, 3, "has three items");
        
        const returnedItems = await service.find({
          ability: defineAbility((can, cannot) => {
            can("manage", "all");
            cannot("read", "tests", { userId: 1 });
            cannot("read", "tests", ["test", "userId"], { userId: 2 });
          }, { resolveAction }),
          paginate: false
        }) as Paginated<unknown>;
        
        assert.deepStrictEqual(
          _sortBy(returnedItems, id),
          _sortBy([
            { [id]: item2[id] }, 
            item3
          ], id),
          "returns subset of items"
        );
      });
  
      it("combines rules by $or", async function() {
        const item1 = await service.create({ test: true, userId: 1, published: false });
        const item2 = await service.create({ test: true, userId: 2, published: true });
        await service.create({ test: true, userId: 3, published: false });
  
        const items = (await service.find({ paginate: false })) as unknown[];
        assert(items.length === 3, "has two items");
  
        const returnedItems = await service.find({
          ability: defineAbility(
            (can) => {
              can("read", "tests", { published: true });
              can("read", "tests", { userId: { $in: [1] } });
            },
            { resolveAction }
          ),
          paginate: false,
        });
  
        assert.deepStrictEqual(
          _sortBy(returnedItems, id),
          _sortBy([item1, item2], id),
          "returns all items"
        );
      });
    });

    describe("with additional query", function() {
      it("returns only allowed items", async function () {
        await service.create({ test: false, userId: 1 });
        await service.create({ test: true, userId: 2 });
        await service.create({ test: true, userId: 3 });
        const item4 = await service.create({ test: false, userId: 3 });
        await service.create({ test: false, userId: 2 });
        const items = (await service.find({ paginate: false })) as unknown[];
        assert.strictEqual(items.length, 5, "has five items");
        
        const returnedItems = await service.find({
          ability: defineAbility((can) => {
            can("read", "tests", { userId: 3 });
          }, { resolveAction }),
          query: {
            test: false
          },
          paginate: false
        });
        
        assert.deepStrictEqual(
          _sortBy(returnedItems, id),
          _sortBy([item4], id),
          "just returned one item"
        );
      });

      it("returns only allowed items with individual subset of fields with $select", async function () {
        const item1 = await service.create({ test: true, userId: 1 });
        const item2 = await service.create({ test: true, userId: 2 });
        await service.create({ test: true, userId: 3 });
        const items = (await service.find({ paginate: false })) as unknown[];
        assert.strictEqual(items.length, 3, "has three items");
        
        const returnedItems = await service.find({
          ability: defineAbility((can) => {
            can("read", "tests", { userId: 1 }),
            can("read", "tests", [id], { userId: 2 });
          }, { resolveAction }),
          query: {
            $select: [id, "test"]
          },
          paginate: false,
        });
        
        assert.deepStrictEqual(
          _sortBy(returnedItems, id),
          _sortBy([
            { [id]: item1[id], test: true }, 
            { [id]: item2[id] }
          ], id),
          "just returned one item"
        );
      });

      it("returns only allowed items with '$or' query", async function () {
        const item1 = await service.create({ test: true, userId: 1 });
        await service.create({ test: true, userId: 2 });
        await service.create({ test: true, userId: 3 });
        await service.create({ test: true, userId: 4 });
        const items = (await service.find({ paginate: false })) as unknown[];
        assert.strictEqual(items.length, 4, "has four items");
          
        const returnedItems = await service.find({
          ability: defineAbility((can, cannot) => {
            can("read", "tests", { userId: 1 });
            can("read", "tests", { userId: 2 });
            cannot("read", "tests", { userId: 4 });
          }, { resolveAction }),
          query: {
            $or: [
              {
                userId: 1
              },
              {
                userId: 3
              },
              {
                userId: 4
              }
            ]
          },
          paginate: false
        }) as Paginated<unknown>;
          
        assert.deepStrictEqual(
          returnedItems,
          [
            { [id]: item1[id], test: true, userId: 1 },
          ],
          "just returned one item"
        );
      });

      it("returns only allowed items with '$and' query", async function() {
        const item1 = await service.create({ test: true, userId: 1 });
        const item2 = await service.create({ test: true, userId: 2 });
        await service.create({ test: false, userId: 1 });
        await service.create({ test: true, userId: 4 });
        const items = (await service.find({ paginate: false })) as unknown[];
        assert.strictEqual(items.length, 4, "has four items");
          
        const returnedItems = await service.find({
          ability: defineAbility((can, cannot) => {
            can("read", "tests", { userId: 1 });
            can("read", "tests", { userId: 2 });
            cannot("read", "tests", { userId: 4 });
          }, { resolveAction }),
          query: {
            $and: [
              {
                test: true
              }
            ]
          },
          paginate: false
        }) as Paginated<unknown>;
          
        assert.deepStrictEqual(
          _sortBy(returnedItems, id),
          _sortBy([
            item1,
            item2
          ], id),
          "just returned two items"
        );
      });
        
      it("returns only allowed items with '$in' query", async function () {
        const item1 = await service.create({ test: true, userId: 1 });
        // eslint-disable-next-line @typescript-eslint/no-unused-vars
        const item2 = await service.create({ test: true, userId: 2 });
        // eslint-disable-next-line @typescript-eslint/no-unused-vars
        const item3 = await service.create({ test: true, userId: 3 });
        const items = (await service.find({ paginate: false })) as unknown[];
        assert.strictEqual(items.length, 3, "has three items");
        
        const returnedItems = await service.find({
          ability: defineAbility((can) => {
            can("read", "tests", { userId: 1 });
          }, { resolveAction }),
          query: {
            userId: {
              $in: [1, 2]
            }
          },
          paginate: false
        }) as Paginated<unknown>;
        
        assert.deepStrictEqual(
          returnedItems,
          [
            { [id]: item1[id], test: true, userId: 1 },
          ],
          "just returned one item"
        );
      });
        
      it("returns only allowed items with '$nin' query", async function () {
        const item1 = await service.create({ test: true, userId: 1 });
        await service.create({ test: true, userId: 2 });
        await service.create({ test: true, userId: 3 });
        const items = (await service.find({ paginate: false })) as unknown[];
        assert.strictEqual(items.length, 3, "has three items");
        
        const returnedItems = await service.find({
          ability: defineAbility((can) => {
            can("read", "tests", { userId: 1 });
          }, { resolveAction }),
          query: {
            userId: {
              $nin: [3]
            }
          },
          paginate: false
        }) as Paginated<unknown>;
        
        assert.deepStrictEqual(
          returnedItems,
          [
            { [id]: item1[id], test: true, userId: 1 },
          ],
          "just returned one item"
        );
      });
    });
  });
};
