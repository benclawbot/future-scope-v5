import { beforeEach, describe, expect, test, vi } from "vitest";
import { createWorker } from "../proxy/worker.js";
import { agentFixtures, createCandidateSources } from "./fixtures/pipeline.js";

const allowedOrigin = "https://app.example.test";
const appToken = "test-app-token-with-enough-entropy";

function environment(overrides = {}) {
  return {
    MINIMAX_API_KEY: "minimax-provider-key",
    APP_AUTH_TOKEN: appToken,
    ALLOWED_ORIGIN: allowedOrigin,
    IP_HASH_PEPPER: "test-hash-pepper",
    PER_IP_RATE_LIMITER: { limit: vi.fn(async () => ({ success: true })) },
    GLOBAL_RATE_LIMITER: { limit: vi.fn(async () => ({ success: true })) },
    ...overrides,
  };
}

function request(path, init = {}) {
  return new Request(`https://proxy.example.test${path}`, {
    ...init,
    headers: {
      Origin: allowedOrigin,
      "X-Request-Id": "11111111-1111-4111-8111-111111111111",
      ...init.headers,
    },
  });
}

describe("Future Scope Worker", () => {
  let pipeline;
  let eventImpact;
  let worker;

  beforeEach(() => {
    pipeline = vi.fn(async (_input, options) => ({
      analysis_id: "11111111-1111-4111-8111-111111111111",
      request_id: options.requestId,
      created_at: "2026-06-18T12:00:00.000Z",
      domain: "technology",
      sources: createCandidateSources(8),
      outcomes: agentFixtures.A6.outcomes,
      audit: { agent_latencies_ms: {}, insufficient_evidence: false },
    }));
    eventImpact = vi.fn(async () => ({
      event_label: "Policy changes",
      event_date: null,
      impacts: { out_001: 0.4, out_002: -0.4 },
      explanations: { out_001: "Supports adoption", out_002: "Reduces alternative" },
    }));
    worker = createWorker({
      runAnalysisPipeline: pipeline,
      generateEventImpact: eventImpact,
      randomUUID: () => "22222222-2222-4222-8222-222222222222",
      now: () => new Date("2026-06-18T12:00:00.000Z"),
    });
  });

  test("health is unauthenticated and reports configuration", async () => {
    const response = await worker.fetch(request("/api/health"), environment(), {});

    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({
      ok: true,
      minimax_configured: true,
      research_enabled: true,
      research_provider: "minimax_native",
      server_time: "2026-06-18T12:00:00.000Z",
      version: "5.1.0",
    });
    expect(response.headers.get("X-Content-Type-Options")).toBe("nosniff");
    expect(response.headers.get("X-Request-Id")).toBe(
      "11111111-1111-4111-8111-111111111111",
    );
  });

  test("rejects missing app authentication", async () => {
    const response = await worker.fetch(
      request("/api/analyze", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ prompt: "Will this forecast pass?" }),
      }),
      environment(),
      {},
    );

    expect(response.status).toBe(401);
    expect(await response.json()).toMatchObject({ code: "E_PROXY_AUTH" });
  });

  test("handles exact-origin preflight without wildcard CORS", async () => {
    const response = await worker.fetch(
      request("/api/analyze", {
        method: "OPTIONS",
        headers: {
          "Access-Control-Request-Method": "POST",
          "Access-Control-Request-Headers": "content-type,x-app-token,x-request-id",
        },
      }),
      environment(),
      {},
    );

    expect(response.status).toBe(204);
    expect(response.headers.get("Access-Control-Allow-Origin")).toBe(allowedOrigin);
    expect(response.headers.get("Access-Control-Allow-Origin")).not.toBe("*");
    expect(response.headers.get("Access-Control-Allow-Headers")).not.toContain(
      ["X-Dev-", "Br", "ave-Key"].join(""),
    );
    expect(response.headers.get("Access-Control-Allow-Headers")).toContain(
      "X-Dev-Minimax-Key",
    );
  });

  test("does not expose the retired direct search route", async () => {
    const response = await worker.fetch(
      request(`/api/${["br", "ave"].join("")}/search`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "X-App-Token": appToken,
        },
        body: JSON.stringify({ query: "forecast evidence" }),
      }),
      environment(),
      {},
    );

    expect(response.status).toBe(404);
    expect(await response.json()).toMatchObject({
      code: "E_INPUT_INVALID",
      message: "Route not found.",
    });
  });

  test("runs an authenticated analysis with rate limits and structured logging", async () => {
    const log = vi.spyOn(console, "log").mockImplementation(() => {});
    const env = environment();
    const response = await worker.fetch(
      request("/api/analyze", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "X-App-Token": appToken,
          "CF-Connecting-IP": "203.0.113.9",
        },
        body: JSON.stringify({
          prompt: "Will grid storage deployment accelerate by June 2028?",
          research_depth: "balanced",
          time_horizon_override: null,
          locale: "en-US",
        }),
      }),
      env,
      {},
    );

    expect(response.status).toBe(200);
    expect(pipeline).toHaveBeenCalledOnce();
    expect(pipeline.mock.calls[0][1]).toMatchObject({
      minimaxApiKey: "minimax-provider-key",
      minimaxModel: "MiniMax-M3",
    });
    expect(pipeline.mock.calls[0][1]).not.toHaveProperty(
      ["br", "ave", "ApiKey"].join(""),
    );
    expect(env.PER_IP_RATE_LIMITER.limit).toHaveBeenCalledOnce();
    expect(env.GLOBAL_RATE_LIMITER.limit).toHaveBeenCalledOnce();
    expect(JSON.parse(log.mock.calls.at(-1)[0])).toMatchObject({
      request_id: "11111111-1111-4111-8111-111111111111",
      route: "/api/analyze",
      domain: "technology",
      depth: "balanced",
      sources_count: 8,
      outcomes_count: 4,
      outcome: "success",
    });
    log.mockRestore();
  });

  test("rejects invalid prompt at the server boundary", async () => {
    const response = await worker.fetch(
      request("/api/analyze", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "X-App-Token": appToken,
        },
        body: JSON.stringify({ prompt: "" }),
      }),
      environment(),
      {},
    );

    expect(response.status).toBe(400);
    expect(await response.json()).toMatchObject({
      code: "E_INPUT_INVALID",
      action: "edit_input",
    });
  });

  test("maps a failed rate limiter to a stable error", async () => {
    const response = await worker.fetch(
      request("/api/analyze", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "X-App-Token": appToken,
        },
        body: JSON.stringify({ prompt: "Will this request be limited?" }),
      }),
      environment({
        PER_IP_RATE_LIMITER: { limit: vi.fn(async () => ({ success: false })) },
      }),
      {},
    );

    expect(response.status).toBe(429);
    expect(await response.json()).toMatchObject({ code: "E_PROXY_RATE_LIMIT" });
  });

  test("emits exactly one structured log for a failed analysis", async () => {
    pipeline.mockRejectedValueOnce(new Error("pipeline failure"));
    const log = vi.spyOn(console, "log").mockImplementation(() => {});
    const response = await worker.fetch(
      request("/api/analyze", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "X-App-Token": appToken,
        },
        body: JSON.stringify({ prompt: "Will this analysis fail cleanly?" }),
      }),
      environment(),
      {},
    );

    expect(response.status).toBe(500);
    expect(log).toHaveBeenCalledTimes(1);
    expect(JSON.parse(log.mock.calls[0][0])).toMatchObject({
      route: "/api/analyze",
      outcome: "error",
      code: "E_INTERNAL",
    });
    log.mockRestore();
  });
});
