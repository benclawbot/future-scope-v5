import { recalculateOutcomes } from "./probability.js";
import { callMiniMaxJson, deduplicateSources, searchBrave } from "./providers.js";
import {
  validateA0,
  validateA1,
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
  A1: { queries: ["distinct Brave query strings"] },
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
  const callJson =
    options.callJson ??
    ((request) =>
      callMiniMaxJson(request, {
        apiKey: options.minimaxApiKey,
        baseUrl: options.minimaxBaseUrl,
        fetchImpl: options.fetchImpl,
        sleep: options.sleep,
      }));
  const search =
    options.search ??
    ((request) =>
      searchBrave(request, {
        apiKey: options.braveApiKey,
        baseUrl: options.braveBaseUrl,
        fetchImpl: options.fetchImpl,
        sleep: options.sleep,
        now: options.now,
      }));
  const now = options.now ?? (() => new Date());
  const randomUUID = options.randomUUID ?? (() => crypto.randomUUID());
  const agentLatencies = {};

  const runAgent = async (agent, user, validate) => {
    const started = now().getTime();
    const result = await callJson({
      agent,
      system: AGENT_SYSTEM,
      user: JSON.stringify(user),
      validate,
    });
    agentLatencies[agent] = Math.max(0, now().getTime() - started);
    return result;
  };

  const minimumQueries = input.research_depth === "deep" ? 10 : 6;
  const minimumCandidates = input.research_depth === "deep" ? 40 : 20;
  const minimumFinalSources = input.research_depth === "deep" ? 15 : 8;
  const minimumEvidenceItems = input.research_depth === "deep" ? 25 : 12;

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
  );

  const plan = await runAgent(
    "A1",
    {
      resolved_question: clarification.forecast_question,
      domain: clarification.domain,
      time_horizon: clarification.time_horizon,
      minimum_queries: minimumQueries,
      coverage:
        "recent developments, primary sources, base rates, constraints, alternatives, and contradictory evidence",
      output_schema: OUTPUT_SCHEMAS.A1,
    },
    (value) => validateA1(value, minimumQueries),
  );

  const retrievalStarted = now().getTime();
  const queryResults = await mapWithConcurrency(plan.queries, 4, (query) =>
    search({
      query,
      count: 10,
      country: localeCountry(input.locale),
      search_lang: input.locale.slice(0, 2).toLowerCase(),
      freshness: null,
      extra_snippets: true,
    }),
  );
  agentLatencies.A2 = Math.max(0, now().getTime() - retrievalStarted);

  const candidates = deduplicateSources(queryResults.flatMap((result) => result.results))
    .slice(0, 80)
    .map((source, index) => ({
      ...source,
      id: `src_${String(index + 1).padStart(3, "0")}`,
    }));

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

  const finalSourceLimit = input.research_depth === "deep" ? 30 : 20;
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
  return {
    analysis_id: randomUUID(),
    request_id: options.requestId ?? randomUUID(),
    created_at: createdAt,
    prompt: input.prompt,
    resolved_question: clarification.forecast_question,
    domain: clarification.domain,
    time_horizon: clarification.time_horizon,
    assumptions: clarification.assumptions_if_not_clarified ?? [],
    sources: finalSources,
    evidence_items: evidence.evidence_items,
    contradictions: audit.contradictions,
    staleness_warnings: audit.staleness_warnings,
    factors: factorDefinitions(),
    events: audit.events,
    outcomes: calculated,
    coverage_note: enumeration.coverage_note,
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

async function mapWithConcurrency(items, concurrency, task) {
  const results = new Array(items.length);
  let cursor = 0;
  const workers = Array.from({ length: Math.min(concurrency, items.length) }, async () => {
    while (cursor < items.length) {
      const index = cursor;
      cursor += 1;
      results[index] = await task(items[index], index);
    }
  });
  await Promise.all(workers);
  return results;
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

function localeCountry(locale) {
  const [, country] = locale.split("-");
  return country?.length === 2 ? country.toUpperCase() : "US";
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
