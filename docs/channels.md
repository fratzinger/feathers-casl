# Channels

One of the biggest advantages of `feathers-casl` is the built in support for channels. If you're not familiar with channels, please read the official [feathers.js docs](https://docs.feathersjs.com/api/channels.html). This chapter is only relevant for you, if you're using realtime connections (most likely [socket.io](https://docs.feathersjs.com/api/client/socketio.html)). You can't use channels, if you've 'only' a REST app by using express.js or koa.

## Example

```ts
// src/channels.ts
import { getChannelsWithReadAbility, makeChannelOptions } from "feathers-casl";

export default function (app) {
  if (typeof app.channel !== "function") {
    // If no real-time functionality has been configured just return
    return;
  }

  // ...

  app.on("login", (authResult: any, { connection }) => {
    if (connection) {
      // this is needed to map the ability from the authentication hook to the connection so it gets available in the HookContext as `params.ability` automatically
      if (authResult.ability) {
        connection.ability = authResult.ability;
        connection.rules = authResult.rules;
      }

      // ...
    }

    // ...
  });

  // ...

  const caslOptions = makeChannelOptions(app);

  app.publish((data, context) => {
    return getChannelsWithReadAbility(app, data, context, caslOptions);
  });
}
```

## `makeOptions`

**Properties:**

- `app: Application`: **required** - used because of `app.configure(casl())`
- `options: Partial<ChannelOptions>`: _optional_ - see the table below.

**returns** `ChannelOptions`

### Options

| Property          | Description                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                        |
| ----------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `ability`         | You can define a custom ability. If it's not defined, `feathers-casl` looks for `connection.ability` by default which exists, if you followed the [Getting Started](/getting-started) instructions. If it doesn't find an `ability`, the connection will not be informed.<br><br><br>**Type:** `Ability ((app: Application, connection: RealTimeConnection, data: any, context: HookContext) => Ability)`<br>**optional** - _Default:_ `(app, connection) => connection.ability`                                                                                                                                                                                                                                                                   |
| `activated`       | Deactivating the `feathers-casl` channels functionality is as easy as set this to `false`. It will return your `channelOnError` then.<br><br>**Type:** `boolean`<br>**optional** - _Default:_ `true`                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                               |
| `availableFields` | **Caution!** This is needed for `@casl/ability` starting with `v5`!<br><br>If you have rules with restricted fields, you want to provide a full list of possibly occurring fields for this service. If it's `undefined` (_by default_) `feathers-casl` cannot distinguish wether an empty set of restricted fields comes from restrictions or from the missing declaration. For standard adapters, you'll find the according function in the [cookbook](cookbook.html#get-availablefields-for-adapters).<br><br>**Type:** `string[] \| ((context: HookContext) => string[])`<br>_Default:_ looks at `options.casl.availableFields` of the service, otherwise `undefined`                                                                           |
| `channelOnError`  | If you set `activated:false` or your custom `'modelName'` returns nothing, the `channelOnError` will be returned.<br><br>**Type:** `string[]`<br>_Default:_ `['authenticated']`                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                    |
| `channels`        | `getChannelsWithReadAbility` by default filters from all existing connections. With the option `channels` you can pass prefiltered channels. So only the connections of the channel / these channels will be considered. You want to use this in a specific `service.publish` function where you want to return a specific channel (e.g. `` app.channel(`room-${roomId}) ``) and want to filter that afterwards.<br><br>**Type:** `Channel \| Channel[]`<br>**optional** - _Default:_ `app.channel(app.channels)`                                                                                                                                                                                                                                  |
| `modelName`       | `feathers-casl` checks permissions per item. Because most items are plain javascript objects, it does not know which type the item is. Per default it looks for `context.path` (for example: `tasks`). You can change this behaviour with the option `'modelName'` to use Class-like names (for example: `Task`)<br><br>**Type:** `string` _or_ `((context: HookContext) => string)`<br>**optional** - _Default:_ `(context) => context.path`                                                                                                                                                                                                                                                                                                      |
| `restrictFields`  | This is one of the most outstanding things of `feathers-casl`. If you define rules like: `can('read', 'posts', ['id', 'title', 'body'])` with restricting fields, it will be considered in the `getChannelsWithReadAbility` per each individual connection. If you wish, you can skip this behavior.<br><br>**Type:** `boolean`<br>**optional** - _Default:_ `true`                                                                                                                                                                                                                                                                                                                                                                                |
| `useActionName`   | `getChannelsWithReadAbility` by default uses your `'get'` rules. So every connected device via socket.io receives events, if it has the appropriate `'get'` rule defined. You maybe want to change who can 'get' items and who can 'receive' realtime updates. You can change `'useActionName'` then to whatever string you like. For example: `useActionName: 'receive'` -> `can('receive', 'posts')`. That way you split the rules for events and for normal requests which is why you have to define all rules for events separately then. You even can change the action-name per event individually.<br><br>**Type:** `string \| { created: string, updated: string, patched: string, removed: string }`<br>**optional** - _Default:_ `'get'` |

## `getChannelsWithReadAbility`

**Properties:**

- `app: Application`: **required** - used for `app.channel` and `app.channels` under the hood
- `data: any`: **required** - the data from the event
- `context: HookContext`: **required** - used to get the `servicePath`/`modelName` under the hood
- `caslOptions?: Partial<ChannelOptions>`: _optional_ - see the table above
  **returns** `Channel | Channel[]`
