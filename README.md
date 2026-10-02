# JobScape

A free search interface for company-hosted job listings. React, TypeScript, Vinext, and a Cloudflare-compatible server route. No paid search service or model API is required.

## Chrome search prototype

The extension interface is the homepage at `/`; `/prototype` remains an alias using the same component without redirecting or dropping query parameters. It reuses the existing form styling, ATS definitions and combined Boolean query builder, and requests one Google results page through a minimal unpacked Chrome extension. Search reconnects on demand. Explicit Load more follows Google's saved next-page link for the submitted query and appends deduplicated results. Successful extraction saves pagination before closing only the extension-owned helper tab; manual-intervention failures retain it. It never falls back to the employer registry. The old registry UI is no longer exposed through user navigation; its backend remains intact.

See [extension setup, reload steps and limitations](extension/README.md). Description reading is deferred. Initial type checks, existing search regressions, extension boundary tests and JavaScript syntax checks passed on 2 October 2026. Real retrieval remains **unverified**: the initial Windows computer-use verification stopped before Search was clicked because the tool could not determine Chrome's current URL confidently enough to enforce its policy. Chrome testing of reconnect, pagination, focus and scroll is now reserved for the user. No alternate automation architecture was attempted.

The **Hiring region** filter offers All (default), Global remote, Unknown, EU, EMEA, APAC and US. Global remote requires explicit worldwide remote hiring evidence from a full-posting check with no conflicting geographic restriction. Unknown distinguishes unchecked from checked-but-inconclusive postings. Full findings override snippet estimates immediately, updating visible results/counts. Include unknown applies only to regional filters. Cards retain supporting quotes and country restrictions; employer HQ does not determine scope. Switching filters preserves loaded cards/pagination and never requests Google or descriptions. Definitions, mapping sources and limits are in [HIRING-REGIONS.md](HIRING-REGIONS.md).

## Product behavior

- Enter a title or title keywords, plus an optional location.
- Use commas or OR to search alternatives. All words within an alternative must occur in a listing title, or in the available description when **Search descriptions too** is enabled.
- **Include title aliases** expands explicit synonyms and abbreviations such as DevRel, SRE, QA, ML, UX, and software engineer/developer. Turn it off for literal matching. Each result explains which field and term matched.
- **Results in JobScape** selects supported live platforms, shows registered employer scope before searching, and counts only responding boards with results. **Search on Google** has a separate platform selection and opens external searches. Role, location, and filter options remain available when switching views.
- Live listings load public Greenhouse, Lever, Ashby, SmartRecruiters, Workable, and Personio feeds from a maintained registry of company boards.
- All ATS searches generate Google site queries for 18 platforms and open them in a new tab. They do not scrape Google or embed Google results.
- Search values are encoded in the page URL. Reloading a search URL runs that search again.
- Old URLs containing Google-only platforms explicitly explain their exclusion from live retrieval and offer the corresponding external links. Results distinguish unsupported sources, unregistered employers, unavailable/partial feeds, and searches with no matches.

## Coverage and limitations

The finite employer registry lives in `lib/registry.ts`. It is deliberately finite, not a global ATS index. APIs are company-scoped; they do not supply a global employer directory. Unavailable boards produce partial-result warnings rather than invented or stale jobs. **Company board coverage** shows current health, counts, sources, checked times, and cache use. See `REGISTRY.md` for the maintenance workflow and ATS migration checks.

Successful board responses are cached in memory for up to ten minutes, with earlier eviction possible under the 24 MB cache budget. Cache survives only for the current server isolate. Searches use bounded concurrency, a nine-second timeout per board, and a sixteen-second overall fetch budget. No API key is required. Live results are deduplicated by application URL and capped at 300 matches.

