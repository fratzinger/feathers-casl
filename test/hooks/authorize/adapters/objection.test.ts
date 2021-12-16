import { Model } from "objection";
import makeTests from "./makeTests";
import { Service } from "feathers-objection";
import { getItems } from "feathers-hooks-common";
import knex from "knex";
import path from "path";
import { HookContext } from "@feathersjs/feathers";

const db  = knex({
  client: "sqlite3",
  debug: false,
  connection: {
    filename: path.join(__dirname, "../../../.data/db.sqlite")
  },
  useNullAsDefault: true
});

Model.knex(db);

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
      hidden: { type: ["boolean", "null"] }
    }
  }
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
        "hidden"
      ]
    },
    paginate: {
      default: 10,
      max: 50
    }
  });
};

const boolFields = [
  "test",
  "published",
  "supersecret",
  "hidden"
];

const afterHooks = [
  (context: HookContext) => {
    //@ts-expect-error type error because feathers-hooks-common not on feathers@5
    let items = getItems(context);
    const isArray = Array.isArray(items);
    items = (isArray) ? items : [items];

    const result = items;

    result.forEach((item, i) => {
      const keys = Object.keys(item);
      keys.forEach(key => {
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

    context.result = (isArray) ? result : result[0];
  }
];

makeTests(
  "feathers-objection", 
  makeService, 
  async () => {
    await db.schema.dropTableIfExists("tests");
    await db.schema.createTable("tests", table => {
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
  afterHooks
);
