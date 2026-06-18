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

export function validateA1(value, minimumQueries) {
  const data = requireRecord(value, "A1 response");
  if (
    !Array.isArray(data.queries) ||
    data.queries.length < minimumQueries ||
    data.queries.length > 15
  ) {
    throw new Error(`A1 requires ${minimumQueries} to 15 queries`);
  }
  data.queries = [...new Set(data.queries.map((query) => requireString(query, "A1 query")))];
  if (data.queries.length < minimumQueries) {
    throw new Error(`A1 requires ${minimumQueries} distinct queries`);
  }
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
