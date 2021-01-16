import { getItems, replaceItems } from "feathers-hooks-common";
import { subject } from "@casl/ability";
import { permittedFieldsOf } from "@casl/ability/extra";
import _pick from "lodash/pick";
import _isEmpty from "lodash/isEmpty";
import { HookContext } from "@feathersjs/feathers";

import { shouldSkip, mergeArrays } from "feathers-utils";

import {
  getPersistedConfig,
  restore$select,
  getAbility,
  makeOptions
} from "./authorize.hook.utils";

import getModelName from "../../utils/getModelName";

import {
  AuthorizeHookOptions
} from "../../types";
import { Forbidden } from "@feathersjs/errors";

const HOOKNAME = "authorize";

export default (options: AuthorizeHookOptions): ((context: HookContext) => Promise<HookContext>) => {
  return async (context: HookContext): Promise<HookContext> => {
    const $select = restore$select(context);

    if (
      shouldSkip(HOOKNAME, context) ||
      context.type !== "after" ||
      !context.params
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
      // Interne Anfrage oder nicht authentifiziert -> Ignorieren
      return context;
    }

    const { ability } = params;
    const items = getItems(context);

    const forOneEl = (item: Record<string, unknown>) => {
      if (!skipCheckConditions && !ability.can("read", subject(modelName, item))) { return undefined; }
      let fields = permittedFieldsOf(ability, "read", subject(modelName, item));
      if (skipCheckFields || (fields.length === 0 && !$select)) {
        return item;
      }

      // 
      const intersect = (fields?.length && $select?.length) 
        ? "intersect"
        : "intersectOrFull";
      fields = mergeArrays(fields, $select, intersect) as string[];
      //TODO: replace _pick with native
      return _pick(item, fields);
    };

    let result;
    if (Array.isArray(items)) {
      result = [];
      for (let i = 0, n = items.length; i < n; i++) {
        const item = forOneEl(items[i]);

        if (item) { result.push(item); }
      }

    } else {
      result = forOneEl(items);
      if (context.method === "get" && _isEmpty(result)) {
        if (options.actionOnForbidden) options.actionOnForbidden();
        throw new Forbidden(`You're not allowed to ${context.method} ${modelName}`);
      }
    }

    replaceItems(context, result);

    return context;
  };
};
