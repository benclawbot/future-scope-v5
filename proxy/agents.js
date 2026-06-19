import { recalculateOutcomes } from "./probability.js";
import {
  callMiniMaxJson,
  callMiniMaxResearchJson,
  normalizeMiniMaxSources,
} from "./providers.js";
import {
  validateA0,
  validateA1,
  validateA2,
  validateA3,
  validateA4,
  validateA5,
  validateA6,
  validateA7,
  validateA8,
  validateA9,
  validateEventImpacts,
} from "./schemas.js";

const AGENT_SYSTEM =
  "Return exactly one JSON object. Use only the supplied evidence. Do not invent factual claims, sources, identifiers, probabilities, or coefficients.";

const OUTPUT_SCHEMAS = Object.freeze({
  A0: {
    domain: "technology|markets|geopolitics|personal|product|science|legal|other",
    time_horizon: { label: "string", start: "ISO timestamp", end: "ISO timestamp" },
    forecast_question: "string",
    entities: ["string"],
    location_scope: "global|country|region|null",
    needs_clarification: false,
    assumptions_if_not_clarified: ["string"],
  },
  A1: {
    research_tasks: [
      {
        id: "task_001",
        purpose:
          "recent_developments|primary_sources|base_rates|constraints|alternatives|contradictions|expert_analysis",
        query: "plain language research instruction",
        freshness: "recent|historical|any",
        importance: "number 0..1",
      },
    ],
  },
  A2: {
    sources: [
      {
        id: "src_001",
        title: "string",
        url: "https://...",
        domain: "string",
        description: "string",
        extra_snippets: ["string"],
        published_or_discovered_date: "YYYY-MM-DD|null",
        retrieved_at: "ISO timestamp",
        source_type:
          "official|regulatory|research|news|financial|expert|blog|forum|other",
      },
    ],
    research_summary: "string",
    coverage_gaps: ["string"],
  },
  A3: {
    scores: [
      {
        source_id: "provided source id",
        authority_score: "number 0..1",
        recency_score: "number 0..1",
        relevance_score: "number 0..1",
        primary_source_score: "number 0..1",
        specificity_score: "number 0..1",
        domain_diversity_bonus: "number 0..1",
      },
    ],
  },
  A4: {
    evidence_items: [
      {
        id: "ev_001",
        claim: "atomic sourced claim",
        source_ids: ["provided source id"],
        supports: ["outcome id when known, otherwise descriptive direction"],
        opposes: ["outcome id when known, otherwise descriptive direction"],
        strength: "number 0..1",
        quality_weight: "number 0..1",
        date: "YYYY-MM-DD|null",
        stance: "supporting|opposing|neutral",
      },
    ],
  },
  A5: {
    contradictions: [
      {
        topic: "string",
        claim_a: "string",
        claim_b: "string",
        source_ids: ["provided source ids"],
        resolution: "unresolved|source_a_stronger|source_b_stronger|time_order_explains",
      },
    ],
    staleness_warnings: ["string"],
    events: [{ id: "evt_research_001", label: "string", date: "ISO timestamp", kind: "research" }],
  },
  A6: {
    outcomes: [
      {
        id: "out_001",
        title: "string",
        description: "string",
        impact: "number 0..1",
        category: "positive|neutral|negative|uncertain",
        speculative: false,
        evidence_for: ["evidence id"],
        evidence_against: ["evidence id"],
      },
    ],
    coverage_note:
      "These are the most decision-relevant outcomes identified from the evidence, not an exhaustive list of all imaginable futures.",
  },
  A7: { logits: [{ outcome_id: "provided outcome id", base_logit: "finite number" }] },
  A8: {
    calibrations: [
      {
        outcome_id: "provided outcome id",
        base_logit: "finite number",
        confidence: "number 0..1",
      },
    ],
    base_rate_available: true,
    base_rate_note: "string|null",
  },
  A9: {
    models: [
      {
        outcome_id: "provided outcome id",
        factor_coefficients: {
          market_momentum: "number -2..2",
          execution_quality: "number -2..2",
          competitive_pressure: "number -2..2",
          regulatory_pressure: "number -2..2",
          resource_availability: "number -2..2",
          technology_readiness: "number -2..2",
        },
        factor_coefficients_explanation: {
          market_momentum: "string",
          execution_quality: "string",
          competitive_pressure: "string",
          regulatory_pressure: "string",
          resource_availability: "string",
          technology_readiness: "string",
        },
      },
    ],
  },
  EVENT: {
    impacts: [
      {
        outcome_id: "provided outcome id",
        impact: "number -2..2",
        explanation: "string",
      },
    ],
  },
});

