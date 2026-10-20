# Strict Global Remote: CTO handoff

## CTO review correction: 20 October 2026

Both reported Berlin descriptions reproduced as **Verified Global before this correction**. Both now return **Restricted**, with the local residency condition retained as evidence. The correction handles explicit applicant/resident-only conditions, mandatory residency and commuting-distance residence without needing a city dictionary. Unresolved local/geographic requirements remain Unverified. Ordinary office/HQ addresses and optional city/country preferences do not veto an otherwise explicit worldwide role. This is a bounded English-pattern correction, not a general location-language parser.

The page classification marker is now `strict-global-v2`. Fresh v1 responses are reclassified from cached posting content before replay, with no new Serper request. A regression test specifically prevents a formerly verified Berlin-only cached card from surviving the policy upgrade. The posting-content cache itself remains usable.

### Real positive through the actual reader and classifier

[a2z Radiology AI: ML Research Engineer / Scientist (Remote, international)](https://jobs.ashbyhq.com/a2zradiology/fb1c1cbf-4b0a-465c-aa27-0a61c3c6ab71) was read directly on **2026-10-20 at 21:18:35 UTC**, through `readPosting`, then `strictGlobal`. The reader identified the actual JobPosting JSON-LD and extracted 3,620 description characters. Source evidence: **“Eligibility: Open to candidates worldwide; this role is fully remote.”** The posting also declares TELECOMMUTE; applicant-location requirements are empty, which is not treated as worldwide permission. No mandatory country/residency/office restriction was found in the full extracted posting. Final outcome: **Verified Global; restrictions: []**. This is stated posting evidence, not a legal eligibility or vacancy-freshness guarantee.

The initial read exposed a conservative false negative: splitting at the semicolon separated the explicit eligibility label from the role clause. The classifier now accepts the exact affirmative posting label `Eligibility: Open to applicants/candidates worldwide`, independently requiring remote proof and applying every existing country/residency/office veto. Conditional labels, generic company labels, snippets and supplemental context cannot establish a positive. Regressions cover the label alone without remote proof, conditional/company wording, and Berlin/US conflicts overriding it. No marketing-only inference was added.

[Recorded reader/classifier observations](docs/global-remote-cto-live.json) include the source URL, timestamps, latency, extracted quote, description hash, metadata, status and restrictions. The bounded investigation used **5 candidate ATS URLs / 6 direct ATS HTTP requests**, including one final positive validation after the parser correction, and **0 Serper requests**. One source is Verified; four remain Unverified because the reader could not identify a full structured posting. No fallback, reader expansion or access retry was added. Search-engine lookup text was used only to locate candidate URLs, never as classifier evidence.

### Usability and final checks

The actual component renderer confirms that Restricted and Unverified each retain a separate disclosure with original posting links and reasons; main cards contain only Verified entries and visibly include the actual eligibility quote. With zero verified cards, the absence disclaimer remains visible and Load more stays enabled whenever new raw provider results permit pagination. API tests confirm the same zero-match behavior, unchanged query, deduplication and v1 replay invalidation. These are controlled component/API checks; no fresh live browser Search or Serper request was made.

Final focused checks passed: **69 classification fixtures, 0 false positives across 55 non-Global fixtures, 16 intentionally Unverified fixtures**, three restricted real-source excerpts and one positive excerpt, full reader/bounds/cache/API/renderer tests; Serper foundation regression checks; project-scoped TypeScript; production Worker build. Vinext retains its existing route-classification/timing notices. The earlier all-suite and live-eight-source results below describe the initial PR revision, not a new full-suite run for this correction.

**Merge recommendation: GO for CTO review and merge after final-revision CI is green**, subject to accepting conservative English/template coverage and finite-test limitations. This does not authorize a merge. **Production release: NO-GO** until PR #15's managed D1 schema/binding, runtime secret/caps, atomic quota validation and private-ingress prerequisites are satisfied. PR #15 remains unchanged at `d745f292e85e3baabec51c3e78b574e81a197995`. No merge or deployment performed.

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

## Initial revision validation and observed limits

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

No unambiguously eligible **real positive** posting was demonstrated in that initial eight-source sample. The CTO follow-up above subsequently demonstrated one real positive through the actual reader and classifier. Unknowns are not counted as false positives or proof of absence. Full browser Search was not repeated because further authenticated Serper calls have not been approved. Browser inspection confirmed the preserved controls/theme and new explanatory text; actual mixed-result card isolation is checked by component rendering/API tests.

All 13 regression suites passed; project TypeScript and the production Worker build passed. Final focused checks cover the final classifier/renderer revision; the build retains Vinext's existing route-classification/timing notices. No dependencies or hosting declarations were changed.

## Release assessment

Ready for CTO review of the strict gate, with one directly verified real positive and **no measured discovery/recall claim**. Deterministic English phrase coverage is intentionally conservative: many genuinely eligible jobs, alternate ATS templates, foreign-language terms and company-only worldwide policies remain Unverified. Known country/office contradictions are tested; finite fixtures cannot certify every possible natural-language restriction. Evidence is time-stamped cached source content, not a legal guarantee or vacancy freshness claim. Approved production/runtime validation remains outstanding. PR #15's managed D1 migration/secret/access prerequisites continue to block deployment. No merge or deployment performed.
