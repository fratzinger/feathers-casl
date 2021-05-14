import { getItems, replaceItems } from "feathers-hooks-common";
import { subject } from "@casl/ability";
import _pick from "lodash/pick";
import _isEmpty from "lodash/isEmpty";
import { HookContext } from "@feathersjs/feathers";
import hasRestrictingFields from "../../utils/hasRestrictingFields";

import { shouldSkip, mergeArrays } from "feathers-utils";

import {
  getPersistedConfig,
  restore$select,
  getAbility,
  makeOptions
} from "./authorize.hook.utils";

import getModelName from "../../utils/getModelName";

import {
  AuthorizeHookOptions, HasRestrictingFieldsOptions
} from "../../types";
import { Forbidden } from "@feathersjs/errors";
import getAvailableFields from "../../utils/getAvailableFields";

const HOOKNAME = "authorize";

export default (options: AuthorizeHookOptions): ((context: HookContext) => Promise<HookContext>) => {
  return async (context: HookContext): Promise<HookContext> => {
    const $select = restore$select(context);

    if (
      !options?.notSkippable && (
        shouldSkip(HOOKNAME, context) ||
        context.type !== "after" ||
        !context.params
      )
    ) { return context; }

    options = makeOptions(context.app, options);

    const modelName = getModelName(options.modelName, context);
    if (!modelName) { return context; }

    const skipCheckConditions = getPersistedConfig(context, "skipRestrictingRead.conditions");
    const skipCheckFields = getPersistedConfig(context, "skipRestrictingRead.fields");

    if (skipCheckConditions && skipCheckFields) {
      return context;
    }

    const { params } = context;

    params.ability = await getAbility(context, options);
    if (!params.ability) {
      // Ignore internal or not authenticated requests
      return context;
    }

    const { ability } = params;
    const items = getItems(context);

    const availableFields = getAvailableFields(context, options);
        
    const hasRestrictingFieldsOptions: HasRestrictingFieldsOptions = {
      availableFields: availableFields
    };

    const pickFieldsForItem = (item: Record<string, unknown>) => {
      const method = (Array.isArray(items)) ? "find" : "get";
      if (!skipCheckConditions && !ability.can(method, subject(modelName, item))) { 
        return undefined; 
      }
      
      let fields = hasRestrictingFields(ability, method, subject(modelName, item), hasRestrictingFieldsOptions);

      if (fields === true) {
        // full restriction
        return {};
      } else if (skipCheckFields || (!fields && !$select)) {
        // no restrictions
        return item;
      } else if (fields && $select) {
        fields = mergeArrays(fields, $select, "intersect") as string[];
      } else {
        fields = (fields) ? fields : $select;
      }

      return _pick(item, fields);
    };

    let result;
    if (Array.isArray(items)) {
      result = [];
      for (let i = 0, n = items.length; i < n; i++) {
        const item = pickFieldsForItem(items[i]);

        if (item) { result.push(item); }
      }

    } else {
      result = pickFieldsForItem(items);
      if (context.method === "get" && _isEmpty(result)) {
        if (options.actionOnForbidden) options.actionOnForbidden();
        throw new Forbidden(`You're not allowed to ${context.method} ${modelName}`);
      }
    }

    replaceItems(context, result);

    return context;
  };
};
