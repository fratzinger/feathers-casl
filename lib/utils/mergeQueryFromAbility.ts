import { rulesToQuery } from "@casl/ability/extra";
import { mergeQuery } from "feathers-utils";
import _isEmpty from "lodash/isEmpty.js";
import { getAdapter } from "../hooks/authorize/authorize.hook.utils";
import { convertRuleToQuery } from "./convertRuleToQuery";
import { hasRestrictingConditions } from "./hasRestrictingConditions";
import { simplifyQuery } from "./simplifyQuery";

import type { AnyAbility } from "@casl/ability";
import type { Application, Query } from "@feathersjs/feathers";
import type { AdapterBase } from "@feathersjs/adapter-commons";
import type { Adapter, AuthorizeHookOptions } from "../types";

// const adaptersFor$not: Adapter[] = ["feathers-nedb"];
const adaptersFor$not: Adapter[] = [];

const adaptersFor$notAsArray: Adapter[] = [
  "feathers-sequelize",
  // "feathers-objection",
];

const adaptersFor$nor: Adapter[] = [
  "@feathersjs/memory",
  // "feathers-mongoose",
  "@feathersjs/mongodb",
];

export const mergeQueryFromAbility = <T>(
  app: Application,
  ability: AnyAbility,
  method: string,
  modelName: string,
  originalQuery: Query,
  service: AdapterBase<T>,
  options: Pick<AuthorizeHookOptions, "adapter">
): Query => {
  if (hasRestrictingConditions(ability, method, modelName)) {
    const adapter = getAdapter(app, options);

    let query: Query;
    if (adaptersFor$not.includes(adapter)) {
      // nedb
      query = rulesToQuery(ability, method, modelName, (rule) => {
        const { conditions } = rule;
        return rule.inverted ? { $not: conditions } : conditions;
      });
      query = simplifyQuery(query);
    } else if (adaptersFor$notAsArray.includes(adapter)) {
      // objection, sequelize
      query = rulesToQuery(ability, method, modelName, (rule) => {
        const { conditions } = rule;
        return rule.inverted ? { $not: [conditions] } : conditions;
      });
      query = simplifyQuery(query);
    } else if (adaptersFor$nor.includes(adapter)) {
      // memory, mongoose, mongodb
      query = rulesToQuery(ability, method, modelName, (rule) => {
        const { conditions } = rule;
        return rule.inverted ? { $nor: [conditions] } : conditions;
      });
      query = simplifyQuery(query);
    } else {
      query = rulesToQuery(ability, method, modelName, (rule) => {
        const { conditions } = rule;
        return rule.inverted ? convertRuleToQuery(rule) : conditions;
      });
      query = simplifyQuery(query);
      if (query.$and) {
        const { $and } = query;
        delete query.$and;
        $and.forEach((q) => {
          query = mergeQuery(query, q, {
            defaultHandle: "intersect",
            operators: service.options?.operators,
            filters: service.options?.filters,
            useLogicalConjunction: true,
          });
        });
      }
    }

    if (_isEmpty(query)) {
      return originalQuery;
    }

    if (!originalQuery) {
      return query;
    } else {
      return mergeQuery(originalQuery, query, {
        defaultHandle: "intersect",
        operators: service.options?.operators,
        filters: service.options?.filters,
        useLogicalConjunction: true,
      });
    }
  } else {
    return originalQuery;
  }
};
