import { defineAbility } from "@casl/ability";
import assert from "assert";
import convertRuleToQuery from "../../lib/utils/convertRuleToQuery";

describe("utils - convertRuleToQuery", function() {
  it("", function() {
    const ability = defineAbility((can, cannot) => {
      can("create", "tests", { id: 1, test: true });

      can("create", "tests", { id: 1 });
      can("create", "tests", { id: { $gt: 1 } });
      can("create", "tests", { id: { $gte: 1 } });
      can("create", "tests", { id: { $lt: 1 } });
      can("create", "tests", { id: { $lte: 1 } });
      can("create", "tests", { id: { $in: [1] } });
      can("create", "tests", { id: { $nin: [1] } });
      can("create", "tests", { id: { $ne: 1 } });

      cannot("create", "tests", { id: 1 });
      cannot("create", "tests", { id: { $gt: 1 } });
      cannot("create", "tests", { id: { $gte: 1 } });
      cannot("create", "tests", { id: { $lt: 1 } });
      cannot("create", "tests", { id: { $lte: 1 } });
      cannot("create", "tests", { id: { $in: [1] } });
      cannot("create", "tests", { id: { $nin: [1] } });
      cannot("create", "tests", { id: { $ne: 1 } });

      cannot("create", "tests");
      can("create", "tests");

      can("create", "tests", { $sort: { id: 1 } });
      cannot("create", "tests", { $sort: { id: 1 } });
      cannot("create", "tests", { id: { $sort: 1 } });
    });
    const expected = [
      { id: 1, test: true },

      { id: 1 },
      { id: { $gt: 1 } },
      { id: { $gte: 1 } },
      { id: { $lt: 1 } },
      { id: { $lte: 1 } },
      { id: { $in: [1] } },
      { id: { $nin: [1] } },
      { id: { $ne: 1 } },
      
      { id: { $ne: 1 } },
      { id: { $lte: 1 } },
      { id: { $lt: 1 } },
      { id: { $gte: 1 } },
      { id: { $gt: 1 } },
      { id: { $nin: [1] } },
      { id: { $in: [1] } },
      { id: 1 },

      undefined,
      undefined,

      { $sort: { id: 1 } },
      {},
      {}
    ];
    const { rules } = ability;

    rules.forEach((rule, i) => {
      assert.deepStrictEqual(
        convertRuleToQuery(rule),
        expected[i],
        `${i}: expected result for rule is: '${JSON.stringify(expected[i])}'`
      );
    });
  });

  it("calls actionOnForbidden", function() {
    let actionOnForbiddenCalled = false;
    const [rule] = defineAbility((can, cannot) => {
      cannot("create", "tests");
    }).rules;
    convertRuleToQuery(rule, { actionOnForbidden: () => { actionOnForbiddenCalled = true; } });

    assert.ok(actionOnForbiddenCalled);
  });
});