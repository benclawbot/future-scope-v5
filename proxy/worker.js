import { generateEventImpact, runAnalysisPipeline } from "./agents.js";
import { AppError, mapError } from "./errors.js";
import { callMiniMaxJson, searchBrave } from "./providers.js";
import {
  assertAllowedOrigin,
  enforceRateLimits,
  preflightResponse,
  requireAppToken,
  responseHeaders,
} from "./security.js";
import {
  validateAnalyzeInput,
  validateEventImpactInput,
  validateSearchInput,
} from "./validation.js";

const VERSION = "5.0.0";

export function createWorker(dependencies = {}) {
  const analyze = dependencies.runAnalysisPipeline ?? runAnalysisPipeline;
  const eventImpact = dependencies.generateEventImpact ?? generateEventImpact;
  const braveSearch = dependencies.searchBrave ?? searchBrave;
  const minimaxJson = dependencies.callMiniMaxJson ?? callMiniMaxJson;
  const randomUUID = dependencies.randomUUID ?? (() => crypto.randomUUID());
  const now = dependencies.now ?? (() => new Date());
  const logger = dependencies.logger ?? console;

  return {
    async fetch(request, env, ctx) {
      const url = new URL(request.url);
      const requestId = validRequestId(request.headers.get("X-Request-Id"))
        ? request.headers.get("X-Request-Id")
        : randomUUID();
      let origin;
      let ipHash = null;

      try {
        origin = assertAllowedOrigin(request, env);
        if (request.method === "OPTIONS") {
          return preflightResponse(requestId, origin);
        }

        if (url.pathname === "/api/health" && request.method === "GET") {
          return json(
            {
              ok: true,
              brave_configured: Boolean(env.BRAVE_SEARCH_API_KEY),
              minimax_configured: Boolean(env.MINIMAX_API_KEY),
              server_time: now().toISOString(),
              version: env.APP_VERSION ?? VERSION,
            },
            200,
            requestId,
            origin,
          );
        }

        requireAppToken(request, env);
        ipHash = await enforceRateLimits(request, env);

        if (url.pathname === "/api/brave/search" && request.method === "POST") {
          const input = validateSearchInput(await readJson(request));
          const result = await braveSearch(input, providerOptions(request, env, "brave"));
          return json(result, 200, requestId, origin);
        }

        if (url.pathname === "/api/minimax/json" && request.method === "POST") {
          const body = await readJson(request);
          const result = await minimaxJson(
            {
              agent: typeof body.agent === "string" ? body.agent.slice(0, 20) : "DIRECT",
              system:
                typeof body.system === "string"
                  ? body.system.slice(0, 4_000)
                  : "Return exactly one JSON object.",
              user: typeof body.user === "string" ? body.user.slice(0, 20_000) : "",
              validate: (value) => value,
            },
            providerOptions(request, env, "minimax"),
          );
          return json(result, 200, requestId, origin);
        }

        if (url.pathname === "/api/analyze" && request.method === "POST") {
          const input = validateAnalyzeInput(await readJson(request));
          const started = now().getTime();
          try {
            const payload = await withDeadline(
              analyze(input, {
                ...providerOptions(request, env, "both"),
                requestId,
                now,
                randomUUID,
              }),
              input.research_depth === "deep" ? 90_000 : 45_000,
            );
            structuredLog(logger, {
              ts: now().toISOString(),
              level: "info",
              request_id: requestId,
              route: url.pathname,
              user_ip_hash: ipHash,
              domain: payload.domain,
              depth: input.research_depth,
              latency_ms_total: Math.max(0, now().getTime() - started),
              latency_ms_per_agent: payload.audit?.agent_latencies_ms ?? {},
              sources_count: payload.sources?.length ?? 0,
              outcomes_count: payload.outcomes?.length ?? 0,
              outcome: "success",
              status: 200,
              code: null,
            });
            return json(payload, 200, requestId, origin);
          } catch (error) {
            const mapped = mapError(error);
            structuredLog(logger, {
              ts: now().toISOString(),
              level: "error",
              request_id: requestId,
              route: url.pathname,
              user_ip_hash: ipHash,
              domain: null,
              depth: input.research_depth,
              latency_ms_total: Math.max(0, now().getTime() - started),
              latency_ms_per_agent: {},
              sources_count: 0,
              outcomes_count: 0,
              outcome: "error",
              status: mapped.status,
              code: mapped.code,
              stack: error?.stack,
            });
            throw mapped;
          }
        }

        if (
          url.pathname === "/api/simulate/event-impact" &&
          request.method === "POST"
        ) {
          const input = validateEventImpactInput(await readJson(request));
          const result = await withDeadline(
            eventImpact(input, providerOptions(request, env, "minimax")),
            60_000,
          );
          return json(result, 200, requestId, origin);
        }

        throw new AppError("E_INPUT_INVALID", "Route not found.", 404, null);
      } catch (error) {
        const mapped = mapError(error);
        if (mapped.code !== "E_PROXY_AUTH" || url.pathname === "/api/analyze") {
          structuredLog(logger, {
            ts: now().toISOString(),
            level: mapped.status >= 500 ? "error" : "warn",
            request_id: requestId,
            route: url.pathname,
            user_ip_hash: ipHash,
            status: mapped.status,
            code: mapped.code,
            stack: error?.stack,
          });
        }
        return json(
          {
            code: mapped.code,
            message: mapped.message,
            ...(mapped.action ? { action: mapped.action } : {}),
            request_id: requestId,
          },
          mapped.status,
          requestId,
          origin,
        );
      }
    },
  };
}

