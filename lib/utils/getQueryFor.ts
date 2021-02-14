import { mergeQuery } from "feathers-utils";

import getFieldsQueryFor from "./getFieldsQueryFor";
import getConditionalQueryFor from "./getConditionalQueryFor";

import { Query } from "@feathersjs/feathers";
import { AnyAbility } from "@casl/ability";

import {
  GetQueryOptions 
} from "../types";

const getQueryFor = (
  ability: AnyAbility, 
  method: string, 
  modelName: string, 
  options?: GetQueryOptions
): Query => {
  options = options || {
    availableFields: []
  };
  const { skipConditional, skipFields } = options;
  if (skipConditional && skipFields) { return {}; }
  const conditionsQuery = (!skipConditional) 
    ? getConditionalQueryFor(ability, method, modelName, { actionOnForbidden: options.actionOnForbidden })
    : {};
  const fieldsQuery = (!skipFields)
    ? getFieldsQueryFor(ability, method, modelName, { availableFields: options.availableFields })
    : {};

  const query = mergeQuery(conditionsQuery, fieldsQuery, { defaultHandle: "combine" });
  return query;
};

export default getQueryFor;