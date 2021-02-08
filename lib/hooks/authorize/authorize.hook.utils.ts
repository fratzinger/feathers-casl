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
  InitOptions,
  Path
} from "../../types";

export const makeOptions = (app: Application, options?: Partial<AuthorizeHookOptions>): AuthorizeHookOptions => {
  options = options || {};
  return Object.assign({}, defaultOptions, getAppOptions(app), options);
};

const defaultOptions: AuthorizeHookOptions = {
  ability: undefined,
  actionOnForbidden: undefined,
  availableFields: (context: HookContext): string[] => {
    const availableFields: string[] | ((context: HookContext) => string[]) = context.service.options?.casl?.availableFields;
    if (!availableFields) return undefined;
    return (typeof availableFields === "function")
      ? availableFields(context)
      : availableFields;
  },
  checkMultiActions: false
};

export const makeDefaultOptions = (options?: Partial<AuthorizeHookOptions>): AuthorizeHookOptions => {
  return Object.assign({}, defaultOptions, options);
};

const getAppOptions = (app: Application): AuthorizeHookOptions | Record<string, never> => {
  const caslOptions: InitOptions = app?.get("casl");
  return (caslOptions && caslOptions.authorizeHook)
    ? caslOptions.authorizeHook
    : {};
};

export const getAbility = (context: HookContext, options?: AuthorizeHookOptions): Promise<AnyAbility|undefined> => {
  options = options || {};

  // if params.ability is set, return it over options.ability
  if (context?.params?.ability) { 
    if (typeof context.params.ability === "function") {
      const ability = context.params.ability(context);
      return Promise.resolve(ability);
    } else {
      return Promise.resolve(context.params.ability);
    }
  }

  if (options?.ability) {
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

export const checkMulti = (context: HookContext, ability: AnyAbility, modelName: string, actionOnForbidden: (() => void)): boolean => {
  const { method } = context;
  const currentIsMulti = isMulti(context);
  if (!currentIsMulti) { return true; }
  if (
    (method === "find" && ability.can(method, modelName)) ||
    (ability.can(`${method}-multi`, modelName))
  ) {
    return true;
  }

  if (actionOnForbidden) actionOnForbidden();
  throw new Forbidden(`You're not allowed to multi-${method} ${modelName}`);
};

export const hide$select = (context: HookContext): unknown => {
  return move(context, "params.query.$select", "params.casl.$select");
};

export const restore$select = (context: HookContext): unknown[]|undefined => {
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
