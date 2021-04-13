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

import hasRestrictingFields from "../../utils/hasRestrictingFields";
import hasRestrictingConditions from "../../utils/hasRestrictingConditions";
import couldHaveRestrictingFields from "../../utils/couldHaveRestrictingFields";
import { convertRuleToQuery } from "../../utils/getConditionalQueryFor";

import {
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
  HasRestrictingFieldsOptions
} from "../../types";
import { rulesToQuery } from "@casl/ability/extra";

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

    if (options.checkMultiActions) {
      checkMulti(context, ability, modelName, options);
    }

    throwUnlessCan(
      ability,
      method,
      modelName,
      modelName,
      options.actionOnForbidden
    );
    
    // if context is with multiple items, there's a change that we need to handle each item separately
    if (isMulti(context)) {
      // if has conditions -> hide $select for after-hook, because
      if (hasRestrictingConditions(ability, "find", modelName)) {
        hide$select(context);
      } else {
        setPersistedConfig(context, "skipRestrictingRead.conditions", true);
      }

      // if has no restricting fields at all -> can skip _pick() in after-hook
      if (!couldHaveRestrictingFields(ability, "find", modelName)) {
        setPersistedConfig(context, "skipRestrictingRead.fields", true);
      }
    }

    const availableFields = (!options?.availableFields)
      ? undefined
      : (typeof options.availableFields === "function")
        ? options.availableFields(context)
        : options.availableFields;

    const hasRestrictingFieldsOptions: HasRestrictingFieldsOptions = {
      availableFields: availableFields
    };

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
          const itemPlain = await service._get(id, {});
          context.data = Object.assign({}, itemPlain, data);
        }
      }

      return context;
    } else if (method === "find" || (["patch", "remove"].includes(method) && id == null)) {
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

        let query;
        if (
          [
            "feathers-memory",
            "feathers-nedb",
            "feathers-objection", 
            "feathers-sequelize"
          ]
            .includes(options.adapter)
        ) {
          query = rulesToQuery(ability, method, modelName, (rule) => {
            const { conditions } = rule;
            return (rule.inverted) ? { $not: conditions } : conditions;
          });
        } else if (
          ["feathers-mongoose"]
            .includes(options.adapter)
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
                operators: service.operators
              });
            });
          }
        }

        if (
          query?.$or?.length === 1 && 
          Object.keys(query).length === 1 &&
          _isEmpty(query.$or[0])
        ) {
          query = {};
        }

        if (!_isEmpty(query)) {
          if (!context.params.query) {
            context.params.query = query;
          } else {
            const oldQuery = Object.assign({}, context.params.query);
            if (
              query?.$or && 
              context.params?.query?.$or
            ) {
              const or1 = query?.$or;
              const or2 = oldQuery.$or;
              delete query.$or;
              delete oldQuery.$or;
              query.$and = query.$and || [];
              query.$and.push(
                { $or: or1 },
                { $or: or2 }
              );
            }

            if (
              query.$and &&
              oldQuery.$and
            ) {
              query.$and.push(...oldQuery.$and);
              delete oldQuery.$and;
            }

            context.params.query = Object.assign(
              {},
              oldQuery,
              query
            );
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
