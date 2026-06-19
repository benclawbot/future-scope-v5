import { createServer } from "node:http";
import { readFile } from "node:fs/promises";
import { extname, join } from "node:path";

const root = new URL("../", import.meta.url);
const port = 4173;

const server = createServer(async (request, response) => {
  const url = new URL(request.url, `http://${request.headers.host}`);
  if (url.pathname.startsWith("/api/")) {
    await handleApi(request, response, url);
    return;
  }

  const relativePath = url.pathname === "/" ? "index.html" : url.pathname.slice(1);
  try {
    const path = join(root.pathname.replace(/^\/([A-Za-z]:)/, "$1"), relativePath);
    const content = await readFile(path);
    response.writeHead(200, {
      "Content-Type": contentType(path),
      "Cache-Control": "no-store",
    });
    response.end(content);
  } catch {
    response.writeHead(404, { "Content-Type": "text/plain" });
    response.end("Not found");
  }
});

server.listen(port, "127.0.0.1");

async function handleApi(request, response, url) {
  setApiHeaders(response, request.headers["x-request-id"]);
  if (request.method === "OPTIONS") {
    response.writeHead(204);
    response.end();
    return;
  }

  if (url.pathname === "/api/health") {
    sendJson(response, 200, {
      ok: true,
      minimax_configured: true,
      research_enabled: true,
      research_provider: "minimax_native",
      server_time: "2026-06-18T12:00:00.000Z",
      version: "5.1.0-test",
    });
    return;
  }

  if (request.headers["x-app-token"] !== "test-token") {
    sendJson(response, 401, {
      code: "E_PROXY_AUTH",
      message: "A valid application token is required.",
      action: "open_settings",
      request_id: request.headers["x-request-id"],
    });
    return;
  }

  if (url.pathname === "/api/analyze") {
    const body = await readJson(request);
    if (!body.prompt?.trim()) {
      sendJson(response, 400, {
        code: "E_INPUT_INVALID",
        message: "prompt must be between 1 and 400 characters",
        action: "edit_input",
        request_id: request.headers["x-request-id"],
      });
      return;
    }
    sendJson(response, 200, createContractPayload(body.prompt, request.headers["x-request-id"]));
    return;
  }

  if (url.pathname === "/api/simulate/event-impact") {
    const body = await readJson(request);
    sendJson(response, 200, {
      event_label: body.event_label,
      event_date: body.event_date,
      impacts: {
        out_001: 0.45,
        out_002: -0.2,
        out_003: -0.1,
        out_004: 0.05,
      },
      explanations: {
        out_001: "The event supports faster deployment.",
        out_002: "The event weakens the steady-growth case.",
        out_003: "The event reduces the slowdown case.",
        out_004: "The event has a limited regional effect.",
      },
    });
    return;
  }

  sendJson(response, 404, {
    code: "E_INPUT_INVALID",
    message: "Route not found.",
    request_id: request.headers["x-request-id"],
  });
}

