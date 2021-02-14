# feathers-casl

<p align="center">
    <img src="https://feathers-casl.netlify.app/img/logo.svg" width="200">
</p>

![npm](https://img.shields.io/npm/v/feathers-casl)
![GitHub Workflow Status](https://img.shields.io/github/workflow/status/fratzinger/feathers-casl/Node.js%20CI)
![Code Climate maintainability](https://img.shields.io/codeclimate/maintainability/fratzinger/feathers-casl)
![Code Climate coverage](https://img.shields.io/codeclimate/coverage/fratzinger/feathers-casl)
![David](https://img.shields.io/david/fratzinger/feathers-casl)
![npm](https://img.shields.io/npm/dm/feathers-casl)
[![GitHub license](https://img.shields.io/github/license/fratzinger/feathers-casl)](https://github.com/fratzinger/feathers-casl/blob/master/LICENSE)

## About

Add access control with CASL to your feathers application.

This project is built for [FeathersJS](http://feathersjs.com). An open source web framework for building modern real-time applications.
It's based on [CASL](https://casl.js.org/) and is a convenient layer to use **CASL** in feathers.js.

### Features
- Fully powered by Feathers & CASL
- Written in TypeScript
- Allows permissions for all methods `create`, `find`, `get`, `update`, `patch`, `remove`, or `create`, `read`, `update`, `delete`
- Define permissions not based on methods: `can('view', 'Settings')`
- Restrict by conditions: `can('create', 'Task', { userId: user.id })`
- Restrict by individual fields: `cannot('update', 'User', ['roleId'])`
- Native support for restrictive `$select`: `can('read', 'User', ['id', 'username'])` -> `$select: ['id', 'username']`
- Supports `channels` right away (every connection only gets updates based on `can('read' ...)`)
- `channels`-support also regards restrictive fields
- Disallow/allow `multi` methods (`create`, `patch`, `remove`) dynamically with: `can('remove-multi', 'Task', { userId: user.id })`
- Support for dynamic rules stored in your database
- Support to define abilities for anything (providers, users, roles, 3rd party apps, ...)
- Baked in support for `@casl/angular`, `@casl/react`, `@casl/vue` and `@casl/aurelia`

## Documentation
You need more information? Please have a look:
https://feathers-casl.netlify.app/

## Installation

```bash
npm i feathers-casl
```

## Testing

Simply run `npm test` and all your tests in the `test/` directory will be run.


## Help

For more information on all the things you can do, visit [the generator](https://generator.feathers-plus.com/), [FeathersJS](http://docs.feathersjs.com) and [CASL](https://casl.js.org/v5/en/).


## License

Licensed under the [MIT license](LICENSE).