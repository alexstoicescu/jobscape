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

Pending manual reload of the unpacked extension. The new website reports that the
currently connected worker is an older revision. Browser automation cannot open
Chrome's protected extension settings. The user must reload the extension, then
refresh JobScape; no browser-security workaround will be attempted.

Planned fixed cases: Events = title mode, aliases on, Remote, EU, blank location,
all ATS. Developer Relations and Partnerships = title mode, aliases on, Remote,
All, blank location, all ATS. Three independent Search clicks per case. Each
trial must record the exact displayed query, observed source evidence, native
cards, distinct legitimate ATS URLs, elapsed time and failure classification.
Two successful cases must also verify visible next-page results, submitted-query
preservation, append/dedup, focus/scroll and owned-helper cleanup.

No nine-trial success rate or live reconnect/cleanup pass is claimed yet.
**NO-GO pending the required >=8/9 live acceptance gate. Keep the PR draft.**

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
