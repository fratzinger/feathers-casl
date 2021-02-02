// Initializes the `users` service on path `/users`
import { ServiceAddons } from "@feathersjs/feathers";
import { MemoryServiceOptions } from "feathers-memory/types";
import { Application, CustomServiceAddons } from "../../declarations";
import { Comments } from "./comments.class";
import hooks from "./comments.hooks";

// Add this service to the service type index
declare module "../../declarations" {
  interface ServiceTypes {
    "comments": Comments & ServiceAddons<unknown> & CustomServiceAddons;
  }
}

export default function (app: Application): void {
  const options: Partial<MemoryServiceOptions> = {
    paginate: app.get("paginate"),
    multi: true,
    casl: {
      availableFields: ["id", "title", "userId", "test"]
    }
  };

  // Initialize our service with any options it requires
  app.use("/comments", new Comments(options, app));

  // Get our initialized service so that we can register hooks
  const service = app.service("comments");

  service.hooks(hooks);
}
