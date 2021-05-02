import _get from "lodash/get";
import _set from "lodash/set";
import _unset from "lodash/unset";

import { Forbidden } from "@feathersjs/errors";

import { AnyAbility } from "@casl/ability";
import { Application, HookContext } from "@feathersjs/feathers";

import {
  isMulti
} from "feathers-utils";

import {
  AuthorizeHookOptions,
  AuthorizeHookOptionsExclusive,
  HookBaseOptions,
  InitOptions,
  Path
} from "../../types";
import getFieldsForConditions from "../../utils/getFieldsForConditions";
import { makeDefaultBaseOptions } from "../common";
import getAvailableFields from "../../utils/getAvailableFields";

export const makeOptions = (
  app: Application, 
  options?: Partial<AuthorizeHookOptions>
): AuthorizeHookOptions => {
  options = options || {};
  return Object.assign(makeDefaultBaseOptions(), defaultOptions, getAppOptions(app), options);
};

const defaultOptions: AuthorizeHookOptionsExclusive = {
  adapter: "feathers-memory",
  availableFields: (context: HookContext): string[] => {
    const availableFields: string[] | ((context: HookContext) => string[]) = context.service.options?.casl?.availableFields;
    return getAvailableFields(context, { availableFields });
  }
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

  if (getPersistedConfig(context, "ability")) {
    if (typeof options.ability === "function") {
      const ability = options.ability(context);
      return Promise.resolve(ability);
    } else {
      return Promise.resolve(options.ability);
    }
  }
  
  return Promise.resolve(undefined);
};

const move = (context: HookContext, fromPath: Path, toPath: Path) => {
  const val = _get(context, fromPath);

  if (val !== undefined) {
    _unset(context, fromPath);
    _set(context, toPath, val);
  }
  return val;
};

export const throwUnlessCan = (
  ability: AnyAbility, 
  method: string, 
  resource: string|Record<string, unknown>, 
  modelName: string,
  actionOnForbidden: () => void
): void => {
  if (ability.cannot(method, resource)) {
    if (actionOnForbidden) actionOnForbidden();
    throw new Forbidden(`You are not allowed to ${method} ${modelName}`);
  }
};

export const handleConditionalSelect = (
  context: HookContext, 
  ability: AnyAbility, 
  method: string, 
  modelName: string
): boolean => {
  if (!context.params?.query || !context.params?.query?.$select) { return false; }
  const { $select } = context.params.query;
  const fields = getFieldsForConditions(ability, method, modelName);
  if (!fields.length) { 
    return false; 
  }

  const fieldsToAdd = fields.filter(field => !$select.includes(field));
  if (!fieldsToAdd.length) { return false; }
  hide$select(context);
  context.params.query.$select = [...$select, ...fieldsToAdd];
  
  return true;
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

export const hide$select = (context: HookContext): unknown => {
  return move(context, "params.query.$select", "params.casl.$select");
};

export const restore$select = (context: HookContext): string[]|undefined => {
  move(context, "params.casl.$select", "params.query.$select");
  return _get(context, "params.query.$select");
};

export const get$select = (context: HookContext): unknown => {
  return getPersistedConfig(context, "$select");
};

export const setPersistedConfig = (context: HookContext, key: Path, val: unknown): HookContext => {
  return _set(context, `params.casl.${key}`, val);
};

export const getPersistedConfig = (context: HookContext, key: Path): unknown => {
  return _get(context, `params.casl.${key}`);
};
