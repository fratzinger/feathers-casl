import { Model } from "objection";
import makeTests from "./makeTests";
import { Service } from "feathers-objection";
import { getItemsIsArray } from "feathers-utils";
import knex from "knex";
import path from "node:path";
import type { ServiceCaslOptions } from "../../../../src";
import type { HookContext } from "@feathersjs/feathers";

const db = knex({
  client: "sqlite3",
  debug: false,
  connection: {
    filename: path.join(__dirname, "../../../.data/db.sqlite"),
  },
  useNullAsDefault: true,
});

Model.knex(db);

declare module "feathers-objection" {
  interface ObjectionServiceOptions {
    casl: ServiceCaslOptions;
  }
}

class TestModel extends Model {
  static get tableName() {
    return "tests";
  }

  static jsonSchema = {
    type: "object",
    properties: {
      userId: { type: ["integer", "null"] },
      hi: { type: ["string", "null"] },
      test: { type: ["boolean", "null"] },
      published: { type: ["boolean", "null"] },
      supersecret: { type: ["boolean", "null"] },
      hidden: { type: ["boolean", "null"] },
    },
  };
}

const makeService = () => {
  return new Service({
    model: TestModel,
    multi: true,
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
    // filters: {
    //   // @ts-ignore
    //   ...filterArray("$and")
    // }
  });
};

const boolFields = ["test", "published", "supersecret", "hidden"];

const afterHooks = [
  (context: HookContext) => {
    const { items, isArray } = getItemsIsArray(context);

    const result = items;

    result.forEach((item, i) => {
      const keys = Object.keys(item);
      keys.forEach((key) => {
        if (item[key] === null) {
          delete item[key];
          return;
        }
        if (boolFields.includes(key)) {
          item[key] = !!item[key];
        }
      });

      result[i] = { ...item };
    });

    context.result = isArray ? result : result[0];
  },
];

makeTests(
  "feathers-objection",
  makeService,
  async () => {
    await db.schema.dropTableIfExists("tests");
    await db.schema.createTable("tests", (table) => {
      table.increments("id");
      table.integer("userId");
      table.string("hi");
      table.boolean("test");
      table.boolean("published");
      table.boolean("supersecret");
      table.boolean("hidden");
    });
  },
  { adapter: "feathers-objection" },
  afterHooks,
);
