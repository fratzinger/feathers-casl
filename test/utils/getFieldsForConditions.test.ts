import { defineAbility } from "@casl/ability";
import assert from "assert";
import getFieldsForConditions from "../../lib/utils/getFieldsForConditions";

describe("utils - getFieldsForConditions.test", function() {
  it("returns empty array for no conditions", function() {
    // eslint-disable-next-line @typescript-eslint/no-empty-function
    const ability = defineAbility(() => {});
    const fields = getFieldsForConditions(ability, "find", "tests");
    assert.deepStrictEqual(fields, [], "empty fields");
  });

  it("returns fields for correct method", function() {
    const ability = defineAbility((can, cannot) => {
      can("find", "tests1", { special: undefined });
      can("find", "tests1", { userId: 1, test: false });
      can("find", "tests1", { userId: 3, hi: "no" });
      cannot("find", "tests1", { testsId: null });
      can("get", "tests1", { id: 1 });
      can("find", "tests2", { commentId: 1 });
    });
    const fieldsTests1 = getFieldsForConditions(ability, "find", "tests1");
    assert.deepStrictEqual(fieldsTests1.sort(), ["special", "userId", "test", "hi", "testsId"].sort(), "found right fields for tests1");
    const fieldsTests2 = getFieldsForConditions(ability, "find", "tests2");
    assert.deepStrictEqual(fieldsTests2.sort(), ["commentId"].sort(), "found right fields for tests2");
  });
});