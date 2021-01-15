import { ServiceAddons } from "@feathersjs/feathers";
import { JWTStrategy } from "@feathersjs/authentication";
import { LocalStrategy } from "@feathersjs/authentication-local";
import { expressOauth } from "@feathersjs/authentication-oauth";
import { AuthService } from "./authentication.class";
import hooks from "./authentication.hooks";

import { Application } from "../../declarations";

declare module "../../declarations" {
  interface ServiceTypes {
    "authentication": AuthService & ServiceAddons<unknown>;
  }
}

export default function(app: Application): void {
  const authentication = new AuthService(app);

  authentication.register("jwt", new JWTStrategy());
  authentication.register("local", new LocalStrategy());

  app.use("/authentication", authentication);
  app.configure(expressOauth());

  const authService = app.service("authentication");
  authService.hooks(hooks);
}