function createContractPayload(prompt, requestId) {
  const factorIds = [
    "market_momentum",
    "execution_quality",
    "competitive_pressure",
    "regulatory_pressure",
    "resource_availability",
    "technology_readiness",
  ];
  const coefficientRows = [
    [0.8, 0.6, -0.4, -0.3, 0.5, 0.7],
    [0.1, 0.2, -0.1, 0.2, 0.1, 0.2],
    [-0.5, -0.4, 0.4, 0.6, -0.3, -0.4],
    [0.2, 0.1, 0.3, 0.1, 0.2, 0.1],
  ];
  const titles = [
    "Deployment accelerates",
    "Growth remains steady",
    "Deployment slows",
    "Regional divergence",
  ];
  const probabilities = [42.4, 30.1, 17.6, 9.9];

  return {
    analysis_id: "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa",
    request_id: requestId,
    created_at: "2026-06-18T12:00:00.000Z",
    prompt,
    resolved_question: prompt,
    domain: "technology",
    time_horizon: {
      label: "24 months",
      start: "2026-06-18T00:00:00.000Z",
      end: "2028-06-18T00:00:00.000Z",
    },
    assumptions: [],
    research_provider: "minimax_native",
    research_summary: "MiniMax native research found eight decision-relevant sources.",
    coverage_gaps: [],
    sources: Array.from({ length: 8 }, (_, index) => ({
      id: `src_${String(index + 1).padStart(3, "0")}`,
      title: `Evidence source ${index + 1}`,
      url: `https://source${index + 1}.example/report`,
      canonical_url: `https://source${index + 1}.example/report`,
      domain: `source${index + 1}.example`,
      description: `A source describing deployment evidence ${index + 1}.`,
      extra_snippets: [],
      published_or_discovered_date: "2026-06-01",
      retrieved_at: "2026-06-18T12:00:00.000Z",
      source_type: ["official", "regulatory", "research", "news"][index % 4],
      quality_score: 0.82 - index * 0.02,
    })),
    evidence_items: Array.from({ length: 12 }, (_, index) => ({
      id: `ev_${String(index + 1).padStart(3, "0")}`,
      claim: `Observed evidence statement ${index + 1}`,
      source_ids: [`src_${String((index % 8) + 1).padStart(3, "0")}`],
      supports: [index % 2 === 0 ? "out_001" : "out_002"],
      opposes: [index % 3 === 0 ? "out_003" : "out_004"],
      strength: 0.7,
      quality_weight: 0.8,
      date: "2026-06-01",
      stance: index % 3 === 0 ? "opposing" : "supporting",
    })),
    contradictions: [
      {
        topic: "Interconnection constraints",
        claim_a: "Queue reform is accelerating approvals.",
        claim_b: "Project connection delays remain elevated.",
        source_ids: ["src_001", "src_002"],
        resolution: "unresolved",
      },
    ],
    staleness_warnings: [],
    factors: factorIds.map((id) => ({
      id,
      label: id
        .split("_")
        .map((word) => word[0].toUpperCase() + word.slice(1))
        .join(" "),
      value: 0.5,
    })),
    events: [
      {
        id: "evt_research_001",
        label: "Policy review milestone",
        date: "2027-03-01T00:00:00.000Z",
        kind: "research",
      },
    ],
    outcomes: titles.map((title, index) => ({
      id: `out_00${index + 1}`,
      rank: index + 1,
      title,
      description: `Evidence-grounded description for ${title.toLowerCase()}.`,
      category: ["positive", "neutral", "negative", "uncertain"][index],
      speculative: index === 3,
      impact: [0.84, 0.56, 0.72, 0.62][index],
      base_logit: [0.7, 0.35, -0.2, -0.55][index],
      current_probability: probabilities[index] / 100,
      previous_probability: probabilities[index] / 100,
      display_probability: probabilities[index],
      confidence: [0.81, 0.74, 0.67, 0.56][index],
      evidence_for: [`ev_00${index + 1}`],
      evidence_against: [`ev_00${((index + 1) % 4) + 1}`],
      factor_coefficients: Object.fromEntries(
        factorIds.map((factorId, factorIndex) => [
          factorId,
          coefficientRows[index][factorIndex],
        ]),
      ),
      factor_coefficients_explanation: Object.fromEntries(
        factorIds.map((factorId) => [
          factorId,
          `${factorId.replaceAll("_", " ")} changes this outcome's logit.`,
        ]),
      ),
    })),
    coverage_note:
      "These are the most decision-relevant outcomes identified from the evidence, not an exhaustive list of all imaginable futures.",
    base_rate_note: null,
    probability_model: {
      type: "logit_softmax",
      raw_probabilities: {
        out_001: 0.424,
        out_002: 0.301,
        out_003: 0.176,
        out_004: 0.099,
      },
      display_precision: 1,
    },
    confidence: { overall: 0.7, evidence_thresholds_met: true },
    audit: {
      insufficient_evidence: false,
      low_base_rate: false,
      contradictions_unresolved: 1,
      thresholds_met: true,
      candidate_sources_count: 20,
      final_sources_count: 8,
      evidence_items_count: 12,
      agent_latencies_ms: { A0: 30, A1: 40, A2: 60, A9: 35 },
    },
  };
}

function setApiHeaders(response, requestId) {
  response.setHeader("Content-Type", "application/json; charset=utf-8");
  response.setHeader("Cache-Control", "no-store");
  response.setHeader("X-Content-Type-Options", "nosniff");
  response.setHeader("X-Request-Id", requestId ?? "test-request-id");
  response.setHeader("Access-Control-Allow-Origin", "http://127.0.0.1:4173");
  response.setHeader(
    "Access-Control-Allow-Headers",
    "Content-Type, X-App-Token, X-Request-Id",
  );
  response.setHeader("Access-Control-Allow-Methods", "GET,POST,OPTIONS");
}

function sendJson(response, status, body) {
  response.writeHead(status);
  response.end(JSON.stringify(body));
}

function readJson(request) {
  return new Promise((resolve, reject) => {
    let body = "";
    request.setEncoding("utf8");
    request.on("data", (chunk) => {
      body += chunk;
    });
    request.on("end", () => {
      try {
        resolve(JSON.parse(body));
      } catch (error) {
        reject(error);
      }
    });
    request.on("error", reject);
  });
}

function contentType(path) {
  return (
    {
      ".html": "text/html; charset=utf-8",
      ".js": "text/javascript; charset=utf-8",
      ".css": "text/css; charset=utf-8",
      ".json": "application/json; charset=utf-8",
    }[extname(path)] ?? "application/octet-stream"
  );
}

process.on("SIGTERM", () => server.close());
process.on("SIGINT", () => server.close());
