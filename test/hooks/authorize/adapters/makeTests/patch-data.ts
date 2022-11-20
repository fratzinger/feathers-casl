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

  describe(`${adapterName}: beforeAndAfter - patch-data`, function () {
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

    it("passes with general 'patch-data' rule", async function () {
      const readMethod = ["read", "get"];

      for (const read of readMethod) {
        await clean(app, service);
        const item = await service.create({ test: true, userId: 1 });
        const result = await service.patch(
          item[id],
          { test: false },
          {
            ability: defineAbility(
              (can) => {
                can("patch", "tests");
                can("patch-data", "tests");
                can(read, "tests");
              },
              { resolveAction }
            ),
          }
        );
        assert.deepStrictEqual(result, {
          [id]: item[id],
          test: false,
          userId: 1,
        });
      }
    });

    it("fails with no 'patch-data' rule", async function () {
      const readMethod = ["read", "get"];

      for (const read of readMethod) {
        await clean(app, service);
        const item = await service.create({ test: true, userId: 1 });
        let rejected = false;
        try {
          await service.patch(
            item[id],
            { test: false },
            {
              ability: defineAbility(
                (can) => {
                  can("patch", "tests");
                  can(read, "tests");
                },
                { resolveAction }
              ),
            }
          );
        } catch (err) {
          rejected = true;
        }
        assert.ok(rejected, "rejected");
      }
    });

    it("basic cannot 'patch-data'", async function () {
      const readMethod = ["read", "get"];

      for (const read of readMethod) {
        await clean(app, service);
        const item = await service.create({ test: true, userId: 1 });
        let rejected = false;
        try {
          await service.patch(
            item[id],
            { test: false },
            {
              ability: defineAbility(
                (can, cannot) => {
                  can("patch", "tests");
                  can("patch-data", "tests");
                  cannot("patch-data", "tests", { test: false });
                  can(read, "tests");
                },
                { resolveAction }
              ),
            }
          );
        } catch (err) {
          rejected = true;
        }
        assert.ok(rejected, "rejected");
      }
    });

    it("basic can 'patch-data' with fail", async function () {
      const readMethod = ["read", "get"];

      for (const read of readMethod) {
        await clean(app, service);
        const item = await service.create({ test: true, userId: 1 });
        try {
          await service.patch(
            item[id],
            { test: false },
            {
              ability: defineAbility(
                (can) => {
                  can("patch", "tests");
                  can("patch-data", "tests");
                  can("patch-data", "tests", { test: true });
                  can(read, "tests");
                },
                { resolveAction }
              ),
            }
          );
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
        const patchedItem = await service.patch(
          item[id],
          { test: false },
          {
            ability: defineAbility(
              (can) => {
                can("patch", "tests");
                can("patch-data", "tests");
                can("patch-data", "tests", { test: false });
                can(read, "tests");
              },
              { resolveAction }
            ),
          }
        );

        assert.deepStrictEqual(
          patchedItem,
          { [id]: item[id], test: false, userId: 1 },
          `patched item correctly for read: '${read}'`
        );
      }
    });
  });
};
