import { HookContext } from "@feathersjs/feathers";
import assert from "assert";

import getModelName from "../../lib/utils/getModelName";

describe("utils - getModelName", function() {
  it("as undefined", function() {
    const modelName = undefined;
    const context = { path: "Test2" } as unknown as HookContext;
    assert.strictEqual(
      getModelName(modelName, context),
      context.path,
      "returns context.path"
    );
  });

  it("as string", function() {
    const modelName = "Test1";
    const context = { path: "Test2" } as unknown as HookContext;
    assert.strictEqual(
      getModelName(modelName, context),
      modelName,
      "just returns modelName"
    );
  });

  it("as function", function() {
    const context = { path: "Test2", method: "Test3" } as unknown as HookContext;
    assert.strictEqual(
      getModelName((c => c.method), context),
      context.method,
      "returns custom modelName"
    );
  });
});