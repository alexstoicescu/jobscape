# Chrome search retrieval reliability

20 October 2026. Architecture review PR 1 only. No deployment or merge.

## Branch and dependencies

`feat/chrome-retrieval-reliability` starts at `feat/dark-mode` commit
`a00b9368fc4fdee5fc62c100132b89a1b8f11d8d`. The PR base is `feat/dark-mode`.
Review order remains PR #12 (search), PR #13 (dark mode), then this PR.
The combined branch includes search fixes at `b8a73c9`; neither predecessor
is rewritten. The unrelated copy PR and untracked Arrakis app are preserved.

## Changes

- Stop requiring Chrome's complete-load event before reading Google. A target
  URL event allows immediate injection; the reader validates the actual
  document's exact query and offset and observes DOM construction for a bounded
  interval. Navigation budget: 12 seconds; DOM budget: 8 seconds. No new navigation
  or retry is initiated by observation.
- Organic candidates require visible linked headings, including accessible
  headings. Exclude known ad containers, navigation and image carousels. Never
  convert image titles or arbitrary ATS links into job cards.
- Distinguish navigation timeout/mismatch, unavailable document, consent,
  verification, slow document, unsupported/image-only layout and explicit empty
  messages. Failures retain the owned helper and pagination cursor. They are not
  successful zero-result searches.
- Keep one exact combined query. Validate actual next links; permit one offset
  attempt per click when none is exposed. Exclude earlier raw URL fingerprints
  from appended results and stop on repeated/empty raw pages, independent of title
  matches. Save state before closing only the owned helper.
- Expose source URL, organic/new ATS counts, elapsed time and paging mode in
  Retrieval details. Revision handshake detects an old loaded extension.

No query-builder, remote eligibility, language classification, description
reader or design changes. The known events/event-driven engineering semantic
false positive remains explicitly demonstrated in the title regression suite.

## TypeScript scope

JobScape's recursive `**/*.ts`, `**/*.tsx` and `**/*.mts` includes descended into
the untracked `arrakis-engine/` app, including its browser tests. That separate
app has its own package.json, dependencies, build script and tsconfig (including
only `web`). The earlier root check consequently reported four unrelated errors:
one HTMLSpanElement/request-body mismatch in `tests/browser/course-hierarchy.ts`,
two HTMLElement/SVGElement image-property errors in `typography.spec.ts`, and an
unknown state-update value in `web/connections.tsx`.

Root includes now enumerate JobScape-owned source directories and root config/type
files, retaining generated Next type directories. No Arrakis files, type options,
errors or own checking commands were changed. Its own errors remain its project's
responsibility. The production bundler continues following JobScape's imports.

## Before / after evidence

Baseline architecture-review observations, not a nine-trial benchmark:

| Case | Before |
| --- | --- |
| Events, remote EU, blank location, all ATS | Image block, zero conventional organic headings; parser failure. |
| Developer Relations, remote All, all ATS | 20-second complete-load timeout. |
| Partnerships, whole-page remote All | 10 native cards; Load more reached 20 distinct URLs. |

Additional diagnostic before this implementation: switching the exact Events
query through Google's visible Web control (`udm=web`) produced an explicit
did-not-match-any-documents message. This is evidence of a query/index/layout
limitation, not proof that an image parser could recover organic jobs. This PR
does not automatically switch views, weaken the query or count images as jobs.

## Automated validation

Passed once on this implementation:

- `node scripts/extension-checks.mjs`
- `node scripts/title-pagination-checks.mjs`
- `node scripts/region-discovery-checks.mjs`
- `node scripts/remote-eligibility-checks.mjs`
- `node scripts/search-checks.mjs`
- `node node_modules/typescript/bin/tsc --noEmit --incremental false`
- `node scripts/run-framework.mjs build` (local portable production build)

Fixtures cover immediate extraction while the tab is loading, exact query and
offset arguments, worker restart/reconnection, single-request guard, retained
failure cursor/helper, actual pagination links, offset attempts, raw-repeat stop,
cross-page deduplication, image/ad rejection, accessible/hidden headings and
consent/verification distinction. Existing posting behavior stays covered.
CI now also runs the extension and title/pagination suites.

The build completed with Vinext's existing static route-classification warning
and plugin-timing notices. It was not a deployed Worker check.

## Live Chrome acceptance

The user reloaded the extension. A fresh real Chrome JobScape page connected
to `retrieval-v2`. No subsequent page reload or Check connection action was
used between Search/Load more actions. All tests used the existing Chrome
profile, which was already signed in; a signed-out run is not established.

Fixed cases: Events = title mode, aliases on, Remote, EU, blank location, all
18 ATS. Developer Relations and Partnerships = title mode, aliases on, Remote,
All, blank location, all ATS. Every row's exact submitted query and native URLs
are recorded in [the machine-readable evidence](docs/evidence/chrome-reliability-2026-10-20.json).
These are independent Search clicks, not cached application responses.

