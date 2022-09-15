# Getting Started

<p align="center">
  <img src="/img/logo.svg" width="150">
</p>

![npm](https://img.shields.io/npm/v/feathers-casl)
![GitHub Workflow Status](https://img.shields.io/github/workflow/status/fratzinger/feathers-casl/Node.js%20CI)
![Code Climate maintainability](https://img.shields.io/codeclimate/maintainability/fratzinger/feathers-casl)
![Code Climate coverage](https://img.shields.io/codeclimate/coverage/fratzinger/feathers-casl)
![libraries.io](https://img.shields.io/librariesio/release/npm/feathers-casl)
![npm](https://img.shields.io/npm/dm/feathers-casl)
![GitHub license](https://img.shields.io/github/license/fratzinger/feathers-casl)

## About

Add access control with CASL to your feathers application.

This project is built for [FeathersJS](http://feathersjs.com). An open source web framework for building modern real-time applications.
It's based on [CASL](https://casl.js.org/) and is a convenient layer to use **CASL** in your feathers.js-project. Supported versions: `@casl/ability^5` and `@feathersjs/feathers^4`.

## Features
- Fully powered by Feathers 4 & CASL 5
- Written in TypeScript
- Allows permissions for all methods `create`, `find`, `get`, `update`, `patch`, `remove`, or `create`, `read`, `update`, `delete`
- Define permissions not based on methods: `can('view', 'Settings')` (Bring your custom logic)
- Restrict by conditions: `can('create', 'Task', { userId: user.id })`
- Restrict by individual fields: `cannot('update', 'User', ['roleId'])`
- Native support for restrictive `$select`: `can('read', 'User', ['id', 'username'])` -> `$select: ['id', 'username']`
- Support to define abilities for anything (providers, users, roles, 3rd party apps, ...)
- Fully supported adapters: `feathers-knex`, `feathers-memory`, `feathers-mongodb`, `feathers-mongoose`, `feathers-nedb`, `feathers-objection`, `feathers-sequelize`
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
npm i feathers-casl
# or
yarn add feathers-casl
```

## Getting Started

### Provide app wide `feathers-casl` options

```js
// app.js
const casl = require('feathers-casl');

app.configure(casl());
```

The `casl()` function can be configured, to provide app wide options to `feathers-casl`

### Define static rules

For most cases we want to define rules per user (or per user-role). So we first add a function which returns an `ability` from `@casl/ability` with these rules:

```js
// src/services/authentication/authentication.abilities.js
const { AbilityBuilder, createAliasResolver, makeAbilityFromRules } = require('feathers-casl');

// don't forget this, as `read` is used internally
const resolveAction = createAliasResolver({
  update: 'patch',       // define the same rules for update & patch
  read: ['get', 'find'], // use 'read' as a equivalent for 'get' & 'find'
  delete: 'remove'       // use 'delete' or 'remove'
});

const defineRulesFor = (user) => {
  // also see https://casl.js.org/v5/en/guide/define-rules
  const { can, cannot, rules } = new AbilityBuilder();

  if (user.role && user.role.name === 'SuperAdmin') {
    // SuperAdmin can do evil
    can('manage', 'all');
    return rules;
  }

  if (user.role && user.role.name === 'Admin') {
    can('create', 'users');
  }

  can('read', 'users');
  can('update', 'users', { id: user.id });
  cannot('update', 'users', ['roleId'], { id: user.id });
  cannot('delete', 'users', { id: user.id });

  can('manage', 'tasks', { userId: user.id });
  can('create-multi', 'posts', { userId: user.id })

  return rules;
};

const defineAbilitiesFor = (user) => {
  const rules = defineRulesFor(user);

  return makeAbilityFromRules(rules, { resolveAction });
};

module.exports = {
  defineRulesFor,
  defineAbilitiesFor
};

```
Typescript version of the code:

```js
// src/services/authentication/authentication.abilities.ts
import { createAliasResolver, makeAbilityFromRules } from 'feathers-casl';
import { AbilityBuilder, Ability } from '@casl/ability';

// don't forget this, as `read` is used internally
const resolveAction = createAliasResolver({
    update: 'patch',       // define the same rules for update & patch
    read: ['get', 'find'], // use 'read' as a equivalent for 'get' & 'find'
    delete: 'remove'       // use 'delete' or 'remove'
});

export const defineRulesFor = (user: any) => {
    // also see https://casl.js.org/v5/en/guide/define-rules
    const { can, cannot, rules } = new AbilityBuilder(Ability);

    if (user.role && user.role.name === 'SuperAdmin') {
        // SuperAdmin can do evil
        can('manage', 'all');
        return rules;
    }

    if (user.role && user.role.name === 'Admin') {
        can('create', 'users');
    }

    can('read', 'users');
    can('update', 'users', { id: user.id });
    cannot('update', 'users', ['roleId'], { id: user.id });
    cannot('delete', 'users', { id: user.id });

    can('manage', 'tasks', { userId: user.id });
    can('create-multi', 'posts', { userId: user.id });

    return rules;
};

export const defineAbilitiesFor = (user: any) => {
    const rules = defineRulesFor(user);

    return makeAbilityFromRules(rules, { resolveAction });
};

```

### Add abilities to hooks context

`feathers-casl` by default looks for `context.params.ability` in the `authorize`-hook and `connection.ability` in the channels. You want to `authorize` users who are `authenticated` first with `@feathers/authentication`. We can add hooks to the `/authentication` service to populate things to `context.params` and `connection` under the hood. We use this here to put `ability` on these objects, which makes it available to all hooks after the `authenticate(...)`-hook. This way we can define rules in just one place:
``

```js{19-27}
// src/services/authentication/authentication.hooks.js
const { defineAbilitiesFor } = require('./abilities');

module.exports = {
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
      context => {
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

```js{5-6,12,15,18,21,24,27,33}
// src/services/tasks/tasks.hooks.js
const { authenticate } = require('@feathersjs/authentication').hooks;
const { authorize } = require('feathers-casl').hooks;

// CAUTION! Make sure the adapter name fits your adapter (e.g. feathers-mongodb, feathers-sequelize, feathers-objection, feathers-knex, ...)!
// You'll want to have the `authorize` as an early before-hook (right after the `authenticate` hook) and as a late after hook, since it could modify the result based on the ability of the requesting user

module.exports = {
  before: {
    all: [authenticate('jwt')],
    find: [
      authorize({ adapter: 'feathers-mongoose' })
    ],
    get: [
      authorize({ adapter: 'feathers-mongoose' })
    ],
    create: [
      authorize({ adapter: 'feathers-mongoose' })
    ],
    update: [
      authorize({ adapter: 'feathers-mongoose' })
    ],
    patch: [
      authorize({ adapter: 'feathers-mongoose' })
    ],
    remove: [
      authorize({ adapter: 'feathers-mongoose' })
    ]
  },

  after: {
    all: [
      authorize({ adapter: 'feathers-mongoose' })
    ],
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

### Whitelist operators

For `feathers-casl` to work properly, you have to whitelist some operators in your service options.
Also make sure to set the adapter option in your `authorize` hook like: `authorize({ adapter: 'feathers-mongoose' })`

- **feathers-memory**: `app.use('...', new Service({ whitelist: ['$nor', '$and'] }))`
- **feathers-nedb**: `app.use'...', new Service({ whitelist: ['$not', '$and'] }))`
- **feathers-mongodb**: `app.use("...', new Service({ whitelist: ['$nor', $and'] }))`
- **feathers-mongoose**: `app.use("...", new Service({ whitelist: ['$nor', '$and'] }))`
- **feathers-knex**: `app.use("...", new Service({ whitelist: ["$not"] }))`
- **feathers-objection**: *nothing to do* :)
- **feathers-sequelize**: This one is a little bit different than the others. See the following:
```js{2,8-11}
const { Service } = require("feathers-sequelize");
const { Op } = require("sequelize");

// ...

app.use('...', new Service({
  Model,
  operators: {
    $not: Op.not
  },
  whitelist: ["$not"]
}))

```

### Add CASL to channels

To unleash the full power of `feathers-casl` you want to add it to your `channels.js` so every user just gets updates only to items they can really read. It's as simple as the following example. For more information see: [channels](/channels.html)

```js{2-5,13,16}
// src/channels.js
const {
  getChannelsWithReadAbility,
  makeOptions
} = require('feathers-casl').channels;

module.exports = function (app) {
  if (typeof app.channel !== 'function') {
    // If no real-time functionality has been configured just return
    return;
  }

  const caslOptions = makeOptions(app);

  app.publish((data, context) => {
    return getChannelsWithReadAbility(app, data, context, caslOptions);
  });
};
```

### Using CASL with the REST (Express.js) transport

In case you are not using sockets and want to use `feathers-casl` with the Express transport, you need to define the abilities right after your `authenticate()` hook and before the `authorize()` hook for each service relying on CASL.

```js
// src/services/tasks/tasks.hooks.js

module.exports = {
  before: {
    all: [
      authenticate('jwt'),
      
      // Add this to set abilities, if a user exists
      context => {
        const { user } = context.params
        if (user) context.params.ability = defineAbilitiesFor(user)
        return context
      }
    ]

    // ...
  },

  // ...
};

```

## Testing

Simply run `npm test` and all your tests in the `test/` directory will be run. The project has full support for *Visual Studio Code*. You can use the debugger to set breakpoints.

## Help

For more information on all the things you can do, visit [FeathersJS](http://docs.feathersjs.com) and [CASL](https://casl.js.org/v5/en/).
