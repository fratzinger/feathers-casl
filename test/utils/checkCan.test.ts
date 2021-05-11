import assert from "assert";
import feathers from "@feathersjs/feathers";
import { Service } from "feathers-memory";
import { defineAbility } from "@casl/ability";

import checkCan from "../../lib/utils/checkCan";

describe("checkCan.test.ts", function() {
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

  it("general checkCan", async function() {
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
});