# Strict Global Remote: CTO handoff

## Scope and dependency

`codex/strict-global-remote` is stacked on PR #15 at `d745f292e85e3baabec51c3e78b574e81a197995`. PR #15 is unchanged and remains the foundation; earlier dependencies remain #12 → #13 → #15 → this feature. PR #14 is excluded. No merge, deployment, infrastructure or secret changes.

Global now means **fully remote and explicitly open worldwide**, based on actual posting content. It no longer means a collection of remote jobs from different countries. The existing combined Google query is unchanged: one Serper request per explicit Search/Load more, with the same submitted keywords/platforms/region and durable request caps. Other regions/All remain discovery views. Selecting a different region takes effect on the next Search.

## Enforcement and evidence

For Global only, after organic URL/title validation, the server checks only the new current-page candidates. `lib/global-remote.ts` is independent of the older extension/snippet estimator, which is deliberately preserved. It reuses existing geography aliases/maps, the Posting type, and adapter text normalization. No registry lookup or board-wide feed retrieval is used.

The classifier requires complete readable posting content, affirmative remote evidence and a role-scoped worldwide statement (or explicit worldwide applicant-location metadata). Generic global companies, worldwide customers, company benefits, Google snippets/titles, jobLocation/HQ and missing applicant requirements do not establish worldwide hiring. TELECOMMUTE supports only remote work. Country/region allowlists, applicant-location requirements, residency/physical-location requirements, exclusions and mandatory office work veto Global. Conditional/unparsed scope remains Unverified. Pure timezone overlap is retained as a restriction/evidence without automatically becoming a country restriction; country limits on the same line still win.

The API's Global `results` array contains only `status: verified`. Separate `globalReview` entries preserve the current-page assessments and exclusion reasons. The UI independently filters its main cards and shows unique loaded counts for Verified Global, Restricted/not fully remote and Unverified, with separate disclosures for withheld candidates. Verified cards show source quotes, structured-field evidence, restrictions and check time. Individual work authorization, language requirements and active vacancy status are not verified. Zero verified results explicitly says it does not establish that no Global jobs exist.

Checks run as part of the manually initiated page request, not at startup, while typing, on region change, or in a background queue. Raw-result exhaustion still determines pagination; zero verified cards does not stop Load more. Previous PR #15 session responses without the strict policy marker are rechecked on replay without another Serper request, so cached unverified Global candidates cannot bypass the new gate.

## Reader, safety and bounds

`lib/posting-reader.ts` reads the original HTTPS ATS URL after validating the platform, posting shape and identity. Redirects are manual and limited to the same validated posting identity; cross-company/job/platform/custom-host, credentialed, non-HTTPS and nonstandard-port destinations are rejected before following. It sends no Serper credential, cookies or browser data to ATS sources.

Supported extraction is a single identifiable `JobPosting` JSON-LD description with its applicant requirements and work type. Supplemental inert visible page text can veto a claim but cannot create a positive claim. Script/style/form/navigation content is removed. Greenhouse has a bounded public **single-job** API fallback, using the existing adapter's content format and normalization; its generated API host/path are fixed to the validated board/job identifiers, and API redirects are rejected. [Greenhouse source contract](https://docs.greenhouse.io/job-board.html#retrieve-a-job).

Unknown remains the outcome for unavailable/verification pages, malformed/ambiguous structured data, unsupported SPA-only pages or redirects, short/truncated/incomplete content and exhausted read budgets. There is no JS renderer, browser extractor, crawler, new adapter or generalized scraping framework. Office addresses and country options on generic application forms are not applicant permission.

Bounds: 3 concurrent readers; 6 seconds per posting, including redirects/fallback; 18-second shared page deadline; 1 MiB per response; 8 MiB total page response budget; 40 ATS fetch attempts per page and at most 4 per posting; 80,000 characters each for description/supplemental text. Any unprocessed/over-limit candidate is Unverified. Serper's existing 15-second timeout remains separate. A Global page can therefore take roughly the provider time plus up to the reader deadline; no automatic retries occur.

The existing shared D1 cache stores bounded inert posting data, not executable HTML, under a distinct posting prefix. Complete reads cache for 10 minutes; failures for 2 minutes. Cache is shared across searches/instances. Existing page-response replay is rechecked when its strict evidence is over ten minutes old. This requires no new database schema beyond PR #15. Serper credits are unchanged; ATS HTTP and D1 cache operations increase. The private-ingress and provisioning blockers in PR #15 still apply; provider credit caps do not cap database/ATS traffic.

## Validation and observed limits

