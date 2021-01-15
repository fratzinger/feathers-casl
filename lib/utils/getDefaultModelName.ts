import { HookContext } from "@feathersjs/feathers";

export const getContextPath = (context: HookContext): string => {
  return context.path;
};

export const getModelName = (context: HookContext): string => {
  const { service } = context;
  const modelName = service.modelName || service.Model && service.Model.name;
  return modelName;
};