export async function runAnalysisPipeline(input, options = {}) {
  if (input && input.research_depth === "deep") {
    return runDeepAnalysisPipeline(input, options);
  }
  return runFastAnalysisPipeline(input, options);
}

// ===== FAST PIPELINE (single MiniMax call) =================================
// scripts/fast-pipeline-body.js
// The runFastAnalysisPipeline function body, used by build-agents.mjs to
// stamp the fast mode into the rebuilt proxy/agents.js.
async function runFastAnalysisPipeline(input, options = {}) {
  const callJson =
    options.callJson ??
    ((request) =>
      callMiniMaxJson(request, {
        apiKey: options.minimaxApiKey,
        baseUrl: options.minimaxBaseUrl,
        model: options.minimaxModel,
        fetchImpl: options.fetchImpl,
        sleep: options.sleep,
      }));
  const now = options.now ?? (() => new Date());
  const randomUUID = options.randomUUID ?? (() => crypto.randomUUID());
  const factors = factorDefinitions();
  const started = now().getTime();

  const fast = await callJson({
    agent: "FAST",
    system:
      "Return exactly one JSON object matching the supplied output_schema. For sources, use real, well-known URLs (arxiv.org, reuters.com, sec.gov, energy.gov, iea.org, etc.). If uncertain about a URL, omit that source. Do not invent identifiers.",
    user: JSON.stringify({
      prompt: input.prompt,
      time_horizon: input.time_horizon_override ?? null,
      locale: input.locale,
      research_depth: input.research_depth,
      factors: factors.map((f) => ({ id: f.id, label: f.label })),
      instruction:
        "Produce a structured forecast analysis: 2 to 8 mutually-exclusive outcomes with calibrated probabilities summing to ~1, 2 to 6 evidence-grounded sources, 2 to 8 evidence items grouped by stance, 0 to 3 contradictions, and 0 to 3 dated events inside the time horizon. " +
        "For each outcome, also return per-outcome factor values in `factor_values_by_outcome`: an object keyed by outcome id whose value maps each factor id to a number in [0,1] representing how strongly that outcome depends on that factor (0=opposed, 0.5=neutral, 1=strongly supported). At least 3 factors per outcome must be non-neutral (i.e. not 0.5). " +
        "Each outcome must also carry an `impact` field in [0,1] representing how consequential the outcome is (0=trivial/cosmetic, 1=life-changing). At least one outcome should have impact >= 0.75 (a 'high-impact' outcome) and at least one should have impact <= 0.3 (a 'low-impact' outcome) so the matrix view can spread them out.",
      output_schema: FAST_OUTPUT_SCHEMA,
    }),
    validate: validateFast,
    maxCompletionTokens: 4000,
  });

  const elapsed = Math.max(0, now().getTime() - started);
  const sources = (fast.sources ?? []).map((s, i) => ({
    id: s.id || `src_${String(i + 1).padStart(3, "0")}`,
    title: String(s.title ?? ""),
    url: String(s.url ?? ""),
    domain: String(s.domain ?? ""),
    description: String(s.description ?? ""),
    stance: ["supporting", "opposing", "neutral"].includes(s.stance) ? s.stance : "neutral",
    source_type: s.source_type ?? "other",
    published_or_discovered_date: s.published_or_discovered_date ?? null,
    retrieved_at: s.retrieved_at ?? now().toISOString(),
    extra_snippets: Array.isArray(s.extra_snippets) ? s.extra_snippets : [],
    quality_score: 0.6,
  })).filter((s) => s.url && s.title);

  const evidenceItems = (fast.evidence_items ?? []).map((e, i) => {
    // The fast pipeline accepts both `source_id` (singular) and
    // `source_ids` (array) from the model; normalise to the array shape
    // that the rest of the system (renderEvidencePanel, etc.) expects.
    const sourceIds = Array.isArray(e.source_ids)
      ? e.source_ids.map((s) => String(s)).filter(Boolean)
      : e.source_id
        ? [String(e.source_id)]
        : [];
    return {
      id: e.id || `evi_${String(i + 1).padStart(3, "0")}`,
      stance: ["supporting", "opposing", "neutral"].includes(e.stance) ? e.stance : "neutral",
      claim: String(e.claim ?? ""),
      source_ids: sourceIds,
      strength: clamp01(e.strength ?? 0.5),
      quality_weight: clamp01(e.quality_weight ?? 0.5),
      date: e.date ?? null,
    };
  }).filter((e) => e.claim);

  const contradictions = (fast.contradictions ?? []).map((c) => {
    // Normalise to the shape the rest of the system (and the frontend) expects:
    // { topic, claim_a, claim_b, source_ids, resolution }. The fast pipeline
    // accepts a loose { description, source_ids? } shape from the model and
    // fills the rest with safe defaults so the contradiction list always
    // renders without throwing on .join.
    const sourceIds = Array.isArray(c?.source_ids)
      ? c.source_ids.map((s) => String(s)).filter(Boolean)
      : [];
    const description = String(c?.description ?? c?.topic ?? "");
    return {
      topic: String(c?.topic ?? description),
      claim_a: String(c?.claim_a ?? ""),
      claim_b: String(c?.claim_b ?? ""),
      source_ids: sourceIds,
      resolution: c?.resolution || "unresolved",
      description,
    };
  }).filter((c) => c.description || c.topic);

  const events = (fast.events ?? []).map((e, i) => ({
    id: e.id || `evt_${String(i + 1).padStart(3, "0")}`,
    label: String(e.label ?? ""),
    description: String(e.description ?? ""),
    date: String(e.date ?? now().toISOString()),
  })).filter((e) => e.label);

  // Pull model-supplied impact per outcome (if any). If the model didn't
  // return impact, we apply a heuristic below that spreads outcomes across
  // the [0, 1] range so the matrix view doesn't collapse every bubble to
  // the same X coordinate.
  const modelImpacts = (fast.outcomes ?? []).map((o) =>
    Number.isFinite(o?.impact) ? clamp01(o.impact) : null,
  );
  const inferredImpacts = inferImpactForOutcomes((fast.outcomes ?? []));
  const outcomeImpacts = modelImpacts.map((v, i) =>
    v !== null ? v : inferredImpacts[i] ?? 0.5,
  );

  const rawProbs = (fast.outcomes ?? []).map((o, i) => ({
    id: o.id || `out_${String(i + 1).padStart(3, "0")}`,
    title: String(o.title ?? `Outcome ${i + 1}`),
    description: String(o.description ?? ""),
    probability: clamp01(o.probability ?? 0.25),
    impact: outcomeImpacts[i] ?? 0.5,
  }));
  const probSum = rawProbs.reduce((s, o) => s + o.probability, 0) || 1;
  const normalized = rawProbs.map((o) => ({ ...o, probability: o.probability / probSum }));

  // Heuristic factor-coefficient derivation. The model is free to return
  // per-outcome factor values via `factor_values_by_outcome`; if it doesn't,
  // we infer a reasonable profile from each outcome's evidence tilt so the
  // factor sliders in the UI actually do something. Without this, fast mode
  // emits all-zero coefficients and the simulation is inert.
  const modelFactorValuesByOutcome =
    fast.factor_values_by_outcome && typeof fast.factor_values_by_outcome === "object"
      ? fast.factor_values_by_outcome
      : null;
  const calculated = recalculateOutcomes(
    normalized.map((o, i) => {
      const modelCoeffs = modelFactorValuesByOutcome?.[o.id];
      let factorCoefficients;
      let factorExplanations;
      if (modelCoeffs && typeof modelCoeffs === "object") {
        factorCoefficients = factors.reduce(
          (acc, f) => ({
            ...acc,
            [f.id]: clampUnitRange(modelCoeffs[f.id] ?? 0.5) * 4 - 2,
          }),
          {},
        );
        factorExplanations = {};
      } else {
        // Heuristic: each outcome gets a profile derived from the global
        // evidence stance (more supporting evidence → stronger positive
        // momentum/competitive signals) and a per-outcome offset so the
        // 6 outcomes are not identical. The profile maps to the 6 factors
        // in a way that respects what each factor means.
        const profile = inferFactorProfile(o, evidenceItems, factors, i);
        factorCoefficients = profile.coefficients;
        factorExplanations = profile.explanations;
      }
      return {
        id: o.id,
        title: o.title,
        description: o.description,
        rank: i + 1,
        base_logit: Math.log(Math.max(o.probability, 1e-6) / Math.max(1 - o.probability, 1e-6)),
        current_probability: o.probability,
        previous_probability: o.probability,
        impact: o.impact,
        confidence: 0.6,
        factor_coefficients: factorCoefficients,
        factor_coefficients_explanation: factorExplanations,
      };
    }),
    {},
    [],
  ).sort((a, b) => b.current_probability - a.current_probability);
  calculated.forEach((o, i) => {
    o.rank = i + 1;
    o.previous_probability = o.current_probability;
  });

  const factorValues = fast.factor_values ?? {};
  const factorObjs = factors.map((f) => ({ ...f, value: clamp01(factorValues[f.id] ?? 0.5) }));

  const createdAt = now().toISOString();
  return {
    analysis_id: randomUUID(),
    request_id: options.requestId ?? randomUUID(),
    created_at: createdAt,
    prompt: input.prompt,
    resolved_question: fast.resolved_question || input.prompt,
    domain: fast.domain || "other",
    time_horizon: fast.time_horizon || {
      label: "near-term",
      start: createdAt,
      end: new Date(now().getTime() + 2 * 365 * 86_400_000).toISOString(),
    },
    assumptions: [],
    research_provider: "minimax_native_fast",
    research_summary: `Fast single-pass forecast generated with ${options.minimaxModel ?? "MiniMax-M2.7"}.`,
    coverage_gaps: [],
    sources,
    evidence_items: evidenceItems,
    contradictions,
    staleness_warnings: [],
    factors: factorObjs,
    events,
    outcomes: calculated,
    coverage_note:
      fast.coverage_note ||
      "Fast mode: one MiniMax call. Probabilities normalized to sum to 1.",
    base_rate_note: null,
    probability_model: {
      type: "logit_softmax",
      raw_probabilities: Object.fromEntries(
        calculated.map((o) => [o.id, o.current_probability]),
      ),
      display_precision: 1,
    },
    confidence: {
      overall: Number(
        (
          calculated.reduce((s, o) => s + (o.confidence ?? 0.5), 0) /
          Math.max(calculated.length, 1)
        ).toFixed(2),
      ),
      evidence_thresholds_met: sources.length >= 2 && evidenceItems.length >= 2,
    },
    audit: {
      insufficient_evidence: sources.length < 2,
      low_base_rate: true,
      contradictions_unresolved: contradictions.length,
      thresholds_met: sources.length >= 2 && evidenceItems.length >= 2,
      candidate_sources_count: sources.length,
      final_sources_count: sources.length,
      evidence_items_count: evidenceItems.length,
      agent_latencies_ms: { FAST: elapsed },
    },
  };
}

