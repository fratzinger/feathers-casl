import { MemoryService } from "@feathersjs/memory";
import { filterObject } from "feathers-utils";
import { authorize, type Adapter, type ServiceCaslOptions } from "../../../src";
import { feathers } from "@feathersjs/feathers";
import { defineAbility } from "@casl/ability";
import { resolveAction } from "../../test-utils";

declare module "@feathersjs/memory" {
  interface MemoryServiceOptions {
    casl?: ServiceCaslOptions;
  }
}

class CustomService extends MemoryService {
  sum(data: any, params: any) {
    return this.find(params);
  }
}

describe("authorize.options.method", () => {
  it("should work", async () => {
    const app = feathers<{
      tests: CustomService;
    }>();

    const id = "id";

    app.use(
      "tests",
      new CustomService({
        id,
        multi: true,
        startId: 1,
        filters: {
          ...filterObject("$nor"),
        },
        operators: ["$nor"],
        casl: {
          availableFields: [
            "id",
            "userId",
            "hi",
            "test",
            "published",
            "supersecret",
            "hidden",
          ],
        },
        paginate: {
          default: 10,
          max: 50,
        },
      }),
      {
        methods: ["find", "get", "create", "update", "patch", "remove", "sum"],
      }
    );

    const hook = authorize({
      method: "find",
      adapter: "@feathersjs/memory",
    });

    const service = app.service("tests");

    service.hooks({
      before: {
        sum: [hook],
      },
      after: {
        sum: [hook],
      },
    });

    const item1 = await service.create({ test: true, userId: 1 });
    await service.create({ test: true, userId: 2 });
    await service.create({ test: true, userId: 3 });
    const items = await service.find({ paginate: false });
    assert.strictEqual(items.length, 3, "has three items");

    const returnedItems = (await service.sum(null, {
      ability: defineAbility(
        (can) => {
          can("read", "tests", { userId: 1 });
        },
        { resolveAction }
      ),
      paginate: false,
    })) as any as any[];

    assert.deepStrictEqual(
      returnedItems,
      [{ [id]: item1[id], test: true, userId: 1 }],
      "just returned one item"
    );
  });
});
