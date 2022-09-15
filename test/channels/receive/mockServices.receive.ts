import type { Application, HookContext } from "@feathersjs/feathers";
import { AuthenticationService, JWTStrategy } from "@feathersjs/authentication";
import { LocalStrategy } from "@feathersjs/authentication-local";
import { expressOauth } from "@feathersjs/authentication-oauth";

import type { Ability } from "../../../lib";
import { createAliasResolver, defineAbility } from "../../../lib";
import { Service } from "feathers-memory";
import hashPassword from "@feathersjs/authentication-local/lib/hooks/hash-password";
import protect from "@feathersjs/authentication-local/lib/hooks/protect";
import type { ServiceCaslOptions } from "../../../lib/types";

const resolveAction = createAliasResolver({
  update: "patch",
  read: ["get", "find"],
  delete: "remove",
});

declare module "@feathersjs/adapter-commons" {
  interface ServiceOptions {
    casl: ServiceCaslOptions
  }
}
  
const defineAbilitiesFor = (user): Ability => {
  //@ts-ignore
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  return defineAbility((can, cannot) => {
    if (user.id === 0) {
      can("manage", "all");
    } else if (user.id === 1) {
      can("read", "articles", { published: true });
      can("read", "comments", ["id", "title"], { userId: user.id });
    } else if (user.id === 2) {
      can("read", "comments", { userId: user.id });
    } else if (user.id === 3) {
      can("receive", "all");
    } else if (user.id === 4) {
      can("receive", "comments", ["id"], { userId: user.id });
    }
  }, { resolveAction });
};

export default function(app: Application): void {
  //#region authentication
  const authentication = new AuthenticationService (app);

  authentication.register("jwt", new JWTStrategy());
  authentication.register("local", new LocalStrategy());

  app.use("/authentication", authentication);
  app.configure(expressOauth());

  const authService = app.service("authentication");
  authService.hooks({
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
    }
  });

  //#endregion

  //#region articles

  app.use("articles", new Service({
    multi: true,
    casl: {
      availableFields: ["id", "test", "published", "test"]
    }
    //paginate: 
  }));

  //#endregion

  //#region comments

  app.use("comments", new Service({
    multi: true,
    casl: {
      availableFields: ["id", "title", "userId", "test"]
    }
    //paginate:
  }));

  //#endregion

  //#region users
  app.use("users", new Service({
    multi: true,
    casl: {
      availableFields: ["id", "email", "password"]
    }
    //paginate: 
  }));

  const users = app.service("users");

  users.hooks({
    before: {
      all: [],
      find: [],
      get: [],
      create: [ hashPassword("password") ],
      update: [ hashPassword("password") ],
      patch: [ hashPassword("password") ],
      remove: []
    },
    after: {
      all: [ 
        // Make sure the password field is never sent to the client
        // Always must be the last hook
        protect("password")
      ]
    }
  });
  //#endregion
}
