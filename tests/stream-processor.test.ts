import { describe, it, expect } from "bun:test";
import { StreamProcessor, type StreamCallbacks } from "../src/stream-processor";

function makeCallbacks() {
  const calls: { method: string; args: any[] }[] = [];
  const cb: StreamCallbacks = {
    onInit: (sid) => calls.push({ method: "onInit", args: [sid] }),
    onText: (text) => calls.push({ method: "onText", args: [text] }),
    onToolUse: (name, input) => calls.push({ method: "onToolUse", args: [name, input] }),
    onToolResult: (name) => calls.push({ method: "onToolResult", args: [name] }),
    onResult: (status, ms) => calls.push({ method: "onResult", args: [status, ms] }),
    onError: (err) => calls.push({ method: "onError", args: [err] }),
  };
  return { calls, cb };
}

describe("StreamProcessor", () => {
  it("parses system message with session_id", () => {
    const { calls, cb } = makeCallbacks();
    const sp = new StreamProcessor(cb);
    sp.feed(JSON.stringify({ type: "system", session_id: "abc-123" }) + "\n");
    expect(calls).toEqual([{ method: "onInit", args: ["abc-123"] }]);
  });

  it("parses assistant text blocks", () => {
    const { calls, cb } = makeCallbacks();
    const sp = new StreamProcessor(cb);
    sp.feed(JSON.stringify({
      type: "assistant",
      message: { content: [{ type: "text", text: "Hello world" }] },
    }) + "\n");
    expect(calls).toEqual([{ method: "onText", args: ["Hello world"] }]);
  });

  it("parses assistant tool_use blocks", () => {
    const { calls, cb } = makeCallbacks();
    const sp = new StreamProcessor(cb);
    sp.feed(JSON.stringify({
      type: "assistant",
      message: { content: [{ type: "tool_use", name: "Read", input: { file_path: "/foo" } }] },
    }) + "\n");
    expect(calls).toEqual([{ method: "onToolUse", args: ["Read", { file_path: "/foo" }] }]);
  });

  it("parses assistant tool_result blocks", () => {
    const { calls, cb } = makeCallbacks();
    const sp = new StreamProcessor(cb);
    sp.feed(JSON.stringify({
      type: "assistant",
      message: { content: [{ type: "tool_result", name: "Bash" }] },
    }) + "\n");
    expect(calls).toEqual([{ method: "onToolResult", args: ["Bash"] }]);
  });

  it("parses result messages", () => {
    const { calls, cb } = makeCallbacks();
    const sp = new StreamProcessor(cb);
    sp.feed(JSON.stringify({ type: "result", subtype: "success", duration_ms: 1500 }) + "\n");
    expect(calls).toEqual([{ method: "onResult", args: ["success", 1500] }]);
  });

  it("parses error messages", () => {
    const { calls, cb } = makeCallbacks();
    const sp = new StreamProcessor(cb);
    sp.feed(JSON.stringify({ type: "error", error: { message: "something broke" } }) + "\n");
    expect(calls).toEqual([{ method: "onError", args: ["something broke"] }]);
  });

  it("handles error without message field", () => {
    const { calls, cb } = makeCallbacks();
    const sp = new StreamProcessor(cb);
    sp.feed(JSON.stringify({ type: "error" }) + "\n");
    expect(calls[0].method).toBe("onError");
    expect(calls[0].args[0]).toContain("error");
  });

  it("handles multiple messages in one chunk", () => {
    const { calls, cb } = makeCallbacks();
    const sp = new StreamProcessor(cb);
    const chunk =
      JSON.stringify({ type: "system", session_id: "s1" }) + "\n" +
      JSON.stringify({ type: "assistant", message: { content: [{ type: "text", text: "hi" }] } }) + "\n" +
      JSON.stringify({ type: "result", subtype: "done", duration_ms: 100 }) + "\n";
    sp.feed(chunk);
    expect(calls.map(c => c.method)).toEqual(["onInit", "onText", "onResult"]);
  });

  it("handles messages split across chunks", () => {
    const { calls, cb } = makeCallbacks();
    const sp = new StreamProcessor(cb);
    const full = JSON.stringify({ type: "system", session_id: "split-test" });
    // Split in the middle of the JSON
    sp.feed(full.slice(0, 10));
    expect(calls).toHaveLength(0);
    sp.feed(full.slice(10) + "\n");
    expect(calls).toEqual([{ method: "onInit", args: ["split-test"] }]);
  });

  it("handles partial line buffering then flush", () => {
    const { calls, cb } = makeCallbacks();
    const sp = new StreamProcessor(cb);
    // Feed without trailing newline — stays in buffer
    sp.feed(JSON.stringify({ type: "system", session_id: "flush-test" }));
    expect(calls).toHaveLength(0);
    sp.flush();
    expect(calls).toEqual([{ method: "onInit", args: ["flush-test"] }]);
  });

  it("ignores invalid JSON lines", () => {
    const { calls, cb } = makeCallbacks();
    const sp = new StreamProcessor(cb);
    sp.feed("not json at all\n");
    sp.feed("{broken\n");
    expect(calls).toHaveLength(0);
  });

  it("ignores empty lines", () => {
    const { calls, cb } = makeCallbacks();
    const sp = new StreamProcessor(cb);
    sp.feed("\n\n\n");
    expect(calls).toHaveLength(0);
  });

  it("ignores unknown message types", () => {
    const { calls, cb } = makeCallbacks();
    const sp = new StreamProcessor(cb);
    sp.feed(JSON.stringify({ type: "unknown_future_type", data: 42 }) + "\n");
    expect(calls).toHaveLength(0);
  });

  it("handles assistant message with mixed content blocks", () => {
    const { calls, cb } = makeCallbacks();
    const sp = new StreamProcessor(cb);
    sp.feed(JSON.stringify({
      type: "assistant",
      message: {
        content: [
          { type: "text", text: "Before tool" },
          { type: "tool_use", name: "Edit", input: { file_path: "/x" } },
          { type: "text", text: "After tool" },
        ],
      },
    }) + "\n");
    expect(calls).toEqual([
      { method: "onText", args: ["Before tool"] },
      { method: "onToolUse", args: ["Edit", { file_path: "/x" }] },
      { method: "onText", args: ["After tool"] },
    ]);
  });

  it("handles assistant message with missing content", () => {
    const { calls, cb } = makeCallbacks();
    const sp = new StreamProcessor(cb);
    sp.feed(JSON.stringify({ type: "assistant", message: {} }) + "\n");
    sp.feed(JSON.stringify({ type: "assistant" }) + "\n");
    expect(calls).toHaveLength(0);
  });

  it("defaults tool_use name and input when missing", () => {
    const { calls, cb } = makeCallbacks();
    const sp = new StreamProcessor(cb);
    sp.feed(JSON.stringify({
      type: "assistant",
      message: { content: [{ type: "tool_use" }] },
    }) + "\n");
    expect(calls).toEqual([{ method: "onToolUse", args: ["unknown", {}] }]);
  });

  it("defaults result fields when missing", () => {
    const { calls, cb } = makeCallbacks();
    const sp = new StreamProcessor(cb);
    sp.feed(JSON.stringify({ type: "result" }) + "\n");
    expect(calls).toEqual([{ method: "onResult", args: ["unknown", 0] }]);
  });
});
