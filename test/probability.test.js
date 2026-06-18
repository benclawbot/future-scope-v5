import { describe, expect, test } from "vitest";
import {
  largestRemainder,
  recalculateOutcomes,
  softmax,
} from "../proxy/probability.js";

describe("softmax", () => {
  test("returns stable normalized probabilities for large logits", () => {
    const probabilities = softmax([1001, 1002, 1003]);

    expect(probabilities.reduce((sum, value) => sum + value, 0)).toBeCloseTo(1, 12);
    expect(probabilities).toEqual([
      0.09003057317038046,
      0.24472847105479764,
      0.6652409557748218,
    ]);
  });
});

describe("largestRemainder", () => {
  test("returns one-decimal percentages that sum to exactly 100", () => {
    const displayed = largestRemainder([1 / 3, 1 / 3, 1 / 3]);

    expect(displayed).toEqual([33.4, 33.3, 33.3]);
    expect(displayed.reduce((sum, value) => sum + Math.round(value * 10), 0)).toBe(
      1000,
    );
  });

  test("preserves deterministic index order for equal remainders", () => {
    expect(largestRemainder([0.255, 0.255, 0.49])).toEqual([25.5, 25.5, 49]);
  });
});

describe("recalculateOutcomes", () => {
  const outcomes = [
    {
      id: "out_001",
      base_logit: 0,
      factor_coefficients: {
        market_momentum: 1,
        execution_quality: 0,
        competitive_pressure: 0,
        regulatory_pressure: 0,
        resource_availability: 0,
        technology_readiness: 0,
      },
    },
    {
      id: "out_002",
      base_logit: 0,
      factor_coefficients: {
        market_momentum: -1,
        execution_quality: 0,
        competitive_pressure: 0,
        regulatory_pressure: 0,
        resource_availability: 0,
        technology_readiness: 0,
      },
    },
  ];

  test("keeps neutral sliders at the base probability", () => {
    const result = recalculateOutcomes(outcomes, { market_momentum: 0.5 }, []);

    expect(result.map((outcome) => outcome.display_probability)).toEqual([50, 50]);
  });

  test("applies active event impact and time decay in logit units", () => {
    const result = recalculateOutcomes(
      outcomes,
      { market_momentum: 0.5 },
      [
        {
          active: true,
          time_decay: 0.5,
          impacts: { out_001: 2, out_002: -2 },
        },
      ],
    );

    expect(result[0].current_probability).toBeGreaterThan(0.87);
    expect(result[1].current_probability).toBeLessThan(0.13);
    expect(result.reduce((sum, outcome) => sum + outcome.display_probability, 0)).toBe(
      100,
    );
  });
});
