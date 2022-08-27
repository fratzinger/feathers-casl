import { MongoMemoryServer } from "mongodb-memory-server";
import { MongoClient } from "mongodb";
import { MongoDBService } from "@feathersjs/mongodb";

import makeTests from "./makeTests";

let Model;

const makeService = () => {
  return new MongoDBService({
    Model,
    multi: true,
    filters: {
      $and: true,
      $nor: true
    } as const,
    operators: ["$and", "$nor"],
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
  } as any);
};

before(async function() {
  const server = await MongoMemoryServer.create();
  const uri = server.getUri();

  const client = await MongoClient.connect(uri);
  Model = client.db("tests").collection("tests");
});

makeTests(
  "@feathersjs/mongodb",
  makeService,
  async (app, service) => {
    await service.remove(null);
  },
  { adapter: "@feathersjs/mongodb" },
);
