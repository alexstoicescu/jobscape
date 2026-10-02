# Explicit full-posting remote checks

On `/prototype`, Check remote eligibility reads only the clicked ATS destination. There is no bulk scan, Google query, employer allowlist, reader UI or paid service. Successful inert descriptions are cached for a future reader. Existing snippet filters and pagination remain independent.

## Real posting evidence, 2 October 2026

[BoWatt: Applied AI Engineer (Germany-based)](https://jobs.ashbyhq.com/bowatt/e6a64c99-477b-40a7-bd84-1f0c5cde942b) is outside the existing employer registry. Its live rendered full posting was read in the in-app browser. The published JobPosting data states TELECOMMUTE and Germany; the description includes:

> Are based in Germany and have the right to work here

The description also offers remote work. This establishes a stated Germany restriction, not worldwide eligibility. The classifier passes the literal observed restriction and returns Germany with that supporting quote. No employer headquarters is used.

This is real source-content verification plus a classifier assertion, **not a successful end-to-end Chrome extension click**. Chrome automation was unavailable (Browser not available: chrome). Actual injected-extractor compatibility, reconnect, focus and tab cleanup still require manual Chrome verification. No further browser retry cycle was started.

## Focused checks

Passed for this update: TypeScript, existing search regressions, hiring-region fixtures, extension worker/bridge fixtures, remote eligibility fixtures, and posting extractor syntax. The eligibility suite alone was repeated after adding conditional-language guards; other passing checks were not rerun. Cases cover US-only, a US employer hiring worldwide, EU-wide, France-only, Unknown, multiple allowed countries, contradictory restrictions, worldwide exclusions, inaccessible/truncated content, cache reuse across worker restart, unchanged search cursor, save-before-close and cleanup on posting failure. Worker fixtures do not prove real Chrome behavior. No full build cycle was run for this focused change.

## Limits

Classification is a conservative English heuristic, not an eligibility guarantee. Non-English wording, indirect or conditional restrictions and unsupported markup can be missed. Missing remote terms, conflicting locations, unavailable pages and bounded/truncated extraction return Unknown. Navigation is bounded to 20 seconds, with an event-driven eight-second description wait and no retry loop. Redirects to another posting/domain are rejected. The cache expires after 30 minutes, is limited to ten entries/2 MB, and is cleared when Chrome clears extension session storage. Google coverage and active status are not established by this check.

Structured field semantics: [JobPosting](https://schema.org/JobPosting), [applicantLocationRequirements](https://schema.org/applicantLocationRequirements). Region sources and scope remain in [HIRING-REGIONS.md](HIRING-REGIONS.md).
