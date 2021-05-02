import { Ability, createAliasResolver } from "@casl/ability";
import assert from "assert";

import makeAbilityFromRules from "../lib/makeAbilityFromRules";

describe("makeAbilityFromRules", function() {
  it("returns Ability with no arguments", function() {
    const ability = makeAbilityFromRules();
    assert.ok(ability instanceof Ability, "returned Ability");
  });

  it("returns Ability with rules", function() {
    const action = "create";
    const subject = "tests";
    const ability = makeAbilityFromRules([{
      action,
      subject
    }]);
    assert.ok(ability.can(action, subject), "ability has rules");
  });

  it("returns Ability with rules and options", function() {
    const subject = "tests";
    const ability = makeAbilityFromRules(
      [{
        action: "read",
        subject
      }], { 
        resolveAction: createAliasResolver({
          read: ["get", "find"],
        })
      }
    );
    assert.ok(ability.can("find", subject), "ability has rules with resolveAction");
  });
});