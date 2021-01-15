import { HookContext } from "@feathersjs/feathers";

const TYPE_FIELD = "__caslSubjectType__";

export default (type: string, object: Record<string, unknown>, context: HookContext): Record<string, unknown> => {
  Object.defineProperty(object, TYPE_FIELD, { 
    value: context.path,
    enumerable: false
  });
  return object;
};