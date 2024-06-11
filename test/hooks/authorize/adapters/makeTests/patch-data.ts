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
                  cannot("patch", "tests", { test: false });
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

    it("basic can 'patch' with fail", async function () {
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
                  can("patch", "tests", { test: true });
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

    it("basic can 'patch'", async function () {
      const readMethod = ["read", "get"];

      for (const read of readMethod) {
        await clean(app, service);
        const item = await service.create({ test: true, userId: 1 });
        const patchedItem = await service.patch(
          item[id],
          { test: false, userId: 1 },
          {
            ability: defineAbility(
              (can) => {
                can("patch", "tests", { userId: 1 });
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
