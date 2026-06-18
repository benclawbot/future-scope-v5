# Future•Scope V5 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build and verify the live-only Future•Scope V5 frontend and Cloudflare Worker proxy.

**Architecture:** A self-contained browser application talks only to a Cloudflare Worker. Pure functions isolate validation, research normalization, probability math, and model orchestration so tests can exercise behavior without provider credentials.

**Tech Stack:** HTML, CSS, browser JavaScript, Cloudflare Workers ES modules, Node.js 24, Vitest 4.1.9, Playwright 1.61.0, Wrangler 4.102.0.

## Global Constraints

- No production forecast fixture, default outcome, or deterministic analysis fallback.
- `index.html` contains its own CSS and JavaScript.
- Provider keys remain server-side.
- MiniMax model is `MiniMax-M3` until official docs change.
- Prompt length is 1–400 characters.
- Factor values are in `[0,1]`; event impacts are in `[-2,2]`.
- Display probabilities sum to exactly `100.0%`.
- WCAG 2.1 AA and reduced motion are required.

---

### Task 1: Project contracts and probability engine

**Files:**
- Create: `package.json`, `.gitignore`, `wrangler.jsonc`
- Create: `proxy/probability.js`, `proxy/validation.js`
- Test: `test/probability.test.js`, `test/validation.test.js`

**Interfaces:**
- Produces `softmax(logits)`, `largestRemainder(probabilities)`, `recalculateOutcomes(payload, factors, events)`.
- Produces boundary validators returning normalized data or `AppError`.

- [ ] Write failing tests for stable softmax, exact displayed totals, neutral sliders, bounded events, prompt validation, and freshness validation.
- [ ] Run `npm test -- test/probability.test.js test/validation.test.js` and confirm failures come from missing modules.
- [ ] Implement the smallest pure functions that satisfy the tests.
- [ ] Re-run the focused tests and confirm zero failures.
- [ ] Commit as `feat: add validated probability contracts`.

### Task 2: Provider clients and agent pipeline

**Files:**
- Create: `proxy/providers.js`, `proxy/agents.js`, `proxy/schemas.js`
- Test: `test/providers.test.js`, `test/agents.test.js`
- Create: `test/fixtures/agent-responses.js`, `test/fixtures/brave-response.json`

**Interfaces:**
- Produces `searchBrave()`, `callMiniMaxJson()`, `runAnalysisPipeline()`.
- Consumes injected `fetch`, timing, and UUID functions.

- [ ] Write failing tests for Brave normalization, canonical deduplication, retries, JSON extraction, one repair call, A0–A9 ordering, evidence thresholds, and coefficient shortfall.
- [ ] Run the focused tests and verify expected failures.
- [ ] Implement provider clients with abort timeouts and the documented MiniMax/Brave request shapes.
- [ ] Implement the sequential agent pipeline with bounded Brave concurrency.
- [ ] Re-run focused tests and confirm zero failures.
- [ ] Commit as `feat: orchestrate sourced forecast analysis`.

### Task 3: Secure Worker routes

**Files:**
- Create: `proxy/worker.js`, `proxy/security.js`, `proxy/errors.js`
- Test: `test/worker.test.js`

**Interfaces:**
- Exposes `/api/health`, `/api/brave/search`, `/api/minimax/json`, `/api/analyze`, `/api/simulate/event-impact`.

- [ ] Write failing route tests for auth, CORS, security headers, request IDs, input errors, rate limits, structured logs, and provider error mapping.
- [ ] Run the route tests and verify expected failures.
- [ ] Implement Worker routing, app-token verification, in-memory rate limiting, exact-origin CORS, and safe error responses.
- [ ] Re-run route tests and confirm zero failures.
- [ ] Commit as `feat: secure the forecasting proxy`.

### Task 4: Live-only application shell

**Files:**
- Create: `index.html`
- Create: `scripts/verify-csp.mjs`, `scripts/check-production-data.mjs`
- Test: `test/e2e/empty-state.spec.js`, `test/e2e/settings.spec.js`

**Interfaces:**
- Consumes the proxy HTTP contract.
- Persists only `FrontendPrefsV1`.

- [ ] Write browser tests for empty state, disabled tabs, settings focus, health testing, theme/density persistence, and session-only app token.
- [ ] Run the browser tests and confirm the app is missing.
- [ ] Implement the responsive header, empty workspace, settings dialog, error dialog, preferences, and API client.
- [ ] Generate and verify CSP hashes.
- [ ] Re-run browser tests and confirm zero failures.
- [ ] Commit as `feat: add the honest live-only workspace`.

### Task 5: Six interactive analysis views

**Files:**
- Modify: `index.html`
- Test: `test/e2e/analysis.spec.js`, `test/e2e/responsive.spec.js`

**Interfaces:**
- Renders only a validated `AnalysisPayload`.
- Uses the shared probability equation ported byte-for-byte in behavior.

- [ ] Write browser tests for successful analysis, Galaxy, Ranked, Tree, Timeline, Matrix, Simulation, slider recalculation, event add/toggle/delete, and exact probability totals.
- [ ] Run tests against the shell and verify they fail for missing views.
- [ ] Implement each view using DOM, Canvas, and native controls without external runtime dependencies.
- [ ] Implement evidence panels, stale-result behavior, coverage note, and explainability.
- [ ] Re-run browser tests at 1440, 1280, 768, and 320 widths.
- [ ] Commit as `feat: render interactive forecast views`.

### Task 6: Documentation, CI, and deploy reproducibility

**Files:**
- Create: `README.md`, `proxy/README.md`, `.dev.vars.example`, `.github/workflows/ci.yml`
- Create: `SPEC.md`
- Modify: `package.json`, `package-lock.json`

- [ ] Document local setup, Cloudflare secrets, deployment, keyboard order, security model, and credential rotation.
- [ ] Add CI gates for unit tests, browser tests, CSP verification, prohibited production data, and `npm audit --omit=dev`.
- [ ] Run `npm ci`, `npm test`, `npm run test:e2e`, `npm run check`, and `npm audit --omit=dev`.
- [ ] Commit as `docs: make the build reproducible`.

### Task 7: End-to-end and visual verification

**Files:**
- Create: `test/live-provider-check.mjs`
- Create: `TEST-REPORT.md`

- [ ] Start the local Worker and app with controlled upstream contract servers.
- [ ] Complete a full analysis through the browser and exercise every interaction.
- [ ] Verify console, network, accessibility tree, keyboard order, and responsive screenshots.
- [ ] If credentials are available, run one transient balanced live analysis; never save its payload.
- [ ] Compare rendered views with all seven layout references and fix visible mismatches.
- [ ] Run the complete verification suite again after the final edit.
- [ ] Commit as `test: verify Future Scope end to end`.
