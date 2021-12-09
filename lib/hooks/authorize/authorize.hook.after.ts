import { getItems, replaceItems } from "feathers-hooks-common";
import { subject } from "@casl/ability";
import _pick from "lodash/pick";
import _isEmpty from "lodash/isEmpty";

import { shouldSkip, mergeArrays } from "feathers-utils";

import {
  getPersistedConfig,
  getAbility,
  makeOptions,
  getConditionalSelect,
  refetchItems
} from "./authorize.hook.utils";

import hasRestrictingFields from "../../utils/hasRestrictingFields";

import getModelName from "../../utils/getModelName";

import { Forbidden } from "@feathersjs/errors";
import getAvailableFields from "../../utils/getAvailableFields";

import type { HookContext } from "@feathersjs/feathers";
import type {
  AuthorizeHookOptions, 
  HasRestrictingFieldsOptions
} from "../../types";

const HOOKNAME = "authorize";

export default async (
  context: HookContext,
  options: AuthorizeHookOptions
): Promise<HookContext> => {
  if (
    !options?.notSkippable && (
      shouldSkip(HOOKNAME, context) ||
        context.type !== "after" ||
        !context.params
    )
  ) { return context; }

  const itemOrItems = getItems(context);
  if (!itemOrItems) { return context; }

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
    
  const asArray = Array.isArray(itemOrItems);
  let items = (asArray) ? itemOrItems : [itemOrItems];

  const availableFields = getAvailableFields(context, options);
        
  const hasRestrictingFieldsOptions: HasRestrictingFieldsOptions = {
    availableFields: availableFields
  };

  const getOrFind = (asArray) ? "find" : "get";

  const $select: string[] | undefined = params.query?.$select;

  if (context.method !== "remove") {
    const $newSelect = getConditionalSelect($select, ability, getOrFind, modelName);
    if ($newSelect) {
      const _items = await refetchItems(context);
      if (_items) { items = _items; }
    }
  }

  const pickFieldsForItem = (item: Record<string, unknown>) => {
    const method = (Array.isArray(itemOrItems)) ? "find" : "get";
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
  if (asArray) {
    result = [];
    for (let i = 0, n = items.length; i < n; i++) {
      const item = pickFieldsForItem(items[i]);

      if (item) { result.push(item); }
    }

  } else {
    result = pickFieldsForItem(items[0]);
    if (context.method === "get" && _isEmpty(result)) {
      if (options.actionOnForbidden) options.actionOnForbidden();
      throw new Forbidden(`You're not allowed to ${context.method} ${modelName}`);
    }
  }

  replaceItems(context, result);

  return context;
};
