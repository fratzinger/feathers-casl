export type MakeTestsOptions = {
  around?: boolean
  beforeHooks?: unknown[]
  afterHooks?: unknown[]
  actionBefore?: () => Promise<void> | void
}
