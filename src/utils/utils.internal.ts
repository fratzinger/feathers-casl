import type { HookContext } from "@feathersjs/feathers";

export const log = (debug: boolean, message: string, ...args: any[]) => {
  if (!debug) {
    return;
  }

  console.log(message, ...args);
};

// eslint-disable-next-line @typescript-eslint/no-empty-function
function skipDebug() {}

export const makeLog = (
  debug: boolean | ((context: HookContext) => boolean) | undefined,
  context: HookContext
) => {
  const shouldDebug =
    typeof debug === "function" ? debug(context) : debug ?? false;

  if (!shouldDebug) {
    return skipDebug;
  }

  return console.log.bind(console);
};
