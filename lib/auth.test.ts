import { beforeEach, describe, expect, test } from "bun:test";
import { scryptSync } from "node:crypto";
import {
  attemptLogin,
  createSession,
  resetLoginAttemptsForTests,
  verifyPassword,
  verifySession,
} from "@/lib/auth";

beforeEach(() => {
  process.env.ALYAS_PASSWORD_HASH = `salt:${scryptSync("correct", "salt", 64).toString("hex")}`;
  process.env.ALYAS_SESSION_SECRET = "a-long-test-secret";
  resetLoginAttemptsForTests();
});

describe("password verification", () => {
  test("accepts the right password and rejects the wrong password", async () => {
    expect(await verifyPassword("correct")).toBe(true);
    expect(await verifyPassword("wrong")).toBe(false);
  });

  test("locks after five failures", async () => {
    for (let attempt = 0; attempt < 4; attempt += 1) {
      expect(await attemptLogin("wrong", 1_000)).toEqual({ ok: false, locked: false });
    }
    expect(await attemptLogin("wrong", 1_000)).toEqual({ ok: false, locked: true, retryAfterSeconds: 900 });
    expect(await attemptLogin("correct", 1_001)).toMatchObject({ ok: false, locked: true });
  });
});

describe("session signing", () => {
  test("round-trips a valid cookie", () => {
    expect(verifySession(createSession(2_000), 1_000)).toBe(true);
  });

  test("rejects a tampered signature", () => {
    const session = createSession(2_000);
    expect(verifySession(`${session.slice(0, -1)}x`, 1_000)).toBe(false);
  });

  test("rejects an expired cookie", () => {
    expect(verifySession(createSession(1_000), 1_000)).toBe(false);
  });
});
