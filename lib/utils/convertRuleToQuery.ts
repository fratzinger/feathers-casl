import _isPlainObject from "lodash/isPlainObject";

import type { SubjectRawRule, MongoQuery, ClaimRawRule } from "@casl/ability";
import type { Query } from "@feathersjs/feathers";
import type { GetConditionalQueryOptions } from "../types";
import type { AnyObject } from "@casl/ability/dist/types/types";

const invertedMap = {
  "$gt": "$lte",
  "$gte": "$lt",
  "$lt": "$gte",
  "$lte": "$gt",
  "$in": "$nin",
  "$nin": "$in",
  "$ne": (prop: Record<string, unknown>): unknown => {
    return prop["$ne"];
  }
};

const supportedOperators = Object.keys(invertedMap);

const invertedProp = (
  prop: Record<string, unknown>, 
  name: string): Record<string, unknown>|string => 
{
  const map = invertedMap[name];
  if (typeof map === "string") {
    return { [map]: prop[name] };
  } else if(typeof map === "function") {
    return map(prop);
  }
};

const convertRuleToQuery = (
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  rule: SubjectRawRule<any, any, MongoQuery<AnyObject>> | ClaimRawRule<any>, 
  options?: GetConditionalQueryOptions): Query => 
{
  const { conditions, inverted } = rule;
  if (!conditions) {
    if (inverted && options?.actionOnForbidden) {
      options.actionOnForbidden();
    }
    return undefined;
  }
  if (inverted) {
    const newConditions = {} as Query;
    for (const prop in (conditions as Record<string, unknown>)) {
      if (_isPlainObject(conditions[prop])) {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const obj: any = conditions[prop];
        for (const name in obj) {
          if (!supportedOperators.includes(name)) {
            console.error(`CASL: not supported property: ${name}`);
            continue;
          }
          newConditions[prop] = invertedProp(obj, name);
        }
      } else {
        newConditions[prop] = { $ne: conditions[prop] };
      }
    }

    return newConditions;
  } else {
    return conditions as Query;
  }
};

export default convertRuleToQuery;
