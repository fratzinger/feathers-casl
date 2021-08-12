import { HookContext } from "@feathersjs/feathers";
import assert from "assert";

import { 
  getContextPath, 
  getModelName
} from "../../lib/utils/getDefaultModelName";

describe("utils - getDefaultModelName", function() {
  it("getContextPath", function() {
    const path = "tests";
    assert.strictEqual(
      getContextPath({ path }),
      path,
      "just returns path"
    );
  });

  describe("getModelName", function() {
    it("service.modelName", function() {
      const options = {
        service: {
          modelName: "modelName",
          Model: {
            name: "Model.name"
          }
        }
      } as unknown as HookContext;

      assert.strictEqual(
        getModelName(options),
        options.service.modelName,
        "returns service.modelName"
      );
    });

    it("service.Model.name", function() {
      const options = {
        service: {
          modelName: null,
          Model: {
            name: "Model.name"
          }
        }
      } as unknown as HookContext;
  
      assert.strictEqual(
        getModelName(options),
        options.service.Model.name,
        "returns service.Model.name"
      );
    });
  });
});