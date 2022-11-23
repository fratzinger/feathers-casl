import type { HookContext } from "@feathersjs/feathers";
import assert from "node:assert";

import { getModelName } from "../../lib";

describe("utils - getModelName", function () {
  it("as undefined", function () {
    const modelName = undefined;
    const context = { path: "Test2" } as unknown as HookContext;
    assert.strictEqual(
      getModelName(modelName, context),
      context.path,
      "returns context.path"
    );
  });

  it("as string", function () {
    const modelName = "Test1";
    const context = { path: "Test2" } as unknown as HookContext;
    assert.strictEqual(
      getModelName(modelName, context),
      modelName,
      "just returns modelName"
    );
  });

  it("as function", function () {
    const context = {
      path: "Test2",
      method: "Test3",
    } as unknown as HookContext;
    assert.strictEqual(
      getModelName((c) => c.method, context),
      context.method,
      "returns custom modelName"
    );
  });

  it("throws for other types", function () {
    const vals = [null, [], {}, 1, true, false];

    vals.forEach((val) => {
      const context = {
        path: "Test2",
        method: "Test3",
      } as unknown as HookContext;
      assert.throws(
        //@ts-expect-error val is not string, function or undefined
        () => getModelName(val, context),
        `throws on val: '${val}''`
      );
    });
  });
});
