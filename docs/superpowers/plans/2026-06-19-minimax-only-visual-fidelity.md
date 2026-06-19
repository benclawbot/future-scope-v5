# Future Scope MiniMax-Only Visual Fidelity Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Remove Brave completely, make MiniMax native research the sole research path, and implement the approved Future Scope visual-fidelity corrections.

**Architecture:** Preserve the browser → Cloudflare Worker → MiniMax trust boundary. Insert a validated A2 native research stage between research planning and source scoring, then enhance the existing self-contained UI using payload-derived SVG visuals without changing the deterministic probability engine.

**Tech Stack:** Vanilla HTML/CSS/JavaScript, Cloudflare Workers, MiniMax chat-completions API, Vitest, Playwright.

## Global Constraints

The Worker remains mandatory and owns `MINIMAX_API_KEY`.

The browser calls the Worker only and never stores a MiniMax key.

Production remains live-only with no mock data, demo mode, hardcoded payload, or deterministic fallback analysis.

The deterministic logit/softmax probability engine and event-impact bounds remain unchanged.

Every source has `source_type` equal to `official`, `regulatory`, `research`, `news`, `financial`, `expert`, `blog`, `forum`, or `other`.

The exact factor colors are market momentum `#8b5cf6`, execution quality `#38bdf8`, competitive pressure `#fb7185`, regulatory pressure `#f59e0b`, resource availability `#34d399`, and technology readiness `#22d3ee`.

The settings dialog contains only Theme, Backend Proxy URL, App Access Token, Connection Status, Save & Test, and Cancel.

The recommended package and application version is `5.1.0`.

---

### Task 1: Define MiniMax Research Contracts and Provider Helpers

**Files:**
- Modify: `proxy/schemas.js`
- Modify: `proxy/providers.js`
- Modify: `test/providers.test.js`
- Modify: `test/validation.test.js`

**Interfaces:**
- Produces: `validateA1(value)`, `validateA2(value, minimumSources)`, `callMiniMaxResearchJson(request, options)`, `normalizeMiniMaxSources(sources, now)`, and `inferSourceType(source)`.
- Consumes: Existing `callMiniMaxJson`, `canonicalizeUrl`, `deduplicateSources`, retry, secret, text-cleaning, and JSON-extraction helpers.

- [ ] **Step 1: Replace provider tests with failing MiniMax-native research tests**

Add tests that require `callMiniMaxResearchJson` to append strict source instructions, `normalizeMiniMaxSources` to reject invalid URLs and produce canonical fields, and `inferSourceType` to classify representative official, regulatory, research, financial, news, expert, blog, forum, and fallback sources.

```js
test("calls MiniMax native research with a strict source contract", async () => {
  const fetchImpl = vi.fn(async () =>
    new Response(JSON.stringify({
      choices: [{ message: { content: JSON.stringify(validA2) } }],
    }), { status: 200 }),
  );

  const result = await callMiniMaxResearchJson(
    { agent: "A2", system: "Research.", user: "{}", validate: validateA2 },
    { minimaxApiKey: "secret", fetchImpl },
  );

  expect(result).toEqual(validA2);
  expect(JSON.parse(fetchImpl.mock.calls[0][1].body).messages[0].content)
    .toContain("Do not invent URLs or citations.");
});
```

- [ ] **Step 2: Run the focused tests and verify RED**

Run: `npm test -- test/providers.test.js test/validation.test.js`

Expected: failure because the A2 validator and MiniMax research helpers do not exist.

- [ ] **Step 3: Implement A1 and A2 validators**

Implement A1 research-task validation with bounded IDs, purposes, queries, freshness, importance, and task counts. Implement A2 validation that requires the full source shape, valid HTTPS URLs, valid dates or null, valid retrieval timestamps, approved source types, research summary, coverage gaps, and the requested minimum candidate count.

- [ ] **Step 4: Implement MiniMax-only provider helpers**

