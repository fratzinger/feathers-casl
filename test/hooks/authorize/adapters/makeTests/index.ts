import makeFindTests from './find.js'
import makeGetTests from './get.js'
import makeCreateTests from './create.js'
import makeCreateMultiTests from './create-multi.js'
import makeUpdateTests from './update.js'
import makeUpdateDataTests from './update-data.js'
import makePatchTests from './patch.js'
import makePatchDataTests from './patch-data.js'
import makePatchMultiTests from './patch-multi.js'
import makeRemoveTests from './remove.js'
import makeRemoveMultiTests from './remove-multi.js'
import type { Adapter, AuthorizeHookOptions } from '../../../../../src/index.js'
import type { MakeTestsOptions } from './_makeTests.types.js'

export default async function (
  name: Adapter | string,
  makeService: () => unknown,
  clean: (app, service) => Promise<void>,
  authorizeHookOptions: Partial<AuthorizeHookOptions>,
  makeTestsOptions: MakeTestsOptions = {
    around: false,
    afterHooks: [],
    actionBefore: () => {},
  },
): Promise<void> {
  describe(`authorize-hook '${name}'`, function () {
    if (makeTestsOptions.actionBefore) {
      beforeAll(makeTestsOptions.actionBefore)
    }
    makeFindTests(
      name,
      makeService,
      clean,
      authorizeHookOptions,
      makeTestsOptions,
    )
    makeGetTests(
      name,
      makeService,
      clean,
      authorizeHookOptions,
      makeTestsOptions,
    )
    makeCreateTests(
      name,
      makeService,
      clean,
      authorizeHookOptions,
      makeTestsOptions,
    )
    makeCreateMultiTests(
      name,
      makeService,
      clean,
      authorizeHookOptions,
      makeTestsOptions,
    )
    makeUpdateTests(
      name,
      makeService,
      clean,
      authorizeHookOptions,
      makeTestsOptions,
    )
    makeUpdateDataTests(
      name,
      makeService,
      clean,
      Object.assign({ useUpdateData: true }, authorizeHookOptions),
      makeTestsOptions,
    )
    makePatchTests(
      name,
      makeService,
      clean,
      authorizeHookOptions,
      makeTestsOptions,
    )
    makePatchDataTests(
      name,
      makeService,
      clean,
      Object.assign({ usePatchData: true }, authorizeHookOptions),
      makeTestsOptions,
    )
    makePatchMultiTests(
      name,
      makeService,
      clean,
      authorizeHookOptions,
      makeTestsOptions,
    )
    makeRemoveTests(
      name,
      makeService,
      clean,
      authorizeHookOptions,
      makeTestsOptions,
    )
    makeRemoveMultiTests(
      name,
      makeService,
      clean,
      authorizeHookOptions,
      makeTestsOptions,
    )
  })
}
