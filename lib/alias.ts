import { randomBytes, randomInt } from "node:crypto";
import { ADJECTIVES, NOUNS } from "@/lib/words";

export type GeneratorMode = "words" | "hex" | "custom";

export type ValidationResult =
  | { valid: true; value: string }
  | { valid: false; error: string };

export function generate(mode: GeneratorMode): string {
  if (mode === "custom") return "";
  if (mode === "hex") return randomBytes(4).toString("hex");
  return `${ADJECTIVES[randomInt(ADJECTIVES.length)]}-${NOUNS[randomInt(NOUNS.length)]}-${randomBytes(2).toString("hex")}`;
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
