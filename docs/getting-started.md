# Getting Started

<p align="center">
  <img src="/img/logo.svg" width="150">
</p>

[![npm](https://img.shields.io/npm/v/feathers-casl)](https://www.npmjs.com/package/feathers-casl)
[![Github CI](https://github.com/fratzinger/feathers-casl/actions/workflows/node.js.yml/badge.svg)](https://github.com/fratzinger/feathers-casl/actions)
[![Code Climate maintainability](https://img.shields.io/codeclimate/maintainability/fratzinger/feathers-casl)](https://codeclimate.com/github/fratzinger/feathers-casl)
[![Code Climate coverage](https://img.shields.io/codeclimate/coverage/fratzinger/feathers-casl)](https://codeclimate.com/github/fratzinger/feathers-casl)
[![libraries.io](https://img.shields.io/librariesio/release/npm/feathers-casl)](https://libraries.io/npm/feathers-casl)
[![npm](https://img.shields.io/npm/dm/feathers-casl)](https://www.npmjs.com/package/feathers-casl)
[![GitHub license](https://img.shields.io/github/license/fratzinger/feathers-casl)](https://github.com/fratzinger/feathers-casl/blob/main/LICENSE)
[![Discord](https://badgen.net/badge/icon/discord?icon=discord&label)](https://discord.gg/qa8kez8QBx)

## About

Add access control with CASL to your feathers application.

This project is built for [FeathersJS](http://feathersjs.com). An open source web framework for building modern real-time applications.
It's based on [CASL](https://casl.js.org/) and is a convenient layer to use **CASL** in your feathers.js-project. Supported versions: `@casl/ability^5` and `@feathersjs/feathers^4`.

## Features

- Fully powered by Feathers 5 & CASL 5
- Allows permissions for all methods `create`, `find`, `get`, `update`, `patch`, `remove`, or `create`, `read`, `update`, `delete`
- Define permissions not based on methods: `can('view', 'Settings')` (Bring your custom logic)
- Restrict by conditions: `can('create', 'Task', { userId: user.id })`
- Restrict by individual fields: `cannot('update', 'User', ['roleId'])`
- Native support for restrictive `$select`: `can('read', 'User', ['id', 'username'])` -> `$select: ['id', 'username']`
- Support to define abilities for anything (providers, users, roles, 3rd party apps, ...)
- Fully supported adapters: `@feathersjs/knex`, `@feathersjs/memory`, `@feathersjs/mongodb`, `feathers-sequelize`, not supported: `feathers-mongoose`, `feathers-nedb`, `feathers-objection`
- Support for dynamic rules stored in your database (Bring your own implementation ;) )
- hooks:
  - `checkBasicPermission` hook for client side usage as a before-hook
  - `authorize` hook for complex rules
  - Disallow/allow `multi` methods (`create`, `patch`, `remove`) dynamically with: `can('remove-multi', 'Task', { userId: user.id })`
- channels:
  - every connection only receives updates based on rules
  - `channels`-support also regards restrictive fields
  - rules can be defined individually for events
- utils:
  - `checkCan` to be used in hooks to check authorization before operations
- Baked in support for `@casl/angular`, `@casl/react`, `@casl/vue` and `@casl/aurelia`

## Installation

```bash
# npm
npm i feathers-casl @casl/ability
# yarn
yarn add feathers-casl @casl/ability
# pnpm
pnpm i feathers-casl @casl/ability
```

## Getting Started

### Provide app wide `feathers-casl` options

```ts
// app.ts
import { feathersCasl } from "feathers-casl";

app.configure(feathersCasl());
```

The `feathersCasl()` function can be configured, to provide app wide options to `feathers-casl`

### Define static rules

For most cases we want to define rules per user (or per user-role). So we first add a function which returns an `ability` from `@casl/ability` with these rules:

```ts
// src/services/authentication/authentication.abilities.ts
import {
  Ability,
  AbilityBuilder,
  createAliasResolver,
  makeAbilityFromRules
} from "@casl/ability";

// don't forget this, as `read` is used internally
const resolveAction = createAliasResolver({
  update: "patch", // define the same rules for update & patch
  read: ["get", "find"], // use 'read' as a equivalent for 'get' & 'find'
  delete: "remove" // use 'delete' or 'remove'
});

export const defineRulesFor = (user) => {
  // also see https://casl.js.org/v6/en/guide/define-rules
  const { can, cannot, rules } = new AbilityBuilder(Ability);

  if (user.role && user.role.name === "SuperAdmin") {
    // SuperAdmin can do evil
    can("manage", "all");
    return rules;
  }

  if (user.role && user.role.name === "Admin") {
    can("create", "users");
  }

  can("read", "users");
  can("update", "users", { id: user.id });
  cannot("update", "users", ["roleId"], { id: user.id });
  cannot("delete", "users", { id: user.id });

  can("manage", "tasks", { userId: user.id });
  can("create-multi", "posts", { userId: user.id });

  return rules;
};

export const defineAbilitiesFor = (user) => {
  const rules = defineRulesFor(user);

  return new Ability(rules, { resolveAction });
};
```

### Add abilities to hooks context

`feathers-casl` by default looks for `context.params.ability` in the `authorize`-hook and `connection.ability` in the channels. You want to `authorize` users who are `authenticated` first with `@feathers/authentication`. We can add hooks to the `/authentication` service to populate things to `context.params` and `connection` under the hood. We use this here to put `ability` on these objects, which makes it available to all hooks after the `authenticate(...)`-hook. This way we can define rules in just one place:
``

```ts
// src/services/authentication/authentication.hooks.ts
import { defineAbilitiesFor } from "./abilities";

export default {
  before: {
    all: [],
    find: [],
    get: [],
    create: [],
    update: [],
    patch: [],
    remove: []
  },
  after: {
    all: [],
    find: [],
    get: [],
    create: [
      (context) => {
        const { user } = context.result;
        if (!user) return context;
        const ability = defineAbilitiesFor(user);
        context.result.ability = ability;
        context.result.rules = ability.rules;

        return context;
      }
    ],
    update: [],
    patch: [],
    remove: []
  },
  error: {
    all: [],
    find: [],
    get: [],
    create: [],
    update: [],
    patch: [],
    remove: []
  }
};
```

### Add the authorize-hook to the services

The `authorize`-hook can be used for all methods and has support for `multi: true`. You should use it as a `before` **AND** a `after` hook at the same time. For more information, see: [authorize hook](/hooks.html#authorize)

```ts
// src/services/tasks/tasks.hooks.ts
import { authenticate } from "@feathersjs/authentication";
import { authorize } from "feathers-casl";

// CAUTION! Make sure the adapter name fits your adapter (e.g. @feathersjs/mongodb, @feathersjs/knex, feathers-sequelize, ...)!
// You'll want to have the `authorize` as an early before-hook (right after the `authenticate` hook) and as a late after hook, since it could modify the result based on the ability of the requesting user

const authorizeHook = authorize({ adapter: "@feathersjs/mongodb" });

export default {
  before: {
    all: [authenticate("jwt")],
    find: [authorizeHook],
    get: [authorizeHook],
    create: [authorizeHook],
    update: [authorizeHook],
    patch: [authorizeHook],
    remove: [authorizeHook]
  },

  after: {
    all: [authorizeHook],
    find: [],
    get: [],
    create: [],
    update: [],
    patch: [],
    remove: []
  },

  error: {
    all: [],
    find: [],
    get: [],
    create: [],
    update: [],
    patch: [],
    remove: []
  }
};
```

### Filters / Operators

For `feathers-casl` to work properly, you have to whitelist some operators in your service options.
Also make sure to set the adapter option in your `authorize` hook like: `authorize({ adapter: '@feathersjs/mongodb' })`

- **@feathersjs/memory**: `app.use('...', new Service({ filters: { $nor: true }, operators: ["$nor"] }))`
- **@feathersjs/mongodb**: `app.use("...', new Service({ filters: { $nor: true }, operators: ["$nor"] ))`
- **@feathersjs/knex**: nothing special to configure :)
- **feathers-sequelize**: This one is a little bit different than the others. See the following:

```ts
import { SequelizeService } from "feathers-sequelize";
import { Op } from "sequelize";

// ...

app.use(
  "...",
  new SequelizeService({
    Model,
    operatorMap: {
      $not: Op.not
    },
    filters: {
      $not: true
    },
    operators: ["$not"]
  })
);
```

### Add CASL to channels

To unleash the full power of `feathers-casl` you want to add it to your `channels.js` so every user just gets updates only to items they can really read. It's as simple as the following example. For more information see: [channels](/channels.html)

```ts
// src/channels.ts
import { getChannelsWithReadAbility, makeChannelOptions } from "feathers-casl";

export default function (app) {
  if (typeof app.channel !== "function") {
    // If no real-time functionality has been configured just return
    return;
  }

  const caslOptions = makeChannelOptions(app);

  app.publish((data, context) => {
    return getChannelsWithReadAbility(app, data, context, caslOptions);
  });
}
```

### Using CASL with the REST (Express.js) transport

In case you are not using sockets and want to use `feathers-casl` with the Express transport, you need to define the abilities right after your `authenticate()` hook and before the `authorize()` hook for each service relying on CASL.

```ts
// src/services/tasks/tasks.hooks.ts

export default {
  before: {
    all: [
      authenticate("jwt"),

      // Add this to set abilities, if a user exists
      (context) => {
        const { user } = context.params;
        if (user) context.params.ability = defineAbilitiesFor(user);
        return context;
      }
    ]

    // ...
  }

  // ...
};
```

## Testing

Simply run `npm test` and all your tests in the `test/` directory will be run. The project has full support for _Visual Studio Code_. You can use the debugger to set breakpoints.

## Help

For more information on all the things you can do, visit [FeathersJS](http://docs.feathersjs.com) and [CASL](https://casl.js.org/v6/en/).
