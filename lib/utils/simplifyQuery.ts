import _isEqual from "lodash/isEqual";
import _cloneDeep from "lodash/cloneDeep";

import type { Query } from "@feathersjs/feathers";

const simplifyQuery = (
  query: Query,
  replaceAnd = true,
  replaceOr = true
): Query => {
  if (!query.$and && !query.$or) { return query; }
  let result = _cloneDeep(query);

  if (result.$and && !result.$and.length) {
    delete result.$and;
  }

  if (result.$or && !result.$or.length) {
    delete result.$or;
  }

  /*if (result.$and && result.$or) {
    const or = (result.$or.length > 1) ? { $or: result.$or } : result.$or[0];
    result.$and.push(or);
    delete result.$or;
  }*/

  if (result.$and) {
    const $and = [];
    result.$and.forEach(q => {
      q = simplifyQuery(q, true, true);
      if ($and.some(x => _isEqual(x, q))) return;
      $and.push(q);
    });
    if (replaceAnd && $and.length === 1 && Object.keys(result).length === 1) {
      result = $and[0];
    } else {
      result.$and = $and;
    }
  }
  if (result.$or) {
    const $or = [];
    result.$or.forEach(q => {
      q = simplifyQuery(q, true, true);
      if ($or.some(x => _isEqual(x, q))) return;
      $or.push(q);
    });
    if (replaceOr && $or.length === 1 && Object.keys(result).length === 1) {
      result = $or[0];
    } else {
      result.$or = $or;
    }
  }
  return result;
};

export default simplifyQuery;