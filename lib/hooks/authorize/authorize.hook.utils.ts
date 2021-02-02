import _get from "lodash/get";
import _set from "lodash/set";
import _unset from "lodash/unset";

import { Forbidden } from "@feathersjs/errors";

import { PureAbility } from "@casl/ability";
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
  const appOptions = app?.get("casl")?.authorizeHook || makeDefaultOptions();
  return Object.assign(appOptions, options);
};

export const makeDefaultOptions = (options?: AuthorizeHookOptions): AuthorizeHookOptions => {
  options = options || {} as AuthorizeHookOptions;
  
  options.checkMultiActions = false;
  options.availableFields = (context: HookContext): string[] => {
    const availableFields: string[] | ((context: HookContext) => string[]) = context.service.options?.casl?.availableFields;
    if (!availableFields) return undefined;
    return (typeof availableFields === "function")
      ? availableFields(context)
      : availableFields;
  };
  options.throwIfFieldsAreEmpty = true;
  return options;
};

export const getAppOptions = (app: Application): AuthorizeHookOptions => {
  const caslOptions: InitOptions = app.get("casl");
  if (caslOptions?.authorizeHook) {
    return caslOptions.authorizeHook;
  }
};

export const getAbility = (context: HookContext, options?: AuthorizeHookOptions): Promise<PureAbility|undefined> => {
  options = options || {};

  if (options?.ability) {
    if (typeof options.ability === "function") {
      const ability = options.ability(context);
      return Promise.resolve(ability);
    } else {
      return Promise.resolve(options.ability);
    }
  }
  
  if (context?.params?.ability) { 
    return Promise.resolve(context.params.ability); 
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
  ability: PureAbility, 
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

export const checkMulti = (context: HookContext, ability: PureAbility, modelName: string, actionOnForbidden: (() => void)): boolean => {
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
