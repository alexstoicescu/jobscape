# Chrome search prototype

## Windows setup

1. Start the existing site with `pnpm dev` (pnpm 11.25.0).
2. In your existing Chrome, open `chrome://extensions`, enable **Developer mode**, choose **Load unpacked**, and select `G:\ATS job search\extension`.
3. Open `http://127.0.0.1:5173/` in the same Chrome profile. `/prototype` remains a query-preserving alias. Reload if it was open before loading the extension. The connection status should say **Chrome extension connected**.
4. Enter keywords and location, choose remote preference and ATS platforms, then click **Search**. One combined Boolean query navigates an extension-owned inactive helper tab. Search reconnects on demand after worker idle/disconnection; **Check connection** and page reload are not prerequisites.
5. **Load more** uses Google's actual next/forward numbered link, or one next-offset attempt per click when absent. It retains the submitted query/matching mode, appends deduplicated cards and preserves scroll. Empty or repeated raw Google results stop pagination; zero title matches do not. Extraction failures are reported separately. See [TITLE-PAGINATION.md](../TITLE-PAGINATION.md).
6. After successful extraction, pagination state is saved in session storage before the extension closes only its helper tab. JobScape remains focused. If Google requires consent or verification, choose **Open helper tab** and handle it manually. Return to JobScape and explicitly repeat Search or Load more. Failures retain the helper tab; there is no bypass or retry loop.

## Reloading this update

In `chrome://extensions`, click the JobScape extension card's **Reload** button, then reload `http://127.0.0.1:5173/prototype` once to replace its old content script. Subsequent worker idle/disconnect requires only clicking Search or Load more. If the extension is actually disabled, enable it first; replacing/reloading the extension invalidates old content scripts and does require that one page reload.

Manual checks: let the worker idle, Clear the platforms, select three, then Search without Check connection. Verify one combined query, cards, JobScape focus and no leftover helper after successful extraction. Load more should append cards without scrolling and continue the submitted query after form edits; at the final page it should disappear. Consent/verification should retain the helper for the explicit manual action.

The alternate allowed development origin is `http://localhost:5173`. Other ports and production origins are rejected by both the bridge and worker. No private deployment settings are modified. Chrome match patterns cannot restrict ports, so the bridge checks the exact origin before doing anything. Communication is confined to the top-level development page; it cannot access arbitrary tabs.

The extension requests `scripting`, session `storage`, Google search access and host access for the existing ATS domain definitions. ATS access is used only for a selected posting after an explicit Check remote eligibility click. URL/domain/path checks still apply before reading; redirects to other destinations are rejected. No cookies, credentials, browsing-history API, or broad `tabs` permission are requested. Session storage holds its own helper tab ID/owner and each JobScape tab's submitted query, platform IDs and pagination cursor. This survives worker idle, not browser-session termination. Queries are sent to Google using the user's existing Chrome profile; signing in is not required.

## Bounds and limitations

- One combined query per Search click and one next page per Load more click, maximum 20 selected-ATS cards per page. No startup searches, per-platform requests, employer allowlist, age cutoff, automatic pagination, reader, or feed fallback.
- Navigation has a 20-second deadline; one retrieval may run at a time across connected pages. Synchronous UI and worker guards prevent concurrent duplicate requests. Every request creates a fresh port and closes it after replying, with no polling, keep-alive or retransmission of uncertain searches. The UI drops obsolete responses. Connection checks send a handshake only, never a Google search.
- Actual next/numbered links must be HTTPS Google search links with the same submitted query and increasing offset. Missing links permit one next-offset attempt per explicit click. Saved cursors are scoped to the requesting JobScape tab and rotated after successful extraction; stale/replayed cursors are rejected without navigation. Empty/repeated raw URLs stop pagination; title filtering does not. Raw-URL fingerprint history is bounded to 5,000 entries with an explicit stop message. Actual focus, scroll and Chrome extraction remain manual checks.
- Results display only titles, snippets, source labels and HTTPS original links. Text renders through React escaping. Destination domains and path prefixes must match the selected ATS definitions. Tracking parameters and fragments are removed for deduplication.
- Google DOM extraction is experimental. Consent, verification, redirects, unsupported markup and empty extraction are reported instead of invented results. No exhaustive coverage, freshness, active status, company/location metadata or remote eligibility is claimed. Large Boolean queries may omit platforms.
- `/` and `/prototype` use the same extension interface. The logo returns to `/` with the current query parameters. The old registry UI is removed from user navigation; backend routes and adapters are preserved. Neither entry point falls back to registry feeds.
- After changing ATS definitions, regenerate the extension snapshot with `node scripts/extension-platforms.mjs`, then reload the unpacked extension.

Live validation evidence is recorded in the PR. Loading the extension and unit fixtures alone are not evidence that Google retrieval works.

## Check remote eligibility

Each result has **Check remote eligibility**. Clicking it retrieves that exact ATS posting in the inactive owned helper, reads structured JobPosting description data or a supported job-content container, and shows stated countries/regions or Worldwide with literal supporting quotes. Applicant location requirements and explicit restrictions take precedence. Employer HQ is ignored. Unconfirmed remote work, conflicting terms, inaccessible pages, unsupported markup or truncated descriptions produce Unknown. This is an English heuristic about stated terms, not a guarantee of individual eligibility.

Successful descriptions are cached as inert text, heading/paragraph/list blocks and HTTPS links in session storage for a future reader: 30 minutes, at most ten entries and a 2 MB budget. Raw HTML is not rendered or cached. Cache hits do not navigate; checks never issue Google searches or change the saved pagination cursor. The helper closes after a posting check, including inaccessible/Unknown outcomes; Google consent helpers retain their existing manual-handling behavior. No bulk scanning, prefetching, reader UI or AI service is added.

For this update, reload the unpacked extension in `chrome://extensions`, review the added ATS host access if Chrome prompts, then reload JobScape once. Search, click a result's Check remote eligibility, inspect its evidence, and verify JobScape keeps focus and its helper closes. Repeating the check should say cached. Real posting evidence and the remaining Chrome verification limit are in [REMOTE-ELIGIBILITY.md](../REMOTE-ELIGIBILITY.md).

## Region-aware discovery

Choose Search hiring region before clicking Search: All adds no region terms, Global targets worldwide-remote phrases, and EU/EMEA/APAC/US include both mapped countries/regions and worldwide candidates. One combined query retains all selected ATS domains and existing keyword/location preferences, without blanket US exclusions. Region changes apply on a new Search; Load more keeps the submitted query.

All returned candidates appear immediately. Check remote eligibility remains strictly on demand; there is no automatic checking on Search, per page or when changing region. Unchecked candidates and checked-but-inconclusive Unknown remain separate from full-posting evidence. Only explicit unrestricted worldwide remote posting evidence earns Global remote. Quotes and restrictions remain visible, with no eligibility guarantee. This supersedes the former local-filter UI. Complete sources/limits are in [HIRING-REGIONS.md](../HIRING-REGIONS.md). Refresh JobScape; no extension reload is needed for this website/query update.
