import { MongoMemoryServer } from "mongodb-memory-server";
import mongoose from "mongoose";
import { Service } from "feathers-mongoose";
mongoose.Promise = global.Promise;

import makeTests from "./_makeTests";
import { getItems } from "feathers-hooks-common";

let Model;

const makeService = () => {
  return new Service({
    Model,
    multi: true,
    lean: true,
    whitelist: ["$nor"],
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
    let items = getItems(context);
    items = (Array.isArray(items)) ? items : [items];
  
    items.forEach(item => {
      delete item.__v;        
    });
  }
];

describe("authorize-hook mongoose", function() {
  before(async function() {
    const server = new MongoMemoryServer();
    const uri = await server.getUri();

    const client = await mongoose.connect(uri);

    const { Schema } = client;
    const schema = new Schema({
      userId: { type: Number },
      hi: { type: String },
      test: { type: Boolean },
      published: { type: Boolean },
      supersecret: { type: Boolean },
      hidden: { type: Boolean }
    }, {
      timestamps: false,
      skipVersioning: true
    });

    if (client.modelNames().includes("tests")) {
      client.deleteModel("tests");
    }
    Model = client.model("tests", schema);
  });

  makeTests(
    "feathers-mongoose", 
    makeService, 
    async (app, service) => { 
      await service.remove(null);
    },
    { adapter: "feathers-mongoose" },
    afterHooks
  );
});