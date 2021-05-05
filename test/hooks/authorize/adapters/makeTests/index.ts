import makeFindTests from "./find";
import makeGetTests from "./get";
import makeCreateTests from "./create";
import makeCreateMultiTests from "./create-multi";
import makeUpdateTests from "./create";
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
  afterHooks?: unknown[]
): Promise<void> {
  await makeFindTests(adapterName, makeService, clean, authorizeHookOptions, afterHooks);
  await makeGetTests(adapterName, makeService, clean, authorizeHookOptions, afterHooks);
  await makeCreateTests(adapterName, makeService, clean, authorizeHookOptions, afterHooks);
  await makeCreateMultiTests(adapterName, makeService, clean, authorizeHookOptions, afterHooks);
  await makeUpdateTests(adapterName, makeService, clean, authorizeHookOptions, afterHooks);
  await makePatchTests(adapterName, makeService, clean, authorizeHookOptions, afterHooks);
  await makePatchMultiTests(adapterName, makeService, clean, authorizeHookOptions, afterHooks);
  await makeRemoveTests(adapterName, makeService, clean, authorizeHookOptions, afterHooks);
  await makeRemoveMultiTests(adapterName, makeService, clean, authorizeHookOptions, afterHooks);
}