Delete `DEFAULT_BRAVE_URL`, `searchBrave`, Brave freshness handling, `X-Subscription-Token`, and Brave HTTP mapping. Add:

```js
export async function callMiniMaxResearchJson(request, options = {}) {
  return callMiniMaxJson({
    agent: request.agent ?? "RESEARCH",
    system: [
      request.system,
      "Use MiniMax native research/web-search capability if available.",
      "Return exactly one JSON object.",
      "Every source must include title, url, domain, description, source_type, and date if available.",
      "Do not invent URLs or citations.",
    ].join("\n"),
    user: request.user,
    validate: request.validate,
    maxCompletionTokens: request.maxCompletionTokens ?? 16000,
  }, options);
}
```

Normalize sources with canonical URLs, cleaned text, deduplication, approved source types, and deterministic retrieval timestamps supplied by the caller.

- [ ] **Step 5: Run focused tests and verify GREEN**

Run: `npm test -- test/providers.test.js test/validation.test.js`

Expected: all focused tests pass.

- [ ] **Step 6: Commit the provider-contract slice**

```powershell
git add proxy/schemas.js proxy/providers.js test/providers.test.js test/validation.test.js
git commit -m "feat: add MiniMax native research contracts"
```

### Task 2: Replace Brave Retrieval with the A2 MiniMax Research Agent

**Files:**
- Modify: `proxy/agents.js`
- Modify: `test/agents.test.js`
- Modify: `test/fixtures/pipeline.js`

**Interfaces:**
- Consumes: `callMiniMaxJson`, `callMiniMaxResearchJson`, `deduplicateSources`, `normalizeMiniMaxSources`, `validateA1`, and `validateA2`.
- Produces: `runAnalysisPipeline(input, dependencies)` with `research_provider`, `research_summary`, `coverage_gaps`, and source-typed final sources.

- [ ] **Step 1: Write failing pipeline tests**

Update fixtures to include A1 `research_tasks` and an A2 response. Require calls in this order:

```js
expect(calls).toEqual(["A0", "A1", "A2", "A3", "A4", "A5", "A6", "A7", "A8", "A9"]);
expect(payload.research_provider).toBe("minimax_native");
expect(payload.sources.every((source) => source.source_type)).toBe(true);
expect(payload.research_summary).toBe(agentFixtures.A2.research_summary);
expect(payload.coverage_gaps).toEqual(agentFixtures.A2.coverage_gaps);
```

Keep confidence-cap and explicit-output-schema coverage.

- [ ] **Step 2: Run agent tests and verify RED**

Run: `npm test -- test/agents.test.js`

Expected: failure because A2 is not called and the payload fields do not exist.

- [ ] **Step 3: Implement A1 planning and A2 native research**

Replace Brave query fan-out with one validated A2 call:

```js
const research = await callResearchJson({
  agent: "A2",
  system: AGENT_SYSTEM,
  user: JSON.stringify({
    resolved_question: clarification.forecast_question,
    domain: clarification.domain,
    time_horizon: clarification.time_horizon,
    research_depth: input.research_depth,
    research_tasks: plan.research_tasks,
    minimum_candidate_sources: minimumCandidates,
    required_source_fields: [
      "title",
      "url",
      "domain",
      "description",
      "extra_snippets",
      "published_or_discovered_date",
      "retrieved_at",
      "source_type",
    ],
    instruction:
      "Perform native MiniMax deep research. Return source objects only for identifiable sources with URLs. Do not invent URLs. Include coverage gaps.",
  }),
  validate: (value) => validateA2(value, minimumCandidates),
  maxCompletionTokens: input.research_depth === "deep" ? 22000 : 14000,
});
```

Deduplicate and normalize A2 sources, pass them through A3 through A9, preserve evidence threshold behavior, and merge MiniMax coverage gaps into the final coverage note.

