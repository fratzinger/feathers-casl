import assert from "assert";
import feathers, { Paginated } from "@feathersjs/feathers";
import { Service } from "feathers-memory";
import { createAliasResolver, defineAbility } from "@casl/ability";

const resolveAction = createAliasResolver({
  update: "patch",
  read: ["get", "find"],
  delete: "remove",
});

import { Application } from "@feathersjs/feathers";

import authorize from "../../lib/hooks/authorize/authorize.hook";
import { ServiceCaslOptions } from "../../lib/types";

declare module "@feathersjs/adapter-commons" {
  interface ServiceOptions {
    casl: ServiceCaslOptions
  }
}

describe("authorize.complete.test.ts", function () {
  let app: Application;
  let service: Service;

  beforeEach(function () {
    app = feathers();
    app.use(
      "tests",
      new Service({
        multi: true,
        casl: {
          availableFields: ["id", "userId", "hi", "test", "published"]
        },
        paginate: {
          default: 10,
          max: 50
        }
      })
    );
    service = app.service("tests");
    //@ts-ignore
    service.hooks({
      before: {
        all: [
          authorize({ 
            availableFields: ["id", "userId", "hi", "test", "published"] 
          })
        ],
      },
      after: {
        all: [authorize({
          availableFields: ["id", "userId", "hi", "test", "published"]
        })],
      },
    });
  });

  describe("beforeAndAfter - get", function () {
    it("returns full item", async function () {
      const readMethods = ["read", "get"];
      for (const read of readMethods) {
        const item = await service.create({ test: true, userId: 1 });
        assert(item.id !== undefined, `item has id for read: '${read}'`);
        const returnedItem = await service.get(item.id, {
          //@ts-ignore
          ability: defineAbility((can) => {
            can(read, "tests", { userId: 1 });
          }, { resolveAction }),
        });
        assert.deepStrictEqual(
          returnedItem,
          item,
          `'create' and 'get' item are the same for read: '${read}'`
        );
      }
      
    });

    it("returns subset of fields", async function () {
      const item = await service.create({ test: true, userId: 1 });
      assert(item.id !== undefined, "item has id");
      const returnedItem = await service.get(item.id, {
        //@ts-ignore
        ability: defineAbility((can) => {
          can("read", "tests", ["id"], { userId: 1 });
        }, { resolveAction }),
      });
      assert.deepStrictEqual(
        returnedItem,
        { id: item.id },
        "'get' returns only [id]"
      );
    });

    it("returns restricted subset of fields with $select", async function () {
      const item = await service.create({ test: true, userId: 1, published: true });
      assert(item.id !== undefined, "item has id");
      const returnedItem = await service.get(item.id, {
        //@ts-ignore
        ability: defineAbility((can) => {
          can("read", "tests", ["id"], { userId: 1 });
        }, { resolveAction }),
        query: {
          $select: ["id", "userId"]
        }
      });
      assert.deepStrictEqual(
        returnedItem,
        { id: item.id },
        "'get' returns only [id]"
      );
    });

    // eslint-disable-next-line @typescript-eslint/no-empty-function
    it.skip("returns subset of fields with inverted fields", async function () {});

    it("throws forbidden for not 'can'", async function () {
      const item = await service.create({ test: true, userId: 1 });
      assert(item.id !== undefined, "item has id");
      const returnedItem = service.get(item.id, {
        //@ts-ignore
        ability: defineAbility((can) => {
          can("read", "tests", { userId: 2 });
        }, { resolveAction }),
      });
      await assert.rejects(
        returnedItem,
        (err) => err.name === "Forbidden",
        "rejects for id not allowed"
      );
    });

    it("throws forbidden for explicit 'cannot'", async function () {
      const item = await service.create({ test: true, userId: 1 });
      assert(item.id !== undefined, "item has id");
      const returnedItem = service.get(item.id, {
        //@ts-ignore
        ability: defineAbility((can, cannot) => {
          cannot("read", "tests", { userId: 1 });
        }, { resolveAction }),
      });
      await assert.rejects(
        returnedItem,
        (err) => err.name === "Forbidden",
        "rejects for id not allowed"
      );
    });

    it("throws if $select and restricted fields don't overlap", async function() {
      const item = await service.create({ id: 0, test: true, userId: 1, supersecret: true, hidden: true });
      assert(item.id !== undefined, "item has id");
      const promise = service.get(item.id, {
        query: { $select: ["id", "supersecret", "hidden"] },
        //@ts-ignore
        ability: defineAbility((can) => {
          can("read", "tests", ["test", "userId"]);
        }, { resolveAction }),
      });
      await assert.rejects(
        promise,
        (err) => err.name === "Forbidden",
        "rejects for id not allowed"
      );
    });
  });

  describe("beforeAndAfter - find", function () {
    it("returns full items", async function () {
      const readMethods = ["read", "find"];

      for (const read of readMethods) {
        await service.remove(null);

        await service.create({ test: true, userId: 1 });
        await service.create({ test: true, userId: 2 });
        await service.create({ test: true, userId: 3 });
        const items = (await service.find({ paginate: false })) as unknown[];
        assert(items.length === 3, `has three items for read: '${read}'`);
  
        const returnedItems = await service.find({
          //@ts-ignore
          ability: defineAbility((can) => {
            can(read, "tests");
          }, { resolveAction }),
          paginate: false,
        });
  
        assert.deepStrictEqual(returnedItems, items, `items are the same for read: '${read}'`);
      }
    });

    it("returns only allowed items", async function () {
      await service.create({ test: true, userId: 1 });
      await service.create({ test: true, userId: 2 });
      await service.create({ test: true, userId: 3 });
      const { data: items, total } = await service.find() as Paginated<unknown>;
      assert(items.length === 3, "has three items");
      assert(total === 3, "total of three");

      const { data: returnedItems, total: returnedTotal } = await service.find({
        //@ts-ignore
        ability: defineAbility((can) => {
          can("read", "tests", { userId: 1 });
        }, { resolveAction })
      }) as Paginated<unknown>;

      assert.deepStrictEqual(
        returnedItems,
        //@ts-ignore
        [{ id: items[0].id, test: true, userId: 1 }],
        "just returned one item"
      );
      assert.strictEqual(returnedTotal, 1, "total is '1'");
    });

    it("returns only allowed items with individual subset of fields", async function () {
      await service.create({ test: true, userId: 1 });
      await service.create({ test: true, userId: 2 });
      await service.create({ test: true, userId: 3 });
      const items = (await service.find({ paginate: false })) as unknown[];
      assert(items.length === 3, "has three items");

      const returnedItems = await service.find({
        //@ts-ignore
        ability: defineAbility((can) => {
          can("read", "tests", { userId: 1 }),
          can("read", "tests", ["id"], { userId: 2 });
        }, { resolveAction }),
        paginate: false,
      });

      assert.deepStrictEqual(
        returnedItems,
        //@ts-ignore
        [{ id: items[0].id, test: true, userId: 1 }, { id: items[1].id }],
        "just returned one item"
      );
    });

    it("returns only allowed items with individual subset of fields with $select", async function () {
      await service.create({ test: true, userId: 1 });
      await service.create({ test: true, userId: 2 });
      await service.create({ test: true, userId: 3 });
      const items = (await service.find({ paginate: false })) as unknown[];
      assert(items.length === 3, "has three items");

      const returnedItems = await service.find({
        //@ts-ignore
        ability: defineAbility((can) => {
          can("read", "tests", { userId: 1 }),
          can("read", "tests", ["id"], { userId: 2 });
        }, { resolveAction }),
        query: {
          $select: ["id", "test"]
        },
        paginate: false,
      });

      assert.deepStrictEqual(
        returnedItems,
        //@ts-ignore
        [{ id: items[0].id, test: true }, { id: items[1].id }],
        "just returned one item"
      );
    });

    it("returns only allowed items with cannot", async function () {
      await service.create({ test: true, userId: 1 });
      await service.create({ test: true, userId: 2 });
      await service.create({ test: true, userId: 3 });
      const items = (await service.find({ paginate: false })) as unknown[];
      assert(items.length === 3, "has three items");

      const { data: returnedItems, total } = await service.find({
        //@ts-ignore
        ability: defineAbility((can, cannot) => {
          can("read", "tests");
          cannot("read", "tests", { userId: 3 });
        }, { resolveAction })
      }) as Paginated<unknown>;

      assert.deepStrictEqual(
        returnedItems,
        [
          //@ts-ignore
          { id: items[0].id, test: true, userId: 1 },
          //@ts-ignore
          { id: items[1].id, test: true, userId: 2 },
        ],
        "just returned two items without userId: 3"
      );

      assert.strictEqual(total, 2, "total is '2'");
    });

    it("returns only allowed items with '$or' query", async function () {
      await service.create({ test: true, userId: 1 });
      await service.create({ test: true, userId: 2 });
      await service.create({ test: true, userId: 3 });
      const items = (await service.find({ paginate: false })) as unknown[];
      assert(items.length === 3, "has three items");

      const { data: returnedItems, total } = await service.find({
        //@ts-ignore
        ability: defineAbility((can) => {
          can("read", "tests", { userId: 1 });
        }, { resolveAction }),
        query: {
          $or: [
            {
              userId: 1
            },
            {
              userId: 2
            }
          ]
        }
      }) as Paginated<unknown>;

      assert.deepStrictEqual(
        returnedItems,
        [
          //@ts-ignore
          { id: items[0].id, test: true, userId: 1 },
        ],
        "just returned one item"
      );

      assert.strictEqual(total, 1, "total is only 1");
    });

    it("returns only allowed items with '$in' query", async function () {
      await service.create({ test: true, userId: 1 });
      await service.create({ test: true, userId: 2 });
      await service.create({ test: true, userId: 3 });
      const items = (await service.find({ paginate: false })) as unknown[];
      assert(items.length === 3, "has three items");

      const { data: returnedItems, total } = await service.find({
        //@ts-ignore
        ability: defineAbility((can) => {
          can("read", "tests", { userId: 1 });
        }, { resolveAction }),
        query: {
          userId: {
            $in: [1, 2]
          }
        }
      }) as Paginated<unknown>;

      assert.deepStrictEqual(
        returnedItems,
        [
          //@ts-ignore
          { id: items[0].id, test: true, userId: 1 },
        ],
        "just returned one item"
      );

      assert.strictEqual(total, 1, "total is only 1");
    });

    it("returns only allowed items with '$nin' query", async function () {
      await service.create({ test: true, userId: 1 });
      await service.create({ test: true, userId: 2 });
      await service.create({ test: true, userId: 3 });
      const items = (await service.find({ paginate: false })) as unknown[];
      assert(items.length === 3, "has three items");

      const { data: returnedItems, total } = await service.find({
        //@ts-ignore
        ability: defineAbility((can) => {
          can("read", "tests", { userId: 1 });
        }, { resolveAction }),
        query: {
          userId: {
            $nin: [1, 2]
          }
        }
      }) as Paginated<unknown>;

      assert.deepStrictEqual(
        returnedItems,
        [
          //@ts-ignore
          { id: items[0].id, test: true, userId: 1 },
        ],
        "just returned one item"
      );

      assert.strictEqual(total, 1, "total is only 1");
    });

    it("throws for non 'can'", async function () {
      await service.create({ test: true, userId: 1 });
      await service.create({ test: true, userId: 2 });
      await service.create({ test: true, userId: 3 });
      const items = (await service.find({ paginate: false })) as unknown[];
      assert(items.length === 3, "has three items");

      const returnedItems = service.find({
        //@ts-ignore
        // eslint-disable-next-line @typescript-eslint/no-empty-function
        ability: defineAbility(() => {}, { resolveAction }),
        paginate: false,
      });

      assert.rejects(
        returnedItems,
        (err) => err.name === "Forbidden",
        "throws on find"
      );
    });

    it("throws for explicit 'cannot'", async function () {
      await service.create({ test: true, userId: 1 });
      await service.create({ test: true, userId: 2 });
      await service.create({ test: true, userId: 3 });
      const items = (await service.find({ paginate: false })) as unknown[];
      assert(items.length === 3, "has three items");

      const returnedItems = service.find({
        //@ts-ignore
        ability: defineAbility((can, cannot) => {
          cannot("read", "tests");
        }, { resolveAction }),
        paginate: false,
      });

      assert.rejects(
        returnedItems,
        (err) => err.name === "Forbidden",
        "throws on find"
      );
    });
  });

  describe("beforeAndAfter - create:single", function () {
    it("can create one item and return 'undefined' for not allowed read", async function () {
      const allItems = (await service.find({ paginate: false })) as unknown[];
      assert(allItems.length === 0, "has no items before");
      const item = await service.create(
        { test: true, userId: 1 },
        {
          //@ts-ignore
          ability: defineAbility((can) => {
            can("create", "tests", { userId: 1 });
          }, { resolveAction }),
        }
      );

      assert.deepStrictEqual(item, undefined, "created item is undefined");

      const realItem = await service.get(0);
      assert.deepStrictEqual(
        realItem,
        { id: 0, test: true, userId: 1 },
        "created item"
      );
    });

    it("can create one item and return all properties", async function () {
      const allItems = (await service.find({ paginate: false })) as unknown[];
      assert(allItems.length === 0, "has no items before");
      const item = await service.create(
        { test: true, userId: 1 },
        {
          //@ts-ignore
          ability: defineAbility((can) => {
            can("create", "tests", { userId: 1 }), can("read", "tests");
          }, { resolveAction }),
        }
      );

      assert.deepStrictEqual(
        item,
        { id: item.id, test: true, userId: 1 },
        "created item with all properties"
      );
    });

    it("can't create not allowed item", async function () {
      const promise = service.create(
        { test: true, userId: 1 },
        {
          //@ts-ignore
          ability: defineAbility((can) => {
            can("create", "tests", { userId: 2 });
          }, { resolveAction }),
        }
      );

      await assert.rejects(
        promise,
        (err) => err.name === "Forbidden",
        "rejects"
      );
    });

    it("can create one item and just returns id", async function () {
      const item = await service.create(
        { test: true, userId: 1 },
        {
          //@ts-ignore
          ability: defineAbility((can) => {
            can("create", "tests", { userId: 1 }),
            can("read", "tests", ["id"], { userId: 1 });
          }, { resolveAction }),
        }
      );

      assert.deepStrictEqual(item, { id: item.id }, "just returns with id");
    });

    it("throws if cannot create item", async function () {
      const promise = service.create({ test: true, userId: 2 }, {
        //@ts-ignore
        ability: defineAbility((can, cannot) => {
          can("create", "tests");
          cannot("create", "tests", { userId: 1 });
        }, { resolveAction })
      });

      assert.rejects(promise, err => err.name === "Forbidden", "cannot create item");
    });

    it("creates item and returns empty object for not overlapping '$select' and 'restricting fields'", async function() {
      const item = { id: 0, test: true, userId: 1, supersecret: true, hidden: true };
      const result = await service.create(
        item,
        {
          query: { $select: ["id", "supersecret", "hidden"] },
          //@ts-ignore
          ability: defineAbility((can) => {
            can("read", "tests", ["test", "userId"]);
            can("create", "tests");
          }, { resolveAction }),
        }
      );
      assert.deepStrictEqual(result, {}, "returned item is empty because of $select and restricting fields");
      const itemInDb = await service.get(item.id);
      assert.deepStrictEqual(itemInDb, item, "item in db is complete");
    });
  });

  describe("beforeAndAfter - create:multi", function () {
    it("can create multiple items and returns empty array", async function () {
      const allItems = (await service.find({ paginate: false })) as unknown[];
      assert(allItems.length === 0, "has no items before");
      const itemsArr = [
        { id: 0, test: true, hi: "1", userId: 1 },
        { id: 1, test: true, hi: "2", userId: 1 },
        { id: 2, test: true, hi: "3", userId: 1 },
      ];
      const items = await service.create(itemsArr, {
        //@ts-ignore
        ability: defineAbility((can) => {
          can("create", "tests", { userId: 1 });
        }, { resolveAction }),
      });

      assert(items.length === 0, "array is empty");
    });

    it("can create multiple items and returns all items", async function () {
      const readMethods = ["read", "find"];
      for (const read of readMethods) {
        await service.remove(null);
        const allItems = (await service.find({ paginate: false })) as unknown[];
        assert(allItems.length === 0, `has no items before for read: '${read}'`);
        const itemsArr = [
          { test: true, hi: "1", userId: 1 },
          { test: true, hi: "2", userId: 1 },
          { test: true, hi: "3", userId: 1 },
        ];
        const items = await service.create(itemsArr, {
          //@ts-ignore
          ability: defineAbility((can) => {
            can("create", "tests", { userId: 1 });
            can(read, "tests");
          }, { resolveAction }),
        });

        const expectedItems = (await service.find({ paginate: false })) as Record<string, unknown>[];
  
        assert.deepStrictEqual(items, expectedItems, `created items for read: '${read}'`);
      }
    });

    it("rejects if one item can't be created", async function () {
      const itemsArr = [
        { id: 0, test: true, hi: "1", userId: 1 },
        { id: 1, test: true, hi: "2", userId: 2 },
        { id: 2, test: true, hi: "3", userId: 1 },
      ];
      const promise = service.create(itemsArr, {
        //@ts-ignore
        ability: defineAbility((can) => {
          can("create", "tests", { userId: 1 });
        }, { resolveAction }),
      });

      await assert.rejects(
        promise,
        (err) => err.name === "Forbidden",
        "rejects because different userId"
      );
    });

    it("picks properties for fields for multiple created data", async function () {
      const itemsArr = [
        { id: 0, test: true, hi: "1", userId: 1 },
        { id: 1, test: true, hi: "2", userId: 2 },
        { id: 2, test: true, hi: "3", userId: 1 },
      ];
      const items = await service.create(itemsArr, {
        //@ts-ignore
        ability: defineAbility((can) => {
          can("create", "tests"),
          can("read", "tests"),
          can("read", "tests", ["id"], { userId: 2 }),
          can("read", "tests", ["id", "userId"], { hi: "3" });
        }, { resolveAction }),
      });

      const expected = [
        { id: 0, test: true, hi: "1", userId: 1 },
        { id: 1 },
        { id: 2, userId: 1 },
      ];

      assert.deepStrictEqual(items, expected, "filtered properties");
    });
  });

  describe("beforeAndAfter - update", function () {
    it("can update one item and returns 'undefined' for not allowed read", async function () {
      const item = await service.create({ test: true, userId: 1 });

      const updatedItem = await service.update(item.id, { test: false, userId: 1 }, {
        //@ts-ignore
        ability: defineAbility(can => {
          can("update", "tests");
        }, { resolveAction })
      });

      assert.deepStrictEqual(updatedItem, undefined, "updated item is undefined");

      const realItem = await service.get(item.id);
      assert.deepStrictEqual(
        realItem,
        { id: item.id, test: false, userId: 1 },
        "updated item correctly"
      );
    });

    it("can update one item and returns complete item", async function () {
      const item = await service.create({ test: true, userId: 1 });

      const readMethod = ["read", "get"];

      for (const read of readMethod) {
        const updatedItem = await service.update(item.id, { test: false, userId: 1 }, {
          //@ts-ignore
          ability: defineAbility(can => {
            can("update", "tests");
            can(read, "tests");
          }, { resolveAction })
        });
  
        assert.deepStrictEqual(updatedItem, { id: item.id, test: false, userId: 1 }, `updated item correctly for read: '${read}'`);
      }
    });

    it("tests against original data, not updated data", async function () {
      const item = await service.create({ test: true, userId: 2 });

      const promise = service.update(item.id, { test: false, userId: 1 }, {
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

      const promise = service.update(item.id, { test: false, userId: 1 }, {
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

      const updatedItem = await service.update(item.id, { test: false, userId: 2 }, {
        //@ts-ignore
        ability: defineAbility((can) => {
          can("update", "tests", ["test"], { userId: 1 });
          can("read", "tests");
        }, { resolveAction })
      });

      const realItem = await service.get(item.id);
      const expected = { id: item.id, test: false, userId: 1 };

      assert.deepStrictEqual(realItem, expected, "updated item correctly");
      assert.deepStrictEqual(updatedItem, realItem, "result of update is real item");
    });

    it("throws if cannot update item", async function () {
      const item = await service.create({ test: true, userId: 1 });

      const promise = service.update(item.id, { test: false, userId: 2 }, {
        //@ts-ignore
        ability: defineAbility((can, cannot) => {
          can("update", "tests");
          cannot("update", "tests", { userId: 1 });
        }, { resolveAction })
      });

      assert.rejects(promise, err => err.name === "Forbidden", "cannot update item");
    });

    it("updates item and returns empty object for not overlapping '$select' and 'restricting fields'", async function() {
      const item = { id: 0, test: true, userId: 1, supersecret: true, hidden: true };
      const updatedItem = { id: 0, test: false, userId: 1, supersecret: true, hidden: true };
      await service.create(item);
      const result = await service.update(item.id, updatedItem, {
        query: { $select: ["id", "supersecret", "hidden"] },
        //@ts-ignore
        ability: defineAbility((can) => {
          can("read", "tests", ["test", "userId"]);
          can(["create", "update"], "tests");
        }, { resolveAction }),
      });
      assert.deepStrictEqual(result, {}, "returned item is empty because of $select and restricting fields");
      const itemInDb = await service.get(item.id);
      assert.deepStrictEqual(itemInDb, updatedItem, "item in db is complete");
    });
  });

  describe("beforeAndAfter - patch:single", function () {
    it("can patch one item and returns 'undefined' for not allowed read", async function () {
      const item = await service.create({ test: true, userId: 1 });

      const patchedItem = await service.patch(item.id, { test: false }, {
        //@ts-ignore
        ability: defineAbility(can => {
          can("patch", "tests");
        }, { resolveAction })
      });

      assert.deepStrictEqual(patchedItem, undefined, "patched item is undefined");

      const realItem = await service.get(item.id);
      assert.deepStrictEqual(
        realItem,
        { id: item.id, test: false, userId: 1 },
        "patched item correctly"
      );
    });

    it("can patch one item and returns complete item", async function () {
      const readMethod = ["read", "get"];

      for (const read of readMethod) {
        await service.remove(null);
        const item = await service.create({ test: true, userId: 1 });
        const patchedItem = await service.patch(item.id, { test: false }, {
          //@ts-ignore
          ability: defineAbility(can => {
            can("patch", "tests");
            can(read, "tests");
          }, { resolveAction })
        });
  
        assert.deepStrictEqual(patchedItem, { id: item.id, test: false, userId: 1 }, `patched item correctly for read: '${read}'`);
      }
    });

    it("throws if patch with restricted fields leads to empty patch", async function () {
      const item = await service.create({ test: true, userId: 1 });

      const promise = service.patch(item.id, { test: false }, {
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

      const patchedItem = await service.patch(item.id, { test: false, userId: 2 }, {
        //@ts-ignore
        ability: defineAbility((can) => {
          can("patch", "tests", ["test"], { userId: 1 });
          can("read", "tests");
        }, { resolveAction })
      });

      const realItem = await service.get(item.id);
      const expected = { id: item.id, test: false, userId: 1 };

      assert.deepStrictEqual(realItem, expected, "patched item correctly");
      assert.deepStrictEqual(patchedItem, realItem, "result of patch is real item");
    });

    it("throws if cannot patch item", async function () {
      const item = await service.create({ test: true, userId: 1 });

      const promise = service.patch(item.id, { test: false }, {
        //@ts-ignore
        ability: defineAbility((can, cannot) => {
          can("patch", "tests");
          cannot("patch", "tests", { userId: 1 });
        }, { resolveAction })
      });

      assert.rejects(promise, err => err.name === "Forbidden", "cannot patch item");
    });

    it("patches item and returns empty object for not overlapping '$select' and 'restricting fields'", async function() {
      const item = { id: 0, test: true, userId: 1, supersecret: true, hidden: true };
      const updatedItem = { id: 0, test: false, userId: 1, supersecret: true, hidden: true };
      await service.create(item);
      const result = await service.patch(item.id, { test: false }, {
        query: { $select: ["id", "supersecret", "hidden"] },
        //@ts-ignore
        ability: defineAbility((can) => {
          can("read", "tests", ["test", "userId"]);
          can(["create", "update"], "tests");
        }, { resolveAction }),
      });
      assert.deepStrictEqual(result, {}, "returned item is empty because of $select and restricting fields");
      const itemInDb = await service.get(item.id);
      assert.deepStrictEqual(itemInDb, updatedItem, "item in db is complete");
    });
  });

  describe("beforeAndAfter - patch:multiple", function () {
    it("patch:multi can patch multiple items and returns [] for not allowed read", async function () {
      await service.create({ test: true, userId: 1 });
      await service.create({ test: true, userId: 1 });
      await service.create({ test: true, userId: 2 });

      const patchedItems = await service.patch(null, { test: false }, {
        //@ts-ignore
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
        { id: 0, test: false, userId: 1 },
        { id: 1, test: false, userId: 1 },
        { id: 2, test: true, userId: 2 }
      ];
      assert.deepStrictEqual(
        realItems,
        expected,
        "patched items correctly"
      );
    });

    it("patch:multi can patch multiple items and returns result", async function () {
      const readMethods = ["read", "find"];

      for (const read of readMethods) {
        await service.remove(null, {});
        const item1 = await service.create({ test: true, userId: 1 });
        const item2 = await service.create({ test: true, userId: 1 });
        const item3 = await service.create({ test: true, userId: 2 });
  
        const patchedItems = await service.patch(null, { test: false }, {
          //@ts-ignore
          ability: defineAbility(can => {
            can("patch", "tests");
            can(read, "tests");
          }, { resolveAction }),
          query: {
            userId: 1
          }
        });
  
        const expectedResult = [
          { id: item1.id, test: false, userId: 1 },
          { id: item2.id, test: false, userId: 1 }
        ];
  
        assert.deepStrictEqual(patchedItems, expectedResult, `result is right array for read: '${read}'`);
  
        const realItems = await service.find({ paginate: false });
        const expected = [
          { id: item1.id, test: false, userId: 1 },
          { id: item2.id, test: false, userId: 1 },
          { id: item3.id, test: true, userId: 2 }
        ];
        assert.deepStrictEqual(
          realItems,
          expected,
          "patched items correctly"
        );
      }
    });

    it("patch:multi assigns original data with patched data for restricted fields", async function () {
      await service.remove(null);
      const item1 = await service.create({ test: true, userId: 1 });
      const item2 = await service.create({ test: "yes", userId: 5 });

      const patchedItems = await service.patch(null, { test: false, userId: 2 }, {
        //@ts-ignore
        ability: defineAbility((can) => {
          can("patch", "tests", ["test"], { userId: 1 });
          can("read", "tests");
        }, { resolveAction })
      });

      const realItems = await service.find({ paginate: false });
      const expected = [
        { id: item1.id, test: false, userId: 1 },
        item2
      ];

      assert.deepStrictEqual(realItems, expected, "patched item correctly");
      assert.deepStrictEqual(patchedItems, [realItems[0]], "result of patch is real item");
    });

    it("patch:multi patches only allowed items", async function () {
      await service.create({ test: true, userId: 1 });
      await service.create({ test: true, userId: 1 });
      await service.create({ test: true, userId: 2 });

      const patchedItems = await service.patch(null, { test: false }, {
        //@ts-ignore
        ability: defineAbility(can => {
          can("patch", "tests", { userId: 1 });
          can("read", "tests");
        }, { resolveAction }),
        query: {}
      });

      const expectedResult = [
        { id: 0, test: false, userId: 1 },
        { id: 1, test: false, userId: 1 }
      ];

      assert.deepStrictEqual(patchedItems, expectedResult, "result is right array");

      const realItems = await service.find({ paginate: false });
      const expected = [
        { id: 0, test: false, userId: 1 },
        { id: 1, test: false, userId: 1 },
        { id: 2, test: true, userId: 2 }
      ];
      assert.deepStrictEqual(
        realItems,
        expected,
        "patched items correctly"
      );
    });

    it("patch:multi patches allowed items and returns subset for read", async function () {
      const items = [
        { id: 0, published: false, test: true, userId: 1 },
        { id: 1, published: true, test: true, userId: 1 },
        { id: 2, published: true, test: true, userId: 2 },
        { id: 3, published: true, test: true, userId: 2 },
        { id: 4, published: false, test: true, userId: 2 }
      ];
      await service.create(items);

      const patchedItems = await service.patch(null, { test: false }, {
        //@ts-ignore
        ability: defineAbility(can => {
          can("patch", "tests", { userId: 1 });
          can("read", "tests", { published: true });
        }, { resolveAction }),
        query: {}
      });

      const expectedResult = [
        { id: 1, published: true, test: false, userId: 1 }
      ];

      assert.deepStrictEqual(patchedItems, expectedResult, "result is right array");

      const realItems = await service.find({ paginate: false });
      const expected = [
        { id: 0, published: false, test: false, userId: 1 },
        { id: 1, published: true, test: false, userId: 1 },
        { id: 2, published: true, test: true, userId: 2 },
        { id: 3, published: true, test: true, userId: 2 },
        { id: 4, published: false, test: true, userId: 2 }
      ];
      assert.deepStrictEqual(
        realItems,
        expected,
        "patched items correctly"
      );
    });

    it("patch:multi patches allowed items and returns subset for read", async function () {
      const items = [
        { id: 0, published: false, test: true, userId: 1 },
        { id: 1, published: true, test: true, userId: 1 },
        { id: 2, published: true, test: true, userId: 2 },
        { id: 3, published: true, test: true, userId: 2 },
        { id: 4, published: false, test: true, userId: 2 }
      ];
      await service.create(items);

      const patchedItems = await service.patch(null, { test: false }, {
        //@ts-ignore
        ability: defineAbility(can => {
          can("patch", "tests", { userId: 1 });
          can("read", "tests", ["id"], { published: false });
          can("read", "tests", { published: true });
        }, { resolveAction }),
        query: {}
      });

      const expectedResult = [
        { id: 0 },
        { id: 1, published: true, test: false, userId: 1 }
      ];

      assert.deepStrictEqual(patchedItems, expectedResult, "result is right array");

      const realItems = await service.find({ paginate: false });
      const expected = [
        { id: 0, published: false, test: false, userId: 1 },
        { id: 1, published: true, test: false, userId: 1 },
        { id: 2, published: true, test: true, userId: 2 },
        { id: 3, published: true, test: true, userId: 2 },
        { id: 4, published: false, test: true, userId: 2 }
      ];
      assert.deepStrictEqual(
        realItems,
        expected,
        "patched items correctly"
      );
    });
  });

  describe("beforeAndAfter - remove:single", function () {
    it("can remove one item and return 'undefined' for not allowed read", async function () {
      const item = await service.create({ test: true, userId: 1 });

      const updatedItem = await service.remove(item.id, {
        //@ts-ignore
        ability: defineAbility(can => {
          can("remove", "tests");
        }, { resolveAction })
      });

      assert.deepStrictEqual(updatedItem, undefined, "removed item is undefined");

      const realItems = await service.find({ paginate: false }) as unknown[];
      assert(realItems.length === 0, "no existent items");
    });

    it("can remove one item and returns complete item", async function () {
      const readMethods = ["read", "get"];

      for (const read of readMethods) {
        await service.remove(null);
        const item = await service.create({ test: true, userId: 1 });
        const removedItem = await service.remove(item.id, {
          //@ts-ignore
          ability: defineAbility(can => {
            can("remove", "tests");
            can(read, "tests");
          }, { resolveAction })
        });
  
        assert.deepStrictEqual(removedItem, { id: item.id, test: true, userId: 1 }, `removed item correctly for read: '${read}'`);
  
        const realItems = await service.find({ paginate: false }) as unknown[];
        assert(realItems.length === 0, "no existent items");
      }
    });

    it("throws if cannot remove item", async function () {
      const item = await service.create({ test: true, userId: 1 });

      const promise = service.remove(item.id, {
        //@ts-ignore
        ability: defineAbility((can, cannot) => {
          can("remove", "tests");
          cannot("remove", "tests", { userId: 1 });
        }, { resolveAction })
      });

      assert.rejects(promise, err => err.name === "Forbidden", "cannot remove item");
    });

    it("removes item and returns empty object for not overlapping '$select' and 'restricting fields'", async function() {
      const item = { id: 0, test: true, userId: 1, supersecret: true, hidden: true };
      await service.create(item);
      const result = await service.remove(item.id, {
        query: { $select: ["id", "supersecret", "hidden"] },
        //@ts-ignore
        ability: defineAbility((can) => {
          can("read", "tests", ["test", "userId"]);
          can(["create", "remove"], "tests");
        }, { resolveAction }),
      });
      assert.deepStrictEqual(result, {}, "returned item is empty because of $select and restricting fields");
      await assert.rejects(
        service.get(item.id),
        err => err.name === "NotFound",
        "item was deleted"
      );
    });
  });

  describe("beforeAndAfter - remove:multiple", function () {
    it("can remove multiple items and returns [] for not allowed read", async function () {
      await service.create({ test: true, userId: 1 });
      await service.create({ test: true, userId: 1 });
      await service.create({ test: true, userId: 2 });

      const removedItems = await service.remove(null, {
        //@ts-ignore
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
        { id: 2, test: true, userId: 2 }
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
        await service.remove(null);
        const item1 = await service.create({ test: true, userId: 1 });
        const item2 = await service.create({ test: true, userId: 1 });
        const item3 = await service.create({ test: true, userId: 2 });
      
        const removedItems = await service.remove(null, {
          //@ts-ignore
          ability: defineAbility(can => {
            can("remove", "tests");
            can(read, "tests");
          }, { resolveAction }),
          query: {
            userId: 1
          }
        });
  
        const expectedResult = [
          { id: item1.id, test: true, userId: 1 },
          { id: item2.id, test: true, userId: 1 }
        ];
  
        assert.deepStrictEqual(removedItems, expectedResult, `result is right array for read: '${read}'`);
  
        const realItems = await service.find({ paginate: false });
        const expected = [
          { id: item3.id, test: true, userId: 2 }
        ];
        assert.deepStrictEqual(
          realItems,
          expected,
          `removed items correctly for read: '${read}'`
        );
      }
    });

    it("removes only allowed items", async function () {
      await service.create({ test: true, userId: 1 });
      await service.create({ test: true, userId: 1 });
      await service.create({ test: true, userId: 2 });

      const removedItems = await service.remove(null, {
        //@ts-ignore
        ability: defineAbility(can => {
          can("remove", "tests", { userId: 1 });
          can("read", "tests");
        }, { resolveAction }),
        query: {}
      });

      const expectedResult = [
        { id: 0, test: true, userId: 1 },
        { id: 1, test: true, userId: 1 }
      ];

      assert.deepStrictEqual(removedItems, expectedResult, "result is right array");

      const realItems = await service.find({ paginate: false });
      const expected = [
        { id: 2, test: true, userId: 2 }
      ];
      assert.deepStrictEqual(
        realItems,
        expected,
        "removed items correctly"
      );
    });

    it("removes allowed items and returns subset for read", async function () {
      const items = [
        { id: 0, published: false, test: true, userId: 1 },
        { id: 1, published: true, test: true, userId: 1 },
        { id: 2, published: true, test: true, userId: 2 },
        { id: 3, published: true, test: true, userId: 2 },
        { id: 4, published: false, test: true, userId: 2 }
      ];
      await service.create(items);

      const removedItems = await service.remove(null, {
        //@ts-ignore
        ability: defineAbility(can => {
          can("remove", "tests", { userId: 1 });
          can("read", "tests", { published: true });
        }, { resolveAction }),
        query: {}
      });

      const expectedResult = [
        { id: 1, published: true, test: true, userId: 1 }
      ];

      assert.deepStrictEqual(removedItems, expectedResult, "result is right array");

      const realItems = await service.find({ paginate: false });
      const expected = [
        { id: 2, published: true, test: true, userId: 2 },
        { id: 3, published: true, test: true, userId: 2 },
        { id: 4, published: false, test: true, userId: 2 }
      ];
      assert.deepStrictEqual(
        realItems,
        expected,
        "removed items correctly"
      );
    });

    it("removes allowed items and returns subset for read", async function () {
      const items = [
        { id: 0, published: false, test: true, userId: 1 },
        { id: 1, published: true, test: true, userId: 1 },
        { id: 2, published: true, test: true, userId: 2 },
        { id: 3, published: true, test: true, userId: 2 },
        { id: 4, published: false, test: true, userId: 2 }
      ];
      await service.create(items);

      const removedItems = await service.remove(null, {
        //@ts-ignore
        ability: defineAbility(can => {
          can("remove", "tests", { userId: 1 });
          can("read", "tests", ["id"], { published: false });
          can("read", "tests", { published: true });
        }, { resolveAction })
      });

      const expectedResult = [
        { id: 0 },
        { id: 1, published: true, test: true, userId: 1 }
      ];

      assert.deepStrictEqual(removedItems, expectedResult, "result is right array");

      const realItems = await service.find({ paginate: false });
      const expected = [
        { id: 2, published: true, test: true, userId: 2 },
        { id: 3, published: true, test: true, userId: 2 },
        { id: 4, published: false, test: true, userId: 2 }
      ];
      assert.deepStrictEqual(
        realItems,
        expected,
        "removed items correctly"
      );
    });
  });
});
