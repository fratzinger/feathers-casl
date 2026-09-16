# Migrating to v4

`feathers-casl` v4 requires `@casl/ability` v7. Everything below is a change
you may have to act on - if none of it applies to your app, the upgrade is a
version bump.

```bash
npm i feathers-casl@4 @casl/ability@7
```

## `@casl/ability` v7

v7 renamed `PureAbility` to `Ability` and dropped the default options, so the
old `Ability` - the one with the MongoDB conditions matcher - is now
`createMongoAbility`. `new Ability(rules)` still compiles, but it no longer
matches conditions, which silently turns every conditional rule into a rule
that never applies.

```ts
// before
import { Ability, AbilityBuilder } from "@casl/ability";

const { can, cannot, rules } = new AbilityBuilder(Ability);
return new Ability(rules, { resolveAction });

// after
import { AbilityBuilder, createMongoAbility } from "@casl/ability";

const { can, cannot, rules } = new AbilityBuilder(createMongoAbility);
return createMongoAbility(rules, { resolveAction });
```

`defineAbility` is unchanged. See the
[CASL v7 release notes](https://github.com/stalniy/casl/blob/master/packages/casl-ability/CHANGELOG.md)
for the rest.

## A `cannot` no longer restricts the rules after it

This is the change most likely to be visible in your app.

`feathers-casl` turns your rules into a query for `find`, multi-`patch` and
multi-`remove`. It now follows the same precedence casl uses for a single
item: the last matching rule wins, so a `cannot` bounds the `can` rules
declared **before** it and is ignored by the ones declared after it.

```ts
defineAbility((can, cannot) => {
  cannot("read", "posts", { blocked: true });
  can("read", "posts", { authorId: user.id });
});
```

Up to v3 the generated query kept both, and excluded blocked posts even
though `ability.can()` allowed them. v4 drops the `cannot`, matching
`ability.can()`. Swap the two rules to get the old query back.

## Queries come out flatter

`$and` and `$or` are only used when there is more than one branch to combine,
and conditions that describe the same thing get merged - several
`can(..., { userId: n })` rules now produce `{ userId: { $in: [...] } }`
instead of `{ $or: [{ userId: 1 }, { userId: 2 }] }`.

If you snapshot `context.params.query` in tests, expect churn. If you had to
whitelist `$and`/`$or` only to satisfy `feathers-casl`, you may not need them
anymore - see [Gotchas](/gotchas#query-operators).

## An inverted rule the adapter can't express now throws

On adapters without native support for inverted rules - `@feathersjs/knex`,
and anything you haven't mapped - a `cannot` is negated operator by operator,
and only `$gt`, `$gte`, `$lt`, `$lte`, `$in`, `$nin` and `$ne` can be
negated. Anything else used to be skipped with a message on stderr, which
meant a rule like

```ts
cannot("read", "posts", { title: { $like: "%draft%" } });
```

produced an empty query and the records it was meant to hide were returned.
v4 throws a `GeneralError` naming the operator instead.

Either express the rule with the operators above, or use an adapter that
handles inverted rules natively: `@feathersjs/memory`, `@feathersjs/mongodb`,
`@fratzinger/feathers-kysely` or `feathers-sequelize`.

## `@feathersjs/feathers` is peer-only

It was listed as both a dependency and a peer dependency, so a second copy
could end up in your tree. It's peer-only now. Nothing to do unless you
relied on `feathers-casl` installing feathers for you.

## `hasRestrictingConditions` returns a boolean

It used to hand back the rule array it looked at. If you used those rules,
call `ability.possibleRulesFor(action, modelName)` yourself. Truthiness is
unchanged, so `if (hasRestrictingConditions(...))` keeps working.
