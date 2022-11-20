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
import type { Adapter, AuthorizeHookOptions } from "../../../../../lib";

export default async function (
  adapterName: Adapter,
  makeService: () => unknown,
  clean: (app, service) => Promise<void>,
  authorizeHookOptions: Partial<AuthorizeHookOptions>,
  afterHooks?: unknown[],
  actionBefore?: () => Promise<void>
): Promise<void> {
  describe(`authorize-hook '${adapterName}'`, function () {
    if (actionBefore) {
      beforeAll(actionBefore);
    }
    makeFindTests(
      adapterName,
      makeService,
      clean,
      authorizeHookOptions,
      afterHooks
    );
    makeGetTests(
      adapterName,
      makeService,
      clean,
      authorizeHookOptions,
      afterHooks
    );
    makeCreateTests(
      adapterName,
      makeService,
      clean,
      authorizeHookOptions,
      afterHooks
    );
    makeCreateMultiTests(
      adapterName,
      makeService,
      clean,
      authorizeHookOptions,
      afterHooks
    );
    makeUpdateTests(
      adapterName,
      makeService,
      clean,
      authorizeHookOptions,
      afterHooks
    );
    makeUpdateDataTests(
      adapterName,
      makeService,
      clean,
      Object.assign({ useUpdateData: true }, authorizeHookOptions),
      afterHooks
    );
    makePatchTests(
      adapterName,
      makeService,
      clean,
      authorizeHookOptions,
      afterHooks
    );
    makePatchDataTests(
      adapterName,
      makeService,
      clean,
      Object.assign({ usePatchData: true }, authorizeHookOptions),
      afterHooks
    );
    makePatchMultiTests(
      adapterName,
      makeService,
      clean,
      authorizeHookOptions,
      afterHooks
    );
    makeRemoveTests(
      adapterName,
      makeService,
      clean,
      authorizeHookOptions,
      afterHooks
    );
    makeRemoveMultiTests(
      adapterName,
      makeService,
      clean,
      authorizeHookOptions,
      afterHooks
    );
  });
}
