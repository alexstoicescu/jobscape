# Shared adapter foundation

Depends on the issue #2 coverage UI PR. This refactor enables separate provider PRs; it does not yet enable another provider.

The contract owns feed URL, cache variant, normalized jobs, complete/partial status, and source issues. Common transport counts requests including redirects, limits response sizes, honors Retry-After within the isolate, and applies the existing board/search deadlines. Provider queues are interleaved. Successful empty feeds are healthy; unavailable and incomplete sources stay distinct.

Checks: TypeScript, existing search regressions, new transport/normalization regressions, and the production Worker build passed. Tests cover zero/missing dates, hybrid/on-site exclusions, HTTPS links, denied access, malformed JSON, expired budgets, response bounds, unsafe redirects, partial board state, and rate-limit cooldown. Synthetic fetches are confined to tests.

A real cold check at **2026-10-02T14:03:48.251Z** reached **46/48 employers**, with **7,308 accessible listings**. It used **48 outbound requests**, received **48,938,439 bytes**, took **9,366 ms**, and retained an estimated **24,663,072 cache bytes**. Postman returned HTTP 404; Binance timed out. The initial 8 MiB response/32 MiB total bounds rejected ordinary existing coverage; measurement informed the final 16 MiB/64 MiB limits before adding employers.

The smoke process reported a **105,114,336-byte Node heap delta**. That process includes TypeScript source loading and garbage-collection effects; this is neither peak heap nor a production Worker measurement. The 24 MiB serialized-text cache estimate is a separate quantity. Production memory and CPU at Cloudflare remain unverified and merit CTO review before publication. Large feeds and cold expanded registries can still exceed explicit limits and will produce partial/unavailable coverage.

`node scripts/live-smoke.mjs all` reproduces the real-feed measurement and writes an ignored report. Live provider availability is not required by CI. No deployment, audience, credentials, or lockfile changes.
