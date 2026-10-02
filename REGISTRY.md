# Employer registry maintenance

The registry is in `lib/registry.ts`. It includes verified boards on Greenhouse, Lever, Ashby, SmartRecruiters, Workable, and Personio. It is a finite list, not global ATS coverage. Each entry includes a source link to the employer's careers page or official hosted ATS board.

## Check health

```sh
node scripts/check-boards.mjs
```

This uses the actual adapters and saves a dated report in ignored `outputs/board-health.json`. It exits with code 1 when any board is unavailable, so it can be used as a maintenance check. A valid feed with zero listed jobs is healthy; review persistent empty feeds manually because employers can migrate. No background schedule or deployment is created by this command.

Search results also expose current board status, accessible listing counts, source links, checked times, and cache use in **Company board coverage**. HTTP 404 suggests checking for a migration; timeout alone is not evidence that the employer moved.

## Add or update a board

1. Follow the employer's official careers page to its public ATS board. Verify the employer name and application links, not just an assumed slug.
2. Verify the appropriate public JSON feed or enabled Personio XML with its documented shape. Hidden Ashby jobs must remain excluded. Do not add failures, speculative feeds, or leftover feeds after a verified migration. A disabled XML feed returning HTML is unavailable, not a healthy empty board.
3. Update the registry entry's platform, slug, name, and source. Replace the old entry when an employer migrates to prevent duplicate boards. Snyk's migration from Greenhouse to Ashby was verified on 2 October 2026.
4. Run the health check, regression checks, and type check. Inspect source URLs and live results before changing any coverage claims.

The current registry expansion adds Cockroach Labs, Fastly, LaunchDarkly, Netlify, Cursor, Resend, Modal, Railway, LangChain, Cohere, Baseten, and Docker. Their feeds responded on 2 October 2026. Postman's existing entry is retained and explicitly reported unavailable; a replacement feed was not verified.

Registry size is distinct from actual request cost. The shared adapter transport caps a search at 48 outbound requests, including redirects, pages, and details, and nine requests per employer. Providers are interleaved so a cold registry does not always starve later integrations. Fetches share a nine-second board deadline and a sixteen-second search deadline. Queue work that runs out of budget is explicitly unavailable; retrieved but bounded pagination/details are explicitly partial. Request concurrency is eight for title searches and four when descriptions are requested.

Responses are limited to 16 MiB per response and 64 MiB in total per search. These are received-byte limits, not a measurement of Worker heap. Cache estimates cap stored normalized text at 24 MiB. Large existing boards can exceed these limits and are reported unavailable rather than claiming they were fully scanned. Retry-After is honored within the current server isolate, with a default one-minute cooldown for HTTP 429. Cooldown state is not shared between isolates.

`node scripts/live-smoke.mjs all` measures real adapter requests, response bytes, elapsed time, estimated cache bytes, and Node heap change. `node scripts/live-smoke.mjs <provider> --descriptions` checks description retrieval. Reports stay in ignored `outputs/`; live availability is not a CI gate. Node heap observations do not establish production Cloudflare memory behavior.

Successful responses cache for up to ten minutes. The cache is bounded to approximately 24 MB of serialized text and may evict boards earlier; concurrent requests reuse in-flight loads. Greenhouse description requests use a separate cache entry. These limits protect the free Worker runtime and can produce explicitly partial results under slow feeds.

SmartRecruiters validation, bounds, and measured costs: [smartrecruiters.md](docs/validation/smartrecruiters.md).

Workable validation, geographic deduplication, empty-board evidence, and costs: [workable.md](docs/validation/workable.md).

Personio validation, official employer identities, excluded stale feeds, locale/XML behavior, and built-Worker evidence: [personio.md](docs/validation/personio.md).

Provider references: [Greenhouse](https://docs.greenhouse.io/job-board.html), [Lever](https://github.com/lever/postings-api), [Ashby](https://developers.ashbyhq.com/docs/public-job-posting-api).
