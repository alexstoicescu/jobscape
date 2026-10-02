# SmartRecruiters integration

Depends on UI PR #6 and shared adapter PR #7. Anonymous company Posting API access used no employer credentials or API key. References: [endpoints](https://developers.smartrecruiters.com/docs/endpoints), [Posting API](https://developers.smartrecruiters.com/docs/posting-api).

| Employer identity / official careers | Public feed | UTC check | Observed coverage |
| --- | --- | --- | --- |
| [SmartRecruiters](https://careers.smartrecruiters.com/smartrecruiters) | [Feed](https://api.smartrecruiters.com/v1/companies/SmartRecruiters/postings?limit=100&offset=0) | 2026-10-02T14:07:04.681Z | 1/1 published posting |
| [Ubisoft](https://www.ubisoft.com/en-us/company/careers/search) / [hosted board](https://careers.smartrecruiters.com/ubisoft2) | [Feed](https://api.smartrecruiters.com/v1/companies/Ubisoft2/postings?limit=100&offset=0) | 2026-10-02T14:07:04.713Z | 300 retrieved / 332 reported, partial |
| [Devoteam](https://careers.smartrecruiters.com/Devoteam) | [Feed](https://api.smartrecruiters.com/v1/companies/Devoteam/postings?limit=100&offset=0) | 2026-10-02T14:07:04.714Z | 300 retrieved / 927 reported, partial |

Feed company identifiers/names matched these employer-owned boards. A public `jobs.smartrecruiters.com/SmartRecruiters/{postingId}` job returned HTTP 200 at 2026-10-02T13:50:20Z, as did its posting-detail API. Details supply real posting URLs and descriptions.

Pagination is bounded to three 100-posting pages. Description search retrieves details for the first six postings per employer with a separate cache variant; other retrieved postings remain title-searchable. Active/internal exclusions, structured country/remote/hybrid flags, released publication dates, IDs, and original URLs are normalized. Released dates can reflect republication rather than the first advertisement.

Title smoke: 601 postings, 3/3 responding, 129 matches for `engineer,manager,developer`, seven requests / 1,397,574 response bytes / 449 ms, 619,108 estimated cache bytes, 10,190,800-byte Node heap delta. Description smoke at 2026-10-02T14:07:06.951Z: 20 requests / 1,512,388 bytes / 1,478 ms; 13 available descriptions across 601 retrieved postings. Both larger boards remain explicitly partial. Node measurements are not production peak memory.

TypeScript, search, transport, and provider pagination/fields/bounds regressions and the production build passed. Browser checks returned 63 real engineer matches, showed 3/3 responding boards with Partial coverage, and exposed bounded counts/issues. An actual `experience` description search returned 15 matches with description evidence and 13/601 description coverage. No console errors observed. [Screenshot](smartrecruiters-browser.png).

Limits: finite/capped boards, sparse bounded descriptions, changing pagination totals, locale variants deduplicated by posting ID, unknown work eligibility/spoken-language requirements, and shared request limits on cold all-provider searches. Production Worker memory/CPU and full cross-browser testing remain unverified. No deployment, audience, credential, or lockfile changes.

Reproduce with `node scripts/live-smoke.mjs smartrecruiters` and `node scripts/live-smoke.mjs smartrecruiters --descriptions`.
