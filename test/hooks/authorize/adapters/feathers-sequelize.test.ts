import { Sequelize, DataTypes, Op } from "sequelize";
import makeTests from "./makeTests";
import { SequelizeService } from "feathers-sequelize";
import { getItemsIsArray, filterArray } from "feathers-utils";
import path from "node:path";
import type { ServiceCaslOptions } from "../../../../lib";
import type { HookContext } from "@feathersjs/feathers";

const sequelize = new Sequelize("sequelize", "", "", {
  dialect: "sqlite",
  storage: path.join(__dirname, "../../../.data/db.sqlite"),
  logging: false,
});

const Model = sequelize.define(
  "tests",
  {
    userId: {
      type: DataTypes.INTEGER,
    },
    hi: {
      type: DataTypes.STRING,
    },
    test: {
      type: DataTypes.BOOLEAN,
    },
    published: {
      type: DataTypes.BOOLEAN,
    },
    supersecret: {
      type: DataTypes.BOOLEAN,
    },
    hidden: {
      type: DataTypes.BOOLEAN,
    },
  },
  {
    timestamps: false,
  }
);

declare module "feathers-sequelize" {
  interface SequelizeAdapterOptions {
    casl?: ServiceCaslOptions;
  }
}

const makeService = () => {
  return new SequelizeService({
    Model,
    multi: true,
    operatorMap: {
      $not: Op.not,
      $and: Op.and,
    },
    filters: {
      ...filterArray("$not", "$and"),
    },
    operators: ["$not", "$and"],
    casl: {
      availableFields: [
        "id",
        "userId",
        "hi",
        "test",
        "published",
        "supersecret",
        "hidden",
      ],
    },
    paginate: {
      default: 10,
      max: 50,
    },
  });
};

const afterHooks = [
  (context: HookContext) => {
    const { Model } = context.service;
    const fields = Model.fieldRawAttributesMap;
    const { items } = getItemsIsArray(context);

    items.forEach((item) => {
      const keys = Object.keys(item);
      keys.forEach((key) => {
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
  },
];

makeTests(
  "feathers-sequelize",
  makeService,
  async () => {
    await Model.sync({ force: true });
  },
  { adapter: "feathers-sequelize" },
  afterHooks
);
