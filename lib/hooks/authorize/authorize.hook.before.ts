import { Forbidden } from "@feathersjs/errors";
import _isEmpty from "lodash/isEmpty";
import _pick from "lodash/pick";
import { subject } from "@casl/ability";

import {
  mergeQuery,
  shouldSkip,
  pushSet,
  isMulti
} from "feathers-utils";

import getModelName from "../../utils/getModelName";
import getQueryFor from "../../utils/getQueryFor";
import hasRestrictingFields from "../../utils/hasRestrictingFields";
import hasRestrictingConditions from "../../utils/hasRestrictingConditions";
import couldHaveRestrictingFields from "../../utils/couldHaveRestrictingFields";

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
  GetQueryOptions,
  HasRestrictingFieldsOptions
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

    const modelName = getModelName(options.modelName, context);
    if (!modelName) { return context; }

    const ability = await getAbility(context, options);
    if (!ability) {
      // Ignore internal or not authenticated requests
      return context;
    }

    if (options.checkMultiActions) {
      checkMulti(context, ability, modelName, options.actionOnForbidden);
    }

    throwUnlessCan(
      ability,
      method,
      modelName,
      modelName,
      options.actionOnForbidden
    );

    const availableFields = (!options?.availableFields)
      ? undefined
      : (typeof options.availableFields === "function")
        ? options.availableFields(context)
        : options.availableFields;
    const hasRestrictingFieldsOptions: HasRestrictingFieldsOptions = {
      availableFields: availableFields,
      throwIfFieldsAreEmpty: options.throwIfFieldsAreEmpty
    };

    const readFieldsOptions: HasRestrictingFieldsOptions = {
      availableFields: availableFields,
      throwIfFieldsAreEmpty: false
    };

    // if context is with multiple items, there's a change that we need to handle each item separately
    if (isMulti(context)) {
      // if has conditions -> hide $select for after-hook, because
      if (hasRestrictingConditions(ability, "read", modelName)) {
        hide$select(context);
      } else {
        setPersistedConfig(context, "skipRestrictingRead.conditions", true);
      }

      // if has no restricting fields at all -> can skip _pick() in after-hook
      if (!couldHaveRestrictingFields(ability, "read", modelName)) {
        setPersistedConfig(context, "skipRestrictingRead.fields", true);
      }
    }

    if (["get", "patch", "update", "remove"].includes(method) && id != null) {
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
        options.actionOnForbidden
      );

      if (method === "get") {
        context.result = item;
        //pushSet(context, "params.skipHooks", "after");
        return context;
      }

      // ensure that only allowed data gets changed
      if (["update", "patch"].includes(method)) {
        const fields = hasRestrictingFields(ability, method, subject(modelName, item), hasRestrictingFieldsOptions);
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

        //TODO: if some fields not match -> `actionOnForbiddenUpdate`

        if (method === "patch") {
          context.data = data;
        } else {
          // merge with initial data
          const itemPlain = await service._get(id);
          context.data = Object.assign({}, itemPlain, data);
        }
      }

      return context;
    } else if (method === "find" || (["patch", "remove"].includes(method) && id == null)) {
      // multi: find | patch | remove
      if (hasRestrictingConditions(ability, method, modelName)) {
        // TODO: if query and context.params.query differ -> separate calls
        
        const getQueryOptions: GetQueryOptions = {
          skipFields: method === "find",
          availableFields,
          throwIfFieldsAreEmpty: true
        };
        const query = getQueryFor(ability, method, modelName, getQueryOptions);

        if (!_isEmpty(query)) {
          if (!context.params.query) {
            context.params.query = query;
          } else {
            context.params.query = mergeQuery(
              context.params.query, 
              query, { 
                defaultHandle: "intersect",
                service
              });
          }
        }
      }

      return context;
    } else if (method === "create") {
      // create: single | multi
      // we have all information we need (maybe we need populated data?)
      const data = (Array.isArray(context.data)) ? context.data : [context.data];
      for (let i = 0; i < data.length; i++) {
        throwUnlessCan(
          ability,
          method,
          subject(modelName, data[i]),
          modelName,
          options.actionOnForbidden
        );
      }
      return context;
    }

    return context;
  };
};
