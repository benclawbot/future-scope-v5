import { FACTOR_IDS } from "./probability.js";

export { FACTOR_IDS };

export class InputError extends Error {
  constructor(message, details = null) {
    super(message);
    this.name = "InputError";
    this.code = "E_INPUT_INVALID";
    this.status = 400;
    this.details = details;
  }
}

export function validateAnalyzeInput(input) {
  const body = requireRecord(input, "analysis request");
  const prompt = boundedText(body.prompt, "prompt", 1, 400);
  const researchDepth = body.research_depth ?? "balanced";
  if (!["balanced", "deep"].includes(researchDepth)) {
    throw new InputError("research_depth must be balanced or deep");
  }

  const locale = body.locale ?? "en-US";
  if (typeof locale !== "string" || !/^[A-Za-z]{2,3}(?:-[A-Za-z0-9]{2,8})?$/.test(locale)) {
    throw new InputError("locale must be a valid language tag");
  }

  const override = body.time_horizon_override ?? null;
  if (
    override !== null &&
    (typeof override !== "string" ||
      Number.isNaN(Date.parse(override)) ||
      override.length > 40)
  ) {
    throw new InputError("time_horizon_override must be an ISO timestamp or null");
  }

  return {
    prompt,
    research_depth: researchDepth,
    time_horizon_override: override,
    locale,
  };
}

export function validateEventImpactInput(input) {
  const body = requireRecord(input, "event impact request");
  const eventLabel = boundedText(body.event_label, "event_label", 1, 180);
  const eventDate = body.event_date ?? null;
  if (eventDate !== null && (typeof eventDate !== "string" || Number.isNaN(Date.parse(eventDate)))) {
    throw new InputError("event_date must be an ISO timestamp or null");
  }

  const summary = requireRecord(body.current_payload_summary, "current_payload_summary");
  boundedText(summary.analysis_id, "analysis_id", 1, 80);
  boundedText(summary.resolved_question, "resolved_question", 1, 400);
  if (!Array.isArray(summary.outcomes) || summary.outcomes.length < 2 || summary.outcomes.length > 8) {
    throw new InputError("current_payload_summary.outcomes must contain 2 to 8 outcomes");
  }
  const outcomes = summary.outcomes.map((outcome) => {
    const record = requireRecord(outcome, "outcome");
    return {
      id: boundedText(record.id, "outcome.id", 1, 40),
      title: boundedText(record.title, "outcome.title", 1, 160),
    };
  });

  if (
    !Array.isArray(summary.factor_ids) ||
    summary.factor_ids.length !== FACTOR_IDS.length ||
    !FACTOR_IDS.every((factorId, index) => summary.factor_ids[index] === factorId)
  ) {
    throw new InputError("factor_ids must match the six supported factor identifiers");
  }

  return {
    event_label: eventLabel,
    event_date: eventDate,
    current_payload_summary: {
      analysis_id: summary.analysis_id.trim(),
      resolved_question: summary.resolved_question.trim(),
      outcomes,
      factor_ids: [...FACTOR_IDS],
    },
  };
}

export function requireRecord(value, label) {
  if (value === null || typeof value !== "object" || Array.isArray(value)) {
    throw new InputError(`${label} must be an object`);
  }
  return value;
}

export function boundedText(value, label, minimum, maximum) {
  if (typeof value !== "string") {
    throw new InputError(`${label} must be a string`);
  }
  const normalized = value.trim().replace(/\s+/g, " ");
  if (normalized.length < minimum || normalized.length > maximum) {
    throw new InputError(`${label} must be between ${minimum} and ${maximum} characters`);
  }
  return normalized;
}
