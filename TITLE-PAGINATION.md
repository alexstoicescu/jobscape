# Title search and pagination correction, PR #12

## Failing case and query comparison, 3 October 2026

Case: events, Remote, EU, blank location, all ATS domains. Before changes, the country-expanded query was 1,130 characters; compact EU/European Union/Europe wording was 778. Both were inspected live once in the in-app browser and returned the same unrelated backend-engineering title, with events only in the snippet. Neither exposed next/numbered links on that first page.

Country expansion is retained: compact wording showed no improvement in this case and can omit country-only postings that never say EU/Europe. Country/classification mappings, mandatory ATS domains, one query and worldwide inclusion are preserved. Larger OR groups still risk Google omissions and the existing 4,096-character query limit; this narrow comparison does not measure exhaustive coverage.

## Correction

Default query alternatives use `intitle:`. Event/events alternatives are supported, and returned Google titles are independently validated with normalized word boundaries and all words required within an alternative. Snippet-only mentions cannot qualify. Whole-page keyword matching is an explicit form checkbox, saved as `wp` in the URL, and frozen with the submitted search for later pages. Whole-page mode removes intitle and the title gate; it does not fetch descriptions.

Pagination first inspects actual next links and forward numbered links for the same query, HTTPS Google origin and increasing offset. If none exists, Load more offers one next-offset attempt (`start + 10`) per explicit click, retaining the submitted query. No polling, retry loop or automatic navigation is added. This is an attempt, not a claim that another useful page exists.

Raw destination URLs are normalized and hashed before ATS/title filtering. Cursor state retains up to 5,000 fingerprints; pagination stops on empty recognized Google results, no new raw URLs, or the explicit history bound. Zero matching titles or zero selected ATS cards never imply exhaustion. URL deduplication remains in the returned cards and appended collection. Unsupported/blank markup is an extraction failure with its cursor retained for a deliberate user retry, not silent exhaustion. Manual Google checks retain the helper as before; successful state is saved before closing only the owned tab.

## Validation and limits

TypeScript, title/extractor fixtures, extension state-machine fixtures and search regressions passed once. Region discovery fixtures passed after updating one outdated expected query prefix to intitle; other passing checks were not rerun. Cases cover event/events, rejecting the failing title, alternatives and whole-page opt-in, next/numbered links, one offset navigation per click, raw repeats/empty results, zero-title-match pagination and extraction-failure cursor retention.

The corrected live Google query returned three event-related titles, including an event project-manager role. One explicit offset attempt returned ten new raw results with unrelated titles. Independent title validation rejects those while retaining pagination because raw results are new. Google may relax/omit query terms on subsequent pages; returned-title validation remains essential.

This is direct live Google observation, not end-to-end Chrome-extension verification. The in-app browser exposed opaque Google redirect URLs and a consent notice; native ATS card delivery was not proven there. Chrome manual verification remains necessary. No attempts to bypass consent, follow opaque redirects in bulk or replace the browser architecture were made. No build, merge or deployment.

## Reload

Reload JobScape's unpacked extension at chrome://extensions, then reload JobScape to replace its content script. Click Search again to submit the title-qualified query. Existing Load more intentionally retains its old submitted query until a new Search. No dependency installation is needed.
