import { describe, expect, test } from "vitest";
import {
  FACTOR_IDS,
  validateAnalyzeInput,
  validateEventImpactInput,
} from "../proxy/validation.js";
import { validateA1, validateA2 } from "../proxy/schemas.js";

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

describe("MiniMax research schemas", () => {
  test("validates distinct A1 research tasks", () => {
    const value = validateA1(
      {
        research_tasks: [
          {
            id: "task_001",
            purpose: "recent_developments",
            query: "Find recent official announcements.",
            freshness: "recent",
            importance: 0.9,
          },
          {
            id: "task_002",
            purpose: "base_rates",
            query: "Find historical base rates.",
            freshness: "historical",
            importance: 0.8,
          },
        ],
      },
      2,
    );

    expect(value.research_tasks).toHaveLength(2);
  });

  test("rejects duplicate A1 task ids and invalid purposes", () => {
    expect(() =>
      validateA1(
        {
          research_tasks: [
            {
              id: "task_001",
              purpose: "unsupported",
              query: "Find evidence.",
              freshness: "any",
              importance: 0.5,
            },
            {
              id: "task_001",
              purpose: "base_rates",
              query: "Find base rates.",
              freshness: "historical",
              importance: 0.5,
            },
          ],
        },
        2,
      ),
    ).toThrow(/purpose|unique/i);
  });

  test("validates the A2 native research source contract", () => {
    const value = validateA2(
      {
        sources: [
          {
            id: "src_001",
            title: "Official release",
            url: "https://example.com/release",
            domain: "example.com",
            description: "Primary announcement",
            extra_snippets: ["Additional detail"],
            published_or_discovered_date: "2026-06-18",
            retrieved_at: "2026-06-18T12:00:00.000Z",
            source_type: "official",
          },
        ],
        research_summary: "One primary source was found.",
        coverage_gaps: [],
      },
      1,
    );

    expect(value.sources[0].source_type).toBe("official");
  });

  test("rejects A2 sources without valid URLs or approved source types", () => {
    expect(() =>
      validateA2(
        {
          sources: [
            {
              id: "src_001",
              title: "Invented citation",
              url: "not-a-url",
              domain: "example.com",
              description: "Invalid source",
              extra_snippets: [],
              published_or_discovered_date: null,
              retrieved_at: "2026-06-18T12:00:00.000Z",
              source_type: "social",
            },
          ],
          research_summary: "Invalid.",
          coverage_gaps: [],
        },
        1,
      ),
    ).toThrow(/url|source_type/i);
  });
});
