import { mergeQuery } from "feathers-utils";

import getFieldsQueryFor from "./getFieldsQueryFor";
import getConditionalQueryFor from "./getConditionalQueryFor";

import { Query } from "@feathersjs/feathers";
import { PureAbility } from "@casl/ability";

import {
  GetConditionalQueryOptions,
  GetQueryOptions 
} from "../types";

const getQueryFor = (
  ability: PureAbility, 
  method: string, 
  modelName: string, 
  options?: GetConditionalQueryOptions & GetQueryOptions
): Query => {
  options = options || {};
  const { skipConditional, skipFields } = options;
  if (skipConditional && skipFields) { return {}; }
  const condQuery = (!skipConditional) 
    ? getConditionalQueryFor(ability, method, modelName, { actionOnForbidden: options.actionOnForbidden })
    : {};
  const fieldsQuery = (!skipFields)
    ? getFieldsQueryFor(ability, method, modelName)
    : {};

  const query = mergeQuery(condQuery, fieldsQuery, { defaultHandle: "combine" });
  return query;
};

export default getQueryFor;