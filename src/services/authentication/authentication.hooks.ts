import { Ability, createAliasResolver, defineAbility } from "../../../lib";
import { HookContext } from "@feathersjs/feathers";

const resolveAction = createAliasResolver({
  update: "patch",
  read: ["get", "find"],
  delete: "remove",
});

const defineAbilitiesFor = (user): Ability => {
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  return defineAbility({ resolveAction }, (can, cannot) => {
    if (user.id === 0) {
      can("manage", "all");
    } else if (user.id === 1) {
      can("read", "articles", { published: true });
      can("read", "comments", ["id", "title"], { userId: user.id });
    } else if (user.id === 2) {
      can("read", "comments", { userId: user.id });
    }
  });
};

export default {
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
      (context: HookContext): HookContext => {
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
  