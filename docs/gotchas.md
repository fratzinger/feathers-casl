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

The same order applies the other way around: a `can` declared **after** a `cannot` overrules it and stays unrestricted. `feathers-casl` builds its queries accordingly, so `find` returns exactly the records that `ability.can()` allows:

```ts
const ability = defineAbility((can, cannot) => {
  can("read", "posts", { authorId: 1 });
  cannot("read", "posts", { published: false });
  // declared last -> wins, unpublished posts of author 2 stay readable
  can("read", "posts", { authorId: 2 });
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

`$and` can also show up **inside** an `$or` branch when a `can` overrules an earlier `cannot` (see [Mind the order of your rules](#mind-the-order-of-your-rules)) and both rules restrict the same property. Whitelisting `$and` in `operators` covers that case as well.

### `GeneralError: feathers-casl: cannot negate ...`

Adapters without native support for inverted rules (e.g. `@feathersjs/knex`) get each operator of a `cannot` condition negated one by one. Only `$gt`, `$gte`, `$lt`, `$lte`, `$in`, `$nin` and `$ne` (and plain equality) can be negated:

```ts
can('read', 'tasks')
cannot('read', 'tasks', { title: { $like: '%secret%' } }) // throws on @feathersjs/knex
```

If nothing of a `cannot` condition can be negated, `feathers-casl` throws instead of dropping the rule - dropping it would let `find` return records that `ability.can()` denies. If only part of it can be negated, the rest is left out with a warning, which makes the query stricter than the rule.

Either use invertible operators in `cannot` rules, or an adapter with native support for inverted rules: `@feathersjs/memory`, `@feathersjs/mongodb`, `feathers-kysely` or `feathers-sequelize`.
