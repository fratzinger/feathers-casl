import NeDB from "@seald-io/nedb";
import { Service } from "feathers-nedb";
import makeTests from "./makeTests";
import path from "path";

// Create a NeDB instance
const Model = new NeDB({
  filename: path.join(__dirname, "../../../.data/tests.db"),
  autoload: true
});

const makeService = () => {
  return new Service({
    Model,
    multi: true,
    whitelist: ["$not", "$and"],
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
  
makeTests(
  "feathers-nedb", 
  makeService, 
  async (app, service) => { 
    await service.remove(null);
  },
  { adapter: "feathers-nedb" }
);
