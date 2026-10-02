# Local verification, 2 October 2026

Read AGENTS.md, CODEX-HANDOFF.md, and README.md before changes. Continued the included React/TypeScript/Vinext source and preserved the approved light/cobalt interface.

## Setup and checks

- Node 24.15.0, satisfying the required >=22.13.0; pnpm 11.25.0.
- Frozen-lockfile installation succeeded. Windows had a separate pnpm launcher on PATH that rejected this checkout; the pinned executable worked.
- `pnpm exec tsc --noEmit` passed using the pinned executable. Direct TypeScript invocation also passed.
- `node scripts/search-checks.mjs` passed.
- Portable production build passed; no publication occurred.
- Local preview: http://127.0.0.1:5173/. Initial route returned HTTP 200.

## Browser and endpoint verification

- Real title searches with OR and comma alternatives, remote on/off, Germany and Europe location filters, platform selection, clearing/selecting all, and Enter submission.
- URL reload restored keywords, location, remote, and the chosen Ashby platform and reran the search.
- All-ATS combined and individual links preserved the query filters. A Google-only Workday selection showed the correct fallback and opened Google in a new tab. Google presented its own cookie-consent page; ranking and indexing coverage were not evaluated.
- A result link opened Linear's matching Developer Relations listing, showing the expected title, regions, and remote workplace type.
- Sorting controls worked; latest-date sorting showed descending dates. Pagination increased visible cards from 25 to 50.
- Browser WebMCP registration and valid execution worked. Invalid comma-only input was rejected.
- Invalid input produced an accessible form alert and HTTP 400 from the endpoint. No selected platforms disabled submission.
- Mobile 390x844 and desktop 1280x900 viewport checks showed no page-level horizontal overflow. Mobile's platform row intentionally scrolls horizontally. This was basic responsive QA, not a full accessibility or cross-browser audit.
- Final real-feed endpoint check: 6,884 listings across 34 of 36 boards; Snyk and Postman unavailable. The remote search `developer relations, developer advocate` returned 11 matches. Germany returned zero literal matches. These are test-time observations, not coverage or availability guarantees.
- Repeated searches reused the matching listings' checked timestamps. An Ashby engineer search returned 620 total matches, capped at 300 with `truncated: true`.
- Synthetic adapter regression checks verified explicit non-remote/hybrid flags, Remote enum handling, negated location wording, hidden listings, deduplication, successful-board caching, retries for failures, and all-feed failures. Synthetic data runs only inside the check process.

## Defects fixed

- Whitespace submissions previously failed silently in the browser. Added a form alert, including for invalid restored URLs. Comma-only and quote-only input is now rejected after term normalization.
- Location text could override explicit non-remote provider values. Structured workplace flags now take precedence, including Ashby's `Remote` enum spelling. Explicit negated remote wording no longer counts as remote in the fallback.
- Total feed failure previously looked like a successful zero-match search. It now has an unavailable heading, failed-board scope, and a Google-search fallback. Partial responses retain their partial-result warning.
- TypeScript incremental output is ignored so generated state cannot be accidentally tracked.

## Limits

- All-feed failure was tested in isolated adapter checks; the final outage UI was not exercised by forcing real provider outages. Real partial failures were exercised in the browser.
- Browser console inspection showed no errors. The development server emitted a React multiple-renderer warning after HMR and reload; no visible malfunction reproduced. A full framework investigation was outside these focused search fixes.
- The existing private deployment and its backend remain unverified in this session. Site identity and lockfile SHA-256 hashes match the initial snapshot. No deployment, audience, or credential changes were made.

## Improvements selected after the initial verification

1. Expand and maintain the employer registry, prioritizing relevant employers and tracking board health or ATS migrations. Show measured accessible coverage.
2. Normalize structured locations and region aliases, with explicit known/unknown remote eligibility. Preserve uncertainty when a provider lacks country data.
3. Add explicit title abbreviations and synonyms, followed by optional job-description keyword search. Label why a listing matches and keep spoken-language requirements separate from listing language.

Provider references: [Greenhouse Job Board API](https://docs.greenhouse.io/job-board.html), [Lever Postings API](https://github.com/lever/postings-api), and [Ashby Job Postings API](https://developers.ashbyhq.com/docs/public-job-posting-api).

## Follow-up implementation and verification

The user authorized all three improvements after the initial report. The earlier observations above describe the original 36-board beta; the following checks describe the improved local version.

- Expanded the registry to 48 boards with 12 verified additions. Corrected Snyk's Greenhouse-to-Ashby migration. Added source links, per-search board-health details, and `node scripts/check-boards.mjs` for a dated maintenance report. See `REGISTRY.md`.
- Added structured country fields, secondary locations, common country aliases, and curated city mappings. Multi-location boards keep their country alternatives. Country exclusions and foreign-country listings are not promoted into matches. Region/unspecified remote matches require explicit opt-in and carry unknown-eligibility labels.
- Added explicit title aliases, an option to disable expansion, optional description matching, field/term match explanations, and actual evidence snippets. Greenhouse content loads on demand; Lever lists and closing text are included. Description availability and the 12,000-character search limit are visible.
- All new options round-trip through the search URL and are accepted as optional WebMCP inputs. Old search URLs still use safe defaults: aliases enabled, descriptions disabled, uncertain geography excluded.
- Added bounded concurrency, a sixteen-second search fetch budget, in-flight request reuse, and a cache size cap to support the larger registry and descriptions on the free Worker path.
- Focused regression checks cover aliases on/off, qualified titles, description-only matches, country codes, Berlin/München mapping, regional/unknown distinctions, country exclusions, multiple locations, California/Canada ambiguity, hidden listings, partial/all feed failure, caching, date semantics, and on-demand Greenhouse content.
- Type checking and the portable production build passed. Real local API tests passed for strict vs broader geography, alias opt-out, cached health, working Snyk data, and Greenhouse description matching. A check reached 47/48 boards with 7,611 listings and Postman unavailable. A strict DevRel/Germany/remote search returned zero matches; opting into broader geography returned three regional matches. These are test-time observations.
- Real Greenhouse description search for `kubernetes` returned 554 matches across 4,656 searchable descriptions; 108 were longer than the search limit. Responses were capped at 300 and retained short previews plus actual match evidence.
- Browser tests verified the new controls, three regional uncertainty labels, alias match explanations, company coverage details, description evidence, restored description/alias settings, Google link generation, and mobile overflow checks. The original preview tab became unresponsive to browser inspection; a fresh tab in the same browser worked.
- Private Site identity and the pnpm lockfile remain unchanged. No deployment or audience changes were made. Production memory/performance at Cloudflare and a full cross-browser accessibility audit remain unverified.

## JobScape rename

- Updated the header, footer, page metadata, search favicon, package name, project instructions, and documentation to JobScape. Renamed the existing GitHub repository to `alexstoicescu/jobscape` and updated `origin`; repository visibility remains private.
- TypeScript and the focused search regression checks passed. Browser verification confirmed the JobScape header, footer, and document title in the existing local preview.
- The original ZIP folder name, published title, and deployment URL remain only as historical records in CODEX-HANDOFF.md. The private deployment and Site identity were not changed. The pnpm lockfile is byte-for-byte unchanged.
