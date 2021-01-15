import path from "path";
import helmet from "helmet";
import cors from "cors";

import feathers from "@feathersjs/feathers";
process.env["NODE_CONFIG_DIR"] = path.join(__dirname, "config/");
import configuration from "@feathersjs/configuration";
import express from "@feathersjs/express";
import socketio from "@feathersjs/socketio";

import { Application } from "./declarations";
import services from "./services";
import appHooks from "./app.hooks";
import channels from "./channels";
import { HookContext as FeathersHookContext } from "@feathersjs/feathers";
import authentication from "./services/authentication/authentication.service";

import casl from "../lib";
// Don't remove this comment. It's needed to format import lines nicely.

const app: Application = express(feathers());
export type HookContext<T = unknown> = { app: Application } & FeathersHookContext<T>;

// Load app configuration
app.configure(configuration());
// Enable security, CORS, compression, favicon and body parsing
app.use(helmet({
  contentSecurityPolicy: false
}));
app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Set up Plugins and providers
app.configure(express.rest());
app.configure(socketio());

app.configure(authentication);
// Set up our services (see `services/index.ts`)
app.configure(services);
// Set up event channels (see channels.ts)
app.configure(channels);

app.hooks(appHooks);

app.configure(casl());

export default app;
