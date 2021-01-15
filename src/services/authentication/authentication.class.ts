import { AuthenticationService } from "@feathersjs/authentication";
import { Application } from "../../declarations";

export class AuthService extends AuthenticationService {
  constructor(app: Application, configKey?: string, options?: unknown) {
    super(app, configKey, options);
  }
}
