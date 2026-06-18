# Future•Scope V5 Production Specification

Status: production-corrected implementation specification.

## Deliverable

Future•Scope is a desktop-first web application consisting of one self-contained `index.html` and a mandatory secure Cloudflare Worker proxy. There is no offline analysis, populated initial state, deterministic forecast fallback, or scenario content copied from layout references.

## Runtime responsibilities

The browser renders the six views, stores only versioned UI preferences, sends prompts and simulation events to the proxy, and keeps the latest analysis in memory. It never calls Brave Search or MiniMax directly.

The Worker stores provider credentials as secrets, validates the app token and request origin, applies per-IP and aggregate rate limits, calls Brave and MiniMax with timeouts and retries, validates structured model output, emits structured logs, and returns an `AnalysisPayload`.

## Current external APIs

Brave Web Search is called at `https://api.search.brave.com/res/v1/web/search` using `X-Subscription-Token`. Supported freshness values are `pd`, `pw`, `pm`, `py`, an omitted value, or `YYYY-MM-DDtoYYYY-MM-DD`.

MiniMax is called at `https://api.minimax.io/v1/chat/completions` using Bearer authentication and model `MiniMax-M3`. Requests use adaptive thinking and request JSON-only content. The first valid JSON object is schema-checked; one repair call is allowed.

## Live-only behavior

Before success, the forecast tabs are disabled and the workspace says: “Enter a forecast question and connect the live research backend.” Missing configuration opens Settings. A failed refresh preserves the last successful analysis and marks it stale. It never substitutes generated fixture data.

## Agent graph

The Worker runs A0 Domain and Horizon Clarifier, A1 Research Query Planner, A2 Brave Retrieval, A3 Source Quality Scorer, A4 Evidence Extraction, A5 Contradiction and Recency Auditor, A6 Outcome Enumeration, A7 Forecast Probability, A8 Calibration Critic, and A9 Simulation Model Builder.

Balanced research requires at least six queries, twenty candidate sources before filtering when available, eight final sources, and twelve evidence items. Deep research requires at least ten queries, forty candidates, fifteen final sources, and twenty-five evidence items. Missed thresholds set `insufficient_evidence` and cap confidence at `0.45`.

## Probability model

For every outcome:

```text
logit = base_logit
      + sum(factor_coefficient * (factor_value - 0.5))
      + sum(active_event * event_impact * time_decay)
```

Factor values are in `[0,1]`, neutral is `0.5`, event impacts are in `[-2,2]`, and event decay is in `[0.2,1]`. Softmax converts logits to raw probabilities. Largest-remainder allocation produces one-decimal display values totaling exactly `100.0%`.

## Data contract

`AnalysisPayload` contains IDs and timestamps, original and resolved questions, domain and horizon, sources, evidence, factors, research and user events, four to eight outcomes, probability model metadata, confidence, coverage and base-rate notes, contradictions, staleness warnings, and audit counters.

Each outcome contains title and description, rank, base logit, raw and previous probability, display probability, confidence, impact, evidence references, six exact factor coefficients, and an explanation for every coefficient.

The six factor IDs are:

```text
market_momentum
execution_quality
competitive_pressure
regulatory_pressure
resource_availability
technology_readiness
```

## Interface

The default dark workspace uses the approved deep navy, purple, blue, cyan, green, orange, and red token system. At 1280px and wider, the main screen uses a twelve-column layout: three columns for assumptions and events, six for the visualization, and three for evidence.

Galaxy shows a probability field. Ranked shows sorted outcomes, bars, confidence, drivers, and coverage note. Tree maps strongest factors to outcomes. Timeline displays horizon events, top probability traces, and event time decay. Matrix plots likelihood against impact. Simulation exposes all factors, event lifecycle, probability changes, and leading drivers.

Settings remains one dialog with theme, density, proxy URL, app token, connection test, and collapsed development options. The app token and provider overrides are session-only.

## Security

Prompt and event lengths are checked in the browser and Worker. Model strings are inserted with `textContent`, and production code does not use dynamic `innerHTML`. CORS is an exact origin allowlist. Responses include no-store, request ID, nosniff, strict referrer policy, HSTS, frame denial, and a restrictive permissions policy.

The self-contained frontend uses a cryptographic script hash in CSP. Inline style permission is limited to `style-src` because the data visualizations set bounded presentation values at runtime; scripts do not receive `unsafe-inline`.

## Accessibility

All controls are keyboard reachable. Tabs support arrows, Home, and End. Dialogs use native focus management, controls have accessible labels, state is paired with text, contrast targets WCAG 2.1 AA, and reduced motion disables animated transitions.

## Persistence

Only `FrontendPrefsV1` is stored:

```json
{
  "schema_version": 1,
  "theme": "dark|light|system",
  "backend_proxy_url": "string|null",
  "ui_density": "comfortable|compact",
  "last_tab": "galaxy|ranked|tree|timeline|matrix|simulation"
}
```

Unknown schema versions are ignored. Analysis payloads and credentials are never stored in localStorage.

## Acceptance

The browser must never contact provider endpoints. Missing live services must produce stable errors rather than output. The same payload, factors, and events must always recalculate identically. Source claims remain traceable, contradictions remain visible, displayed probabilities total exactly 100.0%, provider keys remain secret, CI uses the lockfile, production dependencies have no known audit findings, and the interface remains usable from 320px through wide desktop layouts.