- [ ] **Step 4: Run agent and probability tests and verify GREEN**

Run: `npm test -- test/agents.test.js test/probability.test.js`

Expected: all tests pass and deterministic probability tests remain unchanged.

- [ ] **Step 5: Commit the pipeline slice**

```powershell
git add proxy/agents.js test/agents.test.js test/fixtures/pipeline.js
git commit -m "feat: use MiniMax native research in analysis pipeline"
```

### Task 3: Remove Brave from the Worker, Validation, Security, and Configuration

**Files:**
- Modify: `proxy/worker.js`
- Modify: `proxy/validation.js`
- Modify: `proxy/errors.js`
- Modify: `proxy/security.js`
- Modify: `wrangler.jsonc`
- Modify: `.dev.vars.example`
- Modify: `package.json`
- Modify: `package-lock.json`
- Modify: `test/worker.test.js`
- Modify: `test/integration.test.js`
- Modify: `test/server.mjs`
- Modify: `test/live-provider-check.mjs`

**Interfaces:**
- Produces: Health contract with `minimax_configured`, `research_enabled`, `research_provider`, `server_time`, and `version`.
- Preserves: `/api/analyze`, `/api/minimax/json`, and `/api/simulate/event-impact`.

- [ ] **Step 1: Write failing Worker and integration tests**

Require the new health contract and a 404 for `/api/brave/search`. Remove Brave dependency injection and mock upstream handling. Make integration upstreams serve MiniMax only.

```js
expect(await response.json()).toMatchObject({
  ok: true,
  minimax_configured: true,
  research_enabled: true,
  research_provider: "minimax_native",
  version: "5.1.0",
});
```

- [ ] **Step 2: Run Worker and integration tests and verify RED**

Run: `npm test -- test/worker.test.js test/integration.test.js`

Expected: health assertions fail and the retired route still exists.

- [ ] **Step 3: Remove Worker and validation Brave paths**

Remove `searchBrave`, `validateSearchInput`, the direct search route, Brave provider options, Brave error codes, and the `X-Dev-Brave-Key` CORS header. Keep local-only MiniMax development override behavior.

- [ ] **Step 4: Update secrets and version**

Set package, lockfile, Worker fallback, and `APP_VERSION` to `5.1.0`. Required secrets become `MINIMAX_API_KEY`, `APP_AUTH_TOKEN`, and `IP_HASH_PEPPER`. Add optional `MINIMAX_MODEL=MiniMax-M3` and `MINIMAX_API_BASE_URL=https://api.minimax.io/v1/chat/completions`.

- [ ] **Step 5: Run Worker, integration, syntax, and data checks**

Run: `npm test -- test/worker.test.js test/integration.test.js && npm run check:syntax && npm run check:data`

Expected: all commands pass.

- [ ] **Step 6: Commit the Worker/configuration slice**

```powershell
git add proxy/worker.js proxy/validation.js proxy/errors.js proxy/security.js wrangler.jsonc .dev.vars.example package.json package-lock.json test/worker.test.js test/integration.test.js test/server.mjs test/live-provider-check.mjs
git commit -m "refactor: remove Brave from Worker and configuration"
```

### Task 4: Simplify Settings and Replace the Brand

**Files:**
- Modify: `index.html`
- Modify: `test/e2e/settings.spec.js`
- Modify: `test/e2e/empty-state.spec.js`
- Modify: `test/accessibility.test.js`

**Interfaces:**
- Produces: Orbital neon brand markup and minimal settings behavior.
- Consumes: New health response fields.

- [ ] **Step 1: Write failing browser assertions**

Require `FUTURE•SCOPE`, `.brand-orb`, the exact six settings controls/actions, no provider credential inputs, and connection copy containing `Research provider: MiniMax native`.

- [ ] **Step 2: Run focused E2E tests and verify RED**

Run: `npx playwright test test/e2e/settings.spec.js test/e2e/empty-state.spec.js`

