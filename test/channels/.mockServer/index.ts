import path from "node:path";
import helmet from "helmet";
import cors from "cors";

import { feathers } from "@feathersjs/feathers";
import type { Application as ExpressFeathers } from "@feathersjs/express";
import express, { json, urlencoded, rest } from "@feathersjs/express";
import socketio from "@feathersjs/socketio";
import type { MemoryService } from "@feathersjs/memory";

process.env["NODE_CONFIG_DIR"] = path.join(__dirname, "config/");
import configuration from "@feathersjs/configuration";

import { feathersCasl } from "../../../src";

interface MockServerOptions {
  channels: (app: Application) => void;
  services: (app: Application) => void;
}

type Application = ExpressFeathers<{
  articles: MemoryService;
  comments: MemoryService;
  users: MemoryService;
}>;

export const mockServer = (options: MockServerOptions) => {
  const { channels, services } = options;
  const app: Application = express(feathers());

  // Load app configuration
  app.configure(configuration());

  // Enable security, CORS, compression, favicon and body parsing
  app.use(
    helmet({
      contentSecurityPolicy: false,
    })
  );
  app.use(cors());
  app.use(json());
  app.use(urlencoded({ extended: true }));

  // Set up Plugins and providers
  app.configure(rest());
  app.configure(socketio());

  app.set("authentication", {
    entity: "user",
    service: "users",
    secret: "123",
    authStrategies: ["jwt", "local"],
    local: {
      usernameField: "email",
      passwordField: "password",
    },
  });

  app.configure(services);

  // Set up event channels (see channels.ts)
  app.configure(channels);

  app.hooks({});

  const articles = app.service("articles");
  const comments = app.service("comments");
  const users = app.service("users");

  app.configure(feathersCasl());
  return {
    app: app,
    articles,
    comments,
    users,
  };
};
