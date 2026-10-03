# CTO review: dark mode

## Scope and dependency

Branch `feat/dark-mode` starts at `35d63fc` on `feat/chrome-search-reader` (PR #12). Review this change against that branch so the diff contains only theme work. Merge PR #12 first, then retarget the dark-mode PR to `main` and review its checks before merging. Nothing has been merged or deployed.

Sync on 3 October 2026: merged PR #12's `b8a73c9` into this branch with a merge commit; no conflicts. This includes default intitle searches, returned-title validation, event/events handling, whole-page opt-in, actual navigation links/explicit offset attempts, raw-result exhaustion detection and all prior regional discovery fixes. PR #13 remains based on `feat/chrome-search-reader`.

The header toggle and matching dark palette work on `/` and the `/prototype` alias. Existing search, region-aware query generation, extension messaging, description checks and pagination are unchanged. No dependencies or lockfile changes.

## Behavior

- With no valid saved override, the initial theme follows the OS/browser color preference. The small layout bootstrap applies it before body content paints, avoiding a light-page flash for a saved dark preference.
- The header's native button has the accessible name Dark mode and `aria-pressed` reflecting whether dark mode is active. Clicking it immediately switches the page without navigation or reloading search state.
- Explicit choices are saved under the local-only `jobscape-theme` key (`light` or `dark`). Both routes share it on the same origin. Other tabs update via storage events. Without an override, OS preference changes are followed. No theme preference is transmitted to the extension or server.
- Storage failures are caught: toggling still works for the current page; persistence is unavailable. Clearing the preference restores system-following behavior on reload. JavaScript-disabled pages retain the existing light theme.
- Dark mode uses a navy background, darker card surfaces, readable muted text and cobalt/blue accents. Inputs, native selects, checkboxes, notices, warnings, quotes, cards and query details have corresponding colors. Color-scheme also updates native browser controls.
- At narrow widths the toggle is icon-only but retains its accessible name and 38px target. The prototype badge is hidden below 580px to leave header space; all search controls remain available. Existing reduced-motion behavior is preserved.

## Implementation

`components/theme-toggle.tsx` owns the toggle and preference event listeners. `app/layout.tsx` initializes `html[data-theme]` before body paint; hydration suppression is limited to that element because the client sets its theme attribute. `app/globals.css` supplies scoped theme tokens and overrides for existing hard-coded surface/text colors. The interface stays structurally intact, with a header action wrapper for the toggle.

## Validation, 3 October 2026

- TypeScript passed. Diff whitespace review passed.
- Local in-app browser: toggled light to dark and back; confirmed body/panel/input colors, pressed state, unchanged keywords/location/region and URL parameters.
- Dark mode persisted across page reload. Light preference persisted when navigating from `/` to `/prototype`; the alias toggle also worked.
- Desktop and 390px viewport had no horizontal overflow. The narrow toggle stayed visible with its accessible name. Desktop and mobile dark screenshots were inspected; the temporary viewport override was reset afterward.
- No Google search or full-posting request was triggered by theme checks. Live Chrome-extension retrieval remains subject to PR #12's previously documented manual checks. Result-card/quote/warning styles are covered by CSS overrides but were not exercised with a newly fetched job in this theme pass.

No production build or deployment was run for this UI change. Standard PR CI provides the remaining production-build check. Browser observations cover the existing local preview, not the private deployment. OS-preference changes, cross-tab synchronization and blocked-storage fallback were reviewed in code rather than manually simulated.

After the sync, TypeScript, title/pagination fixtures, region-discovery fixtures, extension state-machine fixtures and search regressions passed once. The diff against PR #12 contains only dark mode and its documentation, confirming the search changes were retained. No new live browser/Google or build cycle was run for the merge; the earlier browser observations above remain historical evidence.

## Reviewer checklist

Confirm both theme palettes, focus indicators and result evidence readability with real loaded cards; optionally exercise system preference changes, a second tab and restricted storage. Do not merge this branch ahead of PR #12. For combined manual testing, run **feat/dark-mode**. Reload the unpacked extension in chrome://extensions to pick up the latest search/pagination fixes, then refresh JobScape and click Search again. The existing private deployment remains unchanged.
