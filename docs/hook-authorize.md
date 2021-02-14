---
title: authorize hook
sidebarDepth: 2
---

# authorize hook

Checks permission for the current request.

|before|after|methods|multi|details|
|---|---|---|---|---|
|yes|yes|all|yes||

## Options

|       Property      |                Description                  |
|---------------------|---------------------------------------------|
| `ability`        | You can define a custom ability. If it's not defined, `feathers-casl` looks for `context.params.ability` by default which exists, if you followed the [Getting Started](/getting-started) instructions. If both are undefined, the `authorize` hook will be skipped.<br>**ProTip:** You can use this asynchronously for dynamic abilities stored in your database!<br><br>**Type:** `Ability | ((context: HookContext) => Ability | Promise<Ability>)`<br>**optional** - *Default:* `undefined` |
| `actionOnForbidden` | The method to call, when an unauthorized request comes in<br><br>**Type:** `() => void`<br>**optional** - *Default:* `undefined`|
| `availableFields`   | **Caution!** This is needed for `@casl/ability` starting with `v5`!<br><br>If you have rules with restricted fields, you want to provide a full list of possibly occurring fields for this service. If it's `undefined` (*by default*) `feathers-casl` cannot distinguish wether an empty set of restricted fields comes from restrictions or from the missing declaration. For standard adapters, you'll find the according function in the [cookbook](cookbook.html#get-availablefields-for-adapters).<br><br>**Type:** `string[] | ((context: HookContext) => string[])`<br>*Default:* looks at `options.casl.availableFields` of the service, otherwise `undefined` |
| `checkAbilityForInternal` | `feathers-casl` looks for an ability to check permissions. If `context.params.ability` is not set, it looks at `options.ability` (see above). This behavior is for external calls by default (where `context.params.provider` is set). For internal calls, `options.ability` will be skipped and instead the ability check will be skipped. You can change this by setting `checkAbilityForInternal: true`.<br><br>**Type:** `boolean`<br>**optional** - *Default:* `false` |
| `checkMultiActions)` | If your database adapters allow `multi: true` you probably want to authorize `single:create/patch/remove` but not `multi:create/patch/remove`. Especially for `remove` this could be crucial. `feathers-casl` has built in support for `multi` anyway. But by default it does it acts exactly the same for `single` and `multi` requests.<br><br>**Type:** `boolean`<br>**optional** - *Default:* `false`|
| `modelName`      | `feathers-casl` checks permissions per item. Because most items are plain javascript objects, it does not know which type the item is. Per default it looks for `context.path` (for example: `tasks`). You can change this behavior with the option `modelName` to use Class-like names (for example: `Task`)<br><br>**Type:** `string | ((context: HookContext) => string)`<br>**optional** - *Default:* `(context) => context.path` |

## Principles

### Hooks Behavior

- `{ query: { $select: [...] } }` does not play well with conditions and fields defined in your rules. So `feathers-casl` hides `$select` in the `before` hook. In the `after` hook the full data can be used to check the permissions then. Afterwards the `$select` will be considered in the `after` hook manually and gets moved to the `query` again for following hooks.<br>This behavior means that you want to put the `authorize` before and after hooks in your hooks chain as close as it can to be to the actually `method`. So you probably don't want to use it in `app.hooks`, nor in `before:all` and `after:all`.
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