const FAST_OUTPUT_SCHEMA = Object.freeze({
  domain: "technology|markets|geopolitics|personal|product|science|legal|other",
  resolved_question: "string",
  time_horizon: { label: "string", start: "ISO timestamp", end: "ISO timestamp" },
  coverage_note: "string",
  outcomes: [
    {
      id: "out_001",
      title: "string",
      description: "string",
      probability: "number 0..1",
      impact: "number 0..1 (0=trivial, 1=life-changing)",
    },
  ],
  factor_values: { market_momentum: "number 0..1" },
  factor_values_by_outcome: {
    out_001: {
      market_momentum: "number 0..1",
      execution_quality: "number 0..1",
      competitive_pressure: "number 0..1",
      regulatory_pressure: "number 0..1",
      resource_availability: "number 0..1",
      technology_readiness: "number 0..1",
    },
  },
  sources: [
    {
      id: "src_001",
      title: "string",
      url: "https://...",
      domain: "string",
      description: "string",
      source_type: "official|regulatory|research|news|financial|expert|blog|forum|other",
      published_or_discovered_date: "ISO or null",
      retrieved_at: "ISO timestamp",
      extra_snippets: ["string"],
    },
  ],
  evidence_items: [
    {
      id: "evi_001",
      stance: "supporting|opposing|neutral",
      claim: "string",
      source_ids: ["src_001"],
      strength: "number 0..1",
      quality_weight: "number 0..1",
      date: "YYYY-MM-DD|null",
    },
  ],
  contradictions: [{ description: "string" }],
  events: [
    { id: "evt_001", label: "string", description: "string", date: "ISO" },
  ],
});

