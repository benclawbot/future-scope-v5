import { describe, expect, test } from "vitest";
import {
  FACTOR_IDS,
  validateAnalyzeInput,
  validateEventImpactInput,
  validateSearchInput,
} from "../proxy/validation.js";

describe("validateAnalyzeInput", () => {
  test("normalizes a valid request", () => {
    expect(
      validateAnalyzeInput({
        prompt: "  Will battery storage costs fall by 2030?  ",
        research_depth: "balanced",
        time_horizon_override: null,
        locale: "en-US",
      }),
    ).toEqual({
      prompt: "Will battery storage costs fall by 2030?",
      research_depth: "balanced",
      time_horizon_override: null,
      locale: "en-US",
    });
  });

  test.each(["", "x".repeat(401)])("rejects invalid prompt length", (prompt) => {
    expect(() => validateAnalyzeInput({ prompt })).toThrowError(/prompt/i);
  });
});

describe("validateSearchInput", () => {
  test.each(["pd", "pw", "pm", "py", "2026-01-01to2026-06-18", null])(
    "accepts documented freshness %s",
    (freshness) => {
      expect(validateSearchInput({ query: "forecast evidence", freshness }).freshness).toBe(
        freshness,
      );
    },
  );

  test.each(["all", "2026-01-01..2026-06-18", "yesterday"])(
    "rejects unsupported freshness %s",
    (freshness) => {
      expect(() => validateSearchInput({ query: "forecast evidence", freshness })).toThrow(
        /freshness/i,
      );
    },
  );
});

describe("validateEventImpactInput", () => {
  test("requires a bounded event label and payload summary", () => {
    expect(
      validateEventImpactInput({
        event_label: "A regulator publishes a final rule",
        event_date: "2027-04-01T00:00:00.000Z",
        current_payload_summary: {
          analysis_id: "11111111-1111-4111-8111-111111111111",
          resolved_question: "Will the rule materially affect adoption?",
          outcomes: [
            { id: "out_001", title: "Adoption slows" },
            { id: "out_002", title: "Adoption continues" },
          ],
          factor_ids: FACTOR_IDS,
        },
      }).event_label,
    ).toBe("A regulator publishes a final rule");
  });
});
