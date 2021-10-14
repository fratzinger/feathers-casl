import assert from "assert";
import { createAliasResolver, defineAbility } from "@casl/ability";
import { Sequelize, Op, DataTypes } from "sequelize";
import feathers from "@feathersjs/feathers";
import { Service } from "feathers-sequelize";
import authorize from "../../lib/hooks/authorize/authorize.hook";
import path from "path";

declare module "feathers-sequelize" {
  interface SequelizeServiceOptions {
    operators: Record<string, unknown>
  }
}

describe("authorize.users.test.ts", function() {
  function mockAbility(user) {
    const ability = defineAbility((can, cannot) => {
      can("manage", "all", { companyId: 1 });
      can("manage", "all", { companyId: 2 });
      cannot(["create", "update", "patch", "remove"], "users", { roleId: 0 });
      cannot("remove", "users", { id: user.id });
      cannot(["update", "patch"], "users", ["roleId"], { id: user.id });
      cannot(["update", "patch"], "users", ["companyId"]);
    }, {
      resolveAction: createAliasResolver({
        update: "patch",
        read: ["get", "find"],
        delete: "remove"
      })
    });
    return ability;
  }

  async function mockApp(hook) {
    const sequelize = new Sequelize("sequelize", "", "", {
      dialect: "sqlite",
      storage: path.join(__dirname, "../.data/db2.sqlite"),
      logging: false
    });

    const UserModel = sequelize.define("users", {
      companyId: {
        type: DataTypes.INTEGER
      },
      name: {
        type: DataTypes.STRING
      },
      roleId: {
        type: DataTypes.INTEGER
      }
    });

    await sequelize.sync();

    const app = feathers();

    app.use("/users", new Service({
      Model: UserModel,
      multi: true,
      operators: {
        $not: Op.not
      },
      whitelist: ["$not"]
    }));

    const service = app.service("users");

    service.hooks({
      before: {
        all: [
          authorize({
            adapter: "feathers-sequelize"
          }),
          hook
        ],
        find: [],
        get: [],
        create: [],
        update: [],
        patch: [],
        remove: []
      },
      after: {
        all: [
          authorize({
            adapter: "feathers-sequelize"
          })
        ],
        find: [],
        get: [],
        create: [],
        update: [],
        patch: [],
        remove: []
      }
    });

    return { service };
  }

  it("user can update user", async function() {
    let hadAbility = false;
    const { service } = await mockApp(
      (context) => {
        if (!context.params.ability) { return context; }
        hadAbility = true;
      }
    );
    const admin = await service.create({ name: "user1", roleId: 1, companyId: 1 });
    const user2 = await service.create({ name: "user2", roleId: 2, companyId: 1 });
    const ability = mockAbility(admin);

    const user2Patched = await service.patch(user2.id, { roleId: 3 }, { ability });
    assert.deepStrictEqual(user2Patched.roleId, 3);
    assert.ok(hadAbility);
  });
});