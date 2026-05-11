export type MakeTestsOptions = {
  around?: boolean
  beforeHooks?: any[]
  afterHooks?: any[]
  actionBefore?: () => Promise<void> | void
}
