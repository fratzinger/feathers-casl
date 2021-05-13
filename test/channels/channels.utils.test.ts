import assert from "assert";
import { getEventName, makeDefaultOptions } from "../../lib/channels/channels.utils";

describe("channels.utils.test.ts", function() {
  it("defaultOptions", function() {
    const options = makeDefaultOptions();
        
    assert.strictEqual(options.activated, true, "is activated by default");
    assert.deepStrictEqual(options.channelOnError, ["authenticated"], "returns 'authenticated' by default");
    assert.strictEqual(options.restrictFields, true, "restrict Fields by default");
    assert.strictEqual(options.useActionName, "get", "use native eventName by default");
  });

  it("getEventName", function() {
    assert.strictEqual(getEventName("find"), undefined, "no event for find");
    assert.strictEqual(getEventName("get"), undefined, "no event for find");
    assert.strictEqual(getEventName("create"), "created", "no event for find");
    assert.strictEqual(getEventName("update"), "updated", "no event for find");
    assert.strictEqual(getEventName("patch"), "patched", "no event for find");
    assert.strictEqual(getEventName("remove"), "removed", "no event for find");
  });
});