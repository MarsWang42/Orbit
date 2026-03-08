import { describe, it, expect } from "bun:test";
import { toBranchName, escapeMarkdown, withRetry } from "../src/utils";

describe("toBranchName", () => {
  it("converts task to lowercase kebab-case", () => {
    expect(toBranchName("Add Login Page")).toBe("add-login-page");
  });

  it("strips special characters", () => {
    expect(toBranchName("fix: bug #123 (urgent!)")).toBe("fix-bug-123-urgent");
  });

  it("strips leading and trailing hyphens", () => {
    expect(toBranchName("--hello--")).toBe("hello");
  });

  it("truncates to 48 characters", () => {
    const long = "a very long task name that exceeds the maximum branch name length allowed";
    expect(toBranchName(long).length).toBeLessThanOrEqual(48);
  });

  it("collapses consecutive special chars into single hyphen", () => {
    expect(toBranchName("foo...bar___baz")).toBe("foo-bar-baz");
  });

  it("returns empty string for empty input", () => {
    expect(toBranchName("")).toBe("");
  });

  it("returns empty string for all-special-char input", () => {
    expect(toBranchName("!!!@@@###")).toBe("");
  });

  it("handles unicode characters", () => {
    expect(toBranchName("修复bug")).toBe("bug");
  });

  it("preserves numbers", () => {
    expect(toBranchName("v2.0 release")).toBe("v2-0-release");
  });
});

describe("escapeMarkdown", () => {
  it("escapes basic markdown characters", () => {
    expect(escapeMarkdown("*bold*")).toBe("\\*bold\\*");
    expect(escapeMarkdown("_italic_")).toBe("\\_italic\\_");
    expect(escapeMarkdown("[link](url)")).toBe("\\[link\\]\\(url\\)");
  });

  it("escapes MarkdownV2 special characters", () => {
    expect(escapeMarkdown("~strikethrough~")).toBe("\\~strikethrough\\~");
    expect(escapeMarkdown("`code`")).toBe("\\`code\\`");
    expect(escapeMarkdown(">quote")).toBe("\\>quote");
    expect(escapeMarkdown("#heading")).toBe("\\#heading");
    expect(escapeMarkdown("a+b")).toBe("a\\+b");
    expect(escapeMarkdown("a-b")).toBe("a\\-b");
    expect(escapeMarkdown("a=b")).toBe("a\\=b");
    expect(escapeMarkdown("a|b")).toBe("a\\|b");
    expect(escapeMarkdown("{obj}")).toBe("\\{obj\\}");
    expect(escapeMarkdown("end.")).toBe("end\\.");
    expect(escapeMarkdown("wow!")).toBe("wow\\!");
    expect(escapeMarkdown("back\\slash")).toBe("back\\\\slash");
  });

  it("leaves plain text unchanged", () => {
    expect(escapeMarkdown("hello world 123")).toBe("hello world 123");
  });

  it("handles empty string", () => {
    expect(escapeMarkdown("")).toBe("");
  });
});

describe("withRetry", () => {
  it("returns result on first success", async () => {
    const result = await withRetry(() => Promise.resolve(42));
    expect(result).toBe(42);
  });

  it("throws non-429 errors immediately", async () => {
    let calls = 0;
    await expect(
      withRetry(() => {
        calls++;
        throw new Error("fatal");
      })
    ).rejects.toThrow("fatal");
    expect(calls).toBe(1);
  });

  it("retries on 429 with retry_after", async () => {
    let calls = 0;
    const result = await withRetry(() => {
      calls++;
      if (calls < 2) {
        const err: any = new Error("rate limited");
        err.error_code = 429;
        err.parameters = { retry_after: 0.01 };
        throw err;
      }
      return Promise.resolve("ok");
    });
    expect(result).toBe("ok");
    expect(calls).toBe(2);
  });

  it("throws after max retries exhausted", async () => {
    let calls = 0;
    await expect(
      withRetry(() => {
        calls++;
        const err: any = new Error("rate limited");
        err.error_code = 429;
        err.parameters = { retry_after: 0.01 };
        throw err;
      }, 2)
    ).rejects.toThrow("rate limited");
    expect(calls).toBe(2);
  });

  it("reads retry_after from payload field as fallback", async () => {
    let calls = 0;
    const result = await withRetry(() => {
      calls++;
      if (calls < 2) {
        const err: any = new Error("rate limited");
        err.error_code = 429;
        err.payload = { retry_after: 0.01 };
        throw err;
      }
      return Promise.resolve("ok");
    });
    expect(result).toBe("ok");
    expect(calls).toBe(2);
  });

  it("does not retry 429 without retry_after", async () => {
    let calls = 0;
    await expect(
      withRetry(() => {
        calls++;
        const err: any = new Error("rate limited");
        err.error_code = 429;
        throw err;
      })
    ).rejects.toThrow("rate limited");
    expect(calls).toBe(1);
  });
});
