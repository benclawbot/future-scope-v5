export const FACTOR_IDS = Object.freeze([
  "market_momentum",
  "execution_quality",
  "competitive_pressure",
  "regulatory_pressure",
  "resource_availability",
  "technology_readiness",
]);

export function softmax(logits) {
  if (!Array.isArray(logits) || logits.length === 0) {
    throw new TypeError("softmax requires at least one logit");
  }

  const maximum = Math.max(...logits);
  const exponentials = logits.map((value) => Math.exp(value - maximum));
  const denominator = exponentials.reduce((sum, value) => sum + value, 0);

  return exponentials.map((value) => value / denominator);
}

export function largestRemainder(probabilities) {
  if (!Array.isArray(probabilities) || probabilities.length === 0) {
    throw new TypeError("largestRemainder requires at least one probability");
  }

  const total = probabilities.reduce((sum, value) => sum + value, 0);
  if (!Number.isFinite(total) || total <= 0) {
    throw new RangeError("probabilities must have a positive finite total");
  }

  const normalized = probabilities.map((value) => {
    if (!Number.isFinite(value) || value < 0) {
      throw new RangeError("probabilities must be finite and non-negative");
    }
    return value / total;
  });

  const floors = normalized.map((value) => Math.floor(value * 1000) / 10);
  const allocatedTenths = Math.round(
    floors.reduce((sum, value) => sum + value, 0) * 10,
  );
  const remainingTenths = 1000 - allocatedTenths;
  const ranked = normalized
    .map((value, index) => ({
      index,
      remainder: value * 100 - floors[index],
    }))
    .sort((left, right) => right.remainder - left.remainder || left.index - right.index);

  for (let position = 0; position < remainingTenths; position += 1) {
    floors[ranked[position].index] += 0.1;
  }

  return floors.map((value) => Number(value.toFixed(1)));
}

export function recalculateOutcomes(outcomes, factorValues = {}, events = []) {
  if (!Array.isArray(outcomes) || outcomes.length === 0) {
    throw new TypeError("at least one outcome is required");
  }

  const logits = outcomes.map((outcome) => {
    let logit = finiteNumber(outcome.base_logit, "base_logit");

    for (const factorId of FACTOR_IDS) {
      const factorValue = factorValues[factorId] ?? 0.5;
      if (!Number.isFinite(factorValue) || factorValue < 0 || factorValue > 1) {
        throw new RangeError(`${factorId} must be between 0 and 1`);
      }

      const coefficient = outcome.factor_coefficients?.[factorId] ?? 0;
      logit += finiteNumber(coefficient, `${factorId} coefficient`) * (factorValue - 0.5);
    }

    for (const event of events) {
      if (!event?.active) continue;
      const impact = event.impacts?.[outcome.id] ?? 0;
      const timeDecay = event.time_decay ?? 1;
      if (Math.abs(finiteNumber(impact, "event impact")) > 2) {
        throw new RangeError("event impact must be between -2 and 2");
      }
      if (!Number.isFinite(timeDecay) || timeDecay < 0.2 || timeDecay > 1) {
        throw new RangeError("event time decay must be between 0.2 and 1");
      }
      logit += impact * timeDecay;
    }

    return logit;
  });

  const rawProbabilities = softmax(logits);
  const displayed = largestRemainder(rawProbabilities);

  return outcomes.map((outcome, index) => ({
    ...outcome,
    previous_probability:
      Number.isFinite(outcome.current_probability) && outcome.current_probability >= 0
        ? outcome.current_probability
        : rawProbabilities[index],
    current_probability: Number(rawProbabilities[index].toFixed(6)),
    display_probability: displayed[index],
    current_logit: Number(logits[index].toFixed(6)),
  }));
}

function finiteNumber(value, label) {
  if (!Number.isFinite(value)) {
    throw new TypeError(`${label} must be a finite number`);
  }
  return value;
}
