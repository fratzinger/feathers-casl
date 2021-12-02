import { Service } from "feathers-memory";
import { ServiceCaslOptions } from "../../../../lib/types";
import makeTests from "./makeTests";

declare module "@feathersjs/adapter-commons" {
  interface ServiceOptions {
    casl: ServiceCaslOptions
  }
}

const makeService = () => {
  return new Service({
    multi: true,
    whitelist: ["$nor", "$not", "$and"],
    // casl: {
    //   availableFields: [
    //     "id", 
    //     "userId", 
    //     "hi", 
    //     "test", 
    //     "published", 
    //     "supersecret", 
    //     "hidden"
    //   ]
    // },
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
