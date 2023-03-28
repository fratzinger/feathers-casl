export type MakeTestsOptions = {
  around?: boolean;
  afterHooks?: unknown[];
  actionBefore?: () => Promise<void> | void;
};
