import { describe, expect, test, vi } from "vitest";
import {
  callMiniMaxJson,
  canonicalizeUrl,
  deduplicateSources,
  extractFirstJsonObject,
  searchBrave,
} from "../proxy/providers.js";

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

describe("searchBrave", () => {
  test("retries one upstream failure and normalizes results", async () => {
    const fetchImpl = vi
      .fn()
      .mockResolvedValueOnce(new Response("unavailable", { status: 503 }))
      .mockResolvedValueOnce(
        Response.json({
          web: {
            results: [
              {
                title: "Official release",
                url: "https://example.com/release?utm_medium=feed",
                description: "Primary announcement",
                extra_snippets: ["Additional detail"],
                age: "June 18, 2026",
              },
            ],
          },
        }),
      );

    const result = await searchBrave(
      { query: "official release", freshness: "pw" },
      {
        apiKey: "provider-key",
        fetchImpl,
        sleep: async () => {},
        now: () => new Date("2026-06-18T12:00:00.000Z"),
      },
    );

    expect(fetchImpl).toHaveBeenCalledTimes(2);
    expect(fetchImpl.mock.calls[1][0]).toContain("freshness=pw");
    expect(result.results[0]).toMatchObject({
      id: "src_001",
      title: "Official release",
      url: "https://example.com/release",
      domain: "example.com",
      retrieved_at: "2026-06-18T12:00:00.000Z",
    });
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
