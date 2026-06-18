# Future•Scope secure proxy

The proxy is a Cloudflare Worker ES module. It exposes:

- `GET /api/health`
- `POST /api/brave/search`
- `POST /api/minimax/json`
- `POST /api/analyze`
- `POST /api/simulate/event-impact`

Every route except health requires `X-App-Token`. Browser origins must exactly match `ALLOWED_ORIGIN`. The Worker uses Cloudflare Rate Limiting bindings for per-IP and aggregate limits and falls back to local in-memory counters only during local execution where bindings are absent.

## Secrets

`BRAVE_SEARCH_API_KEY`, `MINIMAX_API_KEY`, `APP_AUTH_TOKEN`, and `IP_HASH_PEPPER` are declared as required Worker secrets. Provider keys are never returned to the browser. Development key overrides are accepted only when `ALLOW_DEV_KEY_OVERRIDES=true` and the request origin is localhost.

## Logging

Analyze completion writes one JSON line containing the request ID, salted IP hash, route, domain, research depth, total and per-agent latency, source count, outcome count, status, result code, and outcome. Stack traces remain server-side.

## Error contract

Errors return stable `code`, `message`, optional `action`, and `request_id` fields. Provider failures are normalized to the V5 catalog, and invalid model JSON receives at most one repair request before failing.
