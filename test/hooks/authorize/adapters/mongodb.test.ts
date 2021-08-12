import { MongoMemoryServer } from "mongodb-memory-server";
import { MongoClient } from "mongodb";
import { Service } from "feathers-mongodb";

import makeTests from "./makeTests";
import { ServiceCaslOptions } from "../../../../lib/types";

let Model;

declare module "@feathersjs/adapter-commons" {
  interface ServiceOptions {
    casl: ServiceCaslOptions
  }
}

const makeService = () => {
  return new Service({
    Model,
    multi: true,
    whitelist: ["$and", "$nor"],
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

before(async function() {
  const server = new MongoMemoryServer();
  const uri = await server.getUri();

  const client = await MongoClient.connect(uri);
  Model = client.db("tests").collection("tests");
});

makeTests(
  "feathers-mongodb", 
  makeService, 
  async (app, service) => { 
    await service.remove(null);
  },
  { adapter: "feathers-mongodb" },
);