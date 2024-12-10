import { MongoMemoryServer } from "mongodb-memory-server";
import { MongoClient } from "mongodb";
import { MongoDBService } from "@feathersjs/mongodb";

import makeTests from "../makeTests";
import type { Adapter, ServiceCaslOptions } from "../../../../../src";
import { filterArray } from "feathers-utils";

let Model;

declare module "@feathersjs/mongodb" {
  interface MongoDBAdapterOptions {
    casl: ServiceCaslOptions;
  }
}

const makeService = () => {
  return new MongoDBService({
    Model,
    multi: true,
    operators: ["$nor"],
    filters: {
      ...filterArray("$nor"),
    },
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

beforeAll(async function () {
  const server = await MongoMemoryServer.create();
  const uri = server.getUri();

  const client = await MongoClient.connect(uri);
  Model = client.db("tests").collection("tests");
});

const adapter: Adapter = "@feathersjs/mongodb";

makeTests(
  adapter,
  makeService,
  async (app, service) => {
    await service.remove(null);
  },
  { adapter }
);
