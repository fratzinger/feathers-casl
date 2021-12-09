import { subject } from "@casl/ability";
import { throwUnlessCan } from "../hooks/authorize/authorize.hook.utils";

import getFieldsForConditions from "./getFieldsForConditions";

import type { AnyAbility } from "@casl/ability";
import type { Id, Service } from "@feathersjs/feathers";
import type { UtilCheckCanOptions } from "../types";

const makeOptions = (
  providedOptions: Partial<UtilCheckCanOptions>
): UtilCheckCanOptions => {
  const defaultOptions: UtilCheckCanOptions = {
    // eslint-disable-next-line @typescript-eslint/no-empty-function
    actionOnForbidden: () => {},
    checkGeneral: true,
    skipThrow: false,
    useConditionalSelect: true
  };
  return Object.assign(defaultOptions, providedOptions || {});
};

const checkCan = async <S>(
  ability: AnyAbility,
  id: Id,
  method: string,
  modelName: string,
  service: Service<S>,
  providedOptions?: Partial<UtilCheckCanOptions>
): Promise<boolean> => {
  const options = makeOptions(providedOptions);
  if (options.checkGeneral) {
    const can = throwUnlessCan(
      ability,
      method,
      modelName,
      modelName,
      options
    );
    if (!can) { return false; }
  }
  
  let params;
  if (options.useConditionalSelect) {
    const $select = getFieldsForConditions(ability, method, modelName);
    params = {
      query: { $select }
    };
  }

  const getMethod = (service._get) ? "_get" : "get";
  
  const item = await service[getMethod](id, params);
    
  const can = throwUnlessCan(
    ability,
    method,
    subject(modelName, item),
    modelName,
    options
  );
  
  return can;
};

export default checkCan;