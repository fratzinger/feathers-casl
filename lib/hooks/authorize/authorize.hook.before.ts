import { Forbidden } from "@feathersjs/errors";
import _isEmpty from "lodash/isEmpty";
import _pick from "lodash/pick";

import {
  mergeQuery,
  shouldSkip,
  pushSet,
  isMulti
} from "feathers-utils";

import getQueryFor from "../../utils/getQueryFor";
import hasRestrictingFields from "../../utils/hasRestrictingFields";
import hasRestrictingConditions from "../../utils/hasRestrictingConditions";
import subjectHelper from "../../utils/subjectHelper";

import {
  makeOptions,
  hide$select,
  setPersistedConfig,
  checkMulti,
  getAbility,
  throwUnlessCan
} from "./authorize.hook.utils";

import {
  HookContext
} from "@feathersjs/feathers";

import {
  AuthorizeHookOptions,
  GetQueryOptions
} from "../../types";

const HOOKNAME = "authorize";

export default (options: AuthorizeHookOptions): ((context: HookContext) => Promise<HookContext>) => {
  return async (context: HookContext): Promise<HookContext> => {
    //TODO: make as isomorphic hook -> for vue-client
    if (
      shouldSkip(HOOKNAME, context) ||
      context.type !== "before" ||
      !context.params
    ) { return context; }
    const { service, method, id, params } = context;

    options = makeOptions(context.app, options);

    const modelName = options.getModelName(context);
    if (!modelName) { return context; }

    const ability = await getAbility(context, options);
    if (!ability) {
      // Interne Anfrage oder nicht authentifiziert -> Ignorieren
      return context;
    }

    if (options.checkMultiActions) {
      checkMulti(context, ability, modelName);
    }

    throwUnlessCan(ability, method, modelName, modelName);

    // if context is with multiple items, there's a change that we need to handle each iteam seperately
    if (isMulti(context)) {
      // if has conditions -> hide $select for after-hook, because
      if (hasRestrictingConditions(ability, "read", modelName)) {
        hide$select(context);
      } else {
        setPersistedConfig(context, "skipRestrictingRead.conditions", true);
      }

      // if has no restricting fields at all -> can skip _pick() in after-hook
      if (!hasRestrictingFields(ability, "read", modelName)) {
        setPersistedConfig(context, "skipRestrictingRead.fields", true);
      }
    }

    if (["get", "patch", "update", "remove"].includes(method) && id != null) {
      // single: get | patch | update | remove

      // get complete item for `throwUnlessCan`-check to be trustworthy
      // -> initial 'get' and 'remove' have no data at all
      // -> initial 'patch' maybe has just partial data
      // -> initial 'update' maybe has completely changed data, for what the check could pass but not for inital data
      const queryGet = Object.assign({}, params.query || {});
      delete queryGet.$select;
      const paramsGet = Object.assign({}, params, { query: queryGet });
      paramsGet.skipHooks = (params.skipHooks && params.skipHooks.slice()) || [];
      pushSet(paramsGet, "skipHooks", `${HOOKNAME}`, { unique: true });

      const item = await service.get(id, paramsGet);

      throwUnlessCan(ability, method, subjectHelper(modelName, item, context), modelName);
      if (method === "get") {
        context.result = item;
        //pushSet(context, "params.skipHooks", "after");
        return context;
      }

      // ensure that only allowed data gets changed
      if (["update", "patch"].includes(method)) {
        const fields = hasRestrictingFields(ability, method, subjectHelper(modelName, item, context));
        if (!fields) { return context; }

        const data = _pick(context.data, fields);

        // if fields are not overlapping -> throw
        if (_isEmpty(data)) {
          throw new Forbidden("You're not allowed to make this request");
        }

        //TODO: if some fields not match -> `actionOnForbiddenUpdate`

        if (method === "patch") {
          context.data = data;
        } else {
          // merge with inital data
          const itemPlain = await service._get(id);
          context.data = Object.assign({}, itemPlain, data);
        }
      }

      return context;
    } else if (method === "find" || (["patch", "remove"].includes(method) && id == null)) {
      // multi: find | patch | remove
      if (hasRestrictingConditions(ability, method, modelName)) {
        // TODO: if query and context.params.query differ -> seperate calls
        const options: GetQueryOptions = {
          skipFields: method === "find"
        };
        const query = getQueryFor(ability, method, modelName, options);

        if (!_isEmpty(query)) {
          if (!context.params.query) {
            context.params.query = query;
          } else {
            context.params.query = mergeQuery(context.params.query, query, { defaultHandle: "intersect" });
          }
        }
      }

      return context;
    } else if (method === "create") {
      // create: single | multi
      // we have all information we need (maybe we need populated data?)
      const data = (Array.isArray(context.data)) ? context.data : [context.data];
      for (let i = 0; i < data.length; i++) {
        throwUnlessCan(ability, method, subjectHelper(modelName, data[i], context), modelName);
      }
      return context;
    }

    return context;
  };
};
