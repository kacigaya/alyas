import { ADJECTIVES, NOUNS } from "@/lib/words";

export type GeneratorMode = "words" | "hex" | "custom";

export type ValidationResult =
  | { valid: true; value: string }
  | { valid: false; error: string };

// This module is imported by a client component, so it uses Web Crypto rather
// than node:crypto: the browser bundle has no randomInt, and calling it threw
// during hydration.
function hex(byteLength: number): string {
  const bytes = crypto.getRandomValues(new Uint8Array(byteLength));
  return Array.from(bytes, (byte) => byte.toString(16).padStart(2, "0")).join("");
}

// Rejection sampling: a plain modulo would favour the first
// (2 ** 32 % length) entries of the list.
function randomIndex(length: number): number {
  const limit = Math.floor(0x1_0000_0000 / length) * length;
  const buffer = new Uint32Array(1);
  do {
    crypto.getRandomValues(buffer);
  } while (buffer[0] >= limit);
  return buffer[0] % length;
}

export function generate(mode: GeneratorMode): string {
  if (mode === "custom") return "";
  if (mode === "hex") return hex(4);
  return `${ADJECTIVES[randomIndex(ADJECTIVES.length)]}-${NOUNS[randomIndex(NOUNS.length)]}-${hex(2)}`;
}

export function validateLocalPart(rawValue: string): ValidationResult {
  const value = rawValue.trim();
  if (value.length === 0) return { valid: false, error: "Enter a local-part." };
  if (value.length > 64) return { valid: false, error: "Use 64 characters or fewer." };
  if (!/^[a-z0-9._-]+$/.test(value)) {
    return { valid: false, error: "Use lowercase letters, numbers, dots, hyphens, or underscores." };
  }
  if (/^[._-]|[._-]$/.test(value)) {
    return { valid: false, error: "Start and end with a letter or number." };
  }
  if (/[._-]{2}/.test(value)) {
    return { valid: false, error: "Do not place separators next to each other." };
  }
  return { valid: true, value };
}
