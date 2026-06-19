# Future•Scope Production Specification

Status: version 5.1 production implementation.

## Deliverable

Future•Scope is a desktop-first web application consisting of one self-contained `index.html` and a mandatory secure Cloudflare Worker. There is no offline analysis, populated initial state, deterministic forecast fallback, or scenario content copied from visual references.

## Runtime responsibilities

The browser renders six analysis views, stores only versioned UI preferences, sends prompts and simulation events to the Worker, and keeps the latest analysis in memory. It never calls a model provider directly and never stores the MiniMax credential.

The Worker stores provider credentials as secrets, validates the app token and request origin, applies rate limits, calls MiniMax with timeouts and retries, validates structured output, normalizes sources, emits structured logs, and returns an `AnalysisPayload`.

## MiniMax research and agent graph

MiniMax uses the OpenAI-compatible chat-completions endpoint, Bearer authentication, adaptive thinking, and model `MiniMax-M3` by default. The first valid JSON object is schema-checked; one repair call is allowed.

The Worker runs A0 Domain and Horizon Clarifier, A1 Research Plan Agent, A2 Native Deep Research Agent, A3 Source Quality Scorer, A4 Evidence Extraction Agent, A5 Contradiction and Recency Auditor, A6 Outcome Enumeration Agent, A7 Forecast Probability Agent, A8 Calibration Critic, and A9 Simulation Model Builder.

Balanced research requires at least six research tasks, twenty candidate sources when available, eight final sources, and twelve evidence items. Deep research requires at least ten tasks, forty candidates, fifteen final sources, and twenty-five evidence items. Missed thresholds set `insufficient_evidence`, expose coverage gaps, and cap confidence at `0.45`.

Every source includes an identifiable HTTPS URL, canonical URL, title, domain, description, snippets, publication or discovery date, retrieval timestamp, quality score, and a source type: official, regulatory, research, news, financial, expert, blog, forum, or other.

## Probability model

For every outcome:

```text
logit = base_logit
      + sum(factor_coefficient * (factor_value - 0.5))
      + sum(active_event * event_impact * time_decay)
```

Factor values are in `[0,1]`, neutral is `0.5`, event impacts are in `[-2,2]`, and event decay is in `[0.2,1]`. Softmax converts logits to raw probabilities. Largest-remainder allocation produces one-decimal display values totaling exactly `100.0%`.

## Interface

Galaxy shows a probability field. Ranked shows sorted outcomes, confidence, drivers, and coverage. Tree assigns each outcome to one strongest-factor branch and uses responsive SVG paths with rounded shared trunks, glowing ports, and arrowheads. Timeline shows neon milestone cards and draggable user events. Matrix plots likelihood against impact. Simulation exposes deterministic recalculation.

The evidence rail separates supporting, opposing, and neutral claims. Each statement shows its full claim, stance, typed and named source attribution, date, strength, source quality, contradictions, top sources, and a source-type donut generated only after a successful analysis. Factor sliders use the six exact semantic colors.

Settings contains Theme, Backend Proxy URL, App Access Token, Connection Status, Save & Test, and Cancel. Credentials remain session-only.

## Security and accessibility

Prompt and event lengths are checked in the browser and Worker. Model strings are inserted with `textContent`. CORS uses an exact origin allowlist. Responses include no-store, request ID, nosniff, strict referrer policy, HSTS, frame denial, and a restrictive permissions policy.

The embedded frontend uses browser-normalized cryptographic CSP hashes. All controls are keyboard reachable, native dialogs manage focus, tabs support arrows, Home, and End, state is paired with text, contrast targets WCAG 2.1 AA, and reduced motion disables animation.

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

The browser must never contact provider endpoints. Missing live services produce stable errors rather than output. The same payload, factors, and events always recalculate identically. Source claims remain traceable, uncertainty remains visible, displayed probabilities total exactly 100.0%, provider keys remain secret, and the interface remains usable from 320px through wide desktop layouts.
