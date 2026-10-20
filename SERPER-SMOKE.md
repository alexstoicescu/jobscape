# Serper discovery validation, 20 October 2026

## Actual browser/Worker flow

Tested on `codex/serper-discovery`, based on PR #13, using the local Cloudflare Worker and real persistent D1 emulator at `http://127.0.0.1:5174/`. Searches were clicked in the in-app browser, with **no Chrome extension dependency**. All 18 ATS platforms selected, blank location, Prefer remote on, title aliases on, title mode, region All. The exact submitted queries, inputs, accepted URLs/titles, original page order, rejection/duplicate counts and usage snapshots are committed in [docs/serper-smoke.json](docs/serper-smoke.json). Snippets are rendered in the browser; they are omitted from this compact evidence export.

| Search | Page 1 cards | Page 2 new cards | Unique loaded cards | Raw organic entries | HTTP request times, including local D1 |
| --- | ---: | ---: | ---: | ---: | --- |
| Events / Field Marketing | 7 | 7 | **14** | 10 + 10 | 2.0 s / 1.2 s |
| Developer Relations / Developer Advocate | 8 | 9 | **17** | 10 + 10 | 3.0 s / 1.3 s |
| Partnerships / Ecosystem | 6 | 6 | **12** | 10 + 10 | 3.9 s / 1.6 s |

These are posting-shaped, title-matching discovery candidates, not manually verified relevant/active/eligible job counts. For example, the browser displayed [Stripe's Partner Marketing Manager, Online & Regional Events](https://job-boards.greenhouse.io/stripe/jobs/8175661), [Runpod's Developer Relations Engineer](https://jobs.ashbyhq.com/runpod/9026d3b8-b736-4bb4-b269-e0b60a7f51ef), and [Dropbox's Strategic Partnerships role](https://job-boards.greenhouse.io/dropbox/jobs/8048847). Original URLs are preserved. The source pages were not fetched for descriptions, geography or languages in this assignment.

Each second page was loaded with an explicit click. Browser DOM counts matched distinct card links (14/17/12), with no duplicate cards. The live raw pages happened to have zero cross-page duplicates; synthetic repeat/alias cases exercise actual deduplication in regression tests rather than claiming a live duplicate was observed. Repeating Partnerships Search and Load more hit the real D1 cache: 0 new API requests, the same 6→12 cards, 275/90 ms endpoint times.

While reading DevRel results, the form was changed to Berlin and EU **before** Load more. The loaded summary stayed All, the submitted query contained no Berlin, and the second page appended to the same results. The query/filters were not regenerated from edited controls. Load more retained focus and results/scroll; Events reported its focused Load more button and scroll position at 2,711 px after append. Light/dark toggles worked without changing cards; the original dark preference was restored. The narrow browser pane retained the existing responsive form/cards, not a redesigned layout. No claim of exhaustive accessibility/cross-browser testing is made.

## Consumption and observed defect

**6 successful authenticated Serper requests / 6 provider-reported credits**, no purchases or paid provisioning. Two earlier attempts failed locally because Cloudflare's runtime rejects `redirect: 'error'` before transport; they returned honest `provider_failed` errors, not zero results. The second attempt captured the exact runtime diagnostic. The implementation now uses supported `manual` redirect handling and rejects redirect responses without forwarding the credential. A regression assertion protects that option.

The D1 ledger conservatively retains **8 charged reservations** (6 successful plus those 2 failed attempts). Two additional cached pages reserve zero provider requests. Counting all potentially chargeable attempts gives **8/12**, below the authorized live request budget; there were no other direct Serper API diagnostics in this implementation run. Reported provider credits were read from the six responses, not independently reconciled against a new dashboard balance. Previous benchmark consumption is separate and was not replayed.

The local smoke configuration used search/daily/monthly/total caps of 3/12/12/12. Defaults documented for a normal preview are 4/20/200/2000. A production operator must budget below actual remaining free credits; this run did not purchase or enable paid usage.

## Baseline and limits

The accepted benchmark found 15/18/18 distinct manually role-relevant candidates across two combined Serper pages; its overall combined precision was 95%. This smoke delivered native UI cards through the actual server path rather than a standalone benchmark script. It uses the existing query builder unchanged apart from quote-aware alternative parsing. The benchmark broad query additionally included “work from anywhere”; current search still uses the approved existing remote/region wording. Conservative posting-route checks, exact title validation, normal search changes and that query difference mean **14/17/12 is not a controlled discovery-quality regression comparison**. This smoke does not re-score precision or revisit provider selection.

No geography/language validation, posting-active check, reader, fan-out, crawling or automatic pagination was added. All cards state Unknown for active status, remote/worldwide eligibility and required languages. Entirely repeated/empty raw pages and search caps are automated-test cases; the live test stopped after two pages rather than claiming full exhaustion. Alternative legitimate ATS URL shapes can be rejected; counts/warnings disclose omissions. Google coverage of every selected platform is not guaranteed. Domain/route validation does not independently verify direct employer relationships.

## Checks completed

- Project-scoped TypeScript: **PASS** (`node node_modules/typescript/bin/tsc --noEmit`).
- Existing regression suites: **PASS**, search, adapter, SmartRecruiters, Workable, Personio, extension, hiring-region, hiring-filter, remote-eligibility, region-discovery, title-pagination.
- New Serper suite: **PASS**, including three role categories, arbitrary quoted phrases/alternatives, unsupported/invalid/non-posting URLs, preserved original URLs, stable submitted query, duplicates, repeat/empty versus filtered pages, missing key/flag/store, provider timeout/auth/quota/malformed/error responses, cache, per-search/daily/monthly/lifetime limits and concurrent cap contention through two SQLite connections.
- Final production Worker build: **PASS**. Vinext reports its existing static route-classification limitation for `/` and `/prototype`, plus plugin timing notices. These are warnings, not a failed build or proof of deployment.
- Final diff and actual-key scans cover source/evidence/client/Worker build artifacts and the sanitized preview log. No dependency, registry, adapter, dark-theme CSS, hosting identity or existing PR changes are included.

**Release assessment:** ready for CTO review as an unchecked discovery preview. Deployment remains blocked until a real shared D1 binding/schema, Worker secret, free-credit budget, feature flag and host support are configured and verified. See [SERPER-DISCOVERY.md](SERPER-DISCOVERY.md). The existing private deployment is untouched. No merge or deployment performed.
