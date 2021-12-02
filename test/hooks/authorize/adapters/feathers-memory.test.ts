import { Service } from "feathers-memory";
import makeTests from "./makeTests";

const makeService = () => {
  return new Service({
    multi: true,
    whitelist: ["$nor", "$not", "$and"],
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
  "feathers-memory", 
  makeService,
  async (app, service) => {
    await service.remove(null);
  },
  { adapter: "feathers-memory" }
);
