import { describe, expect, test } from "bun:test";
import { generate, validateLocalPart } from "@/lib/alias";
import { ADJECTIVES, NOUNS } from "@/lib/words";

describe("generate", () => {
  test("creates a word pair with a four-character hex suffix", () => {
    expect(generate("words")).toMatch(/^[a-z]+-[a-z]+-[0-9a-f]{4}$/);
  });

  test("creates eight hex characters", () => {
    expect(generate("hex")).toMatch(/^[0-9a-f]{8}$/);
  });

  test("leaves custom mode empty", () => {
    expect(generate("custom")).toBe("");
  });

  test("stays inside both word lists", () => {
    for (let attempt = 0; attempt < 200; attempt += 1) {
      const [adjective, noun] = generate("words").split("-");
      expect(ADJECTIVES.some((word) => word === adjective)).toBe(true);
      expect(NOUNS.some((word) => word === noun)).toBe(true);
    }
  });
});

describe("validateLocalPart", () => {
  test.each([
    ["", "Enter a local-part."],
    ["a".repeat(65), "Use 64 characters or fewer."],
    ["UPPER", "Use lowercase letters, numbers, dots, hyphens, or underscores."],
    ["not allowed", "Use lowercase letters, numbers, dots, hyphens, or underscores."],
    [".leading", "Start and end with a letter or number."],
    ["trailing-", "Start and end with a letter or number."],
    ["two..dots", "Do not place separators next to each other."],
    ["two-_separators", "Do not place separators next to each other."],
  ])("rejects %p", (value, error) => {
    expect(validateLocalPart(value)).toEqual({ valid: false, error });
  });

  test("accepts every allowed separator and normalizes whitespace", () => {
    expect(validateLocalPart("  valid.name-test_2  ")).toEqual({
      valid: true,
      value: "valid.name-test_2",
    });
  });

  test("accepts the 64-character boundary", () => {
    const value = "a".repeat(64);
    expect(validateLocalPart(value)).toEqual({ valid: true, value });
  });
});
