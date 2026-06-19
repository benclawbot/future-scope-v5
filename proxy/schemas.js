import { FACTOR_IDS, requireRecord } from "./validation.js";

const DOMAINS = new Set([
  "technology",
  "markets",
  "geopolitics",
  "personal",
  "product",
  "science",
  "legal",
  "other",
]);
const RESEARCH_PURPOSES = new Set([
  "recent_developments",
  "primary_sources",
  "base_rates",
  "constraints",
  "alternatives",
  "contradictions",
  "expert_analysis",
]);
const RESEARCH_FRESHNESS = new Set(["recent", "historical", "any"]);
export const SOURCE_TYPES = new Set([
  "official",
  "regulatory",
  "research",
  "news",
  "financial",
  "expert",
  "blog",
  "forum",
  "other",
]);

export function validateA0(value) {
  const data = requireRecord(value, "A0 response");
  if (!DOMAINS.has(data.domain)) throw new Error("A0 domain is invalid");
  requireString(data.forecast_question, "A0 forecast_question");
  requireRecord(data.time_horizon, "A0 time_horizon");
  requireDate(data.time_horizon.start, "A0 time_horizon.start");
  requireDate(data.time_horizon.end, "A0 time_horizon.end");
  if (Date.parse(data.time_horizon.end) <= Date.parse(data.time_horizon.start)) {
    throw new Error("A0 horizon end must be after start");
  }
  return data;
}

export function validateA1(value, minimumTasks) {
  const data = requireRecord(value, "A1 response");

  // Kept temporarily while the pipeline migrates to research_tasks in the next slice.
  if (Array.isArray(data.queries)) {
    if (data.queries.length < minimumTasks || data.queries.length > 15) {
      throw new Error(`A1 requires ${minimumTasks} to 15 queries`);
    }
    data.queries = [...new Set(data.queries.map((query) => requireString(query, "A1 query")))];
    if (data.queries.length < minimumTasks) {
      throw new Error(`A1 requires ${minimumTasks} distinct queries`);
    }
    return data;
  }

  if (
    !Array.isArray(data.research_tasks) ||
    data.research_tasks.length < minimumTasks ||
    data.research_tasks.length > 15
  ) {
    throw new Error(`A1 requires ${minimumTasks} to 15 research_tasks`);
  }

  const ids = new Set();
  const queries = new Set();
  for (const taskValue of data.research_tasks) {
    const task = requireRecord(taskValue, "A1 research task");
    const id = requireString(task.id, "A1 research task id");
    if (!/^task_[A-Za-z0-9_-]{1,64}$/.test(id)) {
      throw new Error("A1 research task id is invalid");
    }
    if (ids.has(id)) throw new Error("A1 research task ids must be unique");
    ids.add(id);

    if (!RESEARCH_PURPOSES.has(task.purpose)) {
      throw new Error("A1 research task purpose is invalid");
    }
    const query = requireString(task.query, "A1 research task query");
    if (query.length > 400) throw new Error("A1 research task query is too long");
    const normalizedQuery = query.toLowerCase();
    if (queries.has(normalizedQuery)) {
      throw new Error("A1 research task queries must be unique");
    }
    queries.add(normalizedQuery);
    if (!RESEARCH_FRESHNESS.has(task.freshness)) {
      throw new Error("A1 research task freshness is invalid");
    }
    requireUnit(task.importance, "A1 research task importance");
  }
  return data;
}

