# feathers-casl

<p align="center">
  <img src="https://feathers-casl.netlify.app/img/logo.svg" width="200">
</p>

[![npm](https://img.shields.io/npm/v/feathers-casl)](https://www.npmjs.com/package/feathers-casl)
[![Github CI](https://github.com/fratzinger/feathers-casl/actions/workflows/node.js.yml/badge.svg)](https://github.com/fratzinger/feathers-casl/actions)
[![Maintainability](https://qlty.sh/gh/fratzinger/projects/feathers-casl/maintainability.svg)](https://qlty.sh/gh/fratzinger/projects/feathers-casl)
[![Code Coverage](https://qlty.sh/gh/fratzinger/projects/feathers-casl/coverage.svg)](https://qlty.sh/gh/fratzinger/projects/feathers-casl)
[![libraries.io](https://img.shields.io/librariesio/release/npm/feathers-casl)](https://libraries.io/npm/feathers-casl)
[![npm](https://img.shields.io/npm/dm/feathers-casl)](https://www.npmjs.com/package/feathers-casl)
[![GitHub license](https://img.shields.io/github/license/fratzinger/feathers-casl)](https://github.com/fratzinger/feathers-casl/blob/main/LICENSE)
[![Discord](https://badgen.net/badge/icon/discord?icon=discord&label)](https://discord.gg/qa8kez8QBx)

> NOTE: This is the version for Feathers v5. For Feathers v4 use [feathers-casl v0](https://github.com/fratzinger/feathers-casl/tree/crow)

## About

Add access control with CASL to your feathers application.

This project is built for [FeathersJS](http://feathersjs.com). An open source web framework for building modern real-time applications.
It's based on [CASL](https://casl.js.org/) and is a convenient layer to use **CASL** in feathers.js.

## Features

- Fully powered by Feathers 5 & CASL 6
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

## Documentation

You need more information? Please have a look:
https://feathers-casl.netlify.app/

## Installation

```bash
npm i feathers-casl @casl/ability
```

## Testing

Simply run `npm test` and all your tests in the `test/` directory will be run. It has full support for _Visual Studio Code_. You can use the debugger to set breakpoints.

## Help

For more information on all the things you can do, visit [FeathersJS](http://docs.feathersjs.com) and [CASL](https://casl.js.org/v6/en/).

## License

Licensed under the [MIT license](LICENSE).

<a href="https://www.netlify.com"> <img src="https://www.netlify.com/v3/img/components/netlify-color-accent.svg" alt="Deploys by Netlify" /> </a>
