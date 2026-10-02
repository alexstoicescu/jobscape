# Employer registry maintenance

The registry is in `lib/registry.ts`. It currently includes 48 boards on Greenhouse, Lever, and Ashby. It is a finite list, not global ATS coverage. Each entry includes a source link to the employer's careers page or official hosted ATS board.

## Check health

```sh
node scripts/check-boards.mjs
```

This uses the actual adapters and saves a dated report in ignored `outputs/board-health.json`. It exits with code 1 when any board is unavailable, so it can be used as a maintenance check. A valid feed with zero listed jobs is healthy; review persistent empty feeds manually because employers can migrate. No background schedule or deployment is created by this command.

Search results also expose current board status, accessible listing counts, source links, checked times, and cache use in **Company board coverage**. HTTP 404 suggests checking for a migration; timeout alone is not evidence that the employer moved.

## Add or update a board

1. Follow the employer's official careers page to its public ATS board. Verify the employer name and application links, not just an assumed slug.
2. Verify a JSON response from the appropriate public feed with the documented array shape. Hidden Ashby jobs must remain excluded. Do not add failures or speculative feeds as verified additions.
3. Update the registry entry's platform, slug, name, and source. Replace the old entry when an employer migrates to prevent duplicate boards. Snyk's migration from Greenhouse to Ashby was verified on 2 October 2026.
4. Run the health check, regression checks, and type check. Inspect source URLs and live results before changing any coverage claims.

The current registry expansion adds Cockroach Labs, Fastly, LaunchDarkly, Netlify, Cursor, Resend, Modal, Railway, LangChain, Cohere, Baseten, and Docker. Their feeds responded on 2 October 2026. Postman's existing entry is retained and explicitly reported unavailable; a replacement feed was not verified.

Keep the current fan-out at 48 boards or fewer to leave room within the Cloudflare free Worker subrequest budget. Expanding beyond that requires changing the request strategy, not silently adding unlimited requests. Fetches have a nine-second maximum and a sixteen-second search budget. Queue work that runs out of budget is reported unavailable. Request concurrency is eight for title searches and four when descriptions are requested.

Successful responses cache for up to ten minutes. The cache is bounded to approximately 24 MB of serialized text and may evict boards earlier; concurrent requests reuse in-flight loads. Greenhouse description requests use a separate cache entry. These limits protect the free Worker runtime and can produce explicitly partial results under slow feeds.

Provider references: [Greenhouse](https://docs.greenhouse.io/job-board.html), [Lever](https://github.com/lever/postings-api), [Ashby](https://developers.ashbyhq.com/docs/public-job-posting-api).