export function validateA2(value, minimumSources) {
  const data = requireRecord(value, "A2 response");
  if (
    !Array.isArray(data.sources) ||
    data.sources.length < minimumSources ||
    data.sources.length > 50
  ) {
    throw new Error(`A2 requires ${minimumSources} to 50 sources`);
  }

  const ids = new Set();
  for (const sourceValue of data.sources) {
    const source = requireRecord(sourceValue, "A2 source");
    const id = requireString(source.id, "A2 source id");
    if (ids.has(id)) throw new Error("A2 source ids must be unique");
    ids.add(id);
    requireString(source.title, "A2 source title");
    const rawUrl = requireString(source.url, "A2 source url");
    let url;
    try {
      url = new URL(rawUrl);
    } catch {
      throw new Error("A2 source url must be a valid URL");
    }
    if (url.protocol !== "https:") throw new Error("A2 source url must use HTTPS");
    requireString(source.domain, "A2 source domain");
    requireString(source.description, "A2 source description");
    if (!Array.isArray(source.extra_snippets) || source.extra_snippets.length > 8) {
      throw new Error("A2 source extra_snippets must be an array with at most 8 entries");
    }
    source.extra_snippets.forEach((snippet) =>
      requireString(snippet, "A2 source extra snippet"),
    );
    if (source.published_or_discovered_date !== null) {
      requireDate(
        source.published_or_discovered_date,
        "A2 source published_or_discovered_date",
      );
    }
    requireDate(source.retrieved_at, "A2 source retrieved_at");
    if (!SOURCE_TYPES.has(source.source_type)) {
      throw new Error("A2 source source_type is invalid");
    }
  }

  requireString(data.research_summary, "A2 research_summary");
  if (!Array.isArray(data.coverage_gaps)) {
    throw new Error("A2 coverage_gaps must be an array");
  }
  data.coverage_gaps.forEach((gap) => requireString(gap, "A2 coverage gap"));
  return data;
}

export function validateA3(value, sourceIds) {
  const data = requireRecord(value, "A3 response");
  if (!Array.isArray(data.scores)) throw new Error("A3 scores must be an array");
  const allowed = new Set(sourceIds);
  for (const score of data.scores) {
    if (!allowed.has(score.source_id)) throw new Error("A3 returned an unknown source_id");
    for (const key of [
      "authority_score",
      "recency_score",
      "relevance_score",
      "primary_source_score",
      "specificity_score",
      "domain_diversity_bonus",
    ]) {
      requireUnit(score[key], `A3 ${key}`);
    }
  }
  return data;
}

export function validateA4(value, sourceIds) {
  const data = requireRecord(value, "A4 response");
  if (!Array.isArray(data.evidence_items)) throw new Error("A4 evidence_items must be an array");
  const allowed = new Set(sourceIds);
  for (const item of data.evidence_items) {
    requireString(item.id, "A4 evidence id");
    requireString(item.claim, "A4 claim");
    if (!Array.isArray(item.source_ids) || item.source_ids.length === 0) {
      throw new Error("A4 evidence requires at least one source_id");
    }
    if (item.source_ids.some((sourceId) => !allowed.has(sourceId))) {
      throw new Error("A4 evidence contains an unknown source_id");
    }
    requireUnit(item.strength, "A4 strength");
    requireUnit(item.quality_weight, "A4 quality_weight");
  }
  return data;
}

export function validateA5(value, sourceIds) {
  const data = requireRecord(value, "A5 response");
  if (!Array.isArray(data.contradictions)) throw new Error("A5 contradictions must be an array");
  if (!Array.isArray(data.staleness_warnings)) throw new Error("A5 staleness_warnings must be an array");
  if (!Array.isArray(data.events)) data.events = [];
  const allowed = new Set(sourceIds);
  for (const contradiction of data.contradictions) {
    requireString(contradiction.topic, "A5 contradiction topic");
    if (
      !Array.isArray(contradiction.source_ids) ||
      contradiction.source_ids.some((sourceId) => !allowed.has(sourceId))
    ) {
      throw new Error("A5 contradiction source_ids are invalid");
    }
  }
  return data;
}

