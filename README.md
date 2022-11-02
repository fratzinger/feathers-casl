# feathers-casl

<p align="center">
  <img src="https://feathers-casl.netlify.app/img/logo.svg" width="200">
</p>

[![npm](https://img.shields.io/npm/v/feathers-casl)](https://www.npmjs.com/package/feathers-casl)
[![GitHub Workflow Status](https://img.shields.io/github/workflow/status/fratzinger/feathers-casl/Node.js%20CI)](https://github.com/fratzinger/feathers-casl/actions/workflows/node.js.yml?query=branch%3Amaster)
[![Code Climate maintainability](https://img.shields.io/codeclimate/maintainability/fratzinger/feathers-casl)](https://codeclimate.com/github/fratzinger/feathers-casl)
[![Code Climate coverage](https://img.shields.io/codeclimate/coverage/fratzinger/feathers-casl)](https://codeclimate.com/github/fratzinger/feathers-casl)
[![libraries.io](https://img.shields.io/librariesio/release/npm/feathers-casl)](https://libraries.io/npm/feathers-casl)
[![npm](https://img.shields.io/npm/dm/feathers-casl)](https://www.npmjs.com/package/feathers-casl)
[![GitHub license](https://img.shields.io/github/license/fratzinger/feathers-casl)](https://github.com/fratzinger/feathers-casl/blob/master/LICENSE)
[![Discord](https://badgen.net/badge/icon/discord?icon=discord&label)](https://discord.gg/qa8kez8QBx)

## About

Add access control with CASL to your feathers application.

This project is built for [FeathersJS](http://feathersjs.com). An open source web framework for building modern real-time applications.
It's based on [CASL](https://casl.js.org/) and is a convenient layer to use **CASL** in feathers.js.

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

## Documentation
You need more information? Please have a look:
https://feathers-casl.netlify.app/

## Installation

```bash
npm i feathers-casl
```

## Testing

Simply run `npm test` and all your tests in the `test/` directory will be run. It has full support for *Visual Studio Code*. You can use the debugger to set breakpoints.

## Help

For more information on all the things you can do, visit [FeathersJS](http://docs.feathersjs.com) and [CASL](https://casl.js.org/v5/en/).

## License

Licensed under the [MIT license](LICENSE).