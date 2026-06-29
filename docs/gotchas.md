# Gotchas

Here is the place for common mistakes for defined rules and unexpected behavior.

## General

### Mind the order of your rules

The following example results in an error, because all rules will be considered in the given order. Rules overwrite/specify the rules before.

```ts
const ability = defineAbility((can, cannot) => {
  can("read", "users");
  cannot("read", "users");
});
```

## Fields

### Conditional subset

```ts
const user = { id: 1 };

const ability = defineAbility((can, cannot) => {
  can("read", "users", ["id", "name", "email"]);
  can("read", "users", ["password"], { id: user.id });
});
```

#### What do you expect?

Do you think it results in `{ $select: ["id", "name", "email", "password"] }` for the current user and `{ $select: ["id", "name", "email"] }` for all other users?

#### Actual behavior:

- current user: `{ $select: [] }`
- all other users: `{ $select: ["id", "name", "email", "password"] }`

#### correct definition:

With the following configuration you only get `["id", "name", "email"]` for all other users and the complete user item for the current user.

```ts
const user = { id: 1 };

const ability = defineAbility((can, cannot) => {
  can("read", "users", ["id", "name", "email"], { id: { $ne: 1 } });
  can("read", "users", { id: user.id });
});
```

## You're not allowed to get on 'users'

To prevent the error `You're not allowed to get on 'users'`, you need to define the abilities right after your `authenticate()` hook and before the `authorize()` hook for the `get` method of the user service.

```ts
// src/services/users/users.hooks.js

export default {
  before: {
    get: [
      authenticate('jwt'),

      // Add this to set abilities, if a user exists
      context => {
        if (context.params.ability) { return context; }
        const { user } = context.params
        if (user) context.params.ability = defineAbilitiesFor(user)
        return context
      }

      authorize({ adapter: '@feathersjs/mongodb' }),
    ]

    // ...
  },

  // ...
};
```

## Query / Operators

### `BadRequest: Invalid query parameter $and` (or `$nor` / `$not`)

`feathers-casl` merges your rule conditions into the incoming query. Inverted rules (`cannot(...)`) are expressed with `$nor`/`$not`, and whenever a rule condition and the query restrict the same property, both are combined with `$and`. If your adapter validates queries (e.g. `@feathersjs/memory`, `@feathersjs/mongodb`) and the operator isn't whitelisted, you'll get an error like:

```
BadRequest: Invalid query parameter $and
```

Whitelist the required operators in your service options — see [Getting Started — Filters / Operators](/getting-started#filters-operators):

```ts
app.use('...', new Service({ filters: { $nor: true }, operators: ['$nor', '$and'] }))
```
