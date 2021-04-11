import NeDB from "nedb";
import { Service } from "feathers-nedb";
import makeTests from "./_makeTests";
import path from "path";

// Create a NeDB instance
const Model = new NeDB({
  filename: path.join(__dirname, "../../.data/tests.db"),
  autoload: true
});

const makeService = () => {
  return new Service({
    Model,
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
  
describe("authorize-hook nedb", function() {
  makeTests(
    "feathers-nedb", 
    makeService, 
    async (app, service) => { 
      await service.remove(null);
    },
    { adapter: "feathers-nedb" }
  );
});