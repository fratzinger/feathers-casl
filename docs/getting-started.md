---
title: Getting Started
sidebarDepth: 3
---

## About

Add access control with CASL to your feathers application.

This project is built for [FeathersJS](http://feathersjs.com). An open source web framework for building modern real-time applications.
It's based on [CASL](https://casl.js.org/) and is a convenient layer to use **CASL** in feathers.js.

## Features
- Fully powered by Feathers & CASL
- Written in TypeScript
- Allows permissions for all methods `create`, `find`, `get`, `update`, `patch`, `remove`, or `create`, `read`, `update`, `delete`
- Define permissions not based on methods: `can('view', 'Settings')`
- Restrict by conditions: `can('create', 'Task', { userId: user.id })`
- Restrict by individual fields: `cannot('update', 'User', ['roleId'])`
- Native support for restrictive `$select`: `can('read', 'User', ['id', 'username'])` -> `$select: ['id', 'username']`
- Supports `channels` right away (every connection only gets updates based on `can('read' ...)`)
- `channels`-support also regards restrictive fields
- Disallow/allow `multi` methods (`create`, `patch`, `remove`) dynamically with: `can('remove_multi', 'Task', { userId: user.id })`
- Support for dynamic rules stored in your database
- Support to define abilities for anything (providers, users, roles, 3rd party apps, ...)
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
// src/services/authentication/authentication.abilites.js
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
    can('create', 'User');
  }

  can('read', 'User');
  can('update', 'User', { id: user.id });
  cannot('update', 'User', ['roleId'], { id: user.id });
  cannot('delete', 'User', { id: user.id });

  can('manage', 'Task', { userId: user.id });
  can('create_multi', 'Post', { userId: user.id })

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

### Add abilities to hooks context

`feathers-casl` by default looks for `context.params.ability` in the `authorize`-hook and `connection.ability` in the channels. You want to `authorize` users who are `authenticated` first with `@feathers/authentication`. We can add hooks to the `/authentication` service to populate things to `context.params` and `connection` under the hood. We use this here to put `ability` on these objects, which makes it available to all hooks after the `authenticate(...)`-hook. This way we can define rules in just one place:
``

```js
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

The `authorize`-hook can be used for all methods and has support for `multi: true`. You should use it as a `before` **AND** a `after` hook at the same time. Please make sure to define `before` at last position and `after` at first position. So you don't want to use it in `app.hooks` nor in `all`. For more information, see: [#authorize-hook](/hook-authorize.html)

```js
// src/services/tasks/tasks.hooks.js
const { authenticate } = require('@feathersjs/authentication').hooks;
const { authorize } = require('feathers-casl').hooks;

module.exports = {
  before: {
    all: [authenticate('jwt')],
    find: [authorize()],
    get: [authorize()],
    create: [authorize()],
    update: [authorize()],
    patch: [authorize()],
    remove: [authorize()]
  },

  after: {
    all: [],
    find: [authorize()],
    get: [authorize()],
    create: [authorize()],
    update: [authorize()],
    patch: [authorize()],
    remove: [authorize()]
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

### Add CASL to channels

To unleash the full power of `feathers-casl` you want to add it to your `channels.js` so every user just gets updates only to items they can really read. It's as simple as the following example. For more information see: [channels](/channels.html)

```js
const {
  getChannelsWithReadAbility,
  makeDefaultOptions
} = require('feathers-casl').channels;

module.exports = function (app) {
  if (typeof app.channel !== 'function') {
    // If no real-time functionality has been configured just return
    return;
  }

  const caslOptions = makeOptions(app);

  // eslint-disable-next-line no-unused-vars
  app.publish((data, context) => {
    return getChannelsWithReadAbility(app, data, context, caslOptions);
  });
};
```