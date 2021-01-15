---
title: Channels
sidebarDepth: 3
---

## Example

```js
const {
  getChannelsWithReadAbility,
  makeOptions
} = require("feathers-casl").channels;

module.exports = function (app) {
  if (typeof app.channel !== "function") {
    // If no real-time functionality has been configured just return
    return;
  }

  const caslOptions = makeOptions(app);

  app.publish((data, context) => {
    return getChannelsWithReadAbility(app, data, context, caslOptions);
  });
};
```

## `makeOptions`

**Properties:**
- `app: Application`: **required** - used because of `app.configure(casl())`
- `options: Partial<ChannelOptions>`: *optional* - see the table below.

**returns** `ChannelOptions`

### Options

|       Property      |                Description                  |
|---------------------|---------------------------------------------|
| `activated` | Deactivating the `feathers-casl` channels functionality is as easy as set this to `false`. It will return your `channelOnError` then.<br><br>**Type:** `boolean`<br>**optional** - *Default:* `true` |
| `channelOnError` | If you set `activated:false` or your custom `getModelName` returns nothing, the `channelOnError` will be returned.<br><br>**Type:** `string[]`<br>*Default:* `['authenticated']`|
| `ability`        | `feathers-casl` looks for `connection.ability` by default. It's there, if you followed the [Getting Started]() instructions. If it cannot be found, your custom `ability` will be used. Just make sure to return a valid `Ability`. Returning nothing is as if the connection cannot `read` the item.<br><br><br>**Type:** `Ability | ((app: Application, connection: RealTimeConnection, data: any, context: HookContext) => Ability)`<br>**optional** - *Default:* `(app, connection) => connection.ability` |
| `getModelName`      | `feathers-casl` checks permissions per item. Because most items are plain javascript objects, it does not know which type the item is. Per default it looks for `context.path` (for example: `tasks`). You can change this behaviour with `getModelName` to use Class-like names (for example: `Task`)<br><br>**Type:** `(context: HookContext) => string`<br>**optional** - *Default:* `(context) => context.path` |
| `restrictFields`    | This is one of the most outstanding things of `feathers-casl`. If you define rules like: `can('read', 'posts', ['id', 'title', 'body'])` with restricting fields, it will be considered in the `getChannelsWithReadAbility` per each individual connection. If you wish, you can skip this behaviour.<br><br>**Type:** `boolean`<br>**optional** - *Default:* `true` |

## `getChannelsWithReadAbility`

**Properties:**
- `app: Application`: **required** - used for `app.channel` and `app.channels` under the hood
- `data: any`: **required** - the data from the event
- `context: HookContext`: **required** - used to get the `servicePath`/`modelName` under the hood
- `caslOptions?: Partial<ChannelOptions>`: *optional* - see the table above
**returns** `Channel|Channel[]`