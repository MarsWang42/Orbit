import { describe, it, expect } from "bun:test";
import { run, runSilent } from "../src/shell";

describe("run", () => {
  it("returns ok:true and stdout for successful commands", async () => {
    const result = await run(["echo", "hello"]);
    expect(result.ok).toBe(true);
    expect(result.stdout).toBe("hello");
    expect(result.stderr).toBe("");
  });

  it("returns ok:false and stderr for failed commands", async () => {
    const result = await run(["ls", "/nonexistent-path-that-does-not-exist"]);
    expect(result.ok).toBe(false);
    expect(result.stderr).not.toBe("");
  });

  it("trims stdout and stderr", async () => {
    const result = await run(["printf", "  spaced  "]);
    expect(result.stdout).toBe("spaced");
  });

  it("respects cwd parameter", async () => {
    const result = await run(["pwd"], "/tmp");
    expect(result.ok).toBe(true);
    // /tmp may resolve to /private/tmp on macOS
    expect(result.stdout).toContain("tmp");
  });

  it("captures multi-line stdout", async () => {
    const result = await run(["printf", "line1\nline2\nline3"]);
    expect(result.ok).toBe(true);
    expect(result.stdout).toBe("line1\nline2\nline3");
  });
});

describe("runSilent", () => {
  it("returns true for successful commands", async () => {
    expect(await runSilent(["true"])).toBe(true);
  });

  it("returns false for failed commands", async () => {
    expect(await runSilent(["false"])).toBe(false);
  });

  it("respects cwd parameter", async () => {
    expect(await runSilent(["test", "-d", "."], "/tmp")).toBe(true);
  });
});
