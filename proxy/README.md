# Future•Scope secure proxy

The proxy is a Cloudflare Worker ES module. It exposes `GET /api/health`, `POST /api/minimax/json`, `POST /api/analyze`, and `POST /api/simulate/event-impact`.

Every route except health requires `X-App-Token`. Browser origins must exactly match `ALLOWED_ORIGIN`. The Worker applies per-IP and aggregate rate limits, owns the MiniMax credential, validates structured model output, normalizes source metadata, and returns stable JSON errors.

## Secrets and variables

Required secrets are `MINIMAX_API_KEY`, `APP_AUTH_TOKEN`, and `IP_HASH_PEPPER`. Optional variables are `MINIMAX_MODEL` and `MINIMAX_API_BASE_URL`. Provider credentials are never returned to the browser.

Development key overrides are accepted only when `ALLOW_DEV_KEY_OVERRIDES=true`, the request origin is local, and `X-Dev-Minimax-Key` is supplied.

## Logging

Analysis completion writes one JSON line containing the request ID, salted IP hash, route, domain, research depth, total and per-agent latency, source count, outcome count, status, result code, and outcome. Stack traces remain server-side.

## Error contract

Errors return stable `code`, `message`, optional `action`, and `request_id` fields. Invalid model JSON receives at most one repair request before failing.
