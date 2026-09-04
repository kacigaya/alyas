import { createHmac, scrypt as scryptCallback, timingSafeEqual } from "node:crypto";
import { promisify } from "node:util";

const scrypt = promisify(scryptCallback);
export const SESSION_COOKIE = "alyas_session";
export const SESSION_MAX_AGE_SECONDS = 30 * 24 * 60 * 60;
const MAX_FAILURES = 5;
const LOCK_MS = 15 * 60 * 1000;

let attempts = { failures: 0, lockedUntil: 0 };

function required(name: "ALYAS_PASSWORD_HASH" | "ALYAS_SESSION_SECRET"): string {
  const value = process.env[name];
  if (!value) throw new Error(`${name} is not configured.`);
  return value;
}

function equalStrings(left: string, right: string): boolean {
  const a = Buffer.from(left);
  const b = Buffer.from(right);
  return a.length === b.length && timingSafeEqual(a, b);
}

export async function verifyPassword(password: string, encoded = required("ALYAS_PASSWORD_HASH")): Promise<boolean> {
  const separator = encoded.indexOf(":");
  if (separator < 1) return false;
  const salt = encoded.slice(0, separator);
  const expectedHex = encoded.slice(separator + 1);
  if (!/^[0-9a-f]+$/i.test(expectedHex) || expectedHex.length % 2 !== 0) return false;
  const expected = Buffer.from(expectedHex, "hex");
  const actual = (await scrypt(password, salt, expected.length)) as Buffer;
  return actual.length === expected.length && timingSafeEqual(actual, expected);
}

export type LoginResult =
  | { ok: true }
  | { ok: false; locked: boolean; retryAfterSeconds?: number };

export async function attemptLogin(password: string, now = Date.now()): Promise<LoginResult> {
  if (attempts.lockedUntil > now) {
    return { ok: false, locked: true, retryAfterSeconds: Math.ceil((attempts.lockedUntil - now) / 1000) };
  }
  if (attempts.lockedUntil && attempts.lockedUntil <= now) attempts = { failures: 0, lockedUntil: 0 };
  if (await verifyPassword(password)) {
    attempts = { failures: 0, lockedUntil: 0 };
    return { ok: true };
  }
  attempts.failures += 1;
  if (attempts.failures >= MAX_FAILURES) {
    attempts.lockedUntil = now + LOCK_MS;
    return { ok: false, locked: true, retryAfterSeconds: LOCK_MS / 1000 };
  }
  return { ok: false, locked: false };
}

function signature(expiry: string, secret = required("ALYAS_SESSION_SECRET")): string {
  return createHmac("sha256", secret).update(expiry).digest("base64url");
}

export function createSession(expiry = Math.floor(Date.now() / 1000) + SESSION_MAX_AGE_SECONDS): string {
  const value = String(expiry);
  return `${value}.${signature(value)}`;
}

export function verifySession(value: string | undefined, now = Math.floor(Date.now() / 1000)): boolean {
  if (!value) return false;
  const [expiry, supplied, extra] = value.split(".");
  if (!expiry || !supplied || extra || !/^\d+$/.test(expiry) || Number(expiry) <= now) return false;
  return equalStrings(supplied, signature(expiry));
}

export function resetLoginAttemptsForTests(): void {
  if (process.env.NODE_ENV !== "test") throw new Error("Test helper used outside tests.");
  attempts = { failures: 0, lockedUntil: 0 };
}
