/* eslint-disable */
import assert from "assert";
import feathers, { Application, HookContext } from "@feathersjs/feathers";
import casl from "../lib/initialize";
import { Ability, defineAbility } from "../lib/index";
import { RealTimeConnection } from "@feathersjs/transport-commons/lib/channels/channel/base";
import { InitOptions } from "../lib/types";

describe("options", () => {
  it.skip("can set app options", () => {
    const app = feathers();
    let calledActionOnForbidden = false;
    let calledAbility = false;
    let calledModelName = false;

    let calledChannelAbility = false;
    let calledChannelModelName = false;
    app.configure(casl({
      authorizeHook: {
        actionOnForbidden: () => {
          calledActionOnForbidden = true;
        },
        checkMultiActions: true,
        //@ts-ignore
        ability: (context: HookContext): Ability => {
          calledAbility = true;
          return defineAbility(() => {});
        },
        modelName: (context: HookContext): string => {
          calledModelName = true;
          return "Test";
        }
      },
      channels: {
        activated: false,
        channelOnError: ["Test"],
        //@ts-ignore
        ability: (app: Application, connection: RealTimeConnection, data: unknown, context: HookContext): Ability => {
          calledChannelAbility = true;
          return defineAbility(() => {});
        },
        modelName: (context: HookContext): string => {
          calledChannelModelName = true;
          return "Test";
        },
        restrictFields: false
      }
    }));

    const caslOptions: InitOptions = app.get("casl");

    assert.ok(caslOptions.authorizeHook, "authorizeHook options is set");
    assert.ok(caslOptions.channels, "channels options is set");

    assert.ok(calledAbility, "called ability function");
    assert.ok(calledActionOnForbidden, "called actionOnForbidden function");
    assert.ok(calledModelName, "called modelName function");

    
    assert.ok(calledChannelAbility, "called ability function on channels");
    assert.ok(calledChannelModelName, "called modelName function on channels");
  });
});