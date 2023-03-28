import assert from "node:assert";
import { feathers } from "@feathersjs/feathers";
import { createAliasResolver, defineAbility } from "@casl/ability";

import type { Application } from "@feathersjs/feathers";

import { authorize } from "../../../../../src";
import type { Adapter, AuthorizeHookOptions } from "../../../../../src";
import { resolveAction } from "../../../../test-utils";
import type { MakeTestsOptions } from "./_makeTests.types";

export default (
  adapterName: Adapter | string,
  makeService: () => any,
  clean: (app, service) => Promise<void>,
  authorizeHookOptions: Partial<AuthorizeHookOptions>,
  { around, afterHooks }: MakeTestsOptions = { around: false, afterHooks: [] }
): void => {
  let app: Application;
  let service;
  let id;

  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  const itSkip = (adapterToTest: string | string[]) => {
    const condition =
      typeof adapterToTest === "string"
        ? adapterName === adapterToTest
        : adapterToTest.includes(adapterName);
    return condition ? it.skip : it;
  };

  describe(`${adapterName}: beforeAndAfter - get`, function () {
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

      afterHooks = Array.isArray(afterHooks)
        ? afterHooks
        : afterHooks
        ? [afterHooks]
        : [];

      if (around) {
        service.hooks({
          around: {
            all: [authorize(options)],
          },
          after: {
            all: afterHooks,
          },
        });
      } else {
        service.hooks({
          before: {
            all: [authorize(options)],
          },
          after: {
            all: [...afterHooks, authorize(options)],
          },
        });
      }

      await clean(app, service);
    });

    it("returns full item", async function () {
      const readMethods = ["read", "get"];
      for (const read of readMethods) {
        const item = await service.create({ test: true, userId: 1 });
        assert(item[id] !== undefined, `item has id for read: '${read}'`);
        const returnedItem = await service.get(item[id], {
          ability: defineAbility(
            (can) => {
              can(read, "tests", { userId: 1 });
            },
            { resolveAction }
          ),
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
      assert(item[id] !== undefined, "item has id");
      const returnedItem = await service.get(item[id], {
        ability: defineAbility(
          (can) => {
            can("read", "tests", [id], { userId: 1 });
          },
          { resolveAction }
        ),
      });
      assert.deepStrictEqual(
        returnedItem,
        { [id]: item[id] },
        "'get' returns only [id]"
      );
    });

    it("returns restricted subset of fields with $select", async function () {
      const item = await service.create({
        test: true,
        userId: 1,
        published: true,
      });
      assert(item[id] !== undefined, "item has id");
      const returnedItem = await service.get(item[id], {
        ability: defineAbility(
          (can) => {
            can("read", "tests", [id], { userId: 1 });
          },
          { resolveAction }
        ),
        query: {
          $select: [id, "userId"],
        },
      });
      assert.deepStrictEqual(
        returnedItem,
        { [id]: item[id] },
        "'get' returns only [id]"
      );
    });

    // eslint-disable-next-line @typescript-eslint/no-empty-function
    it.skip("returns subset of fields with inverted fields", async function () {});

    it("throws 'NotFound' for not 'can'", async function () {
      const item = await service.create({ test: true, userId: 1 });
      assert(item[id] !== undefined, "item has id");
      const returnedItem = service.get(item[id], {
        ability: defineAbility(
          (can) => {
            can("read", "tests", { userId: 2 });
          },
          { resolveAction }
        ),
      });
      // rejects with 'NotFound' because it's handled by feathers itself
      // the rejection comes not from `feathers-casl` before/after-hook but from the adapter call
      // the requesting user should not have the knowledge, that the item exist at all
      await assert.rejects(
        returnedItem,
        (err: Error) => err.name === "NotFound",
        "rejects for id not allowed"
      );
    });

    it("throws 'NotFound' for explicit 'cannot'", async function () {
      const item = await service.create({ test: true, userId: 1 });
      assert(item[id] !== undefined, "item has id");
      const returnedItem = service.get(item[id], {
        ability: defineAbility(
          (can, cannot) => {
            can("read", "tests");
            cannot("read", "tests", { userId: 1 });
          },
          { resolveAction }
        ),
      });
      // rejects with 'NotFound' because it's handled by feathers itself
      // the rejection comes not from `feathers-casl` before/after-hook but from the adapter call
      // the requesting user should not have the knowledge, that the item exist at all
      await assert.rejects(
        returnedItem,
        (err: Error) => err.name === "NotFound",
        "rejects for id not allowed"
      );
    });

    it("throws if $select and restricted fields don't overlap", async function () {
      const item = await service.create({
        test: true,
        userId: 1,
        supersecret: true,
        hidden: true,
      });
      assert(item[id] !== undefined, "item has id");

      const promise = service.get(item[id], {
        query: { $select: [id, "supersecret", "hidden"] },
        ability: defineAbility(
          (can) => {
            can("read", "tests", ["test", "userId"]);
          },
          { resolveAction }
        ),
      });
      // rejects with 'Forbidden' which is handled by the after-hook
      // the requesting user potentially can get the item, but he cannot get these fields
      // maybe it should not throw, because that is an indication for hackers, that the data exists
      // default behavior with `$select: ['nonExistent']` is: `{[id]: ${id} }`
      await assert.rejects(
        promise,
        (err: Error) => err.name === "Forbidden",
        "rejects for id not allowed"
      );
    });
  });
};
