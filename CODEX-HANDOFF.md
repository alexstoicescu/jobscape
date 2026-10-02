# JobScape: Codex handoff

Prepared 2 October 2026. This package contains the source for the deployed beta, plus this guide and AGENTS.md. It contains no dependencies, build output, Git authentication tokens, or local execution profile. No application code was changed for this export.

## Current checkout

The user renamed the project to **JobScape** after the original export. Source and Git history now live at https://github.com/alexstoicescu/jobscape. Local setup, browser verification, and the three approved improvements are documented in README.md, QA.md, and REGISTRY.md. The creation evidence and constraints below describe the original beta and remain historical context.

The existing private deployment retains its original title and URL until publication is requested. Preserve `.openai/hosting.json` and its Site identity; a source/repository rename does not authorize publication or an audience change.

## Start here

1. Open the JobScape checkout folder containing package.json. For the original ZIP, that folder was named `role-radar`.
2. Start a new Codex chat in that project.
3. Use the starter prompt below. The included files supply the project context independently of conversation memory.

### Starter prompt

Read AGENTS.md, CODEX-HANDOFF.md, and README.md. Continue this existing JobScape project without rebuilding it. Set up the project with the pinned pnpm lockfile, run the type check, and start a local preview. Test the main search flow in a browser if available: keywords, title alternatives, location, remote filtering, ATS selection, partial-feed failures, result links, and Google search links. Fix any defects you find. Keep the existing private deployment intact. Then report what works, what remains unverified, and the three highest-impact improvements for broader search coverage. Do not implement the proposed new features until we choose the next step.

## Existing private publication (unchanged)

- Published title: Role Radar (original deployed version)
- Private URL: https://role-radar.st0icescu.chatgpt.site
- Sites project ID: appgprj_6abf8c8c334c8191b59398eb8d83ea22
- Published source commit: 134af601a63eb797a83befb38ff6696636d3c495
- Saved version: appgprj_6abf8c8c334c8191b59398eb8d83ea22~appgver_a319c5be9a688191b5b3ea3f88040aef
- Publication status was confirmed succeeded on 2 October 2026.

The original archive had no Git history or Git remote; the current checkout has both. These identifiers document the unchanged publication and are not credentials. The beta is separate from Alex's personal portfolio repository.

If Codex has the Sites plugin and the relevant account access, use the existing project ID and Sites workflow to open and publish the same Site. Do not assume that the plugin, authenticated account, or this Work conversation is available in a new Codex session. If Sites is unavailable, development can continue locally; decide on hosting separately before attempting publication.

## Why this exists

Alex struggles with ATS site searches and does not want to repeatedly edit Google queries. He requested a clean free website accepting role keywords and location, with results from company application pages. The reference was https://careerpowerup.com/find-hidden-remote-job-openings/.

The user liked the first version and requested moving the remaining development into Codex. No redesign or extra product features were requested in the migration turn.

## Implemented

- Job title or title keyword search.
- Alternatives separated by commas or OR. Every word within an alternative must occur in the title.
- Optional location filter with a few explicit country aliases.
- Remote-only toggle, based on provider flags and explicit location wording.
- Selection of 18 ATS platforms.
- Live normalized results from a registry of 36 employer boards on Greenhouse, Lever, and Ashby.
- Direct links to each company's application page.
- Alphabetical job-title sorting, company sorting, and latest available date sorting.
- URL-encoded search state; opening a search URL reruns it.
- Explicit loading, error, no-results, and unavailable-feed states.
- Generated combined and per-platform Google searches under All ATS searches.
- Responsive layouts, basic accessible labels and focus states, favicon, and site metadata.
- An optional browser WebMCP action, `search_ats_jobs`, registered only when supported.

## Core source

| File | Purpose |
| --- | --- |
| app/page.tsx | Search UI, tabs, results, source filters, and optional WebMCP action |
| app/globals.css | Cobalt blue and light neutral visual design and responsive layout |
| app/api/search/route.ts | Input-validated POST search route |
| lib/search.ts | Shared types, title/location matching, and Google query generation |
| lib/boards.ts | Employer registry, adapters, normalized listings, and in-memory cache |
| .openai/hosting.json | Existing Site ID and capability declarations |
| scripts/execution-profile.mjs | Uses portable mode when no local profile exists |
| vite.config.ts | Vinext and Cloudflare-compatible build integration |