| Trial | Google/source observation | Native cards / distinct ATS URLs | Time to usable results | Outcome |
| --- | --- | --- | --- | --- |
| Events 1 | Image block; independently inspected helper: zero organic headings, no consent/verification | 0 / 0 | None; failure observed within 10.326 s (upper bound including tool gap) | `unsupported_layout`; helper retained |
| Developer Relations 1 | DOM reader reported 10 organic entries; native ATS titles/links inspected | 10 / 10 | 2.960 s (worker: 1.860 s) | Extracted |
| Partnerships 1 | DOM reader reported 10 organic entries; two rejected by existing title validation | 8 / 8 | 2.296 s (worker: 1.444 s) | Extracted |
| Events 2 | Independently inspected image-only helper, zero organic headings, no consent/verification | 0 / 0 | None; exact terminal duration not captured | `unsupported_layout`; helper retained |
| Developer Relations 2 | Google redirected to `/sorry/index`; unusual-traffic text and reCAPTCHA iframe confirmed | 0 / 0 | None; verification error in 1.428 s | `verification`; helper retained |
| Events 3 | Not run after verification blocker | Not measured | Not measured | Blocked |
| Developer Relations 3 | Not run after verification blocker | Not measured | Not measured | Blocked |
| Partnerships 2 | Not run after verification blocker | Not measured | Not measured | Blocked |
| Partnerships 3 | Not run after verification blocker | Not measured | Not measured | Blocked |

Two extractions succeeded in five completed trials. Three failures already make
8/9 impossible, even if all remaining trials succeeded. The four remaining
Searches were therefore not issued after Google required verification. No CAPTCHA
was interacted with, no view/query/profile change used to evade it, and no retry
loop or replacement architecture was attempted.

Timing measures the Search click to the next observed ready state, including
browser-tool overhead; worker times are separately reported. Events 2's browser
locator wait expired before the application completed, so the same trial was
subsequently observed without issuing another Search. Its time to usable results
is correctly absent. The error ultimately appeared, rather than a stuck spinner.

Successful Google helpers closed too quickly for independent source screenshots.
Their organic counts come from the actual injected DOM reader, and their native
cards were separately inspected in Chrome. The ATS URLs are posting-shaped
original destinations, not invented fixture data; their current active status
was not independently checked. This is narrower evidence than a recorded visual
comparison of every Google organic row. A screenshot capture also timed out;
the committed evidence is DOM observations, not a screenshot claim.

### Pagination and preserved state

Both tests followed real Google next links with `start=10`, with no offset
fallback needed. Exact decoded `q` matched the submitted Boolean string.

| Search | Cards before / after | Distinct after | Scroll Y before / after | JobScape visible / helper closed | Elapsed |
| --- | --- | --- | --- | --- | --- |
| Developer Relations | 10 / 20 | 20 | 3237 / 3237 | Yes / yes | 2.556 s |
| Partnerships | 8 / 18 | 18 | 2635 / 2635 | Yes / yes | 1.394 s |

The original URLs remained in order and each appended page added ten new URLs,
without duplicates. Developer Relations form location was changed to Berlin and
region to US before Load more: both the displayed submitted query and Google's
next-page `q` remained the original All/blank-location query. Form values were
restored before the next independent Search. No automatic next-page request was
observed. Failed helpers were reused; successful helpers closed, while the
verification helper remains available for manual handling.

Fresh extension connections worked across the actual actions without Check
connection. A forced service-worker-idle/termination recovery was not verified.
Actual repeated/empty final pages and unavailable-page boundaries were not
reached before the stop condition; these retain fixture coverage only. The
live image layout was safely rejected, but its specific image-block detector
missed this markup and emitted the broader `unsupported_layout` classification.

### Recommendation

**NO-GO for continued investment in the extension as JobScape's primary search
mechanism under the current constraints. Keep PR #14 draft.** The load-completion
mitigation improves DevRel and both successful cases paginate correctly, but it
does not resolve image-only discovery, and Google imposed verification after a
small manual test set (five Searches plus two Load more clicks). This is a failed
gate, not 8/9 acceptance or a nine-trial completion claim. Do not proceed with
PR 2/3 or add workarounds on the strength of these two successful extractions.
Earlier diagnostic Google queries also used this profile. This is an observed
verification blocker during acceptance, not a controlled estimate of Google's
rate limit or proof that exactly seven requests always trigger verification.

CI `verify` passed for implementation head `10b10f0` on 20 October:
[run 39442428063](https://github.com/alexstoicescu/jobscape/actions/runs/39442428063).
Only evidence/documentation changes follow that tested implementation; passing
local checks were not rerun for this handoff.

## Limits and reload

Google can change markup, return image-only pages, omit selected domains, rewrite
its own results, demand manual consent/verification, delay indexing or retain
closed postings. Query preservation does not guarantee Google honors every
Boolean operator. The 20-card/page and 5,000 raw-URL session limits remain.
No completeness, freshness, active-role, semantic relevance or eligibility
guarantee is established by retrieval. Unsupported layouts deliberately fail.

Windows: run this branch with the existing `pnpm dev`, reload JobScape 0.2.0 at
`chrome://extensions` (same unpacked `G:\ATS job search\extension`), then refresh
`http://127.0.0.1:5173/`. The page must say Chrome extension connected. Search and
Load more reconnect per click; no Check connection step is required after idle.
