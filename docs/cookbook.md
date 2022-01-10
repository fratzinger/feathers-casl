---
title: Cookbook
---

# Cookbook

## Get availableFields for adapters

### feathers-sequelize

```js
availableFields(context) {
  const { rawAttributes } = context.service.Model;
  return Object.keys(rawAttributes);
}
```