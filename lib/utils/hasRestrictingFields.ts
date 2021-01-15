import { PureAbility, AnyAbility } from "@casl/ability";
import { permittedFieldsOf, PermittedFieldsOptions } from "@casl/ability/extra";

export default (ability: PureAbility, action: unknown, subject: unknown, options?: PermittedFieldsOptions<AnyAbility>): string[]|false => {
  const fields: string[] = permittedFieldsOf(ability, action, subject, options);
  return (fields.length === 0) ? false : fields;
};
