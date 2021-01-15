import assert from "assert";
import feathers, { Application, HookContext } from "@feathersjs/feathers";
import casl from "../lib/initialize";
import { Ability, defineAbility } from "../lib/index";
import { RealTimeConnection } from "@feathersjs/transport-commons/lib/channels/channel/base";
import { InitOptions } from "../lib/types";

describe("options", () => {
  it("can set app options", () => {
    const app = feathers();
    let calledActionOnForbidden = false;
    let calledAbility = false;
    let calledGetModelName = false;
    const calledSubjectHelper = false;

    let calledChannelAbility = false;
    let calledChannelGetModelName = false;
    const calledChannelSubjectHelper = false;
    app.configure(casl({
      authorizeHook: {
        actionOnForbidden: () => {
          calledActionOnForbidden = true;
        },
        checkMultiActions: true,
        ability: (context: HookContext): Ability => {
          calledAbility = true;
          return defineAbility(() => {});
        },
        getModelName: (context: HookContext): string => {
          calledGetModelName = true;
          return "Test";
        }
      },
      channels: {
        activated: false,
        channelOnError: ["Test"],
        ability: (app: Application, connection: RealTimeConnection, data: unknown, context: HookContext): Ability => {
          calledChannelAbility = true;
          return defineAbility(() => {});
        },
        getModelName: (context: HookContext): string => {
          calledChannelGetModelName = true;
          return "Test";
        },
        restrictFields: false
      }
    }));

    const caslOptions: InitOptions = app.get("casl");

    assert.ok(caslOptions.authorizeHook, "authorizeHook options is set");
    assert.ok(caslOptions.channels, "channels options is set");
  });
});