import { defineAbility } from "@casl/ability";
import { HookContext } from "@feathersjs/feathers";
import assert from "assert";
import { handleConditionalSelect } from "../../../lib/hooks/authorize/authorize.hook.utils";

describe("authorize.utils.test", function() {
  describe("handleConditionSelect", function() {
    it("adds conditional fields to $select", function() {
      const methods = ["find", "get", "create", "update", "patch", "remove"];
      const servicePath = "tests";
      methods.forEach(method => {
        const context = {
          params: {
            query: {
              $select: ["id"]
            }
          }
        } as unknown as HookContext;

        const ability = defineAbility((can) => {
          can(method, servicePath, { id: 2, userId: 1 });
        });

        const result = handleConditionalSelect(context, ability, method, servicePath);
        assert.ok(result === true, `'${method}': handled result`);
        assert.deepStrictEqual(context.params.query.$select, ["id", "userId"], `'${method}': merged select`);
      });
    });

    it("does not change with no $select but conditionalSelect", function() {
      const methods = ["find", "get", "create", "update", "patch", "remove"];
      const servicePath = "tests";
      methods.forEach(method => {
        const context = {
          params: {}
        } as unknown as HookContext;

        const ability = defineAbility((can) => {
          can(method, servicePath, { id: 2, userId: 1 });
        });

        const result = handleConditionalSelect(context, ability, method, servicePath);
        assert.ok(result === false, `'${method}': skipped`);
        assert.ok(!context.params?.query?.$select, `'${method}': has no $select`);
      });
    });

    it("does not change with with $select and no conditionalSelect", function() {
      const methods = ["find", "get", "create", "update", "patch", "remove"];
      const servicePath = "tests";
      methods.forEach(method => {
        const context = {
          params: {
            query: { $select: ["id"] }
          }
        } as unknown as HookContext;

        const ability = defineAbility((can) => {
          can(method, servicePath);
        });

        const result = handleConditionalSelect(context, ability, method, servicePath);
        assert.ok(result === false, `'${method}': skipped`);
        assert.deepStrictEqual(context.params.query.$select, ["id"], `'${method}': $select did not change`);
      });
    });
  });
});