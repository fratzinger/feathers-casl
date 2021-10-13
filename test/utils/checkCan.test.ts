import assert from "assert";
import feathers from "@feathersjs/feathers";
import { Service } from "feathers-memory";
import { defineAbility } from "@casl/ability";

import checkCan from "../../lib/utils/checkCan";

describe("utils - checkCan", function() {
  let app, service;
  before(async function() {
    app = feathers();
    app.use("tests", new Service({ multi: true }));
    service = app.service("tests");
    await service.create([
      { id: 0, test: true, published: true },
      { id: 1, test: false, published: true, hi: 1 },
      { id: 2, test: null, published: false }
    ]);
  });

  it("general 'checkCan'", async function() {
    const ability = defineAbility((can, cannot) => {
      can("get", "tests");
      can("update", "tests", { published: true });
      cannot("patch", "tests");
      can("remove", "tests", { test: true });
    });
    await assert.doesNotReject(
      () => checkCan(ability, 0, "get", "tests", service),
      "'get:0' does not reject"
    );
    await assert.doesNotReject(
      () => checkCan(ability, 0, "update", "tests", service),
      "'update:0' does not reject"
    );
    await assert.doesNotReject(
      () => checkCan(ability, 0, "remove", "tests", service),
      "'update:0' does not reject"
    );
    await assert.rejects(
      () => checkCan(ability, 1, "remove", "tests", service),
      "'remove:1' rejects"
    );
    await assert.rejects(
      () => checkCan(ability, 2, "update", "tests", service),
      "'update:2' rejects"
    );
    await assert.rejects(
      () => checkCan(ability, 0, "patch", "tests", service),
      "'patch:0' rejects"
    );
  });

  it("'checkCan' with skipThrow", async function() {
    const ability = defineAbility((can, cannot) => {
      can("get", "tests");
      can("update", "tests", { published: true });
      cannot("patch", "tests");
      can("remove", "tests", { test: true });
    });
    let can = await checkCan(ability, 0, "get", "tests", service, { skipThrow: true });
    assert.strictEqual(can, true, "'get:0' returns true");
    can = await checkCan(ability, 0, "update", "tests", service, { skipThrow: true });
    assert.strictEqual(can, true, "'update:0' returns true");
    can = await checkCan(ability, 0, "remove", "tests", service, { skipThrow: true });
    assert.strictEqual(can, true, "'update:0' returns true");
    can = await checkCan(ability, 1, "remove", "tests", service, { skipThrow: true });
    assert.strictEqual(can, false, "'remove:1' returns false");
    can = await checkCan(ability, 2, "update", "tests", service, { skipThrow: true });
    assert.strictEqual(can, false, "'update:2' returns false");
    can = await checkCan(ability, 0, "patch", "tests", service, { skipThrow: true });
    assert.strictEqual(can, false, "'patch:0' returns false");
  });
});