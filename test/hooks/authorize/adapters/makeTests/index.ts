import makeFindTests from "./find";
import makeGetTests from "./get";
import makeCreateTests from "./create";
import makeCreateMultiTests from "./create-multi";
import makeUpdateTests from "./update";
import makePatchTests from "./patch";
import makePatchMultiTests from "./patch-multi";
import makeRemoveTests from "./remove";
import makeRemoveMultiTests from "./remove-multi";
import { Adapter, AuthorizeHookOptions } from "../../../../../lib/types";

export default async function(
  adapterName: Adapter,
  makeService: () => unknown,
  clean: (app, service) => Promise<void>,
  authorizeHookOptions: Partial<AuthorizeHookOptions>,
  afterHooks?: unknown[],
  actionBefore?: () => Promise<void>
): Promise<void> {
  describe(`authorize-hook '${adapterName}'`, function() {
    if (actionBefore) { before(actionBefore); }
    makeFindTests(adapterName, makeService, clean, authorizeHookOptions, afterHooks);
    makeGetTests(adapterName, makeService, clean, authorizeHookOptions, afterHooks);
    makeCreateTests(adapterName, makeService, clean, authorizeHookOptions, afterHooks);
    makeCreateMultiTests(adapterName, makeService, clean, authorizeHookOptions, afterHooks);
    makeUpdateTests(adapterName, makeService, clean, authorizeHookOptions, afterHooks);
    makePatchTests(adapterName, makeService, clean, authorizeHookOptions, afterHooks);
    makePatchMultiTests(adapterName, makeService, clean, authorizeHookOptions, afterHooks);
    makeRemoveTests(adapterName, makeService, clean, authorizeHookOptions, afterHooks);
    makeRemoveMultiTests(adapterName, makeService, clean, authorizeHookOptions, afterHooks);
  });
  
}