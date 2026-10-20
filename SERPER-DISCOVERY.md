# Serper discovery: CTO handoff

This documents the PR #15 foundation. The separately stacked [Strict Global Remote feature](GLOBAL-REMOTE.md) supersedes its Global-only classification deferral; the foundation's configuration/release prerequisites still apply.

## Scope and dependencies

Branch `codex/serper-discovery` starts at `feat/dark-mode` (`a00b936`), PR #13, which depends on PR #12 (`feat/chrome-search-reader`). Review/merge order remains #12 → #13 → this PR. PR #14 is excluded: none of its experimental extractor changes are ancestors of this branch. No PR was merged or deployment changed.

`/` renders Serper only when the server flag is exactly `JOBSCAPE_DISCOVERY=serper`. Unset/other values preserve PR #13's existing extension homepage; they do not render a disabled Serper form. `/prototype` retains that extension interface; its logo returns to `/` with search parameters. This is flag selection, not a fallback after a failed Serper request: an enabled Serper failure remains an explicit error. Existing ATS adapters, `/api/search`, theme/CSS, regional mappings and hosting identity are preserved. No description retrieval or eligibility/language classification was added to the Serper flow. See [release-readiness review](SERPER-RELEASE-READINESS.md) for verified hosting/access status and the supported managed-D1 provisioning path.

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

**Deployment is blocked** until the release owner authorizes the managed storage declaration and hosted migrations. Sites supports logical `d1` bindings and provisions/connects them on publication. For this existing host, declare `d1: "SERPER_DB"` in the retained hosting manifest and package the ledger schema through its Drizzle migration workflow. Neither change/provisioning was performed. Currently the manifest is `null`, `db/schema.ts` is empty and the raw `db/serper.sql` is not included in the host's migration bundle. A standalone Cloudflare release could instead use a real `SERPER_D1_DATABASE_ID` plus explicit schema application, but that is not the confirmed managed Sites path. The committed UUID is only a local placeholder. Bind the same database to every instance consuming this budget. Install `SERPER_API_KEY` through Sites' secret environment configuration and explicitly set caps/flag. The current hosted environment has no configured entries. Preserve `.openai/hosting.json`'s Site identity and owner-only access. No build-time key is needed. All consumers of this key must share the budget or use separate keys; this application cannot cap external clients. Do not enable Serper on a paid/auto-recharging account as part of this change. See the release review for access and no-paid-call validation prerequisites.

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
