import _isPlainObject from "lodash/isPlainObject";
import { Forbidden } from "@feathersjs/errors";
import { mergeQuery } from "feathers-utils";

import { AnyAbility, RawRuleFrom, AbilityTuple, Subject } from "@casl/ability";
import { Query } from "@feathersjs/feathers";

import { GetConditionalQueryOptions } from "../types";

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

export const convertRuleToQuery = (
  rule: RawRuleFrom<AbilityTuple<string, Subject>, unknown>, 
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
        const obj = conditions[prop];
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

const getConditionalQueryFor = (
  ability: AnyAbility, 
  method: string, 
  subjectType: string, 
  options?: GetConditionalQueryOptions
): Query => {
  options = options || {};
  options.actionOnForbidden = options.actionOnForbidden || (() => {
    throw new Forbidden("You're not allowed to make this request");
  });

  const rules = ability.rulesFor(method, subjectType).reverse();

  let query = {};

  for (let i = 0; i < rules.length; i++) {
    const rule = rules[i];

    const currentQuery = convertRuleToQuery(rule, options);
    if (currentQuery === undefined) {
      query = {};
    } else {
      query = mergeQuery(
        query, 
        currentQuery, { 
          defaultHandle: "combine"
        });
    }
  }

  return query;
};

export default getConditionalQueryFor;
