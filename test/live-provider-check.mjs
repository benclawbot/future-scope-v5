const proxyUrl = process.env.PROXY_URL ?? "http://127.0.0.1:8787";
const appToken = process.env.APP_AUTH_TOKEN;
const prompt =
  process.env.LIVE_TEST_PROMPT ??
  "Will United States grid-scale battery storage deployment exceed 30 GW annually by the end of 2028?";

if (!appToken) {
  console.error("APP_AUTH_TOKEN is required for the live provider check.");
  process.exit(2);
}

const requestId = crypto.randomUUID();
const startedAt = Date.now();
const response = await fetch(`${proxyUrl}/api/analyze`, {
  method: "POST",
  headers: {
    "Content-Type": "application/json",
    "X-App-Token": appToken,
    "X-Request-Id": requestId,
    Origin: "http://localhost:4173",
  },
  body: JSON.stringify({
    prompt,
    research_depth: "balanced",
    time_horizon_override: null,
    locale: "en-US",
  }),
});
const body = await response.json();

if (!response.ok) {
  console.error(
    JSON.stringify({
      ok: false,
      status: response.status,
      code: body.code,
      message: body.message,
      request_id: body.request_id ?? requestId,
      latency_ms: Date.now() - startedAt,
    }),
  );
  process.exit(1);
}

console.log(
  JSON.stringify({
    ok: true,
    request_id: body.request_id,
    analysis_id: body.analysis_id,
    domain: body.domain,
    sources_count: body.sources?.length ?? 0,
    evidence_items_count: body.evidence_items?.length ?? 0,
    outcomes_count: body.outcomes?.length ?? 0,
    probabilities_total_tenths: body.outcomes?.reduce(
      (sum, outcome) => sum + Math.round(outcome.display_probability * 10),
      0,
    ),
    insufficient_evidence: body.audit?.insufficient_evidence,
    latency_ms: Date.now() - startedAt,
  }),
);
