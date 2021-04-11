import { Sequelize, DataTypes, Op } from "sequelize";
import makeTests from "./_makeTests";
import { Service } from "feathers-sequelize";
import { getItems } from "feathers-hooks-common";

const sequelize = new Sequelize("sequelize", "", "", {
  dialect: "sqlite",
  storage: "../.data/db.sqlite",
  logging: false
});

const Model = sequelize.define("tests", {
  userId: {
    type: DataTypes.INTEGER
  },
  hi: {
    type: DataTypes.STRING
  },
  test: {
    type: DataTypes.BOOLEAN
  },
  published: {
    type: DataTypes.BOOLEAN
  },
  supersecret: {
    type: DataTypes.BOOLEAN
  },
  hidden: {
    type: DataTypes.BOOLEAN
  }
}, {
  timestamps: false
});

declare module "feathers-sequelize" {
  interface SequelizeServiceOptions {
    operators: Record<string, unknown>
  }
}

const makeService = () => {
  return new Service({
    Model,
    multi: true,
    operators: {
      $not: Op.not
    },
    whitelist: ["$not"],
    casl: {
      availableFields: [
        "id", 
        "userId", 
        "hi", 
        "test", 
        "published",
        "supersecret", 
        "hidden"
      ]
    },
    paginate: {
      default: 10,
      max: 50
    }
  });
};

const afterHooks = [
  context => {
    const { Model } = context.service;
    const fields = Model.fieldRawAttributesMap;
    let items = getItems(context);
    items = (Array.isArray(items)) ? items : [items];

    items.forEach(item => {
      const keys = Object.keys(item);
      keys.forEach(key => {
        const field = fields[key];
        if (item[key] === null) {
          delete item[key];
          return;
        }
        // @ts-ignore
        if (field.type instanceof DataTypes.BOOLEAN) {
          item[key] = !!item[key];
        }
      });
    });
  }
];

describe("authorize-hook sequelize", function() {
  makeTests(
    "feathers-sequelize", 
    makeService, 
    async () => { 
      await Model.sync({ force: true });
    },
    { adapter: "feathers-sequelize" },
    afterHooks
  );
});