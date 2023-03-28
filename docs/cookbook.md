# Cookbook

## Get availableFields for adapters

### feathers-sequelize

```ts
availableFields(context) {
  const { rawAttributes } = context.service.Model;
  return Object.keys(rawAttributes);
}
```