export function validateA6(value) {
  const data = requireRecord(value, "A6 response");
  if (!Array.isArray(data.outcomes) || data.outcomes.length < 4 || data.outcomes.length > 8) {
    throw new Error("A6 requires 4 to 8 outcomes");
  }
  const ids = new Set();
  for (const outcome of data.outcomes) {
    requireString(outcome.id, "A6 outcome id");
    requireString(outcome.title, "A6 outcome title");
    requireString(outcome.description, "A6 outcome description");
    requireUnit(outcome.impact, "A6 outcome impact");
    if (ids.has(outcome.id)) throw new Error("A6 outcome ids must be unique");
    ids.add(outcome.id);
    if (
      (!Array.isArray(outcome.evidence_for) || outcome.evidence_for.length === 0) &&
      (!Array.isArray(outcome.evidence_against) || outcome.evidence_against.length === 0)
    ) {
      throw new Error("A6 outcome requires evidence_for or evidence_against");
    }
  }
  requireString(data.coverage_note, "A6 coverage_note");
  return data;
}

export function validateA7(value, outcomeIds) {
  const data = requireRecord(value, "A7 response");
  validateOutcomeRows(data.logits, outcomeIds, "A7 logits", (row) => {
    requireFinite(row.base_logit, "A7 base_logit");
  });
  return data;
}

export function validateA8(value, outcomeIds) {
  const data = requireRecord(value, "A8 response");
  validateOutcomeRows(data.calibrations, outcomeIds, "A8 calibrations", (row) => {
    requireFinite(row.base_logit, "A8 base_logit");
    requireUnit(row.confidence, "A8 confidence");
  });
  if (typeof data.base_rate_available !== "boolean") {
    throw new Error("A8 base_rate_available must be boolean");
  }
  return data;
}

export function validateA9(value, outcomeIds) {
  const data = requireRecord(value, "A9 response");
  validateOutcomeRows(data.models, outcomeIds, "A9 models", (row) => {
    requireRecord(row.factor_coefficients, "A9 factor_coefficients");
    requireRecord(row.factor_coefficients_explanation, "A9 factor explanation");
    let nonzero = 0;
    for (const factorId of FACTOR_IDS) {
      const coefficient = requireFinite(
        row.factor_coefficients[factorId],
        `A9 coefficient ${factorId}`,
      );
      if (coefficient < -2 || coefficient > 2) {
        throw new Error("A9 coefficients must be between -2 and 2");
      }
      if (coefficient !== 0) nonzero += 1;
      requireString(
        row.factor_coefficients_explanation[factorId],
        `A9 explanation ${factorId}`,
      );
    }
    if (nonzero < 2) {
      const error = new Error("A9 requires at least two nonzero coefficients per outcome");
      error.code = "E_LLM_COEFFICIENT_SHORTFALL";
      throw error;
    }
  });
  return data;
}

export function validateEventImpacts(value, outcomeIds) {
  const data = requireRecord(value, "event impact response");
  validateOutcomeRows(data.impacts, outcomeIds, "event impacts", (row) => {
    const impact = requireFinite(row.impact, "event impact");
    if (impact < -2 || impact > 2) throw new Error("event impact must be between -2 and 2");
    requireString(row.explanation, "event impact explanation");
  });
  return data;
}

function validateOutcomeRows(rows, outcomeIds, label, validateRow) {
  if (!Array.isArray(rows) || rows.length !== outcomeIds.length) {
    throw new Error(`${label} must contain one row per outcome`);
  }
  const expected = new Set(outcomeIds);
  const seen = new Set();
  for (const row of rows) {
    if (!expected.has(row.outcome_id) || seen.has(row.outcome_id)) {
      throw new Error(`${label} outcome ids are invalid`);
    }
    seen.add(row.outcome_id);
    validateRow(row);
  }
}

function requireString(value, label) {
  if (typeof value !== "string" || !value.trim()) throw new Error(`${label} is required`);
  return value.trim();
}

function requireDate(value, label) {
  requireString(value, label);
  if (Number.isNaN(Date.parse(value))) throw new Error(`${label} must be an ISO date`);
  return value;
}

function requireFinite(value, label) {
  if (!Number.isFinite(value)) throw new Error(`${label} must be finite`);
  return value;
}

function requireUnit(value, label) {
  requireFinite(value, label);
  if (value < 0 || value > 1) throw new Error(`${label} must be between 0 and 1`);
  return value;
}
