import { PureAbility, AnyAbility } from "@casl/ability";
import { PermittedFieldsOptions } from "@casl/ability/extra";
import { Query } from "@feathersjs/feathers";
import hasRestrictingFields from "./hasRestrictingFields";

// eslint-disable-next-line no-unused-vars
export default (ability: PureAbility, action: unknown, subject: unknown, options?: PermittedFieldsOptions<AnyAbility>): Query => {
  const fields = hasRestrictingFields(ability, action, subject, options);
  if (!fields) { return {}; }
  return { $select: fields };
};