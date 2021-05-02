import { HookContext } from "@feathersjs/feathers";
import { HookBaseOptions } from "../types";

const defaultOptions: HookBaseOptions = {
  ability: undefined,
  actionOnForbidden: undefined,
  checkMultiActions: false,
  checkAbilityForInternal: false,
  modelName: (context: Pick<HookContext, "path">): string => {
    return context.path;
  },
  notSkippable: false
};

export const makeDefaultBaseOptions = (): HookBaseOptions => {
  return Object.assign({}, defaultOptions);
};