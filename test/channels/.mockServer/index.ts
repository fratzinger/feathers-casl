import path from "path";
import helmet from "helmet";
import cors from "cors";

import { feathers } from "@feathersjs/feathers";
import express, { Application, json, urlencoded, rest } from "@feathersjs/express";
import socketio from "@feathersjs/socketio";
import { Service } from "feathers-memory";

process.env["NODE_CONFIG_DIR"] = path.join(__dirname, "config/");
import configuration from "@feathersjs/configuration";

import casl from "../../../lib";


interface MockServerOptions {
  channels: ((app: Application) => void)
  services: ((aüü: Application) => void)
}

interface ExportMockServer {
  app: Application
  articles: Service
  comments: Service
  users: Service
}

const mockServer = (options: MockServerOptions): ExportMockServer => {
  const { channels, services } = options;  
  const app: Application = express(feathers());

  // Load app configuration
  app.configure(configuration());

  // Enable security, CORS, compression, favicon and body parsing
  app.use(helmet({
    contentSecurityPolicy: false
  }));
  app.use(cors());
  app.use(json());
  app.use(urlencoded({ extended: true }));

  // Set up Plugins and providers
  app.configure(rest());
  app.configure(socketio());

  app.configure(services);

  // Set up event channels (see channels.ts)
  app.configure(channels);

  app.hooks({});

  const articles = app.service("articles") as any as Service;
  const comments = app.service("comments") as any as Service;
  const users = app.service("users") as any as Service;

  app.configure(casl());
  return {
    app: app,
    articles,
    comments,
    users
  };
};


export default mockServer;
