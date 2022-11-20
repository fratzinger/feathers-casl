import type { Application, HookContext } from "@feathersjs/feathers";
import { AuthenticationService, JWTStrategy } from "@feathersjs/authentication";
import { LocalStrategy } from "@feathersjs/authentication-local";

import type { Ability } from "../../../lib";
import { createAliasResolver, defineAbility } from "../../../lib";
import { MemoryService } from "@feathersjs/memory";
import hashPassword from "@feathersjs/authentication-local/lib/hooks/hash-password";
import protect from "@feathersjs/authentication-local/lib/hooks/protect";
import type { ServiceCaslOptions } from "../../../lib/types";

const resolveAction = createAliasResolver({
  update: "patch",
  read: ["get", "find"],
  delete: "remove",
});

declare module "@feathersjs/memory" {
  interface MemoryServiceOptions {
    casl?: ServiceCaslOptions;
  }
}

const defineAbilitiesFor = (user): Ability => {
  //@ts-ignore
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  return defineAbility(
    (can, cannot) => {
      if (user.id === 0) {
        can("manage", "all");
      } else if (user.id === 1) {
        can("receive-created", "articles", { published: true });
        can("receive-updated", "comments", ["test"]);
        can("receive-patched", "articles", { test: false });
        can("receive-patched", "comments");
        can("receive-removed", "articles", { userId: 1 });
        can("receive-removed", "comments", ["id"], { userId: 1 });
        can("read", "comments", ["id", "title"], { userId: user.id });
      } else if (user.id === 2) {
        can("receive", "all");
        can("receive-created", "comments", { userId: user.id });
      } else if (user.id === 3) {
        can(
          [
            "receive-created",
            "receive-updated",
            "receive-patched",
            "receive-removed",
          ],
          "all"
        );
      } else if (user.id === 4) {
        can("receive-created", "comments", ["id"], { userId: user.id });
      }
    },
    { resolveAction }
  );
};

export default function (app: Application): void {
  //#region authentication
  const authentication = new AuthenticationService(app);

  authentication.register("jwt", new JWTStrategy());
  authentication.register("local", new LocalStrategy());

  app.use("/authentication", authentication);

  const authService = app.service("authentication");
  authService.hooks({
    after: {
      all: [],
      create: [
        (context: HookContext): HookContext => {
          const { user } = context.result;
          if (!user) return context;
          const ability = defineAbilitiesFor(user);
          context.result.ability = ability;
          context.result.rules = ability.rules;

          return context;
        },
      ],
      remove: [],
    },
  });

  //#endregion

  //#region articles

  app.use(
    "articles",
    new MemoryService({
      multi: true,
      casl: {
        availableFields: ["id", "test", "published", "test"],
      },
      //paginate:
    })
  );

  //#endregion

  //#region comments

  app.use(
    "comments",
    new MemoryService({
      multi: true,
      casl: {
        availableFields: ["id", "title", "userId", "test"],
      },
      //paginate:
    })
  );

  //#endregion

  //#region users
  app.use(
    "users",
    new MemoryService({
      multi: true,
      casl: {
        availableFields: ["id", "email", "password"],
      },
      //paginate:
    })
  );

  const users = app.service("users");

  users.hooks({
    before: {
      all: [],
      find: [],
      get: [],
      create: [hashPassword("password")],
      update: [hashPassword("password")],
      patch: [hashPassword("password")],
      remove: [],
    },
    after: {
      all: [
        // Make sure the password field is never sent to the client
        // Always must be the last hook
        protect("password"),
      ],
    },
  });
  //#endregion
}
