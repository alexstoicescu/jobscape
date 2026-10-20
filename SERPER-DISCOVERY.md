# Serper discovery: CTO handoff

## Scope and dependencies

Branch `codex/serper-discovery` starts at `feat/dark-mode` (`a00b936`), PR #13, which depends on PR #12 (`feat/chrome-search-reader`). Review/merge order remains #12 → #13 → this PR. PR #14 is excluded: none of its experimental extractor changes are ancestors of this branch. No PR was merged or deployment changed.

`/` now renders the Serper interface behind the server flag `JOBSCAPE_DISCOVERY=serper`. Disabled means a visible disabled preview, never an automatic registry/Chrome fallback. `/prototype` retains the previous extension interface for comparison; its logo returns to `/` with search parameters. Existing ATS adapters, `/api/search`, theme/CSS, regional mappings and hosting identity are preserved. No description retrieval or eligibility/language classification was added to the Serper flow.

## Configuration on Windows

Use the installed Node >=22.13 and pinned pnpm 11.25.0. No new dependencies are required. Keep the existing key in ignored `.env.local`; the Cloudflare preview loads it server-side. Add these **non-secret settings** alongside it:

```dotenv
JOBSCAPE_DISCOVERY=serper
SERPER_SEARCH_LIMIT=4
SERPER_DAILY_LIMIT=20
SERPER_MONTHLY_LIMIT=200
SERPER_TOTAL_LIMIT=2000
```

`SERPER_API_KEY` must be present in that file or the Worker secret environment. Never prefix it with `VITE_`/`NEXT_PUBLIC_`, paste it into commands, or commit it. Never configure paid auto-upgrades. The flag is off by default. Numeric caps may be lowered to zero to block new provider requests; malformed values fail closed. Hard upper bounds are 10 pages/search, 1,000 daily, 2,500 monthly/total. Configure caps below remaining **free** credits, accounting for other clients using the key.

Initialize only the local D1 emulator, then start the preview:

```powershell
node --import ./scripts/sites-env.mjs ./node_modules/wrangler/bin/wrangler.js d1 execute SERPER_DB --config wrangler.serper.jsonc --local --persist-to .wrangler/state --file db/serper.sql
node scripts/run-framework.mjs dev
```

Open the printed local URL (normally `http://127.0.0.1:5173/`). Restart the server after changing configuration; refresh the website. No extension reload or installation is needed. Restoring URL parameters does **not** submit a search. Click Search explicitly. Region/form edits affect the next Search; Load more uses the saved session.

## Durable limits and deployment blocker

