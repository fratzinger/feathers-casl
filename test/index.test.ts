import assert from "assert";
import index, {
  authorize,
  checkBasicPermission,
  channels,
  getChannelsWithReadAbility,
  hooks
} from "../lib";
import feathers from "@feathersjs/feathers";

import type { ServiceCaslOptions } from "../lib/types";

declare module "@feathersjs/feathers" {
    interface Application {
      casl: ServiceCaslOptions
    }
  }

describe("index", function() {
  it("default is initialize", function() {
    const app = feathers();
    assert.ok(!app.get("casl"), "casl is not set");
    index()(app);
    assert.ok(app.get("casl"), "casl is set");
  });
  
  it("destructured exports", function() {
    assert.ok(authorize, "authorize is ok");
    assert.ok(checkBasicPermission, "checkBasicPermission is ok");
    assert.ok(getChannelsWithReadAbility, "getChannelsWithReadAbility is ok");
    assert.ok(
      channels.getChannelsWithReadAbility, 
      "channels.getChannelsWithReadAbility is ok"
    );
    assert.ok(
      hooks.authorize && hooks.checkBasicPermission,
      "hooks.authorize && hooks.checkBasicPermission is ok"
    );
  });
});