Location searches normalize provider country/address fields, common country aliases, and a curated set of cities. A Germany search can now match Berlin or München. This mapping is intentionally limited and does not infer residency, visa, or remote-work eligibility. By default, country searches require a listed-country or mapped-city match. Opt into **Include regional or unspecified remote locations** to include regional matches such as EMEA or remote listings without geography. These are labeled with unknown country eligibility; explicit foreign-country locations stay excluded. Remote detection respects provider flags and explicit location wording.

Description search fetches Greenhouse content only when requested, retrieves bounded SmartRecruiters details, and uses available Lever, Ashby, Workable, and Personio text. It searches up to 12,000 normalized characters per description and reports missing/truncated coverage. Cards show actual evidence snippets while responses keep previews small. It does not determine listing language, required spoken language, or hiring eligibility. Greenhouse dates remain Updated; available provider publication dates remain Published. Personio creation dates are not displayed as publication dates. See the provider evidence linked from `REGISTRY.md` for measured coverage and bounds.

Google indexing can omit active roles and retain closed roles. Custom employer domains and companies beyond the registry may not appear in the all-ATS queries. Large combined Google queries can yield less coverage than individual platform searches.

## Structure

- `app/page.tsx`: primary search interface and optional browser WebMCP search action.
- `app/api/search/route.ts`: validated same-origin search endpoint.
- `lib/search.ts`: shared input validation, matching, and query generation.
- `lib/boards.ts`: adapters, health reporting, timeouts, normalization, and cache.
- `lib/registry.ts`: maintained employer entries and source/feed URLs.
- `lib/geography.ts`: country/city/region normalization and explicit unknown states.
- `scripts/check-boards.mjs`: live maintenance report.

## Local development

Use Node >=22.13.0 and pnpm 11.25.0 with the existing lockfile:

```sh
pnpm install --frozen-lockfile
pnpm exec tsc --noEmit
pnpm dev
```

The portable preview requests port 5173; use the URL printed by the server. `pnpm build` builds the Worker without publishing it. `node node_modules/typescript/bin/tsc --noEmit` also checks types. `node scripts/search-checks.mjs` runs focused regression checks with isolated synthetic feed responses; the app always uses real public feeds.

On Windows, check `pnpm --version` before installing. A separate older pnpm launcher on PATH can fail with `packages field missing or empty`. Invoke the verified 11.25.0 executable directly or correct PATH; preserve the project lockfile. `node scripts/run-framework.mjs dev` and `node scripts/run-framework.mjs build` directly run the same portable scripts if the pnpm launcher is unavailable.

Local setup, type checking, production build, and browser QA were completed on Windows on 2 October 2026. See `QA.md` for tested flows, observed coverage, fixes, and remaining limits. The private deployment was not changed or independently tested.

## Repository and checks

Source is maintained in the private repository [alexstoicescu/jobscape](https://github.com/alexstoicescu/jobscape). The initial commit records the current local version; the ZIP did not include earlier Git history.

The Checks workflow runs a frozen-lockfile install, TypeScript checks, focused search regressions, and the portable Worker build on pushes to `main` and pull requests. It uses Node 24.15.0 and pnpm 11.25.0. Live board health is checked manually because provider availability changes independently of source changes.

Use a feature branch and a pull request for subsequent changes. Dependencies, local runtime state, build outputs, QA reports in `outputs/`, and environment files are ignored. `.openai/hosting.json` retains the existing private Site identity. There is no deployment workflow; pushing source does not publish the Site.

## Sources

The Chrome interface at `/` and its `/prototype` alias supports combined Google search, explicit pagination, local region filters and per-result full-posting remote checks. Setup and reload steps are in [extension/README.md](extension/README.md); real posting evidence and remaining manual Chrome checks are in [REMOTE-ELIGIBILITY.md](REMOTE-ELIGIBILITY.md). The registry backend is preserved.

- https://docs.greenhouse.io/job-board.html
- https://github.com/lever/postings-api
- https://developers.ashbyhq.com/docs/public-job-posting-api
- Inspiration: https://careerpowerup.com/find-hidden-remote-job-openings/
