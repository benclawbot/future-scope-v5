import { describe, expect, test, vi } from "vitest";
import {
  callMiniMaxJson,
  callMiniMaxResearchJson,
  canonicalizeUrl,
  deduplicateSources,
  extractFirstJsonObject,
  inferSourceType,
  normalizeMiniMaxSources,
} from "../proxy/providers.js";
import { validateA2 } from "../proxy/schemas.js";

describe("source normalization", () => {
  test("canonicalizes tracking parameters and trailing slashes", () => {
    expect(
      canonicalizeUrl(
        "HTTPS://Example.COM/report/?utm_source=newsletter&ref=home&id=42#section",
      ),
    ).toBe("https://example.com/report?id=42");
  });

  test("deduplicates by canonical URL and normalized title", () => {
    const sources = deduplicateSources([
      { url: "https://example.com/report?utm_source=x", title: "A New Report" },
      { url: "https://example.com/report", title: "A New Report" },
      { url: "https://elsewhere.test/other", title: "  A new   report " },
    ]);

    expect(sources).toHaveLength(1);
  });
});

describe("extractFirstJsonObject", () => {
  test("ignores thinking text and braces inside strings", () => {
    expect(
      extractFirstJsonObject(
        '<think>reasoning</think>\n```json\n{"value":"a } brace","nested":{"ok":true}}\n```',
      ),
    ).toEqual({ value: "a } brace", nested: { ok: true } });
  });
});

describe("MiniMax source normalization", () => {
  test("normalizes source fields and rejects non-web URLs", () => {
    const sources = normalizeMiniMaxSources(
      [
        {
          id: "src_model",
          title: "  Official   release ",
          url: "https://Example.com/release/?utm_medium=feed",
          domain: "wrong.test",
          description: " Primary   announcement ",
          extra_snippets: [" Additional detail ", "", "Second detail"],
          published_or_discovered_date: "June 18, 2026",
          retrieved_at: null,
          source_type: "official",
        },
        {
          id: "src_invalid",
          title: "Invalid source",
          url: "ftp://example.com/report",
          description: "Not a web source",
          extra_snippets: [],
          published_or_discovered_date: null,
          retrieved_at: null,
          source_type: "other",
        },
      ],
      { now: () => new Date("2026-06-18T12:00:00.000Z") },
    );

    expect(sources).toEqual([
      {
        id: "src_model",
        title: "Official release",
        url: "https://example.com/release",
        canonical_url: "https://example.com/release",
        domain: "example.com",
        description: "Primary announcement",
        extra_snippets: ["Additional detail", "Second detail"],
        published_or_discovered_date: "2026-06-18",
        retrieved_at: "2026-06-18T12:00:00.000Z",
        source_type: "official",
      },
    ]);
  });

  test.each([
    [{ domain: "agency.gov" }, "regulatory"],
    [{ url: "https://arxiv.org/abs/1234" }, "research"],
    [{ domain: "reuters.com" }, "news"],
    [{ title: "Quarterly financial results" }, "financial"],
    [{ description: "Expert analysis from an industry analyst" }, "expert"],
    [{ url: "https://example.com/blog/update" }, "blog"],
    [{ domain: "reddit.com" }, "forum"],
    [{ title: "Company official announcement" }, "official"],
    [{ title: "Unclassified source" }, "other"],
  ])("infers source type for %o", (source, expected) => {
    expect(inferSourceType(source)).toBe(expected);
  });
});

describe("callMiniMaxResearchJson", () => {
  test("calls MiniMax with strict native-research source instructions", async () => {
    const research = {
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
    };
    const fetchImpl = vi.fn(async () =>
      Response.json({
        choices: [{ message: { content: JSON.stringify(research) } }],
      }),
    );

    const result = await callMiniMaxResearchJson(
      {
        agent: "A2",
        system: "Research the resolved question.",
        user: "{}",
        validate: (value) => validateA2(value, 1),
      },
      {
        apiKey: "provider-key",
        fetchImpl,
        sleep: async () => {},
      },
    );

    expect(result).toEqual(research);
    const body = JSON.parse(fetchImpl.mock.calls[0][1].body);
    expect(body.messages[0].content).toContain(
      "Use MiniMax native research/web-search capability if available.",
    );
    expect(body.messages[0].content).toContain("Do not invent URLs or citations.");
    expect(body.max_completion_tokens).toBe(16000);
  });
});

describe("callMiniMaxJson", () => {
  test("makes one repair call after schema validation fails", async () => {
    const fetchImpl = vi
      .fn()
      .mockResolvedValueOnce(
        Response.json({
          choices: [{ message: { content: '{"queries":[]}' } }],
        }),
      )
      .mockResolvedValueOnce(
        Response.json({
          choices: [
            {
              message: {
                content: '{"queries":["one","two","three","four","five","six"]}',
              },
            },
          ],
        }),
      );

    const result = await callMiniMaxJson(
      {
        agent: "A1",
        system: "Return JSON.",
        user: "Plan research.",
        validate(value) {
          if (!Array.isArray(value.queries) || value.queries.length < 6) {
            throw new Error("at least six queries required");
          }
          return value;
        },
      },
      {
        apiKey: "provider-key",
        fetchImpl,
        sleep: async () => {},
      },
    );

    expect(result.queries).toHaveLength(6);
    expect(fetchImpl).toHaveBeenCalledTimes(2);
    const repairBody = JSON.parse(fetchImpl.mock.calls[1][1].body);
    expect(repairBody.messages.at(-1).content).toContain("at least six queries required");
    expect(repairBody.model).toBe("MiniMax-M3");
  });
});