## Setup

The snapshot was developed with Node 24.19.0 and pnpm 11.25.0. package.json requires Node >=22.13.0. Use a supported Node version and install pnpm 11.25.0 if it is not available.

From the extracted project root:

```sh
pnpm install --frozen-lockfile
pnpm exec tsc --noEmit
pnpm dev
```

The portable runner requests port 5173. Use the URL actually reported by the server. On Windows, run commands in the project directory in PowerShell or a supported terminal. Read package.json and the profile scripts if the local runtime differs; do not invoke the managed-linux bash build script directly on Windows.

Build with:

```sh
pnpm build
```

`npm run install:ci` expects a package-lock.json. This snapshot uses pnpm-lock.yaml, so use the pnpm install command above.

Local setup was not run on Windows or macOS in this handoff. Any installation or portable-runtime problem should be treated as a setup issue to verify and resolve in Codex.

## Evidence from creation

Completed:

- TypeScript type checking passed.
- Cloudflare-compatible build passed and deployed successfully.
- Title alternatives, mismatched locations, remote requirements, generated queries, and invalid inputs passed focused logic checks.
- Real public-feed checks returned 6,883 listings across 34 of the 36 registry entries. A remote search for `developer relations, developer advocate` returned 12 matching roles.
- Successful real-feed examples included Linear, Datadog, Notion, Canonical, Supabase, n8n, and GitLab. These are test-time observations, not guaranteed current listings.
- Snyk and Postman feeds were unavailable in the last check. Other boards can fail or migrate later.

Unverified:

- Actual browser rendering, keyboard operation, responsive layout, and complete browser interaction flow.
- Optional browser WebMCP registration, valid execution, and invalid-input behavior in a supported browser context.
- Search endpoint operation after publication was not independently exercised on the live private URL. Backend logic was exercised directly against real ATS feeds before deployment.
- Local installation and preview on Alex's Windows machine.

Do not describe these unverified items as passed.

## Current constraints

1. **Employer discovery is finite.** The APIs are company-scoped. Selecting Greenhouse does not search every Greenhouse employer. The registry is intentionally explicit.
2. **All ATS searches open Google.** Google results do not return inside this app. The free direct-feed experience and broader query links have different coverage.
3. **Geography is literal.** Germany will not necessarily match a listing labeled only Berlin or EMEA. Remote work eligibility is not inferred.
4. **Dates have different meanings.** Greenhouse's updated_at is shown as Updated. Published is used only where available from the provider.
5. **Cache is per server isolate.** Successful board responses are cached for ten minutes; cold isolates refetch. There is no database, scheduled indexer, or shared cache.
6. **Server fan-out is bounded by the registry.** Each selected board request has a nine-second timeout. The browser search request has a twenty-second timeout. Results are deduplicated by application URL and capped at 300 matches.
7. **Google queries have limits.** Very large combined site queries can reduce coverage. The per-platform query links provide a narrower alternative. Closed and unindexed jobs remain a search-engine limitation.
8. **Title matching is literal.** There is no semantic matching, abbreviation expansion, or job-description keyword search.
9. **Language eligibility is absent.** The app does not determine whether German is required. Alex's preference for English-speaking opportunities would be useful context for a future requested feature.

## Recommended next decisions

These are suggestions to discuss after setup and browser verification, not approvals to build them now.

1. Broaden employer coverage and add a maintained discovery/indexing mechanism. Measure active boards and actual accessible jobs before claiming global coverage.
2. Improve location and remote eligibility handling, including countries, regions, and clear unknown states.
3. Improve role matching and, if requested, distinguish listing language from required spoken language using actual job descriptions.

Keep source and coverage transparent. Never promise that direct ATS applications increase hiring odds or that every result is a hidden or newly posted role.

## Documentation

- https://docs.greenhouse.io/job-board.html
- https://github.com/lever/postings-api
- https://developers.ashbyhq.com/docs/public-job-posting-api
- https://learn.chatgpt.com/docs/projects
