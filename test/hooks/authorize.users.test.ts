import assert from "assert";
import { createAliasResolver, defineAbility } from "@casl/ability";
import { Sequelize, Op, DataTypes } from "sequelize";
import { feathers, NextFunction } from "@feathersjs/feathers";
import { Service } from "feathers-sequelize";
import authorize from "../../lib/hooks/authorize/authorize.hook";
import { authorizeAround } from "../../lib/hooks/authorize/authorize.hook";
import path from "path";

declare module "feathers-sequelize" {
  interface SequelizeServiceOptions {
    operators: any
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

  async function mockApp(hooks) {
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

    service.hooks(hooks);

    return { service };
  }

  it("user can update user: before/after", async function() {
    let hadAbility = false;
    const checkAbility = (context) => {
      if (!context.params.ability) { return context; }
      hadAbility = true;
    };
    const hooks = {
      before: {
        all: [
          authorize({ adapter: "feathers-sequelize" }),
          checkAbility
        ],
      },
      after: {
        all: [
          authorize({ adapter: "feathers-sequelize" })
        ],
      }
    };
    const { service } = await mockApp(hooks);
    const admin = await service.create({ name: "user1", roleId: 1, companyId: 1 });
    const user2 = await service.create({ name: "user2", roleId: 2, companyId: 1 });
    const ability = mockAbility(admin);

    const user2Patched: Record<string, any> = await service.patch(user2.id, { roleId: 3 }, { ability } as any);
    assert.deepStrictEqual(user2Patched.roleId, 3);
    assert.ok(hadAbility);
  });

  it("user can update user: around", async function() {
    let hadAbility = false;
    const checkAbility = async (context, next: NextFunction) => {
      if (context.params.ability) {
        hadAbility = true;
      }
      await next();
    };
    const hooks = {
      around: {
        all: [authorizeAround({ adapter: "feathers-sequelize" }), checkAbility]
      }
    };
    const { service } = await mockApp(hooks);
    const admin = await service.create({ name: "user3", roleId: 1, companyId: 1 });
    const user2 = await service.create({ name: "user4", roleId: 2, companyId: 1 });
    console.log(admin, user2)
    const ability = mockAbility(admin);

    const user2Patched: Record<string, any> = await service.patch(user2.id, { roleId: 3 }, { ability } as any);
    assert.deepStrictEqual(user2Patched.roleId, 3);
    assert.ok(hadAbility);
  });
});