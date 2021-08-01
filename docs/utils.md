---
title: Utils
sidebarDepth: 2
---

# Utils

Besides the hooks and channels of `feathers-casl`, it provides utils to be used in your custom hooks or services.

## checkCan

There are cases you want to check a permission before a user does something. You can use `checkCan` in your custom hook or service to check if a user can make an action for a single item (e.g. 'get', 'update', 'patch', 'remove'). It is also used internally in the `authorize` hook.

```typescript
import { checkCan } from 'feathers-casl';

checkCan(
  ability: AnyAbility, // the ability from casl
  id: number | string, // id of the item to check
  method: 'get' | 'update' | 'patch' | 'remove', // the method to check for
  modelName: string, // the modelName to check for (servicePath by default)
  service: Service, // the service to check for
  options: CheckCanOptions // see table below
): Promise<boolean>
```

### Options

|       Property         |                Description                  |
|------------------------|---------------------------------------------|
| `actionOnForbidden`    | The method to call, when an unauthorized request comes in<br><br>**Type:** `() => void`<br>**optional** - *Default:* `undefined` |
| `checkGeneral`         | `checkCan` specifically checks for your item. It can do a general check before, so it  |
| `skipThrow`            | `checkCan` throws by default if the permission check fails. You can change this with the `skipThrow` option, so a boolean will be returned<br><br>**Type:** `boolean`<br>**optional** - *Default:* `false` |
| `useConditionalSelect` | `checkCan` does a slim `.get()` request by default to get only the fields of the item to check against. You can set `useConditionalSelect: false` to get the full item instead.<br><br>**Type:** `boolean`<br>**optional** - *Default:* `true` |

## mergeQueryFromAbility

This util can be used to compose a query from a provided ability

```typescript
import { mergeQueryFromAbility } from 'feathers-casl';

const query = mergeQueryFromAbility(
  app,
  ability,
  method,
  modelName,
  query,
  service,
  options
);
```

### Options

| Property    | Description                                 |
|-------------|---------------------------------------------|
| `app`       | Your `feathers` app. |
| `ability`   | The `ability` from `casl` |
| `method `   | The method to merge rules for. Mostly one of: `'find'`, `'get'`, `'create'`, `'update'`, `'patch'`, `'remove'` <br><br>**Type:** `string` |
| `modelName` | The modelName to merge rules for. Mostly the service path. <br><br>**Type:** `string` |
| `query`     | Your query you want to merge rules with. <br><br>**Type:** `object` |
| `service`   | |
| `options`   | |