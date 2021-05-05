import { Forbidden } from "@feathersjs/errors";
import _isEmpty from "lodash/isEmpty";
import _pick from "lodash/pick";
import _isEqual from "lodash/isEqual";
import { AnyAbility, subject } from "@casl/ability";

import {
  mergeQuery,
  shouldSkip,
  pushSet,
  isMulti
} from "feathers-utils";

import hasRestrictingFields from "../../utils/hasRestrictingFields";
import hasRestrictingConditions from "../../utils/hasRestrictingConditions";
import couldHaveRestrictingFields from "../../utils/couldHaveRestrictingFields";
import { convertRuleToQuery } from "../../utils/getConditionalQueryFor";

import {
  setPersistedConfig,
  getAbility,
  throwUnlessCan,
  getPersistedConfig,
  handleConditionalSelect,
  getAdapter
} from "./authorize.hook.utils";

import {
  HookContext
} from "@feathersjs/feathers";

import {
  AuthorizeHookOptions, HookBaseOptions
} from "../../types";
import { rulesToQuery } from "@casl/ability/extra";
import checkBasicPermission from "../checkBasicPermission.hook";
import getAvailableFields from "../../utils/getAvailableFields";
import { checkCreatePerItem } from "../common";

const HOOKNAME = "authorize";

export default (options: AuthorizeHookOptions): ((context: HookContext) => Promise<HookContext>) => {
  return async (context: HookContext): Promise<HookContext> => {
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
    
    // if context is with multiple items, there's a change that we need to handle each item separately
    if (isMulti(context)) {
      handleConditionalSelect(context, ability, "find", modelName);
      
      if (!hasRestrictingConditions(ability, "find", modelName)) {
        setPersistedConfig(context, "skipRestrictingRead.conditions", true);
      }

      // if has no restricting fields at all -> can skip _pick() in after-hook
      if (!couldHaveRestrictingFields(ability, "find", modelName)) {
        setPersistedConfig(context, "skipRestrictingRead.fields", true);
      }
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
};

const handleSingle = async (
  context: HookContext,
  ability: AnyAbility,
  modelName: string,
  availableFields: string[] | undefined,
  options: AuthorizeHookOptions
): Promise<HookContext> => {
  const { params, method, service, id } = context;
  // single: get | patch | update | remove

  // get complete item for `throwUnlessCan`-check to be trustworthy
  // -> initial 'get' and 'remove' have no data at all
  // -> initial 'patch' maybe has just partial data
  // -> initial 'update' maybe has completely changed data, for what the check could pass but not for initial data
  const queryGet = Object.assign({}, params.query || {});
  delete queryGet.$select;
  const paramsGet = Object.assign({}, params, { query: queryGet });
  paramsGet.skipHooks = (params.skipHooks?.slice()) || [];
  pushSet(paramsGet, "skipHooks", `${HOOKNAME}`, { unique: true });

  const item = await service.get(id, paramsGet);

  throwUnlessCan(
    ability,
    method,
    subject(modelName, item),
    modelName,
    options
  );

  if (method === "get") {
    context.result = item;
    //pushSet(context, "params.skipHooks", "after");
    return context;
  }

  // ensure that only allowed data gets changed
  if (["update", "patch"].includes(method)) {
    const fields = hasRestrictingFields(ability, method, subject(modelName, item), { availableFields });
    if (!fields) { return context; }
    if (fields === true || fields.length === 0) {
      if (options.actionOnForbidden) { options.actionOnForbidden(); }
      throw new Forbidden("You're not allowed to make this request");
    }
        
    const data = _pick(context.data, fields);

    // if fields are not overlapping -> throw
    if (_isEmpty(data)) {
      if (options.actionOnForbidden) { options.actionOnForbidden(); }
      throw new Forbidden("You're not allowed to make this request");
    }

    checkData(context, ability, modelName, data, options);

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

const checkData = async (
  context: HookContext,
  ability: AnyAbility,
  modelName: string,
  data: Record<string, unknown>,
  options: Pick<HookBaseOptions, "actionOnForbidden">
) => {
  if (!["patch", "update"].includes(context.method)) { return; }
  const rules = ability.rulesFor(`${context.method}-data`, modelName);
  rules.forEach(rule => {
    if (!rule.conditions) { return; }
    for (const key in rule.conditions) {
      const { inverted } = rule;
      if (_isEqual(data[key], rule.conditions[key]) === !inverted) {
        options.actionOnForbidden();
        throw new Forbidden("You're not allowed to make this request"); 
      }
    }
  });
};

const handleMulti = async (
  context: HookContext,
  ability: AnyAbility,
  modelName: string,
  availableFields: string[] | undefined,
  options: AuthorizeHookOptions
): Promise<HookContext> => {
  const { method, service } = context;
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
      
  if (hasRestrictingConditions(ability, method, modelName)) {
    // TODO: if query and context.params.query differ -> separate calls

    const adapter = getAdapter(context, options);

    let query;
    if (
      [
        "feathers-memory",
        "feathers-nedb",
        "feathers-objection", 
        "feathers-sequelize"
      ]
        .includes(adapter)
    ) {
      query = rulesToQuery(ability, method, modelName, (rule) => {
        const { conditions } = rule;
        return (rule.inverted) ? { $not: conditions } : conditions;
      });
    } else if (
      ["feathers-mongoose"]
        .includes(adapter)
    ) {
      query = rulesToQuery(ability, method, modelName, (rule) => {
        const { conditions } = rule;
        return (rule.inverted) ? { $nor: [conditions] } : conditions;
      });
    } else {
      query = rulesToQuery(ability, method, modelName, (rule) => {
        const { conditions } = rule;
        return (rule.inverted) ? convertRuleToQuery(rule) : conditions;
      });
      if (query.$and) {
        const { $and } = query;
        delete query.$and;
        $and.forEach(q => {
          query = mergeQuery(query, q, {
            defaultHandle: "intersect",
            operators: service.operators,
            useLogicalConjunction: true
          });
        });
      }
    }

    if (!_isEmpty(query)) {
      if (!context.params.query) {
        context.params.query = query;
      } else {
        const operators = service.options?.whitelist;
        context.params.query = mergeQuery(
          context.params.query, 
          query, { 
            defaultHandle: "intersect",
            operators,
            useLogicalConjunction: true
          }
        );
      }
    }
  }

  return context;
};
