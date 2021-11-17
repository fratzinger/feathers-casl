---
title: Client side
sidebarDepth: 2
---

# Client side

## General

Thanks to the awesome work of [stalniy](https://github.com/stalniy) and his isomorphic approach, you can use the packages `@casl/ability`, `@casl/angular`, `@casl/react`, `@casl/vue` and `@casl/aurelia`. It's pretty straight forward.

### Feathers client

Since we defined the `ability` and `rules` in the `authentication:after/create` hook (see: [Getting Started](/getting-started.html#add-abilities-to-hooks-context)), we can use it on the client side.

## Angular

```bash
npm install @casl/angular @casl/ability
# or
yarn add @casl/angular @casl/ability
```

You're interested how it works for `angular`? Sorry, I can't help with that, since I just use it with `Vue`. As a starting point, see [#Feathers client](#feathers-client) and [@casl/angular](https://casl.js.org/v5/en/package/casl-angular). That will get you closer to the goal. If you got a working example anyway, I would be curious, how it works. Please create a issue or pull request and let me know.

## React

```bash
npm install @casl/react @casl/ability
# or
yarn add @casl/react @casl/ability
```

You're interested how it works for `react`? Sorry, I can't help with that, since I just use it with `Vue`. As a starting point, see [#Feathers client](#feathers-client) and [@casl/react](https://casl.js.org/v5/en/package/casl-react). That will get you closer to the goal. If you got a working example anyway, I would be curious, how it works. Please create a issue or pull request and let me know.

## FeathersVuex

### Installation

```bash
npm install @casl/vue @casl/ability
# or
yarn add @casl/vue @casl/ability
```

`FeathersVuex` differs from the general implementation. It's based on the huge amount of sugar [@marshallswain](https://github.com/feathersjs-ecosystem/feathers-vuex) has spread on top of that.

There are some things we want to ensure:
- get rules on `authenticate`
- delete rules on `logout`

The best way to keep the rules, is in our `vuex`-store. So first, we add a custom `casl`-vuex-plugin.

#### The vuex-plugin

```js
// src/store/vuex.plugin.casl.js
import { Ability, createAliasResolver, detectSubjectType as defaultDetector } from '@casl/ability';
import { BaseModel } from '@/src/store/feathers/client.js';

const detectSubjectType = (subject) => {
  if (typeof subject === 'string') return subject;
  if (!(subject instanceof BaseModel)) return defaultDetector(subject);
  return subject.constructor.servicePath;
}

const resolveAction = createAliasResolver({
  update: 'patch',       // define the same rules for update & patch
  read: ['get', 'find'], // use 'read' as a equivalent for 'get' & 'find'
  delete: 'remove'       // use 'delete' or 'remove'
});

const ability = new Ability([], { detectSubjectType, resolveAction });

const caslPlugin = (store) => {
  store.registerModule('casl', {
    namespaced: true,
    state: {
      ability: ability,
      rules: []
    },
    mutations: {
      setRules(state, rules) {
        state.rules = rules;
        state.ability.update(rules);
      }
    }
  });
  store.subscribeAction({
    after: (action, state) => {
      if (action.type === 'auth/responseHandler') {
        const { rules } = action.payload;
        if (!rules || !state.auth.user) {
          store.commit('casl/setRules', []);
          return;
        }

        store.commit('casl/setRules', rules);

      } else if (action.type === 'auth/logout') {
        store.commit('casl/setRules', []);
      }
    }
  });
};

export {
  ability,
  caslPlugin
};
```

#### Insert the vuex-module

```js
// src/store/index.js

import { caslPlugin } from '@/store/vuex.plugin.casl'; // your previously defined file

export const store = new Vuex.Store({
  plugins: [
    caslPlugin,
    ...
  ],
  ...
});
```

#### register the @casl/vue plugin

Now it's more like conventional `@casl/vue` work and we're almost done. It's mostly like the [Getting started of @casl/vue](https://casl.js.org/v5/en/package/casl-vue#getting-started)

```js
// main.js

import Vue from 'vue';
import { abilitiesPlugin } from '@casl/vue';
import { store } from '@/store';

Vue.use(abilitiesPlugin, store.state.casl.ability );
```

### Just use it

From here on, just follow the instructions at [@casl/vue](https://casl.js.org/v5/en/package/casl-vue#check-permissions-in-templates). For example:

```vue
<template>
  <div v-if="$can('create', 'posts')">
    <a @click='createPost'>Add Post</a>
  </div>
  <!-- or even a specific item -->
  <div>{{ post.title }}</div>
  <button :disabled="$can('update', post)" @click="task.save"></button>
</template>

<script>
export default {
  data() {
    return {
      task: new this.$$FeathersVuex.api.Task({}),
    }
  }
}
</script>
```

## Aurelia

```bash
npm install @casl/aurelia @casl/ability
# or
yarn add @casl/aurelia @casl/ability
```

You're interested how it works for `aurelia`? Sorry, I can't help with that, since I just use it with `Vue`. As a starting point, see [#Feathers client](#feathers-client) and [@casl/aurelia](https://casl.js.org/v5/en/package/casl-aurelia). That will get you closer to the goal. If you got a working example anyway, I would be curious, how it works. Please create a issue or pull request and let me know.

## Others

The listed examples above don't fit your needs? Sorry, I can't help with that, since I just use it with `Vue`. As a starting point, see [#Feathers client](#feathers-client). That will get you closer to the goal. If you got a working example anyway, I would be curious, how it works. Please create a issue or pull request and let me know.
