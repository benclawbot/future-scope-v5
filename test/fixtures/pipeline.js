import { FACTOR_IDS } from "../../proxy/validation.js";

export const agentFixtures = {
  A0: {
    domain: "technology",
    time_horizon: {
      label: "24 months",
      start: "2026-06-18T00:00:00.000Z",
      end: "2028-06-18T00:00:00.000Z",
    },
    forecast_question: "Will grid storage deployment accelerate by June 2028?",
    entities: ["grid storage"],
    location_scope: "global",
    needs_clarification: false,
    assumptions_if_not_clarified: [],
  },
  A1: {
    research_tasks: [
      {
        id: "task_001",
        purpose: "recent_developments",
        query: "Find recent grid storage deployment developments.",
        freshness: "recent",
        importance: 0.95,
      },
      {
        id: "task_002",
        purpose: "primary_sources",
        query: "Find primary grid storage deployment sources.",
        freshness: "recent",
        importance: 0.9,
      },
      {
        id: "task_003",
        purpose: "base_rates",
        query: "Find historical grid storage deployment base rates.",
        freshness: "historical",
        importance: 0.85,
      },
      {
        id: "task_004",
        purpose: "constraints",
        query: "Find grid storage deployment constraints.",
        freshness: "any",
        importance: 0.8,
      },
      {
        id: "task_005",
        purpose: "alternatives",
        query: "Find alternative grid flexibility technologies.",
        freshness: "any",
        importance: 0.7,
      },
      {
        id: "task_006",
        purpose: "contradictions",
        query: "Find contrary grid storage deployment evidence.",
        freshness: "recent",
        importance: 0.75,
      },
    ],
  },
  A2: {
    sources: createCandidateSources(20),
    research_summary: "MiniMax found a diverse set of decision-relevant sources.",
    coverage_gaps: ["Private project pipeline data is incomplete."],
  },
  A3: {
    scores: Array.from({ length: 20 }, (_, index) => ({
      source_id: `src_${String(index + 1).padStart(3, "0")}`,
      authority_score: 0.8,
      recency_score: 0.9,
      relevance_score: 0.9,
      primary_source_score: index % 2 === 0 ? 1 : 0.5,
      specificity_score: 0.8,
      domain_diversity_bonus: 1,
    })),
  },
  A4: {
    evidence_items: Array.from({ length: 12 }, (_, index) => ({
      id: `ev_${String(index + 1).padStart(3, "0")}`,
      claim: `Evidence statement ${index + 1}`,
      source_ids: [`src_${String((index % 8) + 1).padStart(3, "0")}`],
      supports: index % 2 === 0 ? ["out_001"] : ["out_002"],
      opposes: [],
      strength: 0.7,
      quality_weight: 0.8,
      date: "2026-06-01",
      stance: index % 2 === 0 ? "supporting" : "opposing",
    })),
  },
  A5: {
    contradictions: [
      {
        topic: "supply growth",
        claim_a: "Capacity is expanding",
        claim_b: "Interconnection queues remain slow",
        source_ids: ["src_001", "src_002"],
        resolution: "unresolved",
      },
    ],
    staleness_warnings: [],
    events: [
      {
        id: "evt_research_001",
        label: "Policy review",
        date: "2027-03-01T00:00:00.000Z",
        kind: "research",
      },
    ],
  },
  A6: {
    outcomes: [
      {
        id: "out_001",
        title: "Deployment accelerates",
        description: "Annual additions rise materially.",
        impact: 0.82,
        category: "positive",
        speculative: false,
        evidence_for: ["ev_001"],
        evidence_against: ["ev_002"],
      },
      {
        id: "out_002",
        title: "Growth remains steady",
        description: "Deployment continues near its current trend.",
        impact: 0.55,
        category: "neutral",
        speculative: false,
        evidence_for: ["ev_002"],
        evidence_against: ["ev_001"],
      },
      {
        id: "out_003",
        title: "Deployment slows",
        description: "Constraints reduce annual additions.",
        impact: 0.72,
        category: "negative",
        speculative: false,
        evidence_for: ["ev_003"],
        evidence_against: ["ev_004"],
      },
      {
        id: "out_004",
        title: "Regional divergence",
        description: "Growth concentrates in a subset of markets.",
        impact: 0.61,
        category: "uncertain",
        speculative: true,
        evidence_for: ["ev_005"],
        evidence_against: ["ev_006"],
      },
    ],
    coverage_note:
      "These are the most decision-relevant outcomes identified from the evidence, not an exhaustive list of all imaginable futures.",
  },
  A7: {
    logits: [
      { outcome_id: "out_001", base_logit: 0.7 },
      { outcome_id: "out_002", base_logit: 0.3 },
      { outcome_id: "out_003", base_logit: -0.2 },
      { outcome_id: "out_004", base_logit: -0.5 },
    ],
  },
  A8: {
    calibrations: [
      { outcome_id: "out_001", base_logit: 0.65, confidence: 0.78 },
      { outcome_id: "out_002", base_logit: 0.25, confidence: 0.72 },
      { outcome_id: "out_003", base_logit: -0.15, confidence: 0.66 },
      { outcome_id: "out_004", base_logit: -0.55, confidence: 0.58 },
    ],
    base_rate_available: true,
    base_rate_note: null,
  },
  A9: {
    models: ["out_001", "out_002", "out_003", "out_004"].map(
      (outcomeId, outcomeIndex) => ({
        outcome_id: outcomeId,
        factor_coefficients: Object.fromEntries(
          FACTOR_IDS.map((factorId, factorIndex) => [
            factorId,
            Number((((factorIndex % 2 === 0 ? 1 : -1) * (outcomeIndex + 1)) / 10).toFixed(1)),
          ]),
        ),
        factor_coefficients_explanation: Object.fromEntries(
          FACTOR_IDS.map((factorId) => [factorId, `${factorId} changes this outcome.`]),
        ),
      }),
    ),
  },
};

export function createCandidateSources(count = 20) {
  return Array.from({ length: count }, (_, index) => ({
    id: `src_${String(index + 1).padStart(3, "0")}`,
    title: `Source ${index + 1}`,
    url: `https://source${index + 1}.test/report`,
    canonical_url: `https://source${index + 1}.test/report`,
    domain: `source${index + 1}.test`,
    description: `Evidence description ${index + 1}`,
    extra_snippets: [],
    published_or_discovered_date: "2026-06-01",
    retrieved_at: "2026-06-18T12:00:00.000Z",
    source_type: ["official", "regulatory", "research", "news"][index % 4],
  }));
}
