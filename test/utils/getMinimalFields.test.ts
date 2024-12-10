import assert from "node:assert";

import { defineAbility, subject } from "@casl/ability";

import { getMinimalFields } from "../../src";

const methods = ["find", "get", "create", "update", "patch", "remove"];

describe("utils - getMinimalFields", function () {
  it("returns full array for manage all", function () {
    const ability = defineAbility((can) => {
      can("manage", "all");
    });
    const availableFields = ["id", "test"];
    for (const method of methods) {
      const record: Record<string, unknown> = { id: 1, test: true };
      const fields = getMinimalFields(
        ability,
        method,
        subject("tests", record),
        { availableFields },
      );
      assert.deepStrictEqual(
        fields,
        ["id", "test"],
        `full array for method '${method}'`,
      );
    }
  });

  it("returns subset of array", function () {
    const ability = defineAbility((can) => {
      can("manage", "all", ["id"]);
    });
    const availableFields = ["id", "test"];
    for (const method of methods) {
      const record: Record<string, unknown> = { id: 1, test: true };
      const fields = getMinimalFields(
        ability,
        method,
        subject("tests", record),
        { availableFields },
      );
      assert.deepStrictEqual(
        fields,
        ["id"],
        `subset of array for method '${method}'`,
      );
    }
  });

  it("returns subset of array with availableFields: undefined", function () {
    const ability = defineAbility((can) => {
      can("manage", "all", ["id"]);
    });
    const availableFields = undefined;
    for (const method of methods) {
      const record: Record<string, unknown> = { id: 1, test: true };
      const fields = getMinimalFields(
        ability,
        method,
        subject("tests", record),
        { availableFields },
      );
      assert.deepStrictEqual(
        fields,
        ["id"],
        `subset of array for method '${method}'`,
      );
    }
  });

  it("returns empty array with availableFields: []", function () {
    const ability = defineAbility((can) => {
      can("manage", "all", ["id"]);
    });
    const availableFields = [];
    for (const method of methods) {
      const record: Record<string, unknown> = { id: 1, test: true };
      const fields = getMinimalFields(
        ability,
        method,
        subject("tests", record),
        { availableFields },
      );
      assert.deepStrictEqual(fields, [], `empty array for method '${method}'`);
    }
  });

  it("returns empty array when not allowed", function () {
    const ability = defineAbility((can, cannot) => {
      cannot("manage", "all");
    });

    for (const method of methods) {
      const record: Record<string, unknown> = { id: 1, test: true };
      const fields = getMinimalFields(
        ability,
        method,
        subject("tests", record),
        { checkCan: true },
      );
      assert.deepStrictEqual(fields, [], `empty array for method '${method}'`);
    }
  });

  it("returns subset of array for more complex rules", function () {
    const ability = defineAbility((can, cannot) => {
      can("manage", "tests", ["id", "name", "email"], { id: { $ne: 1 } });
      can("manage", "tests", { id: 1 });
      cannot("manage", "tests", ["supersecret"]);
    });
    const availableFields = ["id", "name", "email", "supersecret", "password"];
    interface Pair {
      input: Record<string, unknown>;
      expected: string[];
    }
    const pairs: Pair[] = [
      {
        input: { id: 1 },
        expected: ["id", "name", "email", "password"],
      },
      {
        input: {},
        expected: ["id", "name", "email"],
      },
      {
        input: { id: 2 },
        expected: ["id", "name", "email"],
      },
    ];
    for (const [index, pair] of pairs.entries()) {
      for (const method of methods) {
        const fields = getMinimalFields(
          ability,
          method,
          subject("tests", pair.input),
          { availableFields },
        );
        assert.deepStrictEqual(
          fields,
          pair.expected,
          `result for input '${index}' and method '${method}' is correct`,
        );
      }
    }
  });
});
