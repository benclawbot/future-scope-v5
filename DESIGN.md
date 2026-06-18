# Future•Scope Design System

## Theme

Desktop-first analytical workspace. Dark is the default because the primary scene is an analyst working for an extended period in a multi-panel research environment; light and system themes remain available. Glass is reserved for the primary visualization and modal overlay, while supporting panels use quieter opaque surfaces.

## Color

- Background zero: `#060814`
- Background one: `#0b1020`
- Panel: `rgba(18, 24, 46, 0.88)`
- Strong panel: `rgba(25, 32, 60, 0.96)`
- Border: `rgba(148, 163, 255, 0.22)`
- Primary text: `#f5f7ff`
- Muted text: `#aeb9d6`
- Purple action: `#8b5cf6`
- Blue evidence: `#38bdf8`
- Cyan alternate: `#22d3ee`
- Green positive: `#34d399`
- Orange caution: `#f59e0b`
- Red negative: `#fb7185`

Light theme maps the same semantic roles to cool white and blue-gray surfaces. Semantic colors always pair with text or shape.

## Typography

Use the system UI stack: `Inter, ui-sans-serif, system-ui, -apple-system, "Segoe UI", sans-serif`. Product labels use one family consistently. Data values use tabular numerals. Headings use 600–750 weight; body and labels use 400–550.

## Layout

At 1280px and wider, Galaxy uses a strict twelve-column grid: three columns for assumptions and events, six for the active visualization, and three for research and evidence. Header and tabs span the workspace. Below 1280px, the evidence rail moves beneath the visualization; below 760px, panels become a single reading column.

## Components

- Header: brand, prompt input, research-depth selector, Analyze action, Settings action.
- Metric strip: source count, confidence, contradictions, last successful run.
- Tab list: Galaxy, Ranked, Tree, Timeline, Matrix, Simulation. Disabled before a successful analysis.
- Assumption sliders: six exact factor IDs, native range controls, visible numeric values.
- Event controls: input, date, add action, active toggle, delete action, and time-decay position.
- Evidence rail: sourced claims grouped as supporting, opposing, and neutral; contradictions remain explicit.
- Settings dialog: theme, density, proxy URL, app token, connection state, Save & Test, and collapsed development-only provider overrides.
- Error dialog: stable code, human message, suggested action, and request ID.

## Signature

The memorable element is the probability field: outcomes appear as restrained luminous bodies whose area represents probability, while concentric orbital guides and evidence links communicate that the forecast is a model, not a collection of decorative bubbles.

## Motion

Use 180–220ms state transitions for selected tabs, probability bars, and modal entry. Probability changes animate only when the user changes a slider or event. Reduced-motion mode removes transforms and animated interpolation.

## Content Rules

Use sentence case and direct verbs. Empty states explain the live-backend requirement. Errors identify what failed and what the user can do. Never display unsupported claims, hidden confidence, fabricated examples, or reference-screenshot scenario text.