D1 is the smallest suitable existing-stack mechanism: SQLite is already compatible with the Cloudflare runtime, and the repository already has D1 types/integration support. KV/isolate counters cannot atomically reserve a global spending slot. No database/account was provisioned. Official references: [D1 prepared statements](https://developers.cloudflare.com/d1/worker-api/prepared-statements/), [transactional batches](https://developers.cloudflare.com/d1/worker-api/d1-database/), [D1 free-plan allowances](https://developers.cloudflare.com/d1/platform/pricing/).

The endpoint uses one conditional INSERT to reserve a page before calling Serper. That same write checks daily/monthly/total/per-search caps and a unique `(session,page)` constraint across all instances sharing the database. UTC boundaries apply. Reservations are conservative request counts, not a provider balance: failed/time-out calls count, and are never refunded. One successful Serper page normally costs one credit; the provider's reported credits are returned separately. No retries/fan-out occur. A failed reserved page requires a new Search; successfully repeated page requests return their stored response. A concurrent duplicate returns an explicit conflict without another provider call.

Identical query/page results are cached in D1 for ten minutes, across instances. A cached page incurs zero new provider requests, but still observes the search page limit. Session/query/pagination state expires after one hour. Successful requests opportunistically delete expired sessions/cache and clear old response payloads. Reservation metadata stays to enforce the lifetime cap; no IPs/accounts are stored. Operational storage retention may extend until the next successful request; counters must not be deleted/reset while reusing the same credit budget.

Missing/unavailable/uninitialized D1 fails closed, including during database errors. There is no in-memory spending fallback. Aborted browser requests may still complete upstream and consume a reserved slot. Usage is visible in result summaries and can be inspected with:

```sql
SELECT day, month, COUNT(*) AS reserved_pages, SUM(charged) AS reserved_provider_requests
FROM discovery_requests GROUP BY day, month;
```

**Deployment is blocked** until the release owner provisions/authorizes one real D1 database, runs `db/serper.sql` remotely, and supplies its ID as `SERPER_D1_DATABASE_ID` when building the Worker (or an equivalent real binding injected by the hosting control plane). The committed UUID is a local-only placeholder, not a usable production database. Bind the same `SERPER_DB` to every instance/environment consuming this budget. Install `SERPER_API_KEY` as a Worker secret and explicitly set the flag/caps in the deployment environment. Keep `.openai/hosting.json` and the current private Site identity intact. Confirm the chosen host can supply that binding; no hosting support is assumed. No build-time key is needed or serialized into production artifacts. All consumers of this key must share the budget or use separate keys; this application cannot cap external clients. Do not enable Serper on a paid/auto-recharging account as part of this change.

## Search contract and limits

- One combined query per Search and one page per explicit Load more. Existing ATS domains and the regional query builder are reused. Arbitrary input/quoted alternatives are retained; quoted commas/OR are literal phrase text. More than eight alternatives is explicitly rejected rather than silently truncated. Existing alias expansion and title validation remain; whole-page search stays opt-in.
- Only `organic` entries are accepted. No ad/image/knowledge-panel extraction. HTTPS, selected domain membership and known posting-shaped routes are required; company board roots are excluded. The original application URL is preserved; a separate provider/posting identity handles tracking and Workday locale duplicates. No employer allowlist is consulted.
- Conservative URL patterns can omit legitimate new/alternate ATS route formats; rejected entries are counted and warned about. Domain/posting shape is not proof of a live vacancy, direct employer relationship or relevance. No posting is fetched in this phase.
- Empty or entirely repeated **raw** results stop pagination. Zero accepted/title-matching cards does not imply exhaustion. The per-search page cap explicitly states that more results may exist. Only submitted query state is used on later pages, never provider next-links or edited controls.
- The UI shows every accepted result as an unchecked candidate. Active status, Germany/worldwide remote eligibility and required languages remain Unknown regardless of snippets or region hints. Existing semantic title limitations (e.g. event-driven engineering) remain deliberately out of scope and have a regression fixture.
- Non-JSON/malformed/missing-organic responses, timeout (15 seconds), authentication, provider credits/rate limit, internal caps and storage/configuration failures are explicit errors. Errors are never converted to empty job results. No automatic retry, startup searches, polling, prefetching or API-key requests from the browser.

## Validation and release readiness

See `SERPER-SMOKE.md` for authenticated smoke-test evidence and consumption. Provider-mocked tests use real SQLite statement execution with two database connections to prove shared cap/duplicate behavior; Cloudflare D1 itself is also exercised by the browser smoke test. No mocked listings enter the application.

The project TypeScript scope now names JobScape source directories rather than recursively including a separate untracked `arrakis-engine/` app. No Arrakis source/errors were modified or suppressed within its own project. This is the same scope correction justified by the previous review, implemented independently rather than merging PR #14.

Commands: `node scripts/serper-checks.mjs`, existing `*-checks.mjs` regression suites, `node node_modules/typescript/bin/tsc --noEmit`, `node scripts/run-framework.mjs build`. CI adds Serper tests to the existing workflow. Build warnings/observed failures and final results belong in the smoke evidence and PR description.

Ready for CTO review as a discovery preview when those checks pass. **Not ready to deploy** until the real durable binding, secret, free-credit budget and hosting support are verified. No claim of Germany/English eligibility or exhaustive ATS coverage is authorized. No merge or deployment performed.
