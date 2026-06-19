import { AppError } from "./errors.js";

const localCounters = new Map();

export function assertAllowedOrigin(request, env) {
  const origin = request.headers.get("Origin");
  if (!origin) return null;
  const allowedOrigin = env.ALLOWED_ORIGIN;
  if (!allowedOrigin || origin !== allowedOrigin) {
    throw new AppError(
      "E_PROXY_AUTH",
      "This origin is not allowed to use the proxy.",
      403,
      "check_proxy_origin",
    );
  }
  return origin;
}

export function requireAppToken(request, env) {
  const expected = env.APP_AUTH_TOKEN;
  const supplied = request.headers.get("X-App-Token");
  if (!expected || !supplied || !constantTimeEqual(supplied, expected)) {
    throw new AppError(
      "E_PROXY_AUTH",
      "A valid application token is required.",
      401,
      "open_settings",
    );
  }
}

export async function enforceRateLimits(request, env) {
  const ip = request.headers.get("CF-Connecting-IP") ?? "local";
  const ipHash = await hashIp(ip, env.IP_HASH_PEPPER ?? "development-only");
  const perIp = await consumeLimit(env.PER_IP_RATE_LIMITER, `ip:${ipHash}`, 10, 60_000);
  const global = await consumeLimit(env.GLOBAL_RATE_LIMITER, "global", 100, 60_000);
  if (!perIp || !global) {
    throw new AppError(
      "E_PROXY_RATE_LIMIT",
      "The proxy rate limit has been exceeded.",
      429,
      "retry_later",
    );
  }
  return ipHash;
}

export async function hashIp(ip, pepper) {
  const bytes = new TextEncoder().encode(`${ip}:${pepper}`);
  const digest = await crypto.subtle.digest("SHA-256", bytes);
  return [...new Uint8Array(digest)]
    .map((value) => value.toString(16).padStart(2, "0"))
    .join("");
}

export function responseHeaders(requestId, origin = null) {
  const headers = new Headers({
    "Cache-Control": "no-store",
    "Content-Type": "application/json; charset=utf-8",
    "Cross-Origin-Resource-Policy": "same-site",
    "Permissions-Policy": "camera=(), microphone=(), geolocation=(), payment=()",
    "Referrer-Policy": "strict-origin-when-cross-origin",
    "Strict-Transport-Security": "max-age=63072000; includeSubDomains",
    "X-Content-Type-Options": "nosniff",
    "X-Frame-Options": "DENY",
    "X-Request-Id": requestId,
  });
  if (origin) {
    headers.set("Access-Control-Allow-Origin", origin);
    headers.set("Vary", "Origin");
  }
  return headers;
}

export function preflightResponse(requestId, origin) {
  const headers = responseHeaders(requestId, origin);
  headers.set("Access-Control-Allow-Methods", "GET, POST, OPTIONS");
  headers.set(
    "Access-Control-Allow-Headers",
    "Content-Type, X-App-Token, X-Request-Id, X-Dev-Minimax-Key",
  );
  headers.set("Access-Control-Max-Age", "600");
  headers.delete("Content-Type");
  return new Response(null, { status: 204, headers });
}

function constantTimeEqual(left, right) {
  const leftBytes = new TextEncoder().encode(left);
  const rightBytes = new TextEncoder().encode(right);
  let difference = leftBytes.length ^ rightBytes.length;
  const length = Math.max(leftBytes.length, rightBytes.length);
  for (let index = 0; index < length; index += 1) {
    difference |= (leftBytes[index] ?? 0) ^ (rightBytes[index] ?? 0);
  }
  return difference === 0;
}

async function consumeLimit(binding, key, fallbackLimit, fallbackWindowMs) {
  if (binding?.limit) {
    const result = await binding.limit({ key });
    return result.success;
  }

  const now = Date.now();
  const current = localCounters.get(key);
  if (!current || current.resetAt <= now) {
    localCounters.set(key, { count: 1, resetAt: now + fallbackWindowMs });
    return true;
  }
  current.count += 1;
  return current.count <= fallbackLimit;
}
