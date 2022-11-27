import { replaceItems } from "feathers-hooks-common";
import { subject } from "@casl/ability";
import _pick from "lodash/pick.js";
import _isEmpty from "lodash/isEmpty.js";

import { shouldSkip, mergeArrays, getItemsIsArray } from "feathers-utils";

import {
  getPersistedConfig,
  getAbility,
  makeOptions,
  getConditionalSelect,
  refetchItems,
  HOOKNAME,
} from "./authorize.hook.utils";

import {
  getAvailableFields,
  hasRestrictingFields,
  getModelName,
} from "../../utils";

import { Forbidden } from "@feathersjs/errors";

import type { HookContext } from "@feathersjs/feathers";
import type {
  AuthorizeHookOptions,
  HasRestrictingFieldsOptions,
} from "../../types";

export const authorizeAfter = async <H extends HookContext = HookContext>(
  context: H,
  options: AuthorizeHookOptions
) => {
  if (shouldSkip(HOOKNAME, context, options) || !context.params) {
    context.type === null && console.log(context.type);
    return context;
  }

  // eslint-disable-next-line prefer-const
  let { isArray, items } = getItemsIsArray(context);
  if (!items.length) {
    context.type === null && console.log(context.type, "no items");
    return context;
  }

  options = makeOptions(context.app, options);

  const modelName = getModelName(options.modelName, context);
  if (!modelName) {
    context.type === null && console.log(context.type, "No model name found");
    return context;
  }

  const skipCheckConditions = getPersistedConfig(
    context,
    "skipRestrictingRead.conditions"
  );
  const skipCheckFields = getPersistedConfig(
    context,
    "skipRestrictingRead.fields"
  );

  if (skipCheckConditions && skipCheckFields) {
    return context;
  }

  const { params } = context;

  params.ability = await getAbility(context, options);
  if (!params.ability) {
    context.type === null && console.log(context.type, "no ability");
    // Ignore internal or not authenticated requests
    return context;
  }

  const { ability } = params;

  const availableFields = getAvailableFields(context, options);

  const hasRestrictingFieldsOptions: HasRestrictingFieldsOptions = {
    availableFields: availableFields,
  };

  const getOrFind = isArray ? "find" : "get";

  const $select: string[] | undefined = params.query?.$select;

  if (context.method !== "remove") {
    const $newSelect = getConditionalSelect(
      $select,
      ability,
      getOrFind,
      modelName
    );
    if ($newSelect) {
      const _items = await refetchItems(context);
      context.type === null &&
        console.log(context.type, "refetch items", _items);
      if (_items) {
        items = _items;
      }
    }
  }

  const pickFieldsForItem = (item: Record<string, unknown>) => {
    if (
      !skipCheckConditions &&
      !ability.can(getOrFind, subject(modelName, item))
    ) {
      return undefined;
    }

    let fields = hasRestrictingFields(
      ability,
      getOrFind,
      subject(modelName, item),
      hasRestrictingFieldsOptions
    );

    context.type === null &&
      console.log("pickFields", fields, skipCheckFields, $select);

    if (fields === true) {
      // full restriction
      return {};
    } else if (skipCheckFields || (!fields && !$select)) {
      // no restrictions
      return item;
    } else if (fields && $select) {
      fields = mergeArrays(fields, $select, "intersect") as string[];
      context.type === null &&
        console.log("mergedFields", fields, skipCheckFields, $select);
    } else {
      fields = fields ? fields : $select;
    }

    return _pick(item, fields);
  };

  let result;
  if (isArray) {
    result = [];
    for (let i = 0, n = items.length; i < n; i++) {
      const item = pickFieldsForItem(items[i]);

      context.type === null && console.log(item);

      if (item) {
        result.push(item);
      }
    }
  } else {
    result = pickFieldsForItem(items[0]);
    if (context.method === "get" && _isEmpty(result)) {
      if (options.actionOnForbidden) options.actionOnForbidden();
      throw new Forbidden(
        `You're not allowed to ${context.method} ${modelName}`
      );
    }
  }

  replaceItems(context, result);

  return context;
};
