import assert from "node:assert";
import { feathers } from "@feathersjs/feathers";
import { createAliasResolver, defineAbility } from "@casl/ability";

import type { Application } from "@feathersjs/feathers";

import { authorize } from "../../../../../lib";
import type { Adapter, AuthorizeHookOptions } from "../../../../../lib";
import { resolveAction } from "../../../../test-utils";

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

  describe(`${adapterName}: beforeAndAfter - remove:single`, function () {
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

    it("can remove one item and return 'undefined' for not allowed read", async function () {
      const item = await service.create({ test: true, userId: 1 });

      const updatedItem = await service.remove(item[id], {
        ability: defineAbility(
          (can) => {
            can("remove", "tests");
          },
          { resolveAction }
        ),
      });

      assert.deepStrictEqual(
        updatedItem,
        undefined,
        "removed item is undefined"
      );

      const realItems = (await service.find({ paginate: false })) as unknown[];
      assert.strictEqual(realItems.length, 0, "no existent items");
    });

    it("can remove one item and returns complete item", async function () {
      const readMethods = ["read", "get"];

      for (const read of readMethods) {
        await clean(app, service);
        const item = await service.create({ test: true, userId: 1 });
        const removedItem = await service.remove(item[id], {
          ability: defineAbility(
            (can) => {
              can("remove", "tests");
              can(read, "tests");
            },
            { resolveAction }
          ),
        });

        assert.deepStrictEqual(
          removedItem,
          { [id]: item[id], test: true, userId: 1 },
          `removed item correctly for read: '${read}'`
        );

        const realItems = (await service.find({
          paginate: false,
        })) as unknown[];
        assert.strictEqual(realItems.length, 0, "no existent items");
      }
    });

    it("throws if cannot remove item", async function () {
      const item = await service.create({ test: true, userId: 1 });

      const promise = service.remove(item[id], {
        ability: defineAbility(
          (can, cannot) => {
            can("remove", "tests");
            cannot("remove", "tests", { userId: 1 });
          },
          { resolveAction }
        ),
      });

      await assert.rejects(
        promise,
        (err: Error) => err.name === "NotFound",
        "cannot remove item"
      );
    });

    it("removes item and returns empty object for not overlapping '$select' and 'restricting fields'", async function () {
      let item = { test: true, userId: 1, supersecret: true, hidden: true };
      item = await service.create(item);

      const result = await service.remove(item[id], {
        query: { $select: [id, "supersecret", "hidden"] },
        ability: defineAbility(
          (can) => {
            can("read", "tests", ["test", "userId"]);
            can(["create", "remove"], "tests");
          },
          { resolveAction }
        ),
      });
      assert.deepStrictEqual(
        result,
        {},
        "returned item is empty because of $select and restricting fields"
      );
      await assert.rejects(
        service.get(item[id]),
        (err: Error) => err.name === "NotFound",
        "item was deleted"
      );
    });
  });
};