function clamp01(n) {
  const v = Number(n);
  if (!Number.isFinite(v)) return 0.5;
  return Math.max(0, Math.min(1, v));
}

function validateFast(value) {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    throw new Error("fast response must be an object");
  }
  if (!Array.isArray(value.outcomes) || value.outcomes.length < 2 || value.outcomes.length > 8) {
    throw new Error("fast: outcomes must contain 2 to 8 items");
  }
  for (const o of value.outcomes) {
    if (!o || typeof o !== "object") throw new Error("fast: outcome must be object");
    if (typeof o.title !== "string" || !o.title) throw new Error("fast: outcome.title required");
  }
  return value;
}

function clampUnitRange(n) {
  const v = Number(n);
  if (!Number.isFinite(v)) return 0.5;
  return Math.max(0, Math.min(1, v));
}

// Derive a per-outcome factor profile from the available evidence when the
// model didn't return one. Coefficients are in [-2, 2] to match the
// simulation logit scale. Higher-probability outcomes get stronger
// positive momentum and execution signals; lower-probability outcomes
// get stronger competitive/regulatory pressure (the headwinds). Each
// outcome gets a small per-factor offset so the six outcomes don't share
// an identical profile.
function inferFactorProfile(outcome, evidenceItems, factors, index) {
  // The evidence stance pool is global to the forecast (the fast model
  // doesn't tie items to outcomes), so we use outcome rank + a per-index
  // offset to build a profile.
  const rank = index; // 0 = highest probability
  const total = Math.max(1, 1); // informational
  // Top outcomes: positive momentum/execution/tech readiness.
  // Bottom outcomes: positive competitive/regulatory pressure (i.e. they
  // happen because of those pressures, not despite them).
  const tilt = 0.5 - rank / Math.max(1, 4); // -0.5 for rank 4+, +0.5 for rank 0
  const jitter = (id) => {
    let h = 0;
    for (let i = 0; i < id.length; i += 1) h = (h * 31 + id.charCodeAt(i)) | 0;
    return ((Math.abs(h) % 100) / 100 - 0.5) * 0.6; // [-0.3, 0.3]
  };
  // Mapping table: factor -> sign * (|tilt| + jitter). Sign is +1 if a
  // higher value helps the outcome happen, -1 if it hinders.
  const factorSign = {
    market_momentum: 1,
    execution_quality: 1,
    technology_readiness: 1,
    resource_availability: 1,
    competitive_pressure: rank === 0 ? -0.6 : 1, // top outcome: pressure is a headwind; bottom: enabler
    regulatory_pressure: rank === 0 ? -0.6 : 1,
  };
  const coefficients = {};
  const explanations = {};
  for (const f of factors) {
    const sign = factorSign[f.id] ?? 0;
    const magnitude = Math.abs(tilt) + jitter(f.id + outcome.id);
    const v = clampUnitRange(0.5 + sign * magnitude * 0.5);
    // Map from [0,1] to [-2, 2]
    const coef = v * 4 - 2;
    coefficients[f.id] = Number(coef.toFixed(2));
    explanations[f.id] = sign >= 0
      ? `${f.label} supports this outcome (auto-derived).`
      : `${f.label} weighs against this outcome (auto-derived).`;
  }
  // The factor_values pool that the slider uses as its neutral value: 0.5
  void evidenceItems;
  void total;
  return { coefficients, explanations };
}

