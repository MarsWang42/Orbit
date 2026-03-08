import { describe, it, expect } from "bun:test";
import { findSplitPoint } from "../src/session";

describe("findSplitPoint", () => {
  it("splits at newline in the latter half of the text", () => {
    const text = "A".repeat(30) + "\n" + "B".repeat(20);
    // limit=40, newline at 30 which is > 40*0.5=20
    expect(findSplitPoint(text, 40)).toBe(30);
  });

  it("returns limit when no newline in latter half", () => {
    // Newline at position 5, which is < 50*0.5=25
    const text = "AAAAA\n" + "B".repeat(100);
    expect(findSplitPoint(text, 50)).toBe(50);
  });

  it("splits before unclosed code fence", () => {
    const text = "Hello\n```\nsome code";
    // One fence (odd) — should split before it
    const split = findSplitPoint(text, 50);
    // Should split at newline before the fence (position 5)
    expect(split).toBe(5);
  });

  it("does not split on even number of code fences", () => {
    // Two fences (even) — normal newline splitting applies
    // "```js\ncode\n```\n" is 14 chars, then pad so a newline falls in the latter half
    const text = "```js\ncode\n```\n" + "A".repeat(20) + "\n" + "B".repeat(20);
    const newlinePos = text.indexOf("\n", 14 + 20);
    const split = findSplitPoint(text, 50);
    expect(split).toBe(newlinePos);
  });

  it("handles text shorter than limit", () => {
    const text = "short text\nwith newline";
    // Newline at 10, limit 100, 10 < 100*0.5=50
    expect(findSplitPoint(text, 100)).toBe(100);
  });

  it("handles text with no newlines", () => {
    const text = "A".repeat(100);
    expect(findSplitPoint(text, 50)).toBe(50);
  });

  it("handles unclosed fence with no newline before it", () => {
    const text = "```code that keeps going";
    // One fence at position 0, no newline before it
    // lastFence=0 which is not > 0, so falls through to normal logic
    const split = findSplitPoint(text, 50);
    expect(split).toBe(50);
  });

  it("handles triple backticks mid-text with newline before", () => {
    const text = "Some intro paragraph\nMore text\n```\nunclosed code block here";
    const split = findSplitPoint(text, 60);
    // Odd fences, lastFence at 31, newline before at 30
    expect(split).toBe(30);
  });
});
