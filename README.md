# Future•Scope V5

Future•Scope is a live-only, source-grounded forecasting workspace. It begins empty, researches a bounded question through Brave Search, uses MiniMax agents to structure evidence and outcomes, and recalculates probabilities through one deterministic logit/softmax engine.

## What is included

`index.html` is the complete browser application with embedded CSS and JavaScript. `proxy/worker.js` is the Cloudflare Worker entry point. The proxy owns provider credentials, app authentication, rate limiting, validation, error mapping, request IDs, security headers, and structured logs.

The seven screenshots from the supplied V5 document were used only as layout references. No visible scenario from those screenshots is present in production code or initial state.

## Local setup

Install the exact locked dependencies:

```powershell
npm ci
```

Copy `.dev.vars.example` to `.dev.vars`, replace the placeholders, and keep that file uncommitted. Generate two independent random values for `APP_AUTH_TOKEN` and `IP_HASH_PEPPER`; for example:

```powershell
[Convert]::ToBase64String([Security.Cryptography.RandomNumberGenerator]::GetBytes(32))
```

Start the Worker:

```powershell
npm run dev
```

Serve `index.html` from an HTTP origin such as `http://localhost:4173`, then set `ALLOWED_ORIGIN` in `wrangler.jsonc` to the exact frontend origin. Open Settings in Future•Scope, enter the Worker URL and the same `APP_AUTH_TOKEN`, then choose **Save and test**.

The app token is not a Brave, MiniMax, or Cloudflare account credential. It is a gate between the browser and this proxy so an arbitrary visitor cannot spend the configured provider quota. It remains in browser memory and is intentionally not stored in localStorage.

## Verification

```powershell
npm run check
npm test
npm run test:e2e
npm audit --omit=dev
npx wrangler deploy --dry-run
```

The browser suite uses a controlled local upstream contract server. It verifies the complete application flow without placing generated forecast data in production source.

## Keyboard order

The primary order is brand-independent and task-first: forecast question, research depth, Analyze, Export when available, Settings, view tabs, factor sliders, event controls, evidence filters and source links. Dialog focus begins at the first editable field and returns to the invoking control when closed. Arrow keys move between enabled view tabs; Home and End move to the first and last tabs.

## Deployment

Deploy the Worker only after adding Cloudflare secrets:

```powershell
npx wrangler secret put BRAVE_SEARCH_API_KEY
npx wrangler secret put MINIMAX_API_KEY
npx wrangler secret put APP_AUTH_TOKEN
npx wrangler secret put IP_HASH_PEPPER
npm run deploy
```

Publish `index.html` and `_headers` on a static HTTPS host. Set `ALLOWED_ORIGIN` to that exact origin. The two rate-limit namespace IDs in `wrangler.jsonc` are application-defined integers and must remain unique within the Cloudflare account.

## Credential safety

Never commit `.dev.vars`, `.env`, provider keys, Cloudflare API tokens, or app tokens. Rotate any credential pasted into chat, issue trackers, logs, or terminal transcripts before production use.

## Current provider contracts

The implementation was verified on June 18, 2026 against the official MiniMax OpenAI-compatible API and Brave Web Search API. MiniMax uses `MiniMax-M3` at `https://api.minimax.io/v1/chat/completions` with Bearer authentication. Brave custom freshness ranges use `YYYY-MM-DDtoYYYY-MM-DD`.
