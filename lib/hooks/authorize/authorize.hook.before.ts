import { Forbidden } from "@feathersjs/errors";
import _isEmpty from "lodash/isEmpty";
import _pick from "lodash/pick";
import _set from "lodash/set";
import type { AnyAbility } from "@casl/ability";
import { subject } from "@casl/ability";

import {
  shouldSkip,
  isMulti
} from "feathers-utils";

import hasRestrictingFields from "../../utils/hasRestrictingFields";
import hasRestrictingConditions from "../../utils/hasRestrictingConditions";
import couldHaveRestrictingFields from "../../utils/couldHaveRestrictingFields";

import {
  setPersistedConfig,
  getAbility,
  getPersistedConfig,
  throwUnlessCan
} from "./authorize.hook.utils";

import checkBasicPermission from "../checkBasicPermission.hook";
import getAvailableFields from "../../utils/getAvailableFields";
import { checkCreatePerItem } from "../common";
import mergeQueryFromAbility from "../../utils/mergeQueryFromAbility";

import type {
  HookContext
} from "@feathersjs/feathers";

import type {
  AuthorizeHookOptions
} from "../../types";

const HOOKNAME = "authorize";

export default async (
  context: HookContext,
  options: AuthorizeHookOptions
): Promise<HookContext> => {
  if (
    !options?.notSkippable && (
      shouldSkip(HOOKNAME, context) ||
        context.type !== "before" ||
        !context.params
    )
  ) { return context; }

  if (!getPersistedConfig(context, "madeBasicCheck")) {
    const basicCheck = checkBasicPermission({
      notSkippable: true,
      ability: options.ability,
      actionOnForbidden: options.actionOnForbidden,
      checkAbilityForInternal: options.checkAbilityForInternal,
      checkCreateForData: true,
      checkMultiActions: options.checkMultiActions,
      modelName: options.modelName,
      storeAbilityForAuthorize: true
    });
    await basicCheck(context);
  }

  if (!options.modelName) {
    return context;
  }
  const modelName = (typeof options.modelName === "string")
    ? options.modelName
    : options.modelName(context);

  if (!modelName) { return context; }

  const ability = await getAbility(context, options);
  if (!ability) {
    // Ignore internal or not authenticated requests
    return context;
  }

  const multi = isMulti(context);
    
  // if context is with multiple items, there's a change that we need to handle each item separately
  if (multi) {
    if (!couldHaveRestrictingFields(ability, "find", modelName)) {
      // if has no restricting fields at all -> can skip _pick() in after-hook
      setPersistedConfig(context, "skipRestrictingRead.fields", true);
    }
  }

  if (["find", "get"].includes(context.method) || (isMulti && !hasRestrictingConditions(ability, "find", modelName))) {
    setPersistedConfig(context, "skipRestrictingRead.conditions", true);
  }

  const { method, id } = context;
  const availableFields = getAvailableFields(context, options);

  if (["get", "patch", "update", "remove"].includes(method) && id != null) {
    // single: get | patch | update | remove
    await handleSingle(context, ability, modelName, availableFields, options);
  } else if (method === "find" || (["patch", "remove"].includes(method) && id == null)) {
    // multi: find | patch | remove
    await handleMulti(context, ability, modelName, availableFields, options);
  } else if (method === "create") {
    // create: single | multi
    checkCreatePerItem(context, ability, modelName, { 
      actionOnForbidden: options.actionOnForbidden, 
      checkCreateForData: true 
    });
  }

  return context;
};

const handleSingle = async (
  context: HookContext,
  ability: AnyAbility,
  modelName: string,
  availableFields: string[] | undefined,
  options: AuthorizeHookOptions
): Promise<HookContext> => {
  // single: get | patch | update | remove

  // get complete item for `throwUnlessCan`-check to be trustworthy
  // -> initial 'get' and 'remove' have no data at all
  // -> initial 'patch' maybe has just partial data
  // -> initial 'update' maybe has completely changed data, for what the check could pass but not for initial data
  const { params, method, service, id } = context;

  const query = mergeQueryFromAbility(
    context.app,
    ability,
    method,
    modelName,
    context.params?.query,
    context.service,
    options
  );

  _set(context, "params.query", query);

  // ensure that only allowed data gets changed
  if (["update", "patch"].includes(method)) {
    const queryGet = Object.assign({}, params.query || {});
    if (queryGet.$select) {
      delete queryGet.$select;
    }
    const paramsGet = Object.assign({}, params, { query: queryGet });

    // TODO: If not allowed to .get() and to .[method](), then throw "NotFound" (maybe optional)

    const getMethod = (service._get) ? "_get" : "get";

    const item = await service[getMethod](id, paramsGet);
  
    const restrictingFields = hasRestrictingFields(ability, method, subject(modelName, item), { availableFields });
    if (restrictingFields && (restrictingFields === true || restrictingFields.length === 0)) {
      if (options.actionOnForbidden) { options.actionOnForbidden(); }
      throw new Forbidden("You're not allowed to make this request");
    }
        
    const data = (!restrictingFields) ? context.data : _pick(context.data, restrictingFields as string[]);

    checkData(context, ability, modelName, data, options);

    if (!restrictingFields) { return context; }

    // if fields are not overlapping -> throw
    if (_isEmpty(data)) {
      if (options.actionOnForbidden) { options.actionOnForbidden(); }
      throw new Forbidden("You're not allowed to make this request");
    }

    //TODO: if some fields not match -> `actionOnForbiddenUpdate`

    if (method === "patch") {
      context.data = data;
    } else {
      // merge with initial data
      const itemPlain = await service._get(id, {});
      context.data = Object.assign({}, itemPlain, data);
    }
  }

  return context;
};

const checkData = (
  context: HookContext,
  ability: AnyAbility,
  modelName: string,
  data: Record<string, unknown>,
  options: Pick<AuthorizeHookOptions, "actionOnForbidden" | "usePatchData" | "useUpdateData">
): void => {
  if (
    (context.method === "patch" && !options.usePatchData) ||
    (context.method === "update" && !options.useUpdateData)
  ) { return; }
  throwUnlessCan(
    ability,
    `${context.method}-data`,
    subject(modelName, data),
    modelName,
    options
  );
};

const handleMulti = async (
  context: HookContext,
  ability: AnyAbility,
  modelName: string,
  availableFields: string[] | undefined,
  options: AuthorizeHookOptions
): Promise<HookContext> => {
  const { method } = context;
  // multi: find | patch | remove

  if (method === "patch") {
    const fields = hasRestrictingFields(ability, method, modelName, { availableFields });
    if (fields === true) {
      if (options.actionOnForbidden) { options.actionOnForbidden(); }
      throw new Forbidden("You're not allowed to make this request");
    }
    if (fields && fields.length > 0) {
      const data = _pick(context.data, fields);
      context.data = data;
    }
  }
  
  const query = mergeQueryFromAbility(
    context.app,
    ability,
    method,
    modelName,
    context.params?.query,
    context.service,
    options
  );

  _set(context, "params.query", query);

  return context;
};