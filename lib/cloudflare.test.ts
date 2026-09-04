import { afterEach, beforeAll, describe, expect, mock, test } from "bun:test";

mock.module("server-only", () => ({}));

let cloudflare: typeof import("@/lib/cloudflare");
const originalFetch = globalThis.fetch;

function asFetch(handler: (input: RequestInfo | URL, init?: RequestInit) => Promise<Response>): typeof fetch {
  return Object.assign(handler, { preconnect: originalFetch.preconnect });
}

beforeAll(async () => {
  process.env.CLOUDFLARE_API_TOKEN = "test-token";
  process.env.CLOUDFLARE_ACCOUNT_ID = "account";
  process.env.CLOUDFLARE_ZONE_ID = "zone";
  process.env.ALYAS_DOMAIN = "example.com";
  cloudflare = await import("@/lib/cloudflare");
});

afterEach(() => {
  globalThis.fetch = originalFetch;
  mock.restore();
});

describe("Cloudflare client", () => {
  test("paginates rules and excludes catch-all", async () => {
    const fetchMock = mock(async (url: string | URL | Request) => {
      const page = String(url).includes("page=2") ? 2 : 1;
      return Response.json({
        success: true,
        result: page === 1
          ? [{ tag: "catch", name: "catch", enabled: false, matchers: [{ type: "all" }], actions: [{ type: "drop" }] }]
          : [{ tag: "alias", name: "Alias", enabled: true, matchers: [{ type: "literal", field: "to", value: "a@example.com" }], actions: [{ type: "forward", value: ["inbox@example.com"] }] }],
        result_info: { page, total_pages: 2 },
      });
    });
    globalThis.fetch = asFetch(fetchMock);
    expect(await cloudflare.listRules()).toHaveLength(1);
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });

  test("creates the documented literal-forward rule", async () => {
    let body = "";
    globalThis.fetch = asFetch(async (_url: RequestInfo | URL, init?: RequestInit) => {
      body = String(init?.body);
      return Response.json({ success: true, result: { tag: "new" } });
    });
    await cloudflare.createRule({ localPart: "shop", destination: "inbox@example.com", label: "Shop" });
    expect(JSON.parse(body)).toEqual({
      name: "Shop",
      enabled: true,
      matchers: [{ type: "literal", field: "to", value: "shop@example.com" }],
      actions: [{ type: "forward", value: ["inbox@example.com"] }],
    });
  });

  test("updates a rule without sending its read-only tag", async () => {
    const bodies: string[] = [];
    globalThis.fetch = asFetch(async (_url, init) => {
      if (init?.method === "PUT") {
        bodies.push(String(init.body));
        return Response.json({ success: true, result: { tag: "alias" } });
      }
      return Response.json({ success: true, result: [{
        tag: "alias",
        name: "Alias",
        enabled: true,
        priority: 3,
        matchers: [{ type: "literal", field: "to", value: "a@example.com" }],
        actions: [{ type: "forward", value: ["inbox@example.com"] }],
      }] });
    });
    await cloudflare.setRuleEnabled("alias", false);
    expect(JSON.parse(bodies[0])).toEqual({
      name: "Alias",
      enabled: false,
      priority: 3,
      matchers: [{ type: "literal", field: "to", value: "a@example.com" }],
      actions: [{ type: "forward", value: ["inbox@example.com"] }],
    });
  });

  test("surfaces only the first Cloudflare error and redacts the token", async () => {
    globalThis.fetch = asFetch(async () => Response.json({
      success: false,
      result: null,
      errors: [{ message: "bad test-token" }, { message: "second" }],
    }, { status: 403 }));
    await expect(cloudflare.listDestinations()).rejects.toThrow("bad [redacted]");
  });

  test("keeps only verified destinations", async () => {
    globalThis.fetch = asFetch(async () => Response.json({ success: true, result: [
      { id: "1", email: "ok@example.com", verified: "now", status: "verified" },
      { id: "2", email: "pending@example.com", verified: null, status: "pending" },
    ] }));
    expect(await cloudflare.listDestinations()).toEqual([
      { id: "1", email: "ok@example.com", verified: "now", status: "verified" },
    ]);
  });
});