`node scripts/global-remote-checks.mjs` covers **47 classification fixtures**: explicit worldwide hiring; US/EU/EMEA restrictions; country allowlists; absent/generic eligibility; company/HQ marketing; hybrid/required office attendance; conflicting statements; exclusions; same-line timezone/country restrictions; metadata ambiguity; inaccessible/incomplete content. It also tests source/redirect/response/time bounds, 3-reader concurrency, posting caches, strict API response/counts, one unchanged provider query per page, deduplication, zero-match pagination, old-session replay and actual component rendering with deliberately mixed/stale card state.

**Final fixture results: 0 false positives across 40 non-Global cases; 11 intentionally Unverified cases; all 47 expected classifications pass.** Three short real-source restriction excerpts are retained as regression evidence. One same-line France-only/timezone regression exposed a false positive during development; the final classifier no longer uses the legacy estimator's timezone-line skip, and that case is locked down. Generic remote/HQ/title text cannot create a main Global card.

The finite live ATS-only check is reproducible with `node scripts/global-remote-live.mjs` (explicit manual execution only). [Actual observations](docs/global-remote-live.json): **8 real posting URLs, 10 ATS requests, 0 authenticated Serper requests, 4 Restricted, 4 Unverified, 0 Verified Global, 0 false positives**. The six original URLs come from the accepted benchmark; two additional adversarial source URLs came from public ATS lookups. This is a reader/classification probe, not a new live Google/Serper search benchmark.

| Source example | Observed outcome |
| --- | --- |
| [Chili Piper Events](https://jobs.ashbyhq.com/chilipiper/42b0d252-7407-4dd3-ab17-825be9599a7b) | Restricted: actual US/Canada hiring restriction, despite worldwide company/snippet language. |
| [Supabase DevRel](https://jobs.ashbyhq.com/supabase/a1320bbf-bfae-49a8-a1b7-12eeccaf39ca) | Restricted: US applicant metadata/role residency overrides global company benefits. |
| [June AI Field Marketing](https://jobs.ashbyhq.com/jobs.june-ai/9c3f6747-ba48-43be-a18b-257afffbf3a9) | Restricted: named applicant-country scope; not worldwide regardless of US/EU prose conflict. |
| [Customer.io Events EMEA](https://job-boards.greenhouse.io/customerio/jobs/8260218) | Restricted: UK/Ireland residency from the single-job description. |
| [Q.ANT DevRel](https://q-ant-gmbh.jobs.personio.de/job/2579395?language=en) | Unverified: the conservative identity check could not establish a single identifiable structured posting. Previously observed onsite requirements were not silently carried forward. |
| [CrowdStrike Field Marketing](https://crowdstrike.wd5.myworkdayjobs.com/en-US/crowdstrikecareers/job/Germany---Remote/Strategic-Field-Marketing-Manager--Remote--DEU-_R29931) | Unverified: no identifiable structured description; Germany/Remote in URL/title is insufficient. |
| [Interdependence AI Automation](https://job-boards.greenhouse.io/interdependence/jobs/5145926008) | Unverified: work-from-anywhere benefits did not explicitly establish worldwide applications for this role. |
| [Theoria Scrum Master](https://job-boards.greenhouse.io/theoriamedical/jobs/4632108008) | Unverified: original URL redirected outside the validated job. No destination was followed or inferred. |

No unambiguously eligible **real positive** posting was demonstrated in this sample. The positive inclusion branch is covered by controlled fixtures and the actual component renderer; it is not represented as live positive discovery. Unknowns are not counted as false positives or proof of absence. Full browser Search was not repeated because further authenticated Serper calls have not been approved. Browser inspection confirmed the preserved controls/theme and new explanatory text; actual mixed-result card isolation is checked by component rendering/API tests.

All 13 regression suites passed; project TypeScript and the production Worker build passed. Final focused checks cover the final classifier/renderer revision; the build retains Vinext's existing route-classification/timing notices. No dependencies or hosting declarations were changed.

## Release assessment

Ready for CTO review of the strict gate, with **no live-positive discovery/recall claim**. Deterministic English phrase coverage is intentionally conservative: many genuinely eligible jobs, alternate ATS templates, foreign-language terms and company-only worldwide policies remain Unverified. Known country/office contradictions are tested; finite fixtures cannot certify every possible natural-language restriction. Evidence is time-stamped cached source content, not a legal guarantee or vacancy freshness claim. A verified real positive and approved production/runtime validation remain release-validation gaps. PR #15's managed D1 migration/secret/access prerequisites continue to block deployment. No merge or deployment performed.