Expected: selectors and provider-status assertions fail.

- [ ] **Step 3: Implement the orbital brand and minimal dialog**

Replace the text tile with the approved `brand-orb`, rings, core, and sparks. Remove visible V5 wording. Remove Brave and provider-development fields from the dialog. Update health handling to use `minimax_configured` and `research_enabled`.

- [ ] **Step 4: Refresh the inline-script CSP hash**

Run: `npm run check:csp`

If it reports a replacement hash, update the `script-src` hash in `index.html`, then rerun until it passes.

- [ ] **Step 5: Run focused tests and verify GREEN**

Run: `npx playwright test test/e2e/settings.spec.js test/e2e/empty-state.spec.js && npm test -- test/accessibility.test.js`

Expected: all focused tests pass.

- [ ] **Step 6: Commit the settings/brand slice**

```powershell
git add index.html test/e2e/settings.spec.js test/e2e/empty-state.spec.js test/accessibility.test.js
git commit -m "feat: simplify settings and add orbital brand"
```

### Task 5: Add Factor Colors and the Source-Type Donut

**Files:**
- Modify: `index.html`
- Modify: `test/e2e/analysis.spec.js`
- Modify: `test/e2e/accessibility.spec.js`

**Interfaces:**
- Produces: `FACTOR_COLORS`, `SOURCE_TYPE_COLORS`, factor-row CSS variables, and an accessible payload-derived source-mix SVG.
- Consumes: `payload.sources[].source_type`.

- [ ] **Step 1: Write failing E2E assertions**

Assert each factor row exposes the specified `--factor-color`, the range fill changes with its value, the populated evidence rail contains an SVG donut and legend, and the empty state contains no donut slices.

- [ ] **Step 2: Run focused E2E tests and verify RED**

Run: `npx playwright test test/e2e/analysis.spec.js test/e2e/accessibility.spec.js`

Expected: the source-mix card and factor-color assertions fail.

- [ ] **Step 3: Implement exact factor styling**

Set `--factor-color` and `--factor-value` on each row, render a colored dot, and use a linear-gradient track whose stop follows the normalized value.

- [ ] **Step 4: Implement the source-type donut**

Aggregate analyzed sources by approved source type. Render SVG segments, total count, and a color-keyed legend above top sources. Use an accessible label summarizing the distribution and do not render the card before a live analysis.

- [ ] **Step 5: Refresh CSP and verify GREEN**

Run: `npm run check:csp && npx playwright test test/e2e/analysis.spec.js test/e2e/accessibility.spec.js`

Expected: all commands pass.

- [ ] **Step 6: Commit the factor/donut slice**

```powershell
git add index.html test/e2e/analysis.spec.js test/e2e/accessibility.spec.js
git commit -m "feat: visualize factor and source mix"
```

### Task 6: Implement Bézier Tree Links and Neon Timeline Milestones

**Files:**
- Modify: `index.html`
- Modify: `test/e2e/analysis.spec.js`
- Modify: `test/e2e/responsive.spec.js`

**Interfaces:**
- Produces: Tree SVG connector overlay and timeline milestone-card rendering.
- Preserves: User-event horizontal drag semantics and deterministic time-decay recalculation.

- [ ] **Step 1: Write failing visual-structure and behavior tests**

Require tree `<path>` values containing cubic Bézier commands, connector redraw after resize and tab re-entry, milestone marker/card structure, and unchanged drag-to-time-decay output.

- [ ] **Step 2: Run focused E2E tests and verify RED**

Run: `npx playwright test test/e2e/analysis.spec.js test/e2e/responsive.spec.js`

Expected: connector and milestone assertions fail.

- [ ] **Step 3: Implement responsive tree connectors**

Create an SVG overlay and use:

```js
function curvedPath(from, to) {
  const midY = from.y + (to.y - from.y) * 0.52;
  return `M ${from.x} ${from.y} C ${from.x} ${midY}, ${to.x} ${midY}, ${to.x} ${to.y}`;
}
```

