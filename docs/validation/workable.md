# Workable integration

Anonymous public careers-page endpoint documented by [Workable](https://help.workable.com/hc/en-us/articles/115012771647-Using-the-Workable-API-to-create-a-careers-page). No SPI token or employer account is used. Depends on the preceding UI, adapter, and SmartRecruiters PRs.

| Verified employer / official careers | Public feed | UTC check | Observed coverage |
| --- | --- | --- | --- |
| [Hack The Box](https://www.hackthebox.com/join-us) | [Feed](https://www.workable.com/api/accounts/hack-the-box-ltd?details=true) | 2026-10-02T14:16:59.593Z | 74 geographic rows, 21 unique jobs |
| [LearnWorlds](https://www.learnworlds.com/company/careers/) | [Feed](https://www.workable.com/api/accounts/learnworlds?details=true) | 2026-10-02T14:16:59.627Z | 15 geographic rows, 3 unique jobs |
| [Workable official board](https://apply.workable.com/careers/) | [Feed](https://www.workable.com/api/accounts/careers?details=true) | 2026-10-02T14:16:59.628Z | Valid published-job payload, zero jobs |

Corporate careers links and returned account names verified these identities. Each public URL redirects to the documented Workable widget endpoint; both requests count toward shared limits. Workable's own empty board is healthy, not evidence of a broken adapter. The guessed `workable` account returned 404 and is not registered. PolyAI's currently empty Workable feed was excluded because its official careers page now uses Greenhouse.

Repeated shortcodes represent geographic variants. The adapter combines every listed location into one job, so German locations cannot disappear because another variant occurs last. `state` is a geographic state in this endpoint. Explicit job status/visibility excludes unpublished roles. Remote uses public telecommuting/workplace fields; hybrid/onsite overrides remote. Descriptions and original application URLs come directly from the feed. Only `published_on` is labeled Published; `created_at` never supplies a missing publication date.

The documented endpoint returns all published jobs without paging. Retrieval caps at 1,000 raw rows; unexpected additional-page metadata, invalid public jobs, or a cap marks coverage partial. There is no per-job detail fanout. Shared HTTP failures, deadlines, Retry-After, response size, cache, and request limits apply.

Real smoke at 2026-10-02T14:17:00.088Z: 24 unique jobs across 3/3 responding employers; 17 matches for `engineer,manager,developer`. Six requests, 993,304 received bytes, 487 ms, 435,440 estimated cache bytes, 6,876,960-byte Node heap delta. This is not production peak memory.

TypeScript, search, transport, SmartRecruiters, and Workable regressions and the production build passed. Browser: 14 real engineer matches; Germany + remote narrowed to six Hack The Box roles and excluded Greece/Cyprus-only LearnWorlds jobs. `Kubernetes` with description search returned four real evidence snippets. Merged multi-country locations and actual source URLs were visible. No console errors. [Screenshot](workable-browser.png).

Limits: three employers, one currently empty; unknown eligibility and description language; 12,000-character normalized description cap; public-source availability and shared cold-search budgets; production Worker peak memory/CPU and full cross-browser testing unverified. Private deployment and lockfile unchanged.

Reproduce: `node scripts/workable-checks.mjs`; `node scripts/live-smoke.mjs workable --descriptions`.
