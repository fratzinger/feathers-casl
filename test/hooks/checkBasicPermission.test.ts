import assert from "assert";
import {
  createAliasResolver,
  defineAbility
} from "@casl/ability";
import checkBasicPermission from "../../lib/hooks/checkBasicPermission.hook";

const resolveAction = createAliasResolver({
  update: "patch",
  read: ["get", "find"],
  delete: "remove"
});

describe("checkBasicPermission.test.ts", function() {
  it("passes if no ability", async function() {
    const makeContext = (method: string, type: string) => {
      return {
        service: {
          modelName: "Test",
        },
        path: "tests",
        method,
        type,
        data: {
          id: 1,
          userId: 1,
          test: true
        },
        params: {
          query: {},
        }
      };
    };
  
    const types = ["before"];
    const methods = ["find", "get", "create", "update", "patch", "remove"];
    const promises = [];
    types.forEach(type => {
      methods.forEach(method => {
        const context = makeContext(method, type);
        const query = Object.assign({}, context.params.query);
        //@ts-ignore
        const promise = checkBasicPermission()(context).then(result => {
          assert.deepStrictEqual(result.params.query, query, `'${type}:${method}': does not change query object`);
        });
        promises.push(promise);
      });
    });
    await Promise.all(promises);
  });
  
  it("passes if skip", async function() {
    const makeContext = (method, type) => {
      return {
        service: {
          modelName: "Test",
        },
        path: "tests",
        method,
        type,
        data: {
          id: 1,
          userId: 1,
          test: true
        },
        params: {
          //@ts-ignore
          // eslint-disable-next-line @typescript-eslint/no-empty-function
          ability: defineAbility(() => {}, { resolveAction }),
          skipHooks: ["checkBasicPermission"],
          query: {},
        }
      };
    };
  
    const types = ["before"];
    const methods = ["find", "get", "create", "update", "patch", "remove"];
    const promises = [];
    types.forEach(type => {
      methods.forEach(method => {
        const context = makeContext(method, type);
        const query = Object.assign({}, context.params.query);
        //@ts-ignore
        const promise = checkBasicPermission()(context).then(result => {
          assert.deepStrictEqual(result.params.query, query, `'${type}:${method}': does not change query object`);
        });
        promises.push(promise);
      });
    });
    await Promise.all(promises);
  });
  
  it("throws forbidden for no permissions", async function() {
    const makeContext = (method = "find", type = "before") => {
      return {
        service: {
          modelName: "Test",
          get(id) {
            return { id, userId: 1 };
          }
        },
        path: "tests",
        method,
        type,
        id: 1,
        data: {
          id: 1,
          userId: 1,
          test: true
        },
        params: {
          //@ts-ignore
          // eslint-disable-next-line @typescript-eslint/no-empty-function
          ability: defineAbility(() => {}, { resolveAction }),
          query: {}
        }
      };
    };
  
    const types = ["before"];
    const methods = ["find", "get", "create", "update", "patch", "remove"];
    const promises = [];
    types.forEach(type => {
      methods.forEach(method => {
        const context = makeContext(method, type);
        const promise = assert.rejects(
          //@ts-ignore
          checkBasicPermission()(context),
          (err) => err.name === "Forbidden",
          `'${type}:${method}': with no permissions returns 'Forbidden' error`
        );
        promises.push(promise);
      });
    });
    await Promise.all(promises);
  });
  
  it("passes for 'manage' 'all' permission", async function() {
    const makeContext = (method, type) => {
      return {
        service: {
          modelName: "Test",
        },
        path: "tests",
        method,
        type,
        data: {
          id: 1,
          userId: 1,
          test: true
        },
        params: {
          //@ts-ignore
          ability: defineAbility((can) => {
            can("manage", "all");
          }, { resolveAction }),
          query: {},
        }
      };
    };
  
    const types = ["before"];
    const methods = ["find", "get", "create", "update", "patch", "remove"];
    const promises = [];
    types.forEach(type => {
      methods.forEach(method => {
        const context = makeContext(method, type);
        const query = Object.assign({}, context.params.query);
        //@ts-ignore
        const promise = checkBasicPermission()(context).then(result => {
          assert.deepStrictEqual(result.params.query, query, "does not change query object");
        });
        promises.push(promise);
      });
    });
    await Promise.all(promises);
  });

  describe("conditional", function() {
    it("passes for create single", async function() {
      const context = {
        service: {
          modelName: "Test",
        },
        path: "tests",
        method: "create",
        type: "before",
        data: {
          id: 1,
          userId: 1,
          test: true
        },
        params: {
          //@ts-ignore
          ability: defineAbility((can) => {
            can("create", "tests", { userId: 1 });
          }, { resolveAction }),
          query: {}
        }
      };
        //@ts-ignore
      await assert.doesNotReject(checkBasicPermission()(context), "passes checkBasicPermission hook");
    });
  
    it("passes for create multi", async function() {
      const context = {
        service: {
          modelName: "Test",
        },
        path: "tests",
        method: "create",
        type: "before",
        data: [
          {
            id: 1,
            userId: 1,
            test: true
          }, {
            id: 2,
            userId: 1,
            test: true
          }, {
            id: 3,
            userId: 1,
            test: true
          }
        ],
        params: {
          //@ts-ignore
          ability: defineAbility((can) => {
            can("create", "tests", { userId: 1 });
            can("read", "tests");
          }, { resolveAction }),
          query: {}
        }
      };
  
      //@ts-ignore
      await assert.doesNotReject(checkBasicPermission({ availableFields: ["id", "userId", "test"] })(context), "passes checkBasicPermission hook");
    });
  
    it("fails for create single", async function() {
      const context = {
        service: {
          modelName: "Test",
        },
        path: "tests",
        method: "create",
        type: "before",
        data: {
          id: 1,
          userId: 2,
          test: true
        },
        params: {
          //@ts-ignore
          ability: defineAbility((can) => {
            can("create", "tests", { userId: 1 });
          }, { resolveAction }),
          query: {}
        }
      };
  
      await assert.rejects(
        //@ts-ignore
        checkBasicPermission()(context),
        err => err.name === "Forbidden",
        "rejects with 'Forbidden' error"
      );
    });
  
    it("fails for create multi", async function() {
      const context = {
        service: {
          modelName: "Test",
        },
        path: "tests",
        method: "create",
        type: "before",
        data: [
          {
            id: 1,
            userId: 1,
            test: true
          }, {
            id: 1,
            userId: 2,
            test: true
          }, {
            id: 1,
            userId: 1,
            test: true
          }
        ],
        params: {
          //@ts-ignore
          ability: defineAbility((can) => {
            can("create", "tests", { userId: 1 });
          }, { resolveAction }),
          query: {}
        }
      };
  
      await assert.rejects(
        //@ts-ignore
        checkBasicPermission()(context),
        err => err.name === "Forbidden",
        "rejects with 'Forbidden' error"
      );
    });
  });
});
