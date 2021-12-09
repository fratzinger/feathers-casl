---
title: Utils
sidebarDepth: 2
---

# Utils

Besides the hooks and channels of `feathers-casl`, it provides utils to be used in your custom hooks orxs services.

## checkBasicPermission

The util `checkBasicPermission` only does a basic permission for the current request and rejects if request is not allowed. It's the same as the hook [`checkBasicPermission`](/hooks.html#checkbasicpermission) but meant to use in your custom hooks.

::: warning
You don't want to use `checkBasicPermission` exclusively! Always use it with [`authorize`](/hooks.html#authorize) or [`checkCan`](#checkcan)! Please make sure that you understand the concepts of `checkBasicPermission`, `authorize` and `checkCan` before you use one of them.
:::

|before|after|methods|multi|details|
|---|---|---|---|---|
|yes|no|all|yes||

### Options

|       Property      |                Description                  |
|---------------------|---------------------------------------------|
| `ability`        | You can define a custom ability. If it's not defined, `feathers-casl` looks for `context.params.ability` by default which exists for requests from `socket.io`, if you followed the [Getting Started](/getting-started) instructions. **CAUTION**: It's not there for requests from `express`! If both are undefined, the `checkBasicPermission` hook will be skipped.<br>**ProTip:** You can use this asynchronously for dynamic abilities stored in your database!<br><br>**Type:** `Ability \| ((context: HookContext) => Ability \| Promise<Ability>)`<br>**optional** - *Default:* `undefined` |
| `actionOnForbidden` | The method to call, when an unauthorized request comes in<br><br>**Type:** `() => void`<br>**optional** - *Default:* `undefined`|
| `checkAbilityForInternal` | `feathers-casl` looks for an ability to check permissions. If `context.params.ability` is not set, it looks at `options.ability` (see above). This behavior is for external calls by default (where `context.params.provider` is set). For internal calls, `options.ability` will be skipped and instead the ability check will be skipped. You can change this by setting `checkAbilityForInternal: true`.<br><br>**Type:** `boolean`<br>**optional** - *Default:* `false` |
| `checkCreateForData` | The basic check of `checkBasicPermission` check can be enhanced for the `'create'` method. On `'create'` you have the full data object/array and therefore you probably have all information you need for a detailed permission check (e.g. `can('create', data)`). By default `checkBasicPermission` skips this detailed check for `'create'` because there could be changes to your data in a before-hook after the `checkBasicPermission`-hook before the adapter-call. The detailed check for `'create'` is covered by the [`authorize`-hook](#authorize) which should be the last before-hook at all. If you need the detailed check for `checkBasicPermission` you can set `checkCreateForData`<br><br>**Type:** `boolean \| ((context: HookContext) => boolean)`<br>**optional** - *Default:* `false` |
| `checkMultiActions` | If your database adapters allow `multi: true` you probably want to authorize `single:create/patch/remove` but not `multi:create/patch/remove`. Especially for `remove` this could be crucial. `feathers-casl` has built in support for `multi` anyway. But by default it acts exactly the same for `single` as for `multi` requests.<br><br>**Type:** `boolean`<br>**optional** - *Default:* `false`|
| `modelName`      | `feathers-casl` checks permissions per item. Because most items are plain javascript objects, it does not know which type the item is. Per default it looks for `context.path` (for example: `tasks`). You can change this behavior with the option `modelName` to use Class-like names (for example: `Task`)<br><br>**Type:** `string \| ((context: HookContext) => string)`<br>**optional** - *Default:* `(context) => context.path` |
| `storeAbilityForAuthorize` | [`authorize`-hook](#authorize) uses `checkBasicPermission` under the hood. But `checkBasicPermission` can be used before `authorize` in your hook chain. In that case, to reduce computation time, you can set `storeAbilityForAuthorize: true` so the basic check in `authorize` will be skipped because it knows, that `checkBasicPermission` has run.<br><br>**Type:** `boolean`<br>**optional** - *Default:* `false` |


### Notable Principles

- `checkBasicPermission` only does a basic check. It's meant to reject at an early stage. It just rejects for simple requests/rules, not for more complex requests.
- For all other methods than `'create'` it just does a basic `can(method, modelName)` check. There's no check for conditions or fields!
- For `'create'` it can assume that all information are provided to do a `can('create', item)` check. If you want this behavior, you need to enable it with the option: `'checkCreateForData'` (see table above)
- `feathers-casl` allows `multi` operations by default. If you set `checkMultiActions: true`, it also checks the following permissions and throws :
  - **find**: `can('find', modelName)`
  - **multi:create**: `can('create-multi', modelName)`
  - **multi:patch**: `can('patch-multi', modelName)`
  - **multi:remove**: `can('remove-multi', modelName)`

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