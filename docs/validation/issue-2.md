# Issue #2: explicit live coverage

Checked 2 October 2026 against the local portable preview.

- TypeScript, `node scripts/search-checks.mjs`, and the production Worker build passed.
- Default live selection and live Select all contain Greenhouse, Lever, and Ashby only. The destination summary shows three supported platforms and 48 registered employers before searching.
- Google has its own 18-platform selection. Switching views retained the entered role and Germany location. Arrow-key tab navigation and Space-key checkbox operation worked.
- A legacy `p=workday` URL restored keywords, Germany, remote, aliases disabled, descriptions enabled, and broader geography enabled. It reported zero live platforms/boards, identified Workday as Google-only, and offered its actual Google link. Selecting that fallback and reloading retained the Google view and selection.
- A mixed `p=ashby,workday` search reported Ashby 20/20 employer boards responding, 2,248 accessible listings, and 16 matching roles at check time. Workday was explicitly excluded from live retrieval and retained as an external search option. Counts are observations, not ongoing guarantees.
- A 390px mobile viewport had no document horizontal overflow (375px scroll width). Both source tabs fit and explanations remained visible. Browser console inspection found no errors.
- Focused coverage regressions distinguish unsupported, supported-with-no-employers, ready, unavailable, partial, and complete states. Existing adapter/filter/cache regressions still pass.

Screenshots: [legacy URL](issue-2-legacy-url.png), [mobile](issue-2-mobile.png), [mixed sources](issue-2-mixed.png).

Limitations: a full screen-reader audit and cross-browser matrix were not performed. Existing remote eligibility uncertainty and finite employer coverage remain. No deployment or audience changes were made.
