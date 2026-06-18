# Future Scope v5 — Test Report

Verification date: June 18, 2026

## Result

The application build, secure Cloudflare Worker proxy, controlled provider integration, and browser flows pass end to end. A separate live-provider smoke test reached the real MiniMax and Brave execution path, but could not complete because Brave returned HTTP 429 (`E_BRAVE_QUOTA`) for the supplied credential.

No credentials are included in the repository or packaged deliverables.

## Automated verification

- `npm run check`: passed. JavaScript syntax, CSP hashes, and the production-data guard all passed.
- `npm test`: passed, 38 tests across 7 files.
- `npm run test:e2e -- --reporter=line --workers=1`: passed, 14 browser tests.
- `npm audit --omit=dev`: passed with 0 vulnerabilities.
- `npx wrangler deploy --dry-run`: passed. The Worker bundle, variables, and rate-limit bindings were accepted.
- `git diff --check`: passed.

The controlled integration test starts local Brave and MiniMax contract services, invokes the real Worker `/api/analyze` route, executes stages A0 through A9, and validates the resulting forecast contract.

## Browser and visual verification

The empty state and all six analysis views were inspected at a 1440×1000 desktop viewport. Responsive tests cover 1280, 768, and 320 pixel widths, including every populated view at 320 pixels with no horizontal overflow.

Browser checks found no console warnings or errors. Accessibility coverage verifies named controls, heading order, keyboard tab navigation, visible evidence sources, reduced-motion behavior, and minimum token contrast.

## Live-provider smoke test

The live check successfully completed MiniMax stages A0 and A1 before Brave Search rejected retrieval with HTTP 429. The application mapped this response to `E_BRAVE_QUOTA` and returned a structured error with request ID `f8d37711-c886-492b-992e-c76eb81b0977` after 13,704 ms.

To complete this final external smoke test, configure a Brave Search credential with available quota in `.dev.vars`, then run:

```powershell
npm run test:live
```

The Cloudflare API token is not required for local development or provider testing. It is only needed when deploying or managing the Worker in a Cloudflare account.
