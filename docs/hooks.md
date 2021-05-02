---
title: Hooks
sidebarDepth: 2
---

# Hooks

## authorize

Does a complex permission check and transforms data if necessary.

|before|after|methods|multi|details|
|---|---|---|---|---|
|yes|yes|all|yes|[source](https://github.com/fratzinger/feathers-casl/blob/master/lib/hooks/authorize/authorize.hook.ts)|

### Options

|       Property      |                Description                  |
|---------------------|---------------------------------------------|
| `ability`        | You can define a custom ability. If it's not defined, `feathers-casl` looks for `context.params.ability` by default which will exist for requests from `socket.io`, if you followed the [Getting Started](/getting-started) instructions. **CAUTION**: It's not there for requests from `express`! If both (`options.ability` & `context.params.ability`) are undefined, the `authorize` hook will be skipped.<br>**ProTip:** You can use this asynchronously for dynamic abilities stored in your database!<br><br>**Type:** `Ability | ((context: HookContext) => Ability | Promise<Ability>)`<br>**optional** - *Default:* `undefined` |
| `actionOnForbidden` | The method to call, when an unauthorized request comes in<br><br>**Type:** `() => void`<br>**optional** - *Default:* `undefined`|
| `adapter`           | The adapter of the service. Used to combine the queries from rules with `$or`, `$and`, `$not` and `$nor` if the adapter supports the operators.<br><br>**Type:** `'feathers-knex' | 'feathers-memory' | 'feathers-mongodb' | 'feathers-mongoose' | 'feathers-nedb' | 'feathers-objection' | 'feathers-sequelize'`<br>**optional** - *Default:* `'feathers-memory'`|
| `availableFields`   | **Caution!** This is needed for `@casl/ability` starting with `v5`!<br><br>If you have rules with restricted fields, you want to provide a full list of possibly occurring fields for this service. If it's `undefined` (*by default*) `feathers-casl` cannot distinguish wether an empty set of restricted fields comes from restrictions or from the missing declaration. For standard adapters, you'll find the according function in the [cookbook](cookbook.html#get-availablefields-for-adapters).<br><br>**Type:** `string[] | ((context: HookContext) => string[])`<br>*Default:* looks at `options.casl.availableFields` of the service, otherwise `undefined` |
| `checkAbilityForInternal` | `feathers-casl` looks for an ability to check permissions. If `context.params.ability` is not set, it looks at `options.ability` (see above). This behavior is for external calls by default (where `context.params.provider` is set). For internal calls, `options.ability` will be skipped and instead the ability check will be skipped. You can change this by setting `checkAbilityForInternal: true`.<br><br>**Type:** `boolean`<br>**optional** - *Default:* `false` |
| `checkMultiActions` | If your database adapters allow `multi: true` you probably want to authorize `single:create/patch/remove` but not `multi:create/patch/remove`. Especially for `remove` this could be crucial. `feathers-casl` has built in support for `multi` anyway. But by default it acts exactly the same for `single` as for `multi` requests.<br><br>**Type:** `boolean`<br>**optional** - *Default:* `false`|
| `modelName`      | `feathers-casl` checks permissions per item. Because most items are plain javascript objects, it does not know which type the item is. Per default it looks for `context.path` (for example: `tasks`). You can change this behavior with the option `modelName` to use Class-like names (for example: `Task`)<br><br>**Type:** `string | ((context: HookContext) => string)`<br>**optional** - *Default:* `(context) => context.path` |

### Principles

- `{ query: { $select: [...] } }` does not play well with conditions and fields defined in your rules. So there's a high chance `feathers-casl` needs to manipulate your defined `$select` in the `before` hook. That's the case, if conditions from `casl` depend on fields that are not defined on `$select`).<br>
  *Example*: 
  - request: `app.service('/users').find({ query: { $select: ['id'] } })`<br>
  - rule: `can('find', 'users', ['id'] { organizationId: 1 }`<br>
  In that case, the request to the server really should be: `app.service('/users').find({ query: { $select: ['id', 'organizationId'] } })` to be able to check the conditions right in the `after`-hook. The`authorize` after-hook does exactly that, but you would expect to only get the `'id'` as a result. So luckily that is covered by the `authorize` after-hook.
  Afterwards the `$select` gets moved to the `query` again for following hooks.<br>This behavior means that you want to put the `authorize` before and after hooks in your hooks chain as close as it can to be to the actual adapter call. So you probably don't want to use it in `app.hooks`, nor in `before:all` because they are the first hooks but in a `after:all` hook, because it's the first to run after the adapter call.
- `feathers-casl` allows `multi` operations by default. If you set `checkMultiActions: true`, it will check the following permissions first:
  - **find**: `can('find', modelName)`
  - **multi:create**: `can('create-multi', modelName)`
  - **multi:patch**: `can('patch-multi', modelName)`
  - **multi:remove**: `can('remove-multi', modelName)`

if this check passes, it will continue with the other checks

#### Before:

| | `create` | `find` | `get` | `update` | `patch` | `remove` |
|-|----------|--------|-------|----------|---------|----------|
| `single` | all data is provided.<br>check permissions for single item<br>throws if `cannot` | - | get complete item from db & check permissions against item from db | get complete item, get restricting fields, pick restricting fields (if remaining fields = zero -> `throw`), merge with item to update & update | get complete item from db, check permissions, get restricting fields, pick restricting fields (if remaining data = zero -> `throw`), set remaining data as `context.data` | get complete item from db & check permissions
| `multi` | all data is provided<br>check permissions forEach item, if one check fails: `throw` | get query for defined `ability` and merge with provided query | - | - | get query for defined `ability` and merge with provided query | get query for defined `ability` and merge with provided query

#### After:

- check restricting read fields of item/items and replace result with allowed fields

## checkBasicPermission

`checkBasicPermission` only does a basic permission for the current request and rejects if request is not allowed.
If you use it, you probably want to put it right after the `authenticate('jwt')` hook. At least you can put it near the beginning of your hooks chain.
In fact, it is meant to be put even on the client side as a before hook, if you have the casl `ability` on the client side. That way a request to your API can be safely skipped, if it rejects. So you can reduce traffic.

::: warning
You don't want to use `checkBasicPermission` exclusively! Always use it with [`authorize`](#authorize)! Please make sure that you understand the concepts of `checkBasicPermission` and [`authorize`](#authorize) before you use one of them.
:::

|before|after|methods|multi|details|
|---|---|---|---|---|
|yes|no|all|yes||

### Options

|       Property      |                Description                  |
|---------------------|---------------------------------------------|
| `ability`        | You can define a custom ability. If it's not defined, `feathers-casl` looks for `context.params.ability` by default which exists for requests from `socket.io`, if you followed the [Getting Started](/getting-started) instructions. **CAUTION**: It's not there for requests from `express`! If both are undefined, the `checkBasicPermission` hook will be skipped.<br>**ProTip:** You can use this asynchronously for dynamic abilities stored in your database!<br><br>**Type:** `Ability | ((context: HookContext) => Ability | Promise<Ability>)`<br>**optional** - *Default:* `undefined` |
| `actionOnForbidden` | The method to call, when an unauthorized request comes in<br><br>**Type:** `() => void`<br>**optional** - *Default:* `undefined`|
| `checkAbilityForInternal` | `feathers-casl` looks for an ability to check permissions. If `context.params.ability` is not set, it looks at `options.ability` (see above). This behavior is for external calls by default (where `context.params.provider` is set). For internal calls, `options.ability` will be skipped and instead the ability check will be skipped. You can change this by setting `checkAbilityForInternal: true`.<br><br>**Type:** `boolean`<br>**optional** - *Default:* `false` |
| `checkCreateForData` | The basic check of `checkBasicPermission` check can be enhanced for the `'create'` method. On `'create'` you have the full data object/array and therefore you probably have all information you need for a detailed permission check (e.g. `can('create', data)`). By default `checkBasicPermission` skips this detailed check for `'create'` because there could be changes to your data in a before-hook after the `checkBasicPermission`-hook before the adapter-call. The detailed check for `'create'` is covered by the [`authorize`-hook](#authorize) which should be the last before-hook at all. If you need the detailed check for `checkBasicPermission` you can set `checkCreateForData`<br><br>**Type:** `boolean | ((context: HookContext) => boolean)`<br>**optional** - *Default:* `false` |
| `checkMultiActions` | If your database adapters allow `multi: true` you probably want to authorize `single:create/patch/remove` but not `multi:create/patch/remove`. Especially for `remove` this could be crucial. `feathers-casl` has built in support for `multi` anyway. But by default it acts exactly the same for `single` as for `multi` requests.<br><br>**Type:** `boolean`<br>**optional** - *Default:* `false`|
| `modelName`      | `feathers-casl` checks permissions per item. Because most items are plain javascript objects, it does not know which type the item is. Per default it looks for `context.path` (for example: `tasks`). You can change this behavior with the option `modelName` to use Class-like names (for example: `Task`)<br><br>**Type:** `string | ((context: HookContext) => string)`<br>**optional** - *Default:* `(context) => context.path` |
| `storeAbilityForAuthorize` | [`authorize`-hook](#authorize) uses `checkBasicPermission` under the hood. But `checkBasicPermission` can be used before `authorize` in your hook chain. In that case, to reduce computation time, you can set `storeAbilityForAuthorize: true` so the basic check in `authorize` will be skipped because it knows, that `checkBasicPermission` has run.<br><br>**Type:** `boolean`<br>**optional** - *Default:* `false` |


### Hooks Behavior

- `checkBasicPermission` only does a basic check. It's meant to reject at an early stage. It just rejects for simple requests/rules, not for more complex requests.
- For all other methods than `'create'` it just does a basic `can(method, modelName)` check. There's no check for conditions or fields!
- For `'create'` it can assume that all information are provided to do a `can('create', item)` check. If you want this behavior, you need to enable it with the option: `'checkCreateForData'` (see table above)
- `feathers-casl` allows `multi` operations by default. If you set `checkMultiActions: true`, it also checks the following permissions and throws :
  - **find**: `can('find', modelName)`
  - **multi:create**: `can('create-multi', modelName)`
  - **multi:patch**: `can('patch-multi', modelName)`
  - **multi:remove**: `can('remove-multi', modelName)`