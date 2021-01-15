import { getItems, replaceItems } from "feathers-hooks-common";
import { permittedFieldsOf } from "@casl/ability/extra";
import _pick from "lodash/pick";

import { shouldSkip, mergeArrays } from "feathers-utils";

import subjectHelper from "../../utils/subjectHelper";

import {
  getPersistedConfig,
  restore$select,
  getAbility,
  makeOptions
} from "./authorize.hook.utils";

import {
  AuthorizeHookOptions
} from "../../types";
import { HookContext } from "@feathersjs/feathers";

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

    const modelName = options.getModelName(context);
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
      if (!skipCheckConditions && !ability.can("read", subjectHelper(modelName, item, context))) { return undefined; }
      let fields = permittedFieldsOf(ability, "read", subjectHelper(modelName, item, context));
      if (skipCheckFields || (fields.length === 0 && !$select)) {
        return item;
      }
      fields = mergeArrays(fields, $select, "intersectOrFull") as string[];
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
    }

    replaceItems(context, result);

    return context;
  };
};
