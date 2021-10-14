import { rulesToQuery } from "@casl/ability/extra";
import { mergeQuery } from "feathers-utils";
import _isEmpty from "lodash/isEmpty";
import { getAdapter } from "../hooks/authorize/authorize.hook.utils";
import convertRuleToQuery from "./convertRuleToQuery";
import hasRestrictingConditions from "./hasRestrictingConditions";
import simplifyQuery from "./simplifyQuery";

import type { AnyAbility } from "@casl/ability";
import type { Application, Query, Service } from "@feathersjs/feathers";
import type { AuthorizeHookOptions } from "../types";

const adaptersFor$not = [
  "feathers-nedb"
];

const adaptersFor$notAsArray = [
  "feathers-sequelize",
  "feathers-objection"
];
  
const adaptersFor$nor = [
  "feathers-memory",
  "feathers-mongoose",
  "feathers-mongodb"
];

export default function mergeQueryFromAbility<T>(
  app: Application,
  ability: AnyAbility,
  method: string,
  modelName: string,
  originalQuery: Query,
  service: Service<T>,
  options: Pick<AuthorizeHookOptions, "adapter">
): Query {
  if (hasRestrictingConditions(ability, method, modelName)) {
    const adapter = getAdapter(app, options);
  
    let query: Query;
    if (adaptersFor$not.includes(adapter)) {
      // nedb
      query = rulesToQuery(ability, method, modelName, (rule) => {
        const { conditions } = rule;
        return (rule.inverted) ? { $not: conditions } : conditions;
      });
      query = simplifyQuery(query);
    } else if (adaptersFor$notAsArray.includes(adapter)) {
      // objection, sequelize
      query = rulesToQuery(ability, method, modelName, (rule) => {
        const { conditions } = rule;
        return (rule.inverted) ? { $not: [conditions] } : conditions;
      });
      query = simplifyQuery(query);
    } else if (adaptersFor$nor.includes(adapter)) {
      // memory, mongoose, mongodb
      query = rulesToQuery(ability, method, modelName, (rule) => {
        const { conditions } = rule;
        return (rule.inverted) ? { $nor: [conditions] } : conditions;
      });
      query = simplifyQuery(query);
    } else {
      query = rulesToQuery(ability, method, modelName, (rule) => {
        const { conditions } = rule;
        return (rule.inverted) ? convertRuleToQuery(rule) : conditions;
      });
      query = simplifyQuery(query);
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

    if (_isEmpty(query)) {
      return originalQuery;
    }
  
    if (!originalQuery) {
      return query;
    } else {
      const operators = service.options?.whitelist;
      return mergeQuery(
        originalQuery, 
        query, { 
          defaultHandle: "intersect",
          operators,
          useLogicalConjunction: true
        }
      );
    }
  } else {
    return originalQuery;
  }
}