const worker = createWorker();
export default worker;

function providerOptions(request, env, provider) {
  const localOrigin = /^https?:\/\/(?:localhost|127\.0\.0\.1)(?::\d+)?$/.test(
    request.headers.get("Origin") ?? "",
  );
  const allowDevelopmentOverrides =
    env.ALLOW_DEV_KEY_OVERRIDES === "true" && localOrigin;
  const braveApiKey =
    allowDevelopmentOverrides && request.headers.get("X-Dev-Brave-Key")
      ? request.headers.get("X-Dev-Brave-Key")
      : env.BRAVE_SEARCH_API_KEY;
  const minimaxApiKey =
    allowDevelopmentOverrides && request.headers.get("X-Dev-Minimax-Key")
      ? request.headers.get("X-Dev-Minimax-Key")
      : env.MINIMAX_API_KEY;

  return {
    ...(provider !== "minimax" ? { braveApiKey, apiKey: braveApiKey } : {}),
    ...(provider !== "brave" ? { minimaxApiKey, apiKey: minimaxApiKey } : {}),
    braveBaseUrl: env.BRAVE_API_BASE_URL,
    minimaxBaseUrl: env.MINIMAX_API_BASE_URL,
    baseUrl:
      provider === "brave"
        ? env.BRAVE_API_BASE_URL
        : provider === "minimax"
          ? env.MINIMAX_API_BASE_URL
          : undefined,
  };
}

async function readJson(request) {
  const contentLength = Number(request.headers.get("Content-Length") ?? 0);
  if (contentLength > 65_536) {
    throw new AppError("E_INPUT_INVALID", "Request body is too large.", 413, "edit_input");
  }
  const text = await request.text();
  if (text.length > 65_536) {
    throw new AppError("E_INPUT_INVALID", "Request body is too large.", 413, "edit_input");
  }
  try {
    return JSON.parse(text);
  } catch (error) {
    throw new AppError("E_INPUT_INVALID", "Request body must be valid JSON.", 400, "edit_input", error);
  }
}

function json(body, status, requestId, origin) {
  return new Response(JSON.stringify(body), {
    status,
    headers: responseHeaders(requestId, origin),
  });
}

function validRequestId(value) {
  return (
    typeof value === "string" &&
    /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(
      value,
    )
  );
}

function withDeadline(promise, milliseconds) {
  let timeout;
  return Promise.race([
    promise,
    new Promise((_, reject) => {
      timeout = setTimeout(() => {
        const error = new Error("Proxy deadline exceeded");
        error.code = "E_PROXY_TIMEOUT";
        reject(error);
      }, milliseconds);
    }),
  ]).finally(() => clearTimeout(timeout));
}

function structuredLog(logger, entry) {
  logger.log(JSON.stringify(entry));
}
