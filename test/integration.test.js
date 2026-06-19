import { createServer } from "node:http";
import { afterAll, beforeAll, describe, expect, test, vi } from "vitest";
import worker from "../proxy/worker.js";
import { agentFixtures } from "./fixtures/pipeline.js";

describe("complete Worker analysis integration", () => {
  let server;
  let baseUrl;

  beforeAll(async () => {
    server = createServer(async (request, response) => {
      const url = new URL(request.url, `http://${request.headers.host}`);
      response.setHeader("Content-Type", "application/json");

      if (url.pathname === "/minimax") {
        const body = await readJson(request);
        const marker = body.messages?.[0]?.content?.match(/\[AGENT:([^\]]+)\]/)?.[1];
        const fixture = agentFixtures[marker];
        if (!fixture) {
          response.writeHead(400);
          response.end(JSON.stringify({ error: `Unknown agent ${marker}` }));
          return;
        }
        response.end(
          JSON.stringify({
            choices: [{ message: { content: JSON.stringify(fixture) } }],
          }),
        );
        return;
      }

      response.writeHead(404);
      response.end(JSON.stringify({ error: "not found" }));
    });

    await new Promise((resolve) => server.listen(0, "127.0.0.1", resolve));
    baseUrl = `http://127.0.0.1:${server.address().port}`;
  });

  afterAll(async () => {
    await new Promise((resolve, reject) =>
      server.close((error) => (error ? reject(error) : resolve())),
    );
  });

  test("returns a validated payload through the public analyze route", async () => {
    const log = vi.spyOn(console, "log").mockImplementation(() => {});
    const env = {
      MINIMAX_API_KEY: "contract-minimax-key",
      APP_AUTH_TOKEN: "contract-app-token",
      IP_HASH_PEPPER: "contract-ip-pepper",
      ALLOWED_ORIGIN: "https://app.example.test",
      MINIMAX_API_BASE_URL: `${baseUrl}/minimax`,
      PER_IP_RATE_LIMITER: { limit: async () => ({ success: true }) },
      GLOBAL_RATE_LIMITER: { limit: async () => ({ success: true }) },
      APP_VERSION: "5.1.0-test",
    };
    const response = await worker.fetch(
      new Request("https://proxy.example.test/api/analyze", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Origin: "https://app.example.test",
          "X-App-Token": "contract-app-token",
          "X-Request-Id": "33333333-3333-4333-8333-333333333333",
          "CF-Connecting-IP": "203.0.113.7",
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
    const payload = await response.json();

    expect(response.status).toBe(200);
    expect(payload.request_id).toBe("33333333-3333-4333-8333-333333333333");
    expect(payload.research_provider).toBe("minimax_native");
    expect(payload.sources.length).toBeGreaterThanOrEqual(8);
    expect(payload.evidence_items).toHaveLength(12);
    expect(payload.outcomes).toHaveLength(4);
    expect(
      payload.outcomes.reduce(
        (sum, outcome) => sum + Math.round(outcome.display_probability * 10),
        0,
      ),
    ).toBe(1000);
    expect(payload.audit.thresholds_met).toBe(true);
    expect(JSON.parse(log.mock.calls.at(-1)[0])).toMatchObject({
      outcome: "success",
      sources_count: 20,
      outcomes_count: 4,
    });
    log.mockRestore();
  });
});

function readJson(request) {
  return new Promise((resolve, reject) => {
    let value = "";
    request.setEncoding("utf8");
    request.on("data", (chunk) => {
      value += chunk;
    });
    request.on("end", () => {
      try {
        resolve(JSON.parse(value));
      } catch (error) {
        reject(error);
      }
    });
    request.on("error", reject);
  });
}
