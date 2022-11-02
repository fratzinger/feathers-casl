# Gotchas

Here is the place for common mistakes for defined rules and unexpected behavior.

## General

### Mind the order of your rules

The following example results in an error, because all rules will be considered in the given order. Rules overwrite/specify the rules before.

```js
const ability = defineAbility((can, cannot) => {
  can("read", "users");
  cannot("read", "users");
});
```

## Fields

### Conditional subset

```js
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

```js
const user = { id: 1 };

const ability = defineAbility((can, cannot) => {
  can("read", "users", ["id", "name", "email"], { id: { $ne: 1 } });
  can("read", "users", { id: user.id });
});
```

## You're not allowed to get on 'users'

To prevent the error `You're not allowed to get on 'users'`, you need to define the abilities right after your `authenticate()` hook and before the `authorize()` hook for the `get` method of the user service.

```js
// src/services/users/users.hooks.js

module.exports = {
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

      authorize({ adapter: 'feathers-mongoose' }),
    ]

    // ...
  },

  // ...
};
```
