import makeFindTests from "./find";
import makeGetTests from "./get";
import makeCreateTests from "./create";
import makeCreateMultiTests from "./create-multi";
import makeUpdateTests from "./update";
import makeUpdateDataTests from "./update-data";
import makePatchTests from "./patch";
import makePatchDataTests from "./patch-data";
import makePatchMultiTests from "./patch-multi";
import makeRemoveTests from "./remove";
import makeRemoveMultiTests from "./remove-multi";
import type { Adapter, AuthorizeHookOptions } from "../../../../../src";
import type { MakeTestsOptions } from "./_makeTests.types";

export default async function (
  name: Adapter | string,
  makeService: () => unknown,
  clean: (app, service) => Promise<void>,
  authorizeHookOptions: Partial<AuthorizeHookOptions>,
  makeTestsOptions: MakeTestsOptions = {
    around: false,
    afterHooks: [],
    actionBefore: () => {},
  }
): Promise<void> {
  describe(`authorize-hook '${name}'`, function () {
    if (makeTestsOptions.actionBefore) {
      beforeAll(makeTestsOptions.actionBefore);
    }
    makeFindTests(
      name,
      makeService,
      clean,
      authorizeHookOptions,
      makeTestsOptions
    );
    makeGetTests(
      name,
      makeService,
      clean,
      authorizeHookOptions,
      makeTestsOptions
    );
    makeCreateTests(
      name,
      makeService,
      clean,
      authorizeHookOptions,
      makeTestsOptions
    );
    makeCreateMultiTests(
      name,
      makeService,
      clean,
      authorizeHookOptions,
      makeTestsOptions
    );
    makeUpdateTests(
      name,
      makeService,
      clean,
      authorizeHookOptions,
      makeTestsOptions
    );
    makeUpdateDataTests(
      name,
      makeService,
      clean,
      Object.assign({ checkRequestData: true }, authorizeHookOptions),
      makeTestsOptions
    );
    makePatchTests(
      name,
      makeService,
      clean,
      authorizeHookOptions,
      makeTestsOptions
    );
    makePatchDataTests(
      name,
      makeService,
      clean,
      Object.assign({ checkRequestData: true }, authorizeHookOptions),
      makeTestsOptions
    );
    makePatchMultiTests(
      name,
      makeService,
      clean,
      authorizeHookOptions,
      makeTestsOptions
    );
    makeRemoveTests(
      name,
      makeService,
      clean,
      authorizeHookOptions,
      makeTestsOptions
    );
    makeRemoveMultiTests(
      name,
      makeService,
      clean,
      authorizeHookOptions,
      makeTestsOptions
    );
  });
}
