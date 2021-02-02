import { PureAbility, Subject } from "@casl/ability";
import { Query } from "@feathersjs/feathers";
import { GetFieldsQueryOptions } from "../types";
import hasRestrictingFields from "./hasRestrictingFields";

// eslint-disable-next-line no-unused-vars
const getFieldsQueryFor = (ability: PureAbility, action: string, subject: Subject, options?: GetFieldsQueryOptions): Query => {
  const fields = hasRestrictingFields(ability, action, subject, options);
  if (!fields) { return {}; }
  if (fields === true) { 
    return { $select: [] }; 
  }
  return { $select: fields };
};

export default getFieldsQueryFor;