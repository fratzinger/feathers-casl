import _get from "lodash/get";
import _set from "lodash/set";

import { Forbidden } from "@feathersjs/errors";

import getFieldsForConditions from "../../utils/getFieldsForConditions";
import { makeDefaultBaseOptions } from "../common";
import getAvailableFields from "../../utils/getAvailableFields";

import { getItemsIsArray } from "feathers-utils";
import { HOOKNAME } from "./authorize.hook";

import {
  isMulti, 
  markHookForSkip
} from "feathers-utils";

import type { AnyAbility } from "@casl/ability";
import type { Application, HookContext, Params } from "@feathersjs/feathers";

import type {
  Adapter,
  AuthorizeHookOptions,
  AuthorizeHookOptionsExclusive,
  HookBaseOptions,
  InitOptions,
  Path,
  ThrowUnlessCanOptions
} from "../../types";
import type { Promisable } from "type-fest";

export const makeOptions = (
  app: Application, 
  options?: Partial<AuthorizeHookOptions>
): AuthorizeHookOptions => {
  options = options || {};
  return Object.assign(makeDefaultBaseOptions(), defaultOptions, getAppOptions(app), options);
};

const defaultOptions: AuthorizeHookOptionsExclusive = {
  adapter: undefined,
  availableFields: (context: HookContext): string[] => {
    const availableFields: string[] | ((context: HookContext) => string[]) = context.service.options?.casl?.availableFields;
    return getAvailableFields(context, { availableFields });
  },
  usePatchData: false,
  useUpdateData: false
};

export const makeDefaultOptions = (
  options?: Partial<AuthorizeHookOptions>
): AuthorizeHookOptions => {
  return Object.assign(makeDefaultBaseOptions(), defaultOptions, options);
};

const getAppOptions = (app: Application): AuthorizeHookOptions | Record<string, never> => {
  const caslOptions: InitOptions = app?.get("casl");
  return (caslOptions && caslOptions.authorizeHook)
    ? caslOptions.authorizeHook
    : {};
};

export const getAdapter = (
  app: Application,
  options: Pick<AuthorizeHookOptions, "adapter">
): Adapter => {
  if (options.adapter) { return options.adapter; }
  const caslAppOptions = app?.get("casl") as InitOptions;
  if (caslAppOptions?.defaultAdapter) { return caslAppOptions.defaultAdapter; }
  return "feathers-memory";
};

export const getAbility = (
  context: HookContext, 
  options?: Pick<HookBaseOptions, "ability" | "checkAbilityForInternal">
): Promise<AnyAbility|undefined> => {
  // if params.ability is set, return it over options.ability
  if (context?.params?.ability) { 
    if (typeof context.params.ability === "function") {
      const ability = context.params.ability(context);
      return Promise.resolve(ability);
    } else {
      return Promise.resolve(context.params.ability);
    }
  }

  const persistedAbility = getPersistedConfig(context, "ability");

  if (persistedAbility) {
    if (typeof persistedAbility === "function") {
      const ability = persistedAbility(context);
      return Promise.resolve(ability);
    } else {
      return Promise.resolve(persistedAbility);
    }
  }

  if (!options.checkAbilityForInternal && !context.params?.provider) {
    return Promise.resolve(undefined);
  }

  if (options?.ability) {
    if (typeof options.ability === "function") {
      const ability = options.ability(context);
      return Promise.resolve(ability);
    } else {
      return Promise.resolve(options.ability);
    }
  }
  
  throw new Forbidden(`You're not allowed to ${context.method} on '${context.path}'`);
};

export const throwUnlessCan = (
  ability: AnyAbility, 
  method: string, 
  resource: string|Record<string, unknown>, 
  modelName: string,
  options: Partial<ThrowUnlessCanOptions>
): boolean => {
  if (ability.cannot(method, resource)) {
    if (options.actionOnForbidden) options.actionOnForbidden();
    if (!options.skipThrow) {
      throw new Forbidden(`You are not allowed to ${method} ${modelName}`);
    }
    return false;
  }
  return true;
};

export const refetchItems = async (
  context: HookContext,
  params?: Params
): Promise<unknown[] | undefined> => {
  if (context.type !== "after") { return; }
  const { items } = getItemsIsArray(context);

  if (!items) { return; }

  const idField = context.service.options?.id;
  const ids = items.map(item => item[idField]);

  params = Object.assign({}, params, { paginate: false });

  markHookForSkip(HOOKNAME, "all", { params });
  delete params.ability;
  
  const query = Object.assign({}, params.query, { [idField]: { $in: ids } });
  params = Object.assign({}, params, { query });

  return await context.service.find(params);
};

export const getConditionalSelect = (
  $select: string[], 
  ability: AnyAbility, 
  method: string, 
  modelName: string
): undefined | string[] => {
  if (!$select?.length) { return undefined; }
  const fields = getFieldsForConditions(ability, method, modelName);
  if (!fields.length) { 
    return undefined; 
  }

  const fieldsToAdd = fields.filter(field => !$select.includes(field));
  if (!fieldsToAdd.length) { return undefined; }
  return [...$select, ...fieldsToAdd];
};

export const checkMulti = (
  context: HookContext, 
  ability: AnyAbility, 
  modelName: string,
  options?: Pick<AuthorizeHookOptions, "actionOnForbidden">
): boolean => {
  const { method } = context;
  const currentIsMulti = isMulti(context);
  if (!currentIsMulti) { return true; }
  if (
    (method === "find" && ability.can(method, modelName)) ||
    (ability.can(`${method}-multi`, modelName))
  ) {
    return true;
  }

  if (options?.actionOnForbidden) options.actionOnForbidden();
  throw new Forbidden(`You're not allowed to multi-${method} ${modelName}`);
};

export const setPersistedConfig = (context: HookContext, key: Path, val: unknown): HookContext => {
  return _set(context, `params.casl.${key}`, val);
};

export function getPersistedConfig (context: HookContext, key: "ability"): AnyAbility | ((context: HookContext) => Promisable<AnyAbility | undefined>) | undefined
export function getPersistedConfig (context: HookContext, key: "skipRestrictingRead.conditions"): boolean
export function getPersistedConfig (context: HookContext, key: "skipRestrictingRead.fields"): boolean
export function getPersistedConfig (context: HookContext, key: "madeBasicCheck"): boolean
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function getPersistedConfig (context: HookContext, key: Path): any {
  return _get(context, `params.casl.${key}`);
}