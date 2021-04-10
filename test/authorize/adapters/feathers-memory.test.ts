import { Service } from "feathers-memory";
import makeTests from "./_makeTests";

const makeService = () => {
  return new Service({
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

describe("authorize-hook feathers-memory", function() {
  makeTests(
    "feathers-memory", 
    makeService,
    async (app, service) => {
      await service.remove(null);
    }
  );
});