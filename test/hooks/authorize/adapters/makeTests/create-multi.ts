import assert from "node:assert";
import { feathers } from "@feathersjs/feathers";
import { createAliasResolver, defineAbility } from "@casl/ability";
import _sortBy from "lodash/sortBy.js";

import type { Application } from "@feathersjs/feathers";

import { authorize } from "../../../../../lib";
import type { Adapter, AuthorizeHookOptions } from "../../../../../lib";

const resolveAction = createAliasResolver({
  update: "patch",
  read: ["get", "find"],
  delete: "remove",
});

export default (
  adapterName: Adapter,
  makeService: () => any,
  clean: (app, service) => Promise<void>,
  authorizeHookOptions: Partial<AuthorizeHookOptions>,
  afterHooks?: unknown[]
): void => {
  let app: Application;
  let service;
  let id;

  const itSkip = (adapterToTest: Adapter | Adapter[]) => {
    const condition =
      typeof adapterToTest === "string"
        ? adapterName === adapterToTest
        : adapterToTest.includes(adapterName);
    return condition ? it.skip : it;
  };

  describe(`${adapterName}: beforeAndAfter - create:multi`, function () {
    beforeEach(async function () {
      app = feathers();
      app.use("tests", makeService());
      service = app.service("tests");

      // eslint-disable-next-line prefer-destructuring
      id = service.options.id;

      const options = Object.assign(
        {
          availableFields: [
            id,
            "userId",
            "hi",
            "test",
            "published",
            "supersecret",
            "hidden",
          ],
        },
        authorizeHookOptions
      );
      const allAfterHooks = [];
      if (afterHooks) {
        allAfterHooks.push(...afterHooks);
      }
      allAfterHooks.push(authorize(options));

      service.hooks({
        before: {
          all: [authorize(options)],
        },
        after: {
          all: allAfterHooks,
        },
      });

      await clean(app, service);
    });

    it("can create multiple items and returns empty array", async function () {
      const allItems = (await service.find({ paginate: false })) as unknown[];
      assert.strictEqual(allItems.length, 0, "has no items before");

      const itemsArr = [
        { test: true, hi: "1", userId: 1 },
        { test: true, hi: "2", userId: 1 },
        { test: true, hi: "3", userId: 1 },
      ];
      const items = await service.create(itemsArr, {
        ability: defineAbility(
          (can) => {
            can("create", "tests", { userId: 1 });
          },
          { resolveAction }
        ),
      });

      assert.strictEqual(items.length, 0, "array is empty");
    });

    it("can create multiple items and returns all items", async function () {
      const readMethods = ["read", "find"];
      for (const read of readMethods) {
        await clean(app, service);
        const allItems = (await service.find({ paginate: false })) as unknown[];
        assert.strictEqual(
          allItems.length,
          0,
          `has no items before for read: '${read}'`
        );
        const itemsArr = [
          { test: true, hi: "1", userId: 1 },
          { test: true, hi: "2", userId: 1 },
          { test: true, hi: "3", userId: 1 },
        ];
        const items = await service.create(itemsArr, {
          ability: defineAbility(
            (can) => {
              can("create", "tests", { userId: 1 });
              can(read, "tests");
            },
            { resolveAction }
          ),
        });

        const expectedItems = (await service.find({
          paginate: false,
        })) as Record<string, unknown>[];

        assert.deepStrictEqual(
          _sortBy(items, id),
          _sortBy(expectedItems, id),
          `created items for read: '${read}'`
        );
      }
    });

    it("rejects if one item can't be created", async function () {
      const itemsArr = [
        { test: true, hi: "1", userId: 1 },
        { test: true, hi: "2", userId: 2 },
        { test: true, hi: "3", userId: 1 },
      ];
      const promise = service.create(itemsArr, {
        ability: defineAbility(
          (can) => {
            can("create", "tests", { userId: 1 });
          },
          { resolveAction }
        ),
      });

      await assert.rejects(
        promise,
        (err: Error) => err.name === "Forbidden",
        "rejects because different userId"
      );
    });

    it("picks properties for fields for multiple created data", async function () {
      const itemsArr = [
        { test: true, hi: "1", userId: 1 },
        { test: true, hi: "2", userId: 2 },
        { test: true, hi: "3", userId: 1 },
      ];
      const items = await service.create(itemsArr, {
        ability: defineAbility(
          (can) => {
            can("create", "tests"),
              can("read", "tests"),
              can("read", "tests", [id], { userId: 2 }),
              can("read", "tests", [id, "userId"], { hi: "3" });
          },
          { resolveAction }
        ),
      });

      const expected = [
        { [id]: items[0][id], test: true, hi: "1", userId: 1 },
        { [id]: items[1][id] },
        { [id]: items[2][id], userId: 1 },
      ];

      assert.deepStrictEqual(items, expected, "filtered properties");
    });
  });
};
