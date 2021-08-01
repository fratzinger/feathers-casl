import type { HookContext } from "@feathersjs/feathers";

export const getContextPath = (context: Pick<HookContext, "path">): string => {
  return context.path;
};

export const getModelName = (context: Pick<HookContext, "service">): string => {
  const { service } = context;
  const modelName = service.modelName || (service.Model && service.Model.name);
  return modelName;
};