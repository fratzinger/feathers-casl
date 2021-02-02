import assert from "assert";

import {
  defineAbility,
  subject
} from "@casl/ability";

import hasRestrictingFields from "../../lib/utils/hasRestrictingFields";

const methods = ["find", "get", "create", "update", "patch", "remove"];

describe("utils - hasRestrictingFields", function() {
  it("returns false for full array", function() {
    const ability = defineAbility((can) => {
      can("manage", "all");
    });
    const obj = subject("tests", {
      id: 1,
      test: true
    });
    const availableFields = ["id", "test"];
    methods.forEach(method => {
      const result = hasRestrictingFields(ability, method, obj, { availableFields });
      assert.strictEqual(result, false, `false for method '${method}'`);
    });
  });

  it("returns false for full array", function() {
    const ability = defineAbility((can) => {
      can("manage", "all");
    });
    const obj = subject("tests", {
      id: 1,
      test: true
    });
    const availableFields = ["id", "test"];
    methods.forEach(method => {
      const result = hasRestrictingFields(ability, method, obj, { availableFields });
      assert.strictEqual(result, false, `false for method '${method}'`);
    });
  });

  it("returns true for empty array", function() {
    const ability = defineAbility((can) => {
      can("manage", "all", ["id"]);
      can("manage", "all", ["test"]);
    });

    const obj = subject("tests", {
      id: 1,
      test: true
    });

    const availableFields = ["id", "test"];
    methods.forEach(method => {
      const result = hasRestrictingFields(ability, method, obj, { availableFields });
      assert.strictEqual(result, true, `true for method '${method}'`);
    });
  });

  it("returns subset array", function() {
    const ability = defineAbility((can) => {
      can("manage", "all", ["id"]);
    });

    const obj = subject("tests", {
      id: 1,
      test: true
    });

    const availableFields = ["id", "test"];
    methods.forEach(method => {
      const result = hasRestrictingFields(ability, method, obj, { availableFields });
      assert.deepStrictEqual(result, ["id"], `is subset for method '${method}'`);
    });
  });

  it("returns subset array", function() {
    const ability = defineAbility((can) => {
      can("manage", "all", ["id"]);
    });

    const obj = subject("tests", {
      id: 1,
      test: true
    });

    const availableFields = ["id", "test"];
    methods.forEach(method => {
      const result = hasRestrictingFields(ability, method, obj, { availableFields });
      assert.deepStrictEqual(result, ["id"], `is subset for method '${method}'`);
    });
  });

  it("returns subset array with condition", function() {
    const ability = defineAbility((can) => {
      can("manage", "all", ["id"], { id: 1 });
    });

    const obj = subject("tests", {
      id: 1,
      test: true,
      supersecret: true
    });

    const availableFields = ["id", "test", "supersecret"];
    methods.forEach(method => {
      const result = hasRestrictingFields(ability, method, obj, { availableFields });
      assert.deepStrictEqual(result, ["id"], `is subset for method '${method}'`);
    });
  });
});