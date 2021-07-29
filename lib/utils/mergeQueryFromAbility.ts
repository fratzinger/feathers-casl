import { AnyAbility } from "@casl/ability";
import { rulesToQuery } from "@casl/ability/extra";
import { Application, Query, Service } from "@feathersjs/feathers";
import { mergeQuery } from "feathers-utils/dist";
import _isEmpty from "lodash/isEmpty";
import { getAdapter } from "../hooks/authorize/authorize.hook.utils";
import { AuthorizeHookOptions } from "../types";
import convertRuleToQuery from "./convertRuleToQuery";
import hasRestrictingConditions from "./hasRestrictingConditions";

const adaptersFor$not = [
  "feathers-memory",
  "feathers-nedb",
  "feathers-objection", 
  "feathers-sequelize"
];
  
const adaptersFor$nor = ["feathers-mongoose"];

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
  
    let query;
    if (adaptersFor$not.includes(adapter)) {
      query = rulesToQuery(ability, method, modelName, (rule) => {
        const { conditions } = rule;
        return (rule.inverted) ? { $not: conditions } : conditions;
      });
    } else if (adaptersFor$nor.includes(adapter)) {
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
            operators: service.operators,
            useLogicalConjunction: true
          });
        });
      }
    }
  
    if (!_isEmpty(query)) {
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
    }
  } else {
    return originalQuery;
  }
}