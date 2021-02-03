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

describe("authorize-hook - complete", function () {
  let app: Application;
  let service: Service;

  beforeEach(function () {
    app = feathers();
    app.use(
      "tests",
      new Service({
        multi: true,
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
        all: [authorize()],
      },
      after: {
        all: [authorize()],
      },
    });
  });

  describe("beforeAndAfter - get", function () {
    it("returns full item", async function () {
      const item = await service.create({ test: true, userId: 1 });
      assert(item.id !== undefined, "item has id");
      const returnedItem = await service.get(item.id, {
        //@ts-ignore
        ability: defineAbility({ resolveAction }, (can) => {
          can("read", "tests", { userId: 1 });
        }),
      });
      assert.deepStrictEqual(
        returnedItem,
        item,
        "'create' and 'get' item are the same"
      );
    });

    it("returns subset of fields", async function () {
      const item = await service.create({ test: true, userId: 1 });
      assert(item.id !== undefined, "item has id");
      const returnedItem = await service.get(item.id, {
        //@ts-ignore
        ability: defineAbility({ resolveAction }, (can) => {
          can("get", "tests", ["id"], { userId: 1 });
        }),
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
        ability: defineAbility({ resolveAction }, (can) => {
          can("read", "tests", { userId: 2 });
        }),
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
        ability: defineAbility({ resolveAction }, (can, cannot) => {
          cannot("read", "tests", { userId: 1 });
        }),
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
        ability: defineAbility({ resolveAction }, (can) => {
          can("read", "tests", ["test", "userId"]);
        }),
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
      await service.create({ test: true, userId: 1 });
      await service.create({ test: true, userId: 2 });
      await service.create({ test: true, userId: 3 });
      const items = (await service.find({ paginate: false })) as unknown[];
      assert(items.length === 3, "has three items");

      const returnedItems = await service.find({
        //@ts-ignore
        ability: defineAbility({ resolveAction }, (can) => {
          can("read", "tests");
        }),
        paginate: false,
      });

      assert.deepStrictEqual(returnedItems, items, "items are the same");
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
        ability: defineAbility({ resolveAction }, (can) => {
          can("read", "tests", { userId: 1 });
        })
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
        ability: defineAbility({ resolveAction }, (can) => {
          can("read", "tests", { userId: 1 }),
          can("read", "tests", ["id"], { userId: 2 });
        }),
        paginate: false,
      });

      assert.deepStrictEqual(
        returnedItems,
        //@ts-ignore
        [{ id: items[0].id, test: true, userId: 1 }, { id: items[1].id }],
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
        ability: defineAbility({ resolveAction }, (can, cannot) => {
          can("read", "tests");
          cannot("read", "tests", { userId: 3 });
        })
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
        ability: defineAbility({ resolveAction }, (can) => {
          can("read", "tests", { userId: 1 });
        }),
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
        ability: defineAbility({ resolveAction }, (can) => {
          can("read", "tests", { userId: 1 });
        }),
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
        ability: defineAbility({ resolveAction }, (can) => {
          can("read", "tests", { userId: 1 });
        }),
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
        // eslint-disable-next-line @typescript-eslint/no-empty-function
        ability: defineAbility({ resolveAction }, () => {}),
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
        ability: defineAbility({ resolveAction }, (can, cannot) => {
          cannot("read", "tests");
        }),
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
          ability: defineAbility({ resolveAction }, (can) => {
            can("create", "tests", { userId: 1 });
          }),
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
          ability: defineAbility({ resolveAction }, (can) => {
            can("create", "tests", { userId: 1 }), can("read", "tests");
          }),
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
          ability: defineAbility({ resolveAction }, (can) => {
            can("create", "tests", { userId: 2 });
          }),
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
          ability: defineAbility({ resolveAction }, (can) => {
            can("create", "tests", { userId: 1 }),
            can("read", "tests", ["id"], { userId: 1 });
          }),
        }
      );

      assert.deepStrictEqual(item, { id: item.id }, "just returns with id");
    });

    it("throws if cannot create item", async function () {
      const promise = service.create({ test: true, userId: 2 }, {
        //@ts-ignore
        ability: defineAbility({ resolveAction }, (can, cannot) => {
          can("create", "tests");
          cannot("create", "tests", { userId: 1 });
        })
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
          ability: defineAbility({ resolveAction }, (can) => {
            can("read", "tests", ["test", "userId"]);
            can("create", "tests");
          }),
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
        ability: defineAbility({ resolveAction }, (can) => {
          can("create", "tests", { userId: 1 });
        }),
      });

      assert(items.length === 0, "array is empty");
    });

    it("can create multiple items and returns all items", async function () {
      const allItems = (await service.find({ paginate: false })) as unknown[];
      assert(allItems.length === 0, "has no items before");
      const itemsArr = [
        { id: 0, test: true, hi: "1", userId: 1 },
        { id: 1, test: true, hi: "2", userId: 1 },
        { id: 2, test: true, hi: "3", userId: 1 },
      ];
      const items = await service.create(itemsArr, {
        //@ts-ignore
        ability: defineAbility({ resolveAction }, (can) => {
          can("create", "tests", { userId: 1 }), can("read", "tests");
        }),
      });

      assert.deepStrictEqual(items, itemsArr, "created items");
    });

    it("rejects if one item can't be created", async function () {
      const itemsArr = [
        { id: 0, test: true, hi: "1", userId: 1 },
        { id: 1, test: true, hi: "2", userId: 2 },
        { id: 2, test: true, hi: "3", userId: 1 },
      ];
      const promise = service.create(itemsArr, {
        //@ts-ignore
        ability: defineAbility({ resolveAction }, (can) => {
          can("create", "tests", { userId: 1 });
        }),
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
        ability: defineAbility({ resolveAction }, (can) => {
          can("create", "tests"),
          can("read", "tests"),
          can("read", "tests", ["id"], { userId: 2 }),
          can("read", "tests", ["id", "userId"], { hi: "3" });
        }),
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
        ability: defineAbility({ resolveAction }, can => {
          can("update", "tests");
        })
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

      const updatedItem = await service.update(item.id, { test: false, userId: 1 }, {
        //@ts-ignore
        ability: defineAbility({ resolveAction }, can => {
          can("update", "tests");
          can("read", "tests");
        })
      });

      assert.deepStrictEqual(updatedItem, { id: item.id, test: false, userId: 1 }, "updated item correctly");
    });

    it("tests against original data, not updated data", async function () {
      const item = await service.create({ test: true, userId: 2 });

      const promise = service.update(item.id, { test: false, userId: 1 }, {
        //@ts-ignore
        ability: defineAbility({ resolveAction }, (can, cannot) => {
          can("update", "tests");
          cannot("update", "tests", { userId: 1 });
        })
      });

      assert.rejects(promise, err => err.name === "Forbidden", "cannot update item");
    });

    it("throws if update with restricted fields leads to empty update", async function () {
      const item = await service.create({ test: true, userId: 1 });

      const promise = service.update(item.id, { test: false, userId: 1 }, {
        //@ts-ignore
        ability: defineAbility({ resolveAction }, (can, cannot) => {
          can("update", "tests");
          cannot("update", "tests", ["test"]);
        })
      });

      assert.rejects(promise, err => err.name === "Forbidden", "rejects request");
    });

    it("assigns original data with updated data for restricted fields", async function () {
      const item = await service.create({ test: true, userId: 1 });

      const updatedItem = await service.update(item.id, { test: false, userId: 2 }, {
        //@ts-ignore
        ability: defineAbility({ resolveAction }, (can) => {
          can("update", "tests", ["test"], { userId: 1 });
          can("read", "tests");
        })
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
        ability: defineAbility({ resolveAction }, (can, cannot) => {
          can("update", "tests");
          cannot("update", "tests", { userId: 1 });
        })
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
        ability: defineAbility({ resolveAction }, (can) => {
          can("read", "tests", ["test", "userId"]);
          can(["create", "update"], "tests");
        }),
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
        ability: defineAbility({ resolveAction }, can => {
          can("patch", "tests");
        })
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
      const item = await service.create({ test: true, userId: 1 });

      const patchedItem = await service.patch(item.id, { test: false }, {
        //@ts-ignore
        ability: defineAbility({ resolveAction }, can => {
          can("patch", "tests");
          can("read", "tests");
        })
      });

      assert.deepStrictEqual(patchedItem, { id: item.id, test: false, userId: 1 }, "patched item correctly");
    });

    it("throws if patch with restricted fields leads to empty patch", async function () {
      const item = await service.create({ test: true, userId: 1 });

      const promise = service.patch(item.id, { test: false }, {
        //@ts-ignore
        ability: defineAbility({ resolveAction }, (can, cannot) => {
          can("patch", "tests");
          cannot("patch", "tests", ["test"]);
        })
      });

      assert.rejects(promise, err => err.name === "Forbidden", "rejects request");
    });

    it("assigns original data with patched data for restricted fields", async function () {
      const item = await service.create({ test: true, userId: 1 });

      const patchedItem = await service.patch(item.id, { test: false, userId: 2 }, {
        //@ts-ignore
        ability: defineAbility({ resolveAction }, (can) => {
          can("patch", "tests", ["test"], { userId: 1 });
          can("read", "tests");
        })
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
        ability: defineAbility({ resolveAction }, (can, cannot) => {
          can("patch", "tests");
          cannot("patch", "tests", { userId: 1 });
        })
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
        ability: defineAbility({ resolveAction }, (can) => {
          can("read", "tests", ["test", "userId"]);
          can(["create", "update"], "tests");
        }),
      });
      assert.deepStrictEqual(result, {}, "returned item is empty because of $select and restricting fields");
      const itemInDb = await service.get(item.id);
      assert.deepStrictEqual(itemInDb, updatedItem, "item in db is complete");
    });
  });

  describe("beforeAndAfter - patch:multiple", function () {
    it("can patch multiple items and returns [] for not allowed read", async function () {
      await service.create({ test: true, userId: 1 });
      await service.create({ test: true, userId: 1 });
      await service.create({ test: true, userId: 2 });

      const patchedItems = await service.patch(null, { test: false }, {
        //@ts-ignore
        ability: defineAbility({ resolveAction }, can => {
          can("patch", "tests");
        }),
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

    it("can patch multiple items and returns result", async function () {
      await service.create({ test: true, userId: 1 });
      await service.create({ test: true, userId: 1 });
      await service.create({ test: true, userId: 2 });

      const patchedItems = await service.patch(null, { test: false }, {
        //@ts-ignore
        ability: defineAbility({ resolveAction }, can => {
          can("patch", "tests");
          can("read", "tests");
        }),
        query: {
          userId: 1
        }
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

    it("patches only allowed items", async function () {
      await service.create({ test: true, userId: 1 });
      await service.create({ test: true, userId: 1 });
      await service.create({ test: true, userId: 2 });

      const patchedItems = await service.patch(null, { test: false }, {
        //@ts-ignore
        ability: defineAbility({ resolveAction }, can => {
          can("patch", "tests", { userId: 1 });
          can("read", "tests");
        }),
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

    it("patches allowed items and returns subset for read", async function () {
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
        ability: defineAbility({ resolveAction }, can => {
          can("patch", "tests", { userId: 1 });
          can("read", "tests", { published: true });
        }),
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

    it("patches allowed items and returns subset for read", async function () {
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
        ability: defineAbility({ resolveAction }, can => {
          can("patch", "tests", { userId: 1 });
          can("read", "tests", ["id"], { published: false });
          can("read", "tests", { published: true });
        }),
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
        ability: defineAbility({ resolveAction }, can => {
          can("remove", "tests");
        })
      });

      assert.deepStrictEqual(updatedItem, undefined, "removed item is undefined");

      const realItems = await service.find({ paginate: false }) as unknown[];
      assert(realItems.length === 0, "no existent items");
    });

    it("can remove one item and returns complete item", async function () {
      const item = await service.create({ test: true, userId: 1 });

      const updatedItem = await service.remove(item.id, {
        //@ts-ignore
        ability: defineAbility({ resolveAction }, can => {
          can("remove", "tests");
          can("read", "tests");
        })
      });

      assert.deepStrictEqual(updatedItem, { id: item.id, test: true, userId: 1 }, "updated item correctly");

      const realItems = await service.find({ paginate: false }) as unknown[];
      assert(realItems.length === 0, "no existent items");
    });

    it("throws if cannot remove item", async function () {
      const item = await service.create({ test: true, userId: 1 });

      const promise = service.remove(item.id, {
        //@ts-ignore
        ability: defineAbility({ resolveAction }, (can, cannot) => {
          can("remove", "tests");
          cannot("remove", "tests", { userId: 1 });
        })
      });

      assert.rejects(promise, err => err.name === "Forbidden", "cannot remove item");
    });

    it("removes item and returns empty object for not overlapping '$select' and 'restricting fields'", async function() {
      const item = { id: 0, test: true, userId: 1, supersecret: true, hidden: true };
      await service.create(item);
      const result = await service.remove(item.id, {
        query: { $select: ["id", "supersecret", "hidden"] },
        //@ts-ignore
        ability: defineAbility({ resolveAction }, (can) => {
          can("read", "tests", ["test", "userId"]);
          can(["create", "remove"], "tests");
        }),
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
        ability: defineAbility({ resolveAction }, can => {
          can("remove", "tests");
        }),
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
      await service.create({ test: true, userId: 1 });
      await service.create({ test: true, userId: 1 });
      await service.create({ test: true, userId: 2 });

      const removedItems = await service.remove(null, {
        //@ts-ignore
        ability: defineAbility({ resolveAction }, can => {
          can("remove", "tests");
          can("read", "tests");
        }),
        query: {
          userId: 1
        }
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

    it("removes only allowed items", async function () {
      await service.create({ test: true, userId: 1 });
      await service.create({ test: true, userId: 1 });
      await service.create({ test: true, userId: 2 });

      const removedItems = await service.remove(null, {
        //@ts-ignore
        ability: defineAbility({ resolveAction }, can => {
          can("remove", "tests", { userId: 1 });
          can("read", "tests");
        }),
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
        ability: defineAbility({ resolveAction }, can => {
          can("remove", "tests", { userId: 1 });
          can("read", "tests", { published: true });
        }),
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
        ability: defineAbility({ resolveAction }, can => {
          can("remove", "tests", { userId: 1 });
          can("read", "tests", ["id"], { published: false });
          can("read", "tests", { published: true });
        })
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
