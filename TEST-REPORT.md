# Future•Scope Test Report

Verification date: June 19, 2026

## Result

Future•Scope 5.1 uses MiniMax native research through the mandatory Cloudflare Worker, returns validated source-grounded analysis, and preserves deterministic probability simulation. No credentials or production forecast fixtures are included in the repository.

## Automated verification

The release gate is:

```powershell
npm run check
npm test
npm run test:e2e
npm audit --omit=dev
npx wrangler deploy --dry-run
```

Static checks validate JavaScript syntax, browser-normalized CSP hashes, the absence of production forecast fixtures, and complete retirement of the previous research integration.

All 44 unit and integration tests pass. They cover provider retries, JSON repair, MiniMax research contracts, source normalization and classification, A0 through A9 orchestration, confidence caps, probability math, validation, authentication, CORS, rate limits, Worker routes, and structured errors.

All 14 browser tests pass. They cover the honest empty state, minimal Settings dialog, orbital brand, all six populated views, source-type donut, explicit supporting/opposing/neutral statements with named sources, exact factor colors, rounded shared-trunk SVG tree links with ports and arrowheads, draggable timeline events, deterministic recalculation, keyboard navigation, reduced motion, persistence boundaries, and responsive layouts from 320px upward.

The dependency audit reports zero production vulnerabilities, and the Cloudflare Worker dry run packages 58.82 KiB uncompressed and 14.71 KiB gzip.

## Live provider check

`npm run test:live` sends a real analysis request through a configured Worker. It requires `APP_AUTH_TOKEN` and a Worker with `MINIMAX_API_KEY`. Its output is transient and must not be committed.

The Cloudflare API token is required only for deployment or Worker-account management.
