import { SOURCE_TYPES } from "./schemas.js";

const DEFAULT_MINIMAX_URL = "https://api.minimax.io/v1/chat/completions";
const TRACKING_PARAMETERS = new Set([
  "fbclid",
  "gclid",
  "igshid",
  "mc_cid",
  "mc_eid",
  "ref",
  "ref_src",
]);

export async function callMiniMaxJson(request, options = {}) {
  const apiKey = requireSecret(options.apiKey, "MINIMAX_API_KEY");
  const fetchImpl = options.fetchImpl ?? fetch;
  const baseMessages = [
    {
      role: "system",
      content: `[AGENT:${request.agent}] ${request.system}`,
    },
    { role: "user", content: request.user },
  ];

  let messages = baseMessages;
  let lastError;
  for (let attempt = 0; attempt < 2; attempt += 1) {
    const response = await fetchWithRetry(options.baseUrl ?? DEFAULT_MINIMAX_URL, {
      fetchImpl,
      sleep: options.sleep,
      timeoutMs: options.timeoutMs ?? 60_000,
      retryStatuses: [500, 502, 503, 504],
      requestInit: {
        method: "POST",
        headers: {
          Authorization: `Bearer ${apiKey}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          model: options.model ?? "MiniMax-M3",
          thinking: { type: "adaptive" },
          messages,
          temperature: 0.2,
          max_completion_tokens:
            request.maxCompletionTokens ?? options.maxCompletionTokens ?? 8192,
        }),
      },
    });

    if (!response.ok) {
      const error = new Error(`MiniMax returned HTTP ${response.status}`);
      error.provider = "minimax";
      error.status = response.status;
      throw error;
    }

    const body = await response.json();
    const content = body.choices?.[0]?.message?.content;
    try {
      if (typeof content !== "string") {
        throw new Error("MiniMax response did not contain message content");
      }
      const parsed = extractFirstJsonObject(content);
      return request.validate ? request.validate(parsed) : parsed;
    } catch (error) {
      lastError = error;
      if (attempt === 1) break;
      messages = [
        ...baseMessages,
        { role: "assistant", content },
        {
          role: "user",
          content:
            "Repair the prior response. Return one JSON object only and satisfy this validation error: " +
            String(error.message).slice(0, 500),
        },
      ];
    }
  }

  const error = new Error(`MiniMax JSON validation failed: ${lastError?.message ?? "unknown"}`);
  error.code = "E_LLM_INVALID_JSON";
  error.provider = "minimax";
  throw error;
}

export async function callMiniMaxResearchJson(request, options = {}) {
  return callMiniMaxJson(
    {
      agent: request.agent ?? "RESEARCH",
      system: [
        request.system,
        "Use MiniMax native research/web-search capability if available.",
        "Return exactly one JSON object.",
        "Every source must include title, url, domain, description, source_type, and date if available.",
        "Do not invent URLs or citations.",
      ].join("\n"),
      user: request.user,
      validate: request.validate,
      maxCompletionTokens: request.maxCompletionTokens ?? 16000,
    },
    options,
  );
}

export function extractFirstJsonObject(text) {
  const source = String(text).replace(/<think>[\s\S]*?<\/think>/gi, "");

  for (let start = source.indexOf("{"); start !== -1; start = source.indexOf("{", start + 1)) {
    let depth = 0;
    let inString = false;
    let escaped = false;

    for (let index = start; index < source.length; index += 1) {
      const character = source[index];
      if (inString) {
        if (escaped) escaped = false;
        else if (character === "\\") escaped = true;
        else if (character === '"') inString = false;
        continue;
      }

      if (character === '"') {
        inString = true;
      } else if (character === "{") {
        depth += 1;
      } else if (character === "}") {
        depth -= 1;
        if (depth === 0) {
          const candidate = source.slice(start, index + 1);
          try {
            return JSON.parse(candidate);
          } catch {
            break;
          }
        }
      }
    }
  }

  throw new Error("No valid JSON object found");
}

export function canonicalizeUrl(rawUrl) {
  const url = new URL(rawUrl);
  url.protocol = url.protocol.toLowerCase();
  url.hostname = url.hostname.toLowerCase();
  url.hash = "";

  for (const key of [...url.searchParams.keys()]) {
    if (key.toLowerCase().startsWith("utm_") || TRACKING_PARAMETERS.has(key.toLowerCase())) {
      url.searchParams.delete(key);
    }
  }
  url.searchParams.sort();

  if (url.pathname.length > 1) {
    url.pathname = url.pathname.replace(/\/+$/, "");
  }
  return url.toString();
}

export function deduplicateSources(sources) {
  const seenUrls = new Set();
  const seenTitles = new Set();
  const unique = [];

  for (const source of sources) {
    let canonicalUrl;
    try {
      canonicalUrl = canonicalizeUrl(source.url);
    } catch {
      continue;
    }
    const normalizedTitle = cleanText(source.title).toLowerCase();
    if (!normalizedTitle || seenUrls.has(canonicalUrl) || seenTitles.has(normalizedTitle)) {
      continue;
    }
    seenUrls.add(canonicalUrl);
    seenTitles.add(normalizedTitle);
    unique.push({ ...source, url: canonicalUrl, canonical_url: canonicalUrl });
  }
  return unique;
}

export function normalizeMiniMaxSources(sources, options = {}) {
  if (!Array.isArray(sources)) return [];
  const now = options.now?.() ?? new Date();
  const normalized = [];

  for (const [index, source] of sources.entries()) {
    if (!source || typeof source !== "object" || Array.isArray(source)) continue;
    let canonicalUrl;
    try {
      const parsedUrl = new URL(source.url);
      if (parsedUrl.protocol !== "https:") continue;
      canonicalUrl = canonicalizeUrl(parsedUrl.toString());
    } catch {
      continue;
    }

    const title = cleanText(source.title);
    const description = cleanText(source.description);
    if (!title || !description) continue;
    const parsedRetrievedAt = Date.parse(source.retrieved_at);
    normalized.push({
      id: cleanText(source.id) || `src_${String(index + 1).padStart(3, "0")}`,
      title,
      url: canonicalUrl,
      canonical_url: canonicalUrl,
      domain: new URL(canonicalUrl).hostname,
      description,
      extra_snippets: Array.isArray(source.extra_snippets)
        ? source.extra_snippets.map(cleanText).filter(Boolean).slice(0, 8)
        : [],
      published_or_discovered_date: parseDate(source.published_or_discovered_date),
      retrieved_at: Number.isNaN(parsedRetrievedAt)
        ? now.toISOString()
        : new Date(parsedRetrievedAt).toISOString(),
      source_type: inferSourceType(source),
    });
  }

  return deduplicateSources(normalized);
}

export function inferSourceType(source) {
  if (SOURCE_TYPES.has(source?.source_type)) return source.source_type;

  const text = [
    source?.domain,
    source?.url,
    source?.title,
    source?.description,
  ]
    .map(cleanText)
    .join(" ")
    .toLowerCase();

  if (/\b(?:reddit|discourse|forum|community)\b/.test(text)) return "forum";
  if (/(?:\/blog\/|\.blog\b|\bblog\b)/.test(text)) return "blog";
  if (/\b(?:\.gov\b|regulator|regulatory|commission|parliament|ministry)\b/.test(text)) {
    return "regulatory";
  }
  if (/\b(?:arxiv|doi\.org|journal|university|research paper|study)\b/.test(text)) {
    return "research";
  }
  if (/\b(?:reuters|associated press|\bnews\b|newspaper|journalist)\b/.test(text)) {
    return "news";
  }
  if (/\b(?:financial|earnings|quarterly results|investor relations|market data)\b/.test(text)) {
    return "financial";
  }
  if (/\b(?:expert|analyst|analysis|think tank)\b/.test(text)) return "expert";
  if (/\b(?:official|press release|announcement)\b/.test(text)) return "official";
  return "other";
}

export async function fetchWithRetry(url, options) {
  const fetchImpl = options.fetchImpl ?? fetch;
  const sleep = options.sleep ?? ((milliseconds) => new Promise((resolve) => setTimeout(resolve, milliseconds)));
  let lastError;

  for (let attempt = 0; attempt < 2; attempt += 1) {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), options.timeoutMs);
    try {
      const response = await fetchImpl(url, {
        ...options.requestInit,
        signal: controller.signal,
      });
      if (attempt === 0 && options.retryStatuses.includes(response.status)) {
        await sleep(500);
        continue;
      }
      return response;
    } catch (error) {
      lastError = error;
      if (attempt === 0) {
        await sleep(500);
        continue;
      }
    } finally {
      clearTimeout(timeout);
    }
  }
  throw lastError ?? new Error("Upstream request failed");
}

export function requireSecret(value, name) {
  if (typeof value !== "string" || value.length < 8) {
    throw new Error(`${name} is not configured`);
  }
  return value;
}

export function cleanText(value) {
  return typeof value === "string" ? value.replace(/\s+/g, " ").trim() : "";
}

function parseDate(value) {
  if (typeof value !== "string" || !value.trim()) return null;
  const trimmed = value.trim();
  const isoDate = trimmed.match(/^(\d{4}-\d{2}-\d{2})(?:T|$)/);
  if (isoDate) return isoDate[1];
  const parsed = new Date(trimmed);
  if (Number.isNaN(parsed.getTime())) return null;
  return [
    parsed.getFullYear(),
    String(parsed.getMonth() + 1).padStart(2, "0"),
    String(parsed.getDate()).padStart(2, "0"),
  ].join("-");
}
