# Future•Scope V5 Design

## Objective

Build the production-corrected Future•Scope V5 as a live-only desktop forecasting application. The browser renders a single self-contained `index.html`; a Cloudflare Worker owns authentication, rate limiting, Brave Search, MiniMax orchestration, validation, security headers, and structured logs.

## Source of truth

The user-supplied `future_scope_v5_final_embedded_codex_spec.html` is authoritative. Its seven embedded screenshots determine layout and visual proportions only. Their visible GPT-7 scenario must never enter production state or source code.

Two current-documentation corrections apply:

- MiniMax uses `https://api.minimax.io/v1/chat/completions` with Bearer authentication and the current `MiniMax-M3` model.
- Brave custom freshness ranges use `YYYY-MM-DDtoYYYY-MM-DD`; `pd`, `pw`, `pm`, and `py` remain valid.

## Deliverable shape

```text
future-scope/
  index.html
  proxy/
    worker.js
    README.md
  SPEC.md
  README.md
  package.json
  package-lock.json
  wrangler.jsonc
  scripts/
  test/
  .github/workflows/ci.yml
```

## Trust boundaries

The prompt, settings, event labels, proxy responses, Brave results, and MiniMax output are untrusted. The browser validates lengths and uses `textContent`, not dynamic `innerHTML`. The Worker repeats validation, authenticates every non-health route, bounds request time and concurrency, validates every model response, and never returns provider keys or stack traces.

The provider keys and `APP_AUTH_TOKEN` live only in Cloudflare secrets or local `.dev.vars`. The browser holds the app token in memory for the current session. Development provider overrides are disabled unless the Worker explicitly enables them and the origin is local.

## Frontend behavior

Initial state contains the prompt, configuration guidance, and disabled analysis tabs. No chart, outcome, or source appears before a live success. Settings can test `/api/health`. A successful analysis activates all six tabs and keeps the payload in memory only.

The Galaxy view uses the twelve-column reference layout. Ranked presents sorted outcomes and visible coverage notes. Tree derives factor-to-outcome branches. Timeline shows analysis horizon, research and user events, top-three probability traces, and draggable event time decay. Matrix maps likelihood against impact with confidence-weighted bubble size. Simulation recalculates probabilities from sliders and active events and explains changes.

## Probability engine

The frontend and Worker share one equation:

```text
logit_i = base_logit_i
        + sum(coefficient_i,f * (factor_value_f - 0.5))
        + sum(event_active_e * event_impact_i,e * time_decay_e)
```

Softmax produces raw probabilities. Display values use largest-remainder allocation to one decimal and must sum to exactly `100.0%`. The same payload, factor values, and events must always produce the same result.

## Proxy behavior

Routes:

- `GET /api/health` is unauthenticated and reports provider configuration.
- `POST /api/brave/search` validates and normalizes direct search requests.
- `POST /api/minimax/json` provides a validated JSON-only model call.
- `POST /api/analyze` runs A0 through A9 with Brave retrieval between planning and synthesis.
- `POST /api/simulate/event-impact` validates per-outcome impacts in `[-2, 2]`.

Balanced analysis executes at least six search queries and uses at least eight final sources when available. Deep analysis executes at least ten and targets fifteen final sources. Missing thresholds set `insufficient_evidence` and cap confidence at `0.45`.

MiniMax responses are extracted as the first valid JSON object, schema-checked, and repaired at most once. Coefficient shortfall and event-impact violations fail with stable error codes instead of synthesized values.

## Security and observability

Production CORS is an exact allowlist, never `*`. Responses include request ID, no-store, nosniff, strict referrer policy, HSTS, and a restrictive permissions policy. The self-contained frontend uses cryptographic CSP hashes for its embedded style and script; a constant nonce is intentionally rejected as security theater.

Rate limits cover per-IP and global request volume. IP addresses are logged only as a salted SHA-256 hash. Analyze completion emits request ID, domain, depth, total and per-agent latency, source and outcome counts, and result code. Client errors include the request ID without stack traces.

## Testing

Unit tests prove validation, canonical deduplication, score calculation, JSON extraction, confidence caps, softmax, largest-remainder rounding, event bounds, auth, CORS, and error mapping. Worker integration tests use local controlled upstream contract servers, never production fallback data.

Browser tests verify the empty initial state, settings connection states, missing-token failure, live analysis rendering against a test-only upstream contract, all six tabs, slider recalculation, event lifecycle, keyboard focus, persistence schema, no analysis persistence, responsive layouts, and clean console.

One final live provider test is run only when valid Brave and MiniMax credentials are available. Its output is transient and is never committed.

## Decisions

Cloudflare Worker is the target proxy. Vanilla browser APIs keep the frontend self-contained. Production code has no scenario fixtures. Test data lives only under `test/fixtures`. A build script computes CSP hashes after `index.html` changes and the CI check verifies them.
