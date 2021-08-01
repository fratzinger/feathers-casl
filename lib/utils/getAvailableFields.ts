import type { HookContext } from "@feathersjs/feathers";
import type { AuthorizeChannelCommonsOptions } from "../types";

const getAvailableFields = (
  context: HookContext, 
  options?: Partial<Pick<AuthorizeChannelCommonsOptions, "availableFields">>
): undefined | string[] => {
  return (!options?.availableFields)
    ? undefined
    : (typeof options.availableFields === "function")
      ? options.availableFields(context)
      : options.availableFields;
};

export default getAvailableFields;