Set edge width to `1.4 + Math.min(4.2, contribution * 5)`, where `contribution` is the absolute factor coefficient contribution. Redraw on tree activation, resize, and analysis/factor changes.

- [ ] **Step 4: Implement neon timeline milestones**

Render each event as a marker pin connected to a neon card. Keep user cards draggable along the axis and compute `position` clamped to `0..1` and `time_decay = 0.2 + 0.8 * position`.

- [ ] **Step 5: Refresh CSP and verify GREEN**

Run: `npm run check:csp && npx playwright test test/e2e/analysis.spec.js test/e2e/responsive.spec.js`

Expected: all commands pass.

- [ ] **Step 6: Commit the tree/timeline slice**

```powershell
git add index.html test/e2e/analysis.spec.js test/e2e/responsive.spec.js
git commit -m "feat: refine tree and timeline visuals"
```

### Task 7: Remove Remaining Brave Documentation and Run the Production Gate

**Files:**
- Modify: `README.md`
- Modify: `proxy/README.md`
- Modify: `SPEC.md`
- Modify: `DESIGN.md`
- Modify: `PRODUCT.md`
- Modify: `TEST-REPORT.md`
- Modify: `docs/superpowers/specs/2026-06-18-future-scope-design.md`
- Modify: `docs/superpowers/plans/2026-06-18-future-scope.md`
- Modify: `.github/workflows/ci.yml` if environment names require cleanup
- Modify: any tracked file still containing retired Brave identifiers

**Interfaces:**
- Produces: Current MiniMax-only deployment and architecture documentation.
- Preserves: Existing screenshot gallery and live-only warnings.

- [ ] **Step 1: Add a failing repo-wide retirement check**

Extend `scripts/check-production-data.mjs` or the closest production check to reject these retired strings in tracked runtime, config, test, and documentation files:

```js
const retired = [
  "BRAVE_SEARCH_API_KEY",
  "BRAVE_API_BASE_URL",
  "X-Dev-Brave-Key",
  "/api/brave/search",
  "searchBrave",
  "X-Subscription-Token",
  "brave_configured",
];
```

- [ ] **Step 2: Run the retirement check and verify RED**

Run: `npm run check:data`

Expected: failure listing remaining retired references.

- [ ] **Step 3: Update documentation and historical project notes**

Rename the README title to `# Future•Scope`, describe MiniMax native research, list only current secrets, update deployment commands, and add:

```text
Recommended repository rename:
benclawbot/future-scope-v5 → benclawbot/future-scope
```

Revise the proxy README, specification, design, product, test report, and retained planning documents so repository searches no longer describe Brave as part of the current or intended architecture.

- [ ] **Step 4: Verify no retired references remain**

Run: `npm run check:data`

Then run a tracked-file search for `brave`, `searchBrave`, `X-Subscription-Token`, and `brave_configured`; expect zero matches.

- [ ] **Step 5: Run the complete production verification gate**

Run:

```powershell
npm run check
npm test
npm run test:e2e
npm audit --omit=dev
npx wrangler deploy --dry-run
```

Expected: every command exits `0`; 0 test failures; 0 audit vulnerabilities.

- [ ] **Step 6: Inspect the final diff and commit**

Run `git diff --check`, inspect `git diff --stat` and `git diff`, and verify no secrets, generated browser artifacts, or unrelated changes are present.

```powershell
git add .
git commit -m "docs: finalize MiniMax-only Future Scope release"
```

- [ ] **Step 7: Final browser review**

Run the app against the controlled local contract server and inspect Galaxy, Ranked, Tree, Timeline, Matrix, Simulation, and Settings at desktop and narrow widths. Confirm no console errors, keyboard regressions, overflow, fake pre-analysis data, or visual loss of hierarchy.
