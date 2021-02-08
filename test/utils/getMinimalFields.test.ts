import assert from "assert";

import {
  defineAbility
} from "@casl/ability";
import { subject } from "@casl/ability";

import getMinimalFields from "../../lib/utils/getMinimalFields";

const methods = ["find", "get", "create", "update", "patch", "remove"];

describe("utils - getMinimalFields", function() {
  it("returns full array for manage all", function() {
    const ability = defineAbility((can) => {
      can("manage", "all");
    });
    const availableFields = ["id", "test"];
    methods.forEach(method => {
      const record: Record<string, unknown> =  { id: 1, test: true };
      const fields = getMinimalFields(ability, method, subject("tests", record), { availableFields });
      assert.deepStrictEqual(fields, ["id", "test"], `full array for method '${method}'`);
    });
  });

  it("returns subset of array", function() {
    const ability = defineAbility((can) => {
      can("manage", "all", ["id"]);
    });
    const availableFields = ["id", "test"];
    methods.forEach(method => {
      const record: Record<string, unknown> =  { id: 1, test: true };
      const fields = getMinimalFields(ability, method, subject("tests", record), { availableFields });
      assert.deepStrictEqual(fields, ["id"], `subset of array for method '${method}'`);
    });
  });

  it("returns subset of array with availableFields: undefined", function() {
    const ability = defineAbility((can) => {
      can("manage", "all", ["id"]);
    });
    const availableFields = undefined;
    methods.forEach(method => {
      const record: Record<string, unknown> =  { id: 1, test: true };
      const fields = getMinimalFields(ability, method, subject("tests", record), { availableFields });
      assert.deepStrictEqual(fields, ["id"], `subset of array for method '${method}'`);
    });
  });

  it("returns empty of array with availableFields: []", function() {
    const ability = defineAbility((can) => {
      can("manage", "all", ["id"]);
    });
    const availableFields = [];
    methods.forEach(method => {
      const record: Record<string, unknown> =  { id: 1, test: true };
      const fields = getMinimalFields(ability, method, subject("tests", record), { availableFields });
      assert.deepStrictEqual(fields, [], `subset of array for method '${method}'`);
    });
  });

  it("returns subset of array for more complex rules", function() {
    const ability = defineAbility((can, cannot) => {
      can("manage", "tests", ["id", "name", "email"], { id: { $ne: 1 } });
      can("manage", "tests", { id: 1 });
      cannot("manage", "tests", ["supersecret"]);
    });
    const availableFields = ["id", "name", "email", "supersecret", "password"];
    interface Pair {
      input: Record<string, unknown>,
      expected: string[]
    }
    const pairs: Pair[] = [
      {
        input: { id: 1 },
        expected: ["id", "name", "email", "password"]
      },
      {
        input: {},
        expected: ["id", "name", "email"]
      },
      {
        input: { id: 2 },
        expected: ["id", "name", "email"]
      }
    ];
    pairs.forEach((pair, i) => {
      methods.forEach(method => {
        const fields = getMinimalFields(ability, method, subject("tests", pair.input), { availableFields });
        assert.deepStrictEqual(fields, pair.expected, `result for input '${i}' and method '${method}' is correct`);
      });
    });
  });
});