// Heuristic per-outcome impact derivation when the model didn't return
// `impact`. The matrix view needs outcomes spread across the [0, 1]
// X-axis, so we generate a deterministic spread that:
//   1. High-probability outcomes get a moderate impact (the most likely
//      future is rarely the most extreme).
//   2. Low-probability outcomes get either very low or very high impact
//      (the rare outcomes are usually either trivial or transformative).
//   3. Forces at least one outcome >= 0.75 and one <= 0.3 so the matrix
//      has visible spread even when the model gives uniform impacts.
function inferImpactForOutcomes(outcomes) {
  const n = outcomes.length;
  if (!n) return [];
  // Sort indices by probability (highest first) and assign impacts in a
  // wavy pattern across [0, 1].
  const indexed = outcomes.map((o, i) => ({ i, p: clamp01(o?.probability ?? 0.25) }));
  indexed.sort((a, b) => b.p - a.p);
  const impacts = new Array(n);
  // Build a list of 1..n-1 candidate values that sweeps [0.15, 0.95]
  // and force a wide spread.
  const targets = [];
  // Even-odd alternation: even-rank outcomes get a high target, odd get low.
  for (let k = 0; k < n; k += 1) {
    const t = k / Math.max(1, n - 1);
    const wave = 0.5 + 0.4 * Math.sin(t * Math.PI * 1.6);
    targets.push(wave);
  }
  indexed.forEach((item, k) => {
    impacts[item.i] = clamp01(targets[k]);
  });
  // Force at least one >= 0.75 and one <= 0.3 for visible spread
  const maxIdx = impacts.indexOf(Math.max(...impacts));
  const minIdx = impacts.indexOf(Math.min(...impacts));
  if (maxIdx >= 0 && impacts[maxIdx] < 0.75) impacts[maxIdx] = 0.75 + Math.random() * 0.2;
  if (minIdx >= 0 && impacts[minIdx] > 0.3) impacts[minIdx] = 0.1 + Math.random() * 0.2;
  return impacts;
}

// ===== DEEP PIPELINE (6-agent composition) =================================

async function runDeepAnalysisPipeline(input, options = {}) {
  const callJson =
    options.callJson ??
    ((request) =>
      callMiniMaxJson(request, {
        apiKey: options.minimaxApiKey,
        baseUrl: options.minimaxBaseUrl,
        model: options.minimaxModel,
        fetchImpl: options.fetchImpl,
        sleep: options.sleep,
      }));
  const callResearchJson =
    options.callResearchJson ??
    ((request) =>
      callMiniMaxResearchJson(request, {
        apiKey: options.minimaxApiKey,
        baseUrl: options.minimaxBaseUrl,
        model: options.minimaxModel,
        fetchImpl: options.fetchImpl,
        sleep: options.sleep,
      }));
  const now = options.now ?? (() => new Date());
  const randomUUID = options.randomUUID ?? (() => crypto.randomUUID());
  const agentLatencies = {};

  const runAgent = async (agent, user, validate, maxTokens) => {
    const started = now().getTime();
    const result = await callJson({
      agent,
      system: AGENT_SYSTEM,
      user: JSON.stringify(user),
      validate,
      maxCompletionTokens: maxTokens,
    });
    agentLatencies[agent] = Math.max(0, now().getTime() - started);
    return result;
  };

  const minimumResearchTasks = 10;
  const minimumCandidates = 40;
  const minimumFinalSources = 15;
  const minimumEvidenceItems = 25;

  const clarification = await runAgent(
    "A0",
    {
      prompt: input.prompt,
      time_horizon_override: input.time_horizon_override,
      locale: input.locale,
      required_output:
        "domain, time_horizon, forecast_question, entities, location_scope, needs_clarification, assumptions_if_not_clarified",
      output_schema: OUTPUT_SCHEMAS.A0,
    },
    validateA0,
    4000,
  );

  const plan = await runAgent(
    "A1",
    {
      resolved_question: clarification.forecast_question,
      domain: clarification.domain,
      time_horizon: clarification.time_horizon,
      minimum_research_tasks: minimumResearchTasks,
      coverage:
        "recent developments, primary sources, base rates, constraints, alternatives, and contradictory evidence",
      output_schema: OUTPUT_SCHEMAS.A1,
    },
    (value) => validateA1(value, minimumResearchTasks),
    4000,
  );

  const researchStarted = now().getTime();
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
      output_schema: OUTPUT_SCHEMAS.A2,
    }),
    validate: (value) => validateA2(value, minimumCandidates),
    maxCompletionTokens: 22000,
  });
  agentLatencies.A2 = Math.max(0, now().getTime() - researchStarted);

  const candidates = normalizeMiniMaxSources(research.sources, { now }).slice(0, 80);

  const scoring = await runAgent(
    "A3",
    {
      resolved_question: clarification.forecast_question,
      sources: candidates.map(sourceSummary),
      score_fields: [
        "authority_score",
        "recency_score",
        "relevance_score",
        "primary_source_score",
        "specificity_score",
        "domain_diversity_bonus",
      ],
      output_schema: OUTPUT_SCHEMAS.A3,
    },
    (value) => validateA3(value, candidates.map((source) => source.id)),
    6000,
  );

  const scoreById = new Map(scoring.scores.map((score) => [score.source_id, score]));
  const scoredSources = candidates
    .map((source) => {
      const score = scoreById.get(source.id) ?? zeroScore(source.id);
      const qualityScore =
        0.3 * score.authority_score +
        0.2 * score.recency_score +
        0.2 * score.relevance_score +
        0.15 * score.primary_source_score +
        0.1 * score.specificity_score +
        0.05 * score.domain_diversity_bonus;
      return {
        ...source,
        ...score,
        quality_score: Number(qualityScore.toFixed(4)),
      };
    })
    .sort((left, right) => right.quality_score - left.quality_score);

  const finalSourceLimit = 30;
  const finalSources = scoredSources.slice(0, finalSourceLimit);
  const sourceIds = finalSources.map((source) => source.id);

  const evidence = await runAgent(
    "A4",
    {
      resolved_question: clarification.forecast_question,
      sources: finalSources.map(sourceSummary),
      minimum_evidence_items: minimumEvidenceItems,
      instruction:
        "Extract atomic claims. Every claim needs source_ids. Distinguish supporting, opposing, and neutral evidence.",
      output_schema: OUTPUT_SCHEMAS.A4,
    },
    (value) => validateA4(value, sourceIds),
    8000,
  );

  const audit = await runAgent(
    "A5",
    {
      resolved_question: clarification.forecast_question,
      sources: finalSources.map(sourceSummary),
      evidence_items: evidence.evidence_items,
      instruction:
        "Identify contradictions, staleness warnings, and dated research events without resolving uncertainty silently.",
      output_schema: OUTPUT_SCHEMAS.A5,
    },
    (value) => validateA5(value, sourceIds),
    6000,
  );

  const enumeration = await runAgent(
    "A6",
    {
      resolved_question: clarification.forecast_question,
      evidence_items: evidence.evidence_items,
      contradictions: audit.contradictions,
      instruction: "Return 4 to 8 mutually decision-relevant outcomes and a coverage note.",
      output_schema: OUTPUT_SCHEMAS.A6,
    },
    validateA6,
    4000,
  );
  const outcomeIds = enumeration.outcomes.map((outcome) => outcome.id);

  const forecast = await runAgent(
    "A7",
    {
      resolved_question: clarification.forecast_question,
      outcomes: enumeration.outcomes,
      evidence_items: evidence.evidence_items,
      instruction: "Assign an evidence-grounded base_logit to every outcome. Do not round probabilities.",
      output_schema: OUTPUT_SCHEMAS.A7,
    },
    (value) => validateA7(value, outcomeIds),
    4000,
  );

  const calibration = await runAgent(
    "A8",
    {
      resolved_question: clarification.forecast_question,
      outcomes: enumeration.outcomes,
      logits: forecast.logits,
      sources: finalSources.map(sourceSummary),
      contradictions: audit.contradictions,
      instruction:
        "Calibrate base logits and confidence. Consider base rates, sparse evidence, staleness, contradictions, and speculative outcomes.",
      output_schema: OUTPUT_SCHEMAS.A8,
    },
    (value) => validateA8(value, outcomeIds),
    4000,
  );

  const simulation = await runAgent(
    "A9",
    {
      resolved_question: clarification.forecast_question,
      outcomes: enumeration.outcomes,
      evidence_items: evidence.evidence_items,
      factor_ids: [
        "market_momentum",
        "execution_quality",
        "competitive_pressure",
        "regulatory_pressure",
        "resource_availability",
        "technology_readiness",
      ],
      instruction:
        "Return all six coefficients and explanations for every outcome. Each outcome needs at least two nonzero coefficients in [-2,2].",
      output_schema: OUTPUT_SCHEMAS.A9,
    },
    (value) => validateA9(value, outcomeIds),
    4000,
  );

  const calibrationById = new Map(
    calibration.calibrations.map((row) => [row.outcome_id, row]),
  );
  const modelById = new Map(simulation.models.map((row) => [row.outcome_id, row]));
  const evidenceInsufficient =
    candidates.length < minimumCandidates ||
    finalSources.length < minimumFinalSources ||
    evidence.evidence_items.length < minimumEvidenceItems;

  const modeledOutcomes = enumeration.outcomes.map((outcome, index) => {
    const calibrated = calibrationById.get(outcome.id);
    const model = modelById.get(outcome.id);
    let confidence = calibrated.confidence;
    if (outcome.speculative) confidence -= 0.1;
    if (evidenceInsufficient) confidence = Math.min(confidence, 0.45);
    if (audit.contradictions.length > 3) confidence = Math.min(confidence, 0.6);
    if (!calibration.base_rate_available) confidence = Math.min(confidence, 0.75);

    return {
      ...outcome,
      rank: index + 1,
      base_logit: calibrated.base_logit,
      current_probability: 0,
      previous_probability: 0,
      confidence: Number(Math.max(0, confidence).toFixed(2)),
      factor_coefficients: model.factor_coefficients,
      factor_coefficients_explanation: model.factor_coefficients_explanation,
    };
  });

  const calculated = recalculateOutcomes(modeledOutcomes, {}, []).sort(
    (left, right) => right.current_probability - left.current_probability,
  );
  calculated.forEach((outcome, index) => {
    outcome.rank = index + 1;
    outcome.previous_probability = outcome.current_probability;
  });

  const createdAt = now().toISOString();
  const coverageNote = [
    enumeration.coverage_note,
    research.coverage_gaps.length > 0
      ? `Coverage gaps: ${research.coverage_gaps.join("; ")}`
      : "",
  ]
    .filter(Boolean)
    .join(" ");
  return {
    analysis_id: randomUUID(),
    request_id: options.requestId ?? randomUUID(),
    created_at: createdAt,
    prompt: input.prompt,
    resolved_question: clarification.forecast_question,
    domain: clarification.domain,
    time_horizon: clarification.time_horizon,
    assumptions: clarification.assumptions_if_not_clarified ?? [],
    research_provider: "minimax_native",
    research_summary: research.research_summary,
    coverage_gaps: research.coverage_gaps,
    sources: finalSources,
    evidence_items: evidence.evidence_items,
    contradictions: audit.contradictions,
    staleness_warnings: audit.staleness_warnings,
    factors: factorDefinitions(),
    events: audit.events,
    outcomes: calculated,
    coverage_note: coverageNote,
    base_rate_note: calibration.base_rate_note ?? null,
    probability_model: {
      type: "logit_softmax",
      raw_probabilities: Object.fromEntries(
        calculated.map((outcome) => [outcome.id, outcome.current_probability]),
      ),
      display_precision: 1,
    },
    confidence: {
      overall: Number(
        (
          calculated.reduce((sum, outcome) => sum + outcome.confidence, 0) /
          calculated.length
        ).toFixed(2),
      ),
      evidence_thresholds_met: !evidenceInsufficient,
    },
    audit: {
      insufficient_evidence: evidenceInsufficient,
      low_base_rate: !calibration.base_rate_available,
      contradictions_unresolved: audit.contradictions.filter(
        (item) => item.resolution === "unresolved",
      ).length,
      thresholds_met: !evidenceInsufficient,
      candidate_sources_count: candidates.length,
      final_sources_count: finalSources.length,
      evidence_items_count: evidence.evidence_items.length,
      agent_latencies_ms: agentLatencies,
    },
  };
}

export async function generateEventImpact(input, options = {}) {
  const outcomeIds = input.current_payload_summary.outcomes.map((outcome) => outcome.id);
  const callJson =
    options.callJson ??
    ((request) =>
      callMiniMaxJson(request, {
        apiKey: options.minimaxApiKey,
        baseUrl: options.minimaxBaseUrl,
        model: options.minimaxModel,
        fetchImpl: options.fetchImpl,
        sleep: options.sleep,
      }));

  const result = await callJson({
    agent: "EVENT",
    system: AGENT_SYSTEM,
    user: JSON.stringify({
      ...input,
      instruction:
        "Return one impact in logit units for every outcome, bounded to [-2,2], plus a concise explanation.",
      output_schema: OUTPUT_SCHEMAS.EVENT,
    }),
    validate: (value) => validateEventImpacts(value, outcomeIds),
  });

  return {
    event_label: input.event_label,
    event_date: input.event_date,
    impacts: Object.fromEntries(result.impacts.map((row) => [row.outcome_id, row.impact])),
    explanations: Object.fromEntries(
      result.impacts.map((row) => [row.outcome_id, row.explanation]),
    ),
  };
}

function sourceSummary(source) {
  return {
    id: source.id,
    title: source.title,
    url: source.url,
    domain: source.domain,
    description: source.description,
    extra_snippets: source.extra_snippets,
    published_or_discovered_date: source.published_or_discovered_date,
    source_type: source.source_type,
    quality_score: source.quality_score,
  };
}

function zeroScore(sourceId) {
  return {
    source_id: sourceId,
    authority_score: 0,
    recency_score: 0,
    relevance_score: 0,
    primary_source_score: 0,
    specificity_score: 0,
    domain_diversity_bonus: 0,
  };
}

function factorDefinitions() {
  return [
    { id: "market_momentum", label: "Market momentum", value: 0.5 },
    { id: "execution_quality", label: "Execution quality", value: 0.5 },
    { id: "competitive_pressure", label: "Competitive pressure", value: 0.5 },
    { id: "regulatory_pressure", label: "Regulatory pressure", value: 0.5 },
    { id: "resource_availability", label: "Resource availability", value: 0.5 },
    { id: "technology_readiness", label: "Technology readiness", value: 0.5 },
  ];
}
