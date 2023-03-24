import assert from "node:assert";
import index, {
  authorize,
  checkBasicPermission,
  getChannelsWithReadAbility,
} from "../src";
import { feathers } from "@feathersjs/feathers";

import type { ServiceCaslOptions } from "../src";

declare module "@feathersjs/feathers" {
  interface Application {
    casl: ServiceCaslOptions;
  }
}

describe("index", function () {
  it("default is initialize", function () {
    const app = feathers();
    assert.ok(!app.get("casl"), "casl is not set");
    index()(app);
    assert.ok(app.get("casl"), "casl is set");
  });

  it("destructured exports", function () {
    assert.ok(authorize, "authorize is ok");
    assert.ok(checkBasicPermission, "checkBasicPermission is ok");
    assert.ok(getChannelsWithReadAbility, "getChannelsWithReadAbility is ok");
  });
});
