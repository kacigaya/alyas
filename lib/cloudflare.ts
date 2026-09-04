import "server-only";

const API_BASE = "https://api.cloudflare.com/client/v4";

type CloudflareEnvelope<T> = {
  success: boolean;
  result: T;
  errors?: Array<{ message?: string }>;
  result_info?: { page?: number; total_pages?: number };
};

export type EmailMatcher = { type: string; field?: string; value?: string };
export type EmailAction = { type: string; value?: string[] };

export type EmailRule = {
  tag: string;
  name: string;
  enabled: boolean;
  priority?: number;
  matchers: EmailMatcher[];
  actions: EmailAction[];
};

export type Destination = {
  id: string;
  email: string;
  verified: string | null;
  status: string;
};

export type RoutingStatus = { enabled: boolean; status: string };

export class CloudflareError extends Error {
  constructor(message: string, public readonly status?: number) {
    super(message);
    this.name = "CloudflareError";
  }
}

function required(name: string): string {
  const value = process.env[name];
  if (!value) throw new CloudflareError(`${name} is not configured.`);
  return value;
}

function sanitize(message: string): string {
  const token = process.env.CLOUDFLARE_API_TOKEN;
  return token ? message.replaceAll(token, "[redacted]") : message;
}

async function request<T>(path: string, init?: RequestInit): Promise<CloudflareEnvelope<T>> {
  const response = await fetch(`${API_BASE}${path}`, {
    ...init,
    cache: "no-store",
    headers: {
      Authorization: `Bearer ${required("CLOUDFLARE_API_TOKEN")}`,
      "Content-Type": "application/json",
      ...init?.headers,
    },
  });

  let payload: CloudflareEnvelope<T>;
  try {
    payload = (await response.json()) as CloudflareEnvelope<T>;
  } catch {
    throw new CloudflareError("Cloudflare returned an invalid response.", response.status);
  }

  if (!response.ok || !payload.success) {
    const message = payload.errors?.[0]?.message;
    throw new CloudflareError(sanitize(message || "Cloudflare request failed."), response.status);
  }
  return payload;
}

function aliasesOnly(rules: EmailRule[]): EmailRule[] {
  return rules.filter((rule) => rule.matchers[0]?.type !== "all");
}

export async function listRules(): Promise<EmailRule[]> {
  const zone = required("CLOUDFLARE_ZONE_ID");
  const rules: EmailRule[] = [];
  let page = 1;
  do {
    const payload = await request<EmailRule[]>(`/zones/${zone}/email/routing/rules?page=${page}&per_page=50`);
    rules.push(...payload.result);
    if (page >= (payload.result_info?.total_pages ?? 1)) break;
    page += 1;
  } while (true);
  return aliasesOnly(rules);
}

export async function createRule(input: {
  localPart: string;
  destination: string;
  label: string;
}): Promise<EmailRule> {
  const zone = required("CLOUDFLARE_ZONE_ID");
  const domain = required("ALYAS_DOMAIN");
  const payload = await request<EmailRule>(`/zones/${zone}/email/routing/rules`, {
    method: "POST",
    body: JSON.stringify({
      name: input.label,
      enabled: true,
      matchers: [{ type: "literal", field: "to", value: `${input.localPart}@${domain}` }],
      actions: [{ type: "forward", value: [input.destination] }],
    }),
  });
  return payload.result;
}

export async function setRuleEnabled(tag: string, enabled: boolean): Promise<EmailRule> {
  const zone = required("CLOUDFLARE_ZONE_ID");
  const rule = (await listRules()).find((item) => item.tag === tag);
  if (!rule) throw new CloudflareError("Alias rule not found.", 404);
  const payload = await request<EmailRule>(`/zones/${zone}/email/routing/rules/${encodeURIComponent(tag)}`, {
    method: "PUT",
    body: JSON.stringify({
      name: rule.name,
      enabled,
      matchers: rule.matchers,
      actions: rule.actions,
      ...(rule.priority === undefined ? {} : { priority: rule.priority }),
    }),
  });
  return payload.result;
}

export async function deleteRule(tag: string): Promise<void> {
  const zone = required("CLOUDFLARE_ZONE_ID");
  const exists = (await listRules()).some((rule) => rule.tag === tag);
  if (!exists) throw new CloudflareError("Alias rule not found.", 404);
  await request<unknown>(`/zones/${zone}/email/routing/rules/${encodeURIComponent(tag)}`, { method: "DELETE" });
}

export async function listDestinations(): Promise<Destination[]> {
  const account = required("CLOUDFLARE_ACCOUNT_ID");
  const destinations: Destination[] = [];
  let page = 1;
  do {
    const payload = await request<Destination[]>(`/accounts/${account}/email/routing/addresses?page=${page}&per_page=50`);
    destinations.push(...payload.result);
    if (page >= (payload.result_info?.total_pages ?? 1)) break;
    page += 1;
  } while (true);
  return destinations.filter((destination) => destination.status === "verified");
}

export async function getRoutingStatus(): Promise<RoutingStatus> {
  const zone = required("CLOUDFLARE_ZONE_ID");
  return (await request<RoutingStatus>(`/zones/${zone}/email/routing`)).result;
}
