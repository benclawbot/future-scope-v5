import { describe, expect, test, vi } from "vitest";
import { runAnalysisPipeline } from "../proxy/agents.js";
import { agentFixtures, createCandidateSources } from "./fixtures/pipeline.js";

describe("runAnalysisPipeline", () => {
  test("runs A0 through A9 in order and returns a valid sourced payload", async () => {
    const calls = [];
    const callJson = vi.fn(async ({ agent }) => {
      calls.push(agent);
      return structuredClone(agentFixtures[agent]);
    });
    const search = vi.fn(async ({ query }) => ({
      query,
      results: createCandidateSources(20),
    }));

    const payload = await runAnalysisPipeline(
      {
        prompt: "Will grid storage deployment accelerate by June 2028?",
        research_depth: "balanced",
        time_horizon_override: null,
        locale: "en-US",
      },
      {
        callJson,
        search,
        now: () => new Date("2026-06-18T12:00:00.000Z"),
        randomUUID: () => "11111111-1111-4111-8111-111111111111",
      },
    );

    expect(calls).toEqual(["A0", "A1", "A3", "A4", "A5", "A6", "A7", "A8", "A9"]);
    expect(search).toHaveBeenCalledTimes(6);
    expect(payload.sources.length).toBeGreaterThanOrEqual(8);
    expect(payload.evidence_items).toHaveLength(12);
    expect(payload.outcomes).toHaveLength(4);
    expect(
      payload.outcomes.reduce(
        (sum, outcome) => sum + Math.round(outcome.display_probability * 10),
        0,
      ),
    ).toBe(1000);
    expect(payload.audit.insufficient_evidence).toBe(false);
    expect(payload.coverage_note).toContain("decision-relevant");
  });

  test("caps confidence when evidence thresholds are missed", async () => {
    const callJson = vi.fn(async ({ agent }) => structuredClone(agentFixtures[agent]));
    const search = vi.fn(async ({ query }) => ({
      query,
      results: createCandidateSources(3),
    }));

    const payload = await runAnalysisPipeline(
      {
        prompt: "Will grid storage deployment accelerate by June 2028?",
        research_depth: "balanced",
        time_horizon_override: null,
        locale: "en-US",
      },
      {
        callJson,
        search,
        now: () => new Date("2026-06-18T12:00:00.000Z"),
        randomUUID: () => "11111111-1111-4111-8111-111111111111",
      },
    );

    expect(payload.audit.insufficient_evidence).toBe(true);
    expect(Math.max(...payload.outcomes.map((outcome) => outcome.confidence))).toBeLessThanOrEqual(
      0.45,
    );
  });

  test("gives every model agent an explicit output schema", async () => {
    const requests = [];
    const callJson = vi.fn(async (request) => {
      requests.push(request);
      return structuredClone(agentFixtures[request.agent]);
    });

    await runAnalysisPipeline(
      {
        prompt: "Will grid storage deployment accelerate by June 2028?",
        research_depth: "balanced",
        time_horizon_override: null,
        locale: "en-US",
      },
      {
        callJson,
        search: async ({ query }) => ({ query, results: createCandidateSources(20) }),
        now: () => new Date("2026-06-18T12:00:00.000Z"),
        randomUUID: () => "11111111-1111-4111-8111-111111111111",
      },
    );

    for (const request of requests) {
      expect(JSON.parse(request.user).output_schema, request.agent).toBeTruthy();
    }
  });
});
