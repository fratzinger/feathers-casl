import assert from "assert";
import {
  createAliasResolver,
  defineAbility
} from "@casl/ability";

import getQueryFor from "../../lib/utils/getQueryFor";

const resolveAction = createAliasResolver({
  update: "patch",
  read: ["get", "find"],
  delete: "remove"
});

describe("utils - getQueryFor", () => {
  describe("fields", function() {
    it("simple select", function() {
      const ability = defineAbility({ resolveAction }, (can) => {
        can("read", "Test", ["id"]);
        can("update", "Test", ["id"]);
        can("remove", "Test", ["id"]);
      });

      ["find", "get", "update", "patch", "remove"].forEach(method => {
        const query = getQueryFor(ability, method, "Test");
        assert.deepStrictEqual(query, { $select: ["id"] }, "query has '$select'");
      });
    });

    it("selects anything but certain value", function() {
      const ability = defineAbility({ resolveAction }, (can, cannot) => {
        can("manage", "Test");
        cannot(["create", "read", "update", "remove"], "Test", ["secretField"]);
      });

      ["find", "get", "update", "patch", "remove"].forEach(method => {
        const query = getQueryFor(ability, method, "Test", { availableFields: ["id", "test", "secretField"] });
        assert.deepStrictEqual(query, { $select: ["id", "test"] }, `query has '$select' for "${method}"`);
      });
    });
  });

  describe("conditions", function() {
    it("makes right query for inverted rules", async function() {
      const pairs = [
        {
          query: { userId: 1 },
          inverted: { userId: { $ne: 1 } }
        }, {
          query: { userId: { $ne: 1 } },
          inverted: { userId: 1 }
        }, {
          query: { userId: { $gt: 1 } },
          inverted: { userId: { $lte: 1 } }
        }, {
          query: { userId: { $gte: 1 } },
          inverted: { userId: { $lt: 1 } }
        }, {
          query: { userId: { $lt: 1 } },
          inverted: { userId: { $gte: 1 } }
        }, {
          query: { userId: { $lte: 1 } },
          inverted: { userId: { $gt: 1 } }
        }, {
          query: { userId: { $in: [1] } },
          inverted: { userId: { $nin: [1] } }
        }, {
          query: { userId: { $nin: [1] } },
          inverted: { userId: { $in: [1] } }
        }
      ];

      pairs.forEach(({ query, inverted }) => {
        const ability = defineAbility({ resolveAction }, (can, cannot) => {
          can("manage", "all", ["userId"]);
          cannot("read", "Test", query);
          cannot("update", "Test", query);
          cannot("remove", "Test", query);
        });

        const methods = ["find", "get", "update", "patch", "remove"];

        methods.forEach(method => {
          const result = getQueryFor(ability, method, "Test", { availableFields: ["userId"] });
          assert.deepStrictEqual(result, inverted, `'${method}': for query: '${JSON.stringify(query)}' the inverted is: ${JSON.stringify(result)}`);
        });
      });
    });
  });

  describe("conditions and fields", function() {
    it("simple condition and select", function() {
      const ability = defineAbility({ resolveAction }, (can) => {
        can("read", "Test", ["id"], { userId: 1 });
        can("update", "Test", ["id"], { userId: 1 });
        can("remove", "Test", ["id"], { userId: 1 });
      });

      ["find", "get", "update", "patch", "remove"].forEach(method => {
        const query = getQueryFor(ability, method, "Test");
        assert.deepStrictEqual(query, { $select: ["id"], userId: 1 }, "query has '$select' and 'userId'");
      });
    });

    it.skip("varying select for different values", function() {
      const ability = defineAbility({ resolveAction }, (can) => {
        can("read", "Test", ["id"], { userId: { $ne: 1 } });
        can("read", "Test", { userId: 1 });
      });
      // eslint-disable-next-line @typescript-eslint/no-unused-vars
      const query = getQueryFor(ability, "find", "Test");
    });
  });
});
