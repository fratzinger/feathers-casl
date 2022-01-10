import assert from "assert";
import authorize from "../../../lib/hooks/authorize/authorize.hook";
import {
  createAliasResolver,
  defineAbility
} from "@casl/ability";
import _cloneDeep from "lodash/cloneDeep";
import { markHookForSkip } from "feathers-utils";
import { HOOKNAME as HOOKNAME_CHECKBASICPERMISSION } from "../../../lib/hooks/checkBasicPermission.hook";
import { HookContext } from "@feathersjs/feathers";

const resolveAction = createAliasResolver({
  update: "patch",
  read: ["get", "find"],
  delete: "remove"
});

describe("authorize.general.test.ts", function() {
  describe("before", function() {
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
        } as unknown as HookContext;
      };
  
      const types = ["before"];
      const methods = ["find", "get", "create", "update", "patch", "remove"];
      const promises = [];
      types.forEach(type => {
        methods.forEach(method => {
          const context = makeContext(method, type);

          markHookForSkip(HOOKNAME_CHECKBASICPERMISSION, "all", context);
          const query = Object.assign({}, context.params.query);

          const promise = authorize()(context).then(result => {
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
            // eslint-disable-next-line @typescript-eslint/no-empty-function
            ability: defineAbility(() => {}, { resolveAction }),
            query: {}
          }
        } as unknown as HookContext;
      };
  
      const types = ["before"];
      const methods = ["find", "get", "create", "update", "patch", "remove"];
      const promises = [];
      types.forEach(type => {
        methods.forEach(method => {
          const context = makeContext(method, type);
          markHookForSkip(HOOKNAME_CHECKBASICPERMISSION, "all", context);
          const promise = assert.rejects(
            authorize()(context),
            (err: Error) => err.name === "Forbidden",
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
            ability: defineAbility((can) => {
              can("manage", "all");
            }, { resolveAction }),
            query: {},
          }
        } as unknown as HookContext;
      };
  
      const types = ["before"];
      const methods = ["find", "get", "create", "update", "patch", "remove"];
      const promises = [];
      types.forEach(type => {
        methods.forEach(method => {
          const context = makeContext(method, type);

          markHookForSkip(HOOKNAME_CHECKBASICPERMISSION, "all", context);
          const query = Object.assign({}, context.params.query);
          
          const promise = authorize({ availableFields: ["id", "userId", "test"] })(context).then(result => {
            assert.deepStrictEqual(result.params.query, query, "does not change query object");
          });
          promises.push(promise);
        });
      });
      await Promise.all(promises);
    });

    it("passes for general individual permission", async function() {
      const makeContext = (method, type) => {
        const path = "tests";
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
            ability: defineAbility((can) => {
              can(method, path);
            }, { resolveAction }),
            query: {},
          }
        } as unknown as HookContext;
      };
    
      const types = ["before"];
      const methods = ["find", "get", "create", "update", "patch", "remove"];
      const promises = [];
      types.forEach(type => {
        methods.forEach(method => {
          const context = makeContext(method, type);
          const query = Object.assign({}, context.params.query);
          const promise = authorize()(context).then(result => {
            assert.deepStrictEqual(result.params.query, query, "does not change query object");
          });
          promises.push(promise);
        });
      });
      await Promise.all(promises);
    });
  
    it("passes for 'manage' 'all' permission with availableFields: undefined", async function() {
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
            ability: defineAbility((can) => {
              can("manage", "all");
            }, { resolveAction }),
            query: {},
          }
        } as unknown as HookContext;
      };
  
      const types = ["before"];
      const methods = ["find", "get", "create", "update", "patch", "remove"];
      const promises = [];
      types.forEach(type => {
        methods.forEach(method => {
          const context = makeContext(method, type);
          
          markHookForSkip(HOOKNAME_CHECKBASICPERMISSION, "all", context);
          const query = Object.assign({}, context.params.query);

          const promise = authorize({ availableFields: undefined })(context)
            .then(result => {
              assert.deepStrictEqual(result.params.query, query, "does not change query object");
            });
          promises.push(promise);
        });
      });
      await Promise.all(promises);
    });

    it("passes if skip", async function() {
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
            // eslint-disable-next-line @typescript-eslint/no-empty-function
            ability: defineAbility(() => {}, { resolveAction }),
            skipHooks: ["authorize"],
            query: {},
          }
        } as unknown as HookContext;
      };
  
      const types = ["before"];
      const methods = ["find", "get", "create", "update", "patch", "remove"];
      const promises = [];
      types.forEach(type => {
        methods.forEach(method => {
          const context = makeContext(method, type);
          
          markHookForSkip(HOOKNAME_CHECKBASICPERMISSION, "all", context);
          const query = Object.assign({}, context.params.query);
          
          const promise = authorize()(context)
            .then(result => {
              assert.deepStrictEqual(result.params.query, query, `'${type}:${method}': does not change query object`);
            });
          promises.push(promise);
        });
      });
      await Promise.all(promises);
    });

    it("passes for undefined modelName", async function() {
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
            // eslint-disable-next-line @typescript-eslint/no-empty-function
            ability: defineAbility(() => {}, { resolveAction }),
            query: {},
          }
        } as unknown as HookContext;
      };
  
      const types = ["before"];
      const methods = ["find", "get", "create", "update", "patch", "remove"];
      const promises = [];
      types.forEach(type => {
        methods.forEach(method => {
          const context = makeContext(method, type);
          
          markHookForSkip(HOOKNAME_CHECKBASICPERMISSION, "all", context);
          const query = Object.assign({}, context.params.query);
          
          const promise = authorize({ modelName: undefined })(context)
            .then(result => {
              assert.deepStrictEqual(result.params.query, query, `'${type}:${method}': does not change query object`);
            });
          promises.push(promise);
        });
      });
      await Promise.all(promises);
    });

    it("makes clean query with multiple rules", async function() {
      const expectedResult = { id: 1, userId: 1, test: true };
      const makeContext = (method, type) => {
        return {
          service: {
            modelName: "Test",
          },
          path: "tests",
          method,
          type,
          result: Object.assign({}, expectedResult),
          id: 1,
          params: {
            ability: defineAbility((can) => {
              can(["find"], "tests", { userId: 1 });
              can(["find"], "tests", { userId: 1 });
              can(["find"], "tests", { userId: 1 });
              can(["find"], "tests", { userId: 1 });
            }, { resolveAction }),
            query: {
              test: true
            },
          }
        } as unknown as HookContext;
      };

      const context = makeContext("find", "before");
      await authorize({ availableFields: undefined })(context);
      assert.deepStrictEqual(context.params.query, { $and: [{ userId: 1 }], test: true });
    });

    describe("create", function() {
      it("'create:single' passes", async function() {
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
            ability: defineAbility((can) => {
              can("create", "tests", { userId: 1 });
            }, { resolveAction }),
            query: {}
          }
        } as unknown as HookContext;

        markHookForSkip(HOOKNAME_CHECKBASICPERMISSION, "all", context);

        await assert.doesNotReject(
          authorize()(context), 
          "passes authorize hook"
        );
      });
  
      it("'create:multi' passes", async function() {
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
            ability: defineAbility((can) => {
              can("create", "tests", { userId: 1 });
              can("read", "tests");
            }, { resolveAction }),
            query: {}
          }
        } as unknown as HookContext;

        markHookForSkip(HOOKNAME_CHECKBASICPERMISSION, "all", context);

        await assert.doesNotReject(
          authorize({ availableFields: ["id", "userId", "test"] })(context), 
          "passes authorize hook"
        );
      });

      it("'create:multi' fails with 'checkMultiActions: true'", async function() {
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
            ability: defineAbility((can) => {
              can("create", "tests", { userId: 1 });
              can("read", "tests");
            }, { resolveAction }),
            query: {}
          }
        } as unknown as HookContext;

        markHookForSkip(HOOKNAME_CHECKBASICPERMISSION, "all", context);

        await assert.rejects(
          authorize({ checkMultiActions: true })(context), 
          "passes authorize hook"
        );
      });
  
      it("'create:single' fails", async function() {
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
            ability: defineAbility((can) => {
              can("create", "tests", { userId: 1 });
            }, { resolveAction }),
            query: {}
          }
        } as unknown as HookContext;

        markHookForSkip(HOOKNAME_CHECKBASICPERMISSION, "all", context);
  
        await assert.rejects(
          authorize()(context),
          (err: Error) => err.name === "Forbidden",
          "rejects with 'Forbidden' error"
        );
      });
  
      it("'create:multi' fails", async function() {
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
            ability: defineAbility((can) => {
              can("create", "tests", { userId: 1 });
            }, { resolveAction }),
            query: {}
          }
        } as unknown as HookContext;

        markHookForSkip(HOOKNAME_CHECKBASICPERMISSION, "all", context);
  
        await assert.rejects(
          authorize()(context),
          (err: Error) => err.name === "Forbidden",
          "rejects with 'Forbidden' error"
        );
      });
  
      it("makes right query for inverted rules", async function() {
        const pairs = [
          {
            condition: { userId: 1 },
            inverted: { $nor: [{ userId: 1 }] }
          }, {
            condition: { userId: { $ne: 1 } },
            inverted: { $nor: [{ userId: { $ne: 1 } }] }
          }, {
            condition: { userId: { $gt: 1 } },
            inverted: { $nor: [{ userId: { $gt: 1 } }] }
          }, {
            condition: { userId: { $gte: 1 } },
            inverted: { $nor: [{ userId: { $gte: 1 } }] }
          }, {
            condition: { userId: { $lt: 1 } },
            inverted: { $nor: [{ userId: { $lt: 1 } }] }
          }, {
            condition: { userId: { $lte: 1 } },
            inverted: { $nor: [{ userId: { $lte: 1 } }] }
          }, {
            condition: { userId: { $in: [1] } },
            inverted: { $nor: [{ userId: { $in: [1] } }] }
          }, {
            condition: { userId: { $nin: [1] } },
            inverted: { $nor: [{ userId: { $nin: [1] } }] }
          }
        ];
        const promises = [];
  
        pairs.forEach(({ condition, inverted }) => {
          const makeContext = (method: string, type: string): HookContext => {
            return {
              service: {
                modelName: "Test",
                options: {
                  whitelist: ["$and", "$not", "$nor"]
                },
                get() {
                  return {
                    id: 1,
                    userId: 1,
                    test: true
                  };
                }
              },
              path: "tests",
              method,
              type,
              params: {
                ability: defineAbility((can, cannot) => {
                  can("manage", "all");
                  cannot(["read", "update", "remove"], "tests", condition);
                  cannot("update", "tests", condition);
                  cannot("remove", "tests", condition);
                }, { resolveAction }),
                query: {},
              }
            } as unknown as HookContext;
          };
  
          const types = ["before"];
          const methods = ["find"];
  
          types.forEach(type => {
            methods.forEach(method => {
              const context = makeContext(method, type);
              const query = Object.assign({}, context.params.query);
              assert.deepStrictEqual(query, {}, `'${type}:${method}': query is empty`);

              const promise = authorize()(context).then(result => {
                assert.deepStrictEqual(result.params.query, inverted, `'${type}:${method}': for condition: '${JSON.stringify(condition)}' the inverted is: ${JSON.stringify(result.params.query)}`);
              });
              promises.push(promise);
            });
          });
        });
        await Promise.all(promises);
      });
    });

    describe("patch", function() {
      it("'patch:multi' passes with 'patch-multi' and 'checkMultiActions: true'", async function() {
        const context = {
          service: {
            modelName: "Test",
          },
          path: "tests",
          method: "patch",
          type: "before",
          id: null,
          data: { id: 1 },
          params: {
            ability: defineAbility((can) => {
              can("patch-multi", "tests");
            }, { resolveAction }),
            query: {}
          }
        } as unknown as HookContext;
    
        await assert.rejects(
          authorize({ checkMultiActions: true })(context), 
          "authorize rejects"
        );
      });
  
      it("'patch:multi' fails with 'checkMultiActions: true'", async function() {
        const context = {
          service: {
            modelName: "Test",
          },
          path: "tests",
          method: "patch",
          type: "before",
          id: null,
          data: { id: 1 },
          params: {
            ability: defineAbility((can) => {
              can("patch", "tests");
            }, { resolveAction }),
            query: {}
          }
        } as unknown as HookContext;
    
        await assert.rejects(
          authorize({ checkMultiActions: true })(context), 
          "authorize rejects"
        );
      });
    });
  
    describe("remove", function() {
      it("'remove:multi' passes with 'remove-multi' and 'checkMultiActions: true'", async function() {
        const context = {
          service: {
            modelName: "Test",
          },
          path: "tests",
          method: "remove",
          type: "before",
          id: null,
          params: {
            ability: defineAbility((can) => {
              can("remove-multi", "tests");
            }, { resolveAction }),
            query: {}
          }
        } as unknown as HookContext;
    
        await assert.rejects(
          authorize({ checkMultiActions: true })(context), 
          "authorize rejects"
        );
      });
  
      it("'remove:multi' fails with 'checkMultiActions: true'", async function() {
        const context = {
          service: {
            modelName: "Test",
          },
          path: "tests",
          method: "remove",
          type: "before",
          id: null,
          params: {
            ability: defineAbility((can) => {
              can("remove", "tests");
            }, { resolveAction }),
            query: {}
          }
        } as unknown as HookContext;
    
        await assert.rejects(
          authorize({ checkMultiActions: true })(context), 
          "authorize rejects"
        );
      });
    });
  });
  
  describe("after", function() {
    it("after - passes single with 'get' rule", async function() {
      const expectedResult = { id: 1, userId: 1, test: true };
      const makeContext = (method, type) => {
        return {
          service: {
            modelName: "Test",
          },
          path: "tests",
          method,
          type,
          result: Object.assign({}, expectedResult),
          id: 1,
          params: {
            ability: defineAbility((can) => {
              can(["get", "create", "update", "patch", "remove"], "all");
            }, { resolveAction }),
            query: {},
          }
        } as unknown as HookContext;
      };
  
      const types = ["after"];
      const methods = ["get", "create", "update", "patch", "remove"];
      const promises = [];
      types.forEach(type => {
        methods.forEach(method => {
          const context = makeContext(method, type);
          const promise = authorize({ availableFields: undefined })(context)
            .then(({ result }) => {
              assert.deepStrictEqual(result, expectedResult, `returns complete object for '${type}:${method}'`);
            });
          promises.push(promise);
        });
      });
      await Promise.all(promises);
    });

    it.skip("after - passes single primitive value with 'find' rule", async function() {
      const promises = [];
      ["test", true, 123].forEach(val => {
        const methods = ["find"];
        const service = {
          path: "tests",
        };
        methods.forEach(method => {
          service[method] = () => {
            return val;
          };
        });
        const makeContext = (method, type) => {
          return {
            service,
            path: "tests",
            method,
            type,
            result: val,
            params: {
              ability: defineAbility((can) => {
                can(["get", "create", "update", "patch", "remove"], "all");
              }, { resolveAction }),
              query: {},
            }
          } as unknown as HookContext;
        };
    
        const types = ["after"];
        types.forEach(type => {
          methods.forEach(method => {
            const context = makeContext(method, type);
            const promise = authorize({ availableFields: undefined })(context)
              .then(({ result }) => {
                assert.deepStrictEqual(result, val, `returns complete object for '${type}:${method}'`);
              });
            promises.push(promise);
          });
        });
      });
      
      
      await Promise.all(promises);
    });

    it("after - passes multi with 'find' rule", async function() {
      const expectedResult = [{ id: 1, userId: 1, test: true }];
      const makeContext = (method, type) => {
        return {
          service: {
            modelName: "Test",
          },
          path: "tests",
          method,
          type,
          result: _cloneDeep(expectedResult),
          id: null,
          params: {
            ability: defineAbility((can) => {
              can(["find", "create", "patch", "remove"], "all");
            }, { resolveAction }),
            query: {},
          }
        } as unknown as HookContext;
      };
  
      const types = ["after"];
      const methods = ["find", "create", "patch", "remove"];
      const promises = [];
      types.forEach(type => {
        methods.forEach(method => {
          const context = makeContext(method, type);
          const promise = authorize({ availableFields: undefined })(context)
            .then(({ result }) => {
              assert.deepStrictEqual(result, expectedResult, `returns complete object for '${type}:${method}'`);
            });
          promises.push(promise);
        });
      });
      await Promise.all(promises);
    });
  });
});
