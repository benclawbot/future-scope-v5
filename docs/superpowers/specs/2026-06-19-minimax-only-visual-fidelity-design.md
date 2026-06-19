# Future Scope MiniMax-Only Visual Fidelity Design

## Objective

Refactor Future Scope so MiniMax native research is the only research provider while preserving the Cloudflare Worker trust boundary, live-only behavior, deterministic probability simulation, and the existing self-contained browser application. Improve the populated interface to match the approved V5 visual language without introducing demo data or changing the probability model.

## Architecture

The browser continues to call only the Cloudflare Worker. The Worker authenticates requests, applies rate limits, owns the MiniMax credential, validates every model response, normalizes source metadata, and returns the analysis payload. MiniMax performs both research discovery and the downstream structured analysis stages.

The agent pipeline becomes A0 through A9 with a new A2 native research stage. A1 produces bounded research tasks. A2 returns identifiable source objects with URLs and source types. A3 through A9 continue source scoring, evidence extraction, contradiction auditing, outcome generation, probability calibration, and simulation-model construction.

The deterministic logit, softmax, event impact, time decay, and largest-remainder display logic remain unchanged.

## Provider and Data Contracts

`proxy/providers.js` retains MiniMax JSON calls and provider-neutral URL, retry, secret, text-cleaning, deduplication, and JSON extraction helpers. It adds a MiniMax research entry point plus source normalization and source-type inference. All Brave-specific endpoints, headers, freshness logic, error codes, and configuration are removed.

A1 returns `research_tasks`, each with an ID, purpose, natural-language query, freshness class, and importance. A2 returns `sources`, `research_summary`, and `coverage_gaps`. Every source includes title, URL, domain, description, snippets, discovery or publication date, retrieval timestamp, and one of the approved source types.

The final payload adds `research_provider: "minimax_native"`, `research_summary`, and `coverage_gaps`. Final sources retain canonical URLs and quality scores.

## Worker and Security Boundary

`GET /api/health` remains unauthenticated and reports MiniMax configuration, native research availability, server time, and application version. `/api/analyze` and `/api/simulate/event-impact` remain authenticated and rate-limited. The direct Brave route is deleted.

Development key overrides remain restricted to local origins and explicit Worker opt-in, but only `X-Dev-Minimax-Key` is accepted. The browser never stores or receives the MiniMax credential.

## Frontend Fidelity

The text brand becomes `FUTURE•SCOPE` with an orbital neon mark. The settings dialog contains only Theme, Backend Proxy URL, App Access Token, Connection Status, Save & Test, and Cancel, and identifies MiniMax native research as the provider.

Factor controls use the exact six-color map and gradient-filled range tracks. The scenario tree uses an SVG overlay with recalculated Bézier paths whose width reflects factor contribution. Timeline events become pinned neon milestone cards; dragging user events preserves the existing normalized position and `time_decay = 0.2 + 0.8 * position` behavior.

The evidence rail gains an SVG source-type donut above the source list. It is derived only from a successful live payload and renders no placeholder slices before analysis.

## Error Handling and Evidence Quality

Provider failures continue through stable structured Worker errors without exposing stack traces or secrets. Invalid A1 or A2 responses receive the existing single repair attempt. Sources without valid identifiable URLs are rejected. Deduplication occurs on canonical URL and normalized title.

Balanced and deep evidence thresholds remain enforced. Missed thresholds mark insufficient evidence, cap confidence at `0.45`, and expose MiniMax coverage gaps in the payload and UI.

## Testing

Unit tests will prove the A1 and A2 schemas, MiniMax research request behavior, source normalization and type inference, Worker route removal, health response changes, agent ordering, source requirements, confidence caps, and absence of Brave symbols.

Browser tests will prove the minimal settings dialog, orbital brand, source donut, factor colors, SVG tree connectors, milestone timeline cards, unchanged drag/time-decay behavior, responsive layout, accessibility, and absence of fake pre-analysis data.

The final gate is `npm run check`, `npm test`, `npm run test:e2e`, `npm audit --omit=dev`, and `npx wrangler deploy --dry-run`.

## Scope Boundaries

The Worker remains mandatory. MiniMax keys never enter browser source or storage. No mock, demo, fallback, screenshot-derived, or hardcoded production forecast data is added. The probability engine is not redesigned. The repository rename is documented but not performed as part of this code PR.
