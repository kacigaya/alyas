"use server";

import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { validateLocalPart } from "@/lib/alias";
import {
  createRule,
  deleteRule,
  listDestinations,
  listRules,
  setRuleEnabled,
} from "@/lib/cloudflare";
import {
  attemptLogin,
  createSession,
  SESSION_COOKIE,
  SESSION_MAX_AGE_SECONDS,
  verifySession,
} from "@/lib/auth";

export type ActionState = { ok: boolean; message: string; field?: string };

async function authenticated(): Promise<boolean> {
  return verifySession((await cookies()).get(SESSION_COOKIE)?.value);
}

async function requireAuthentication(): Promise<ActionState | null> {
  return (await authenticated()) ? null : { ok: false, message: "Your session expired. Sign in again." };
}

function safeError(error: unknown): ActionState {
  return {
    ok: false,
    message: error instanceof Error && error.name === "CloudflareError"
      ? error.message
      : "The request could not be completed.",
  };
}

export async function login(_state: ActionState, formData: FormData): Promise<ActionState> {
  const password = formData.get("password");
  if (typeof password !== "string" || !password) {
    return { ok: false, field: "password", message: "Enter the password." };
  }
  let result;
  try {
    result = await attemptLogin(password);
  } catch {
    return { ok: false, message: "Authentication is not configured." };
  }
  if (!result.ok) {
    return result.locked
      ? { ok: false, message: "Too many failed attempts. Login is locked for 15 minutes." }
      : { ok: false, field: "password", message: "Password is incorrect." };
  }
  (await cookies()).set(SESSION_COOKIE, createSession(), {
    httpOnly: true,
    secure: true,
    sameSite: "lax",
    path: "/",
    maxAge: SESSION_MAX_AGE_SECONDS,
  });
  redirect("/");
}

export async function logout(): Promise<void> {
  (await cookies()).delete(SESSION_COOKIE);
  redirect("/login");
}

export async function createAlias(_state: ActionState, formData: FormData): Promise<ActionState> {
  const authError = await requireAuthentication();
  if (authError) return authError;
  const localPart = formData.get("localPart");
  const destination = formData.get("destination");
  const labelValue = formData.get("label");
  if (typeof localPart !== "string") return { ok: false, field: "localPart", message: "Enter a local-part." };
  const validated = validateLocalPart(localPart);
  if (!validated.valid) return { ok: false, field: "localPart", message: validated.error };
  if (typeof destination !== "string") return { ok: false, field: "destination", message: "Choose a destination." };
  const label = typeof labelValue === "string" ? labelValue.trim() : "";
  if (label.length > 100) return { ok: false, field: "label", message: "Use 100 characters or fewer." };

  try {
    const [rules, destinations] = await Promise.all([listRules(), listDestinations()]);
    const domain = process.env.ALYAS_DOMAIN;
    const address = `${validated.value}@${domain}`;
    if (rules.some((rule) => rule.matchers.some((matcher) => matcher.value?.toLowerCase() === address))) {
      return { ok: false, field: "localPart", message: "That alias already exists." };
    }
    if (!destinations.some((item) => item.email === destination)) {
      return { ok: false, field: "destination", message: "Choose a verified destination." };
    }
    await createRule({ localPart: validated.value, destination, label: label || validated.value });
    revalidatePath("/");
    return { ok: true, message: `${address} created.` };
  } catch (error) {
    return safeError(error);
  }
}

export async function setAliasEnabled(_state: ActionState, formData: FormData): Promise<ActionState> {
  const authError = await requireAuthentication();
  if (authError) return authError;
  const tag = formData.get("tag");
  const enabled = formData.get("enabled") === "true";
  if (typeof tag !== "string" || !tag) return { ok: false, message: "Alias rule not found." };
  try {
    await setRuleEnabled(tag, enabled);
    revalidatePath("/");
    return { ok: true, message: enabled ? "Alias enabled." : "Alias disabled." };
  } catch (error) {
    return safeError(error);
  }
}

export async function deleteAlias(_state: ActionState, formData: FormData): Promise<ActionState> {
  const authError = await requireAuthentication();
  if (authError) return authError;
  const tag = formData.get("tag");
  if (typeof tag !== "string" || !tag) return { ok: false, message: "Alias rule not found." };
  try {
    await deleteRule(tag);
    revalidatePath("/");
    return { ok: true, message: "Alias deleted." };
  } catch (error) {
    return safeError(error);
  }
}
