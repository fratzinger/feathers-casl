import type { HookContext } from "@feathersjs/feathers";

const getModelName = (modelName: string | ((context: HookContext) => string), context: HookContext): string => {
  if (modelName === undefined) { return context.path; }
  if (typeof modelName === "string") { return modelName; }
  if (typeof modelName === "function") { return modelName(context); }

  throw new Error("feathers-casl: 'modelName' is not a string or function");
};

export default getModelName;