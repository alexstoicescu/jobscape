# Chrome search prototype

## Windows setup

1. Start the existing site with `pnpm dev` (pnpm 11.25.0).
2. In your existing Chrome, open `chrome://extensions`, enable **Developer mode**, choose **Load unpacked**, and select `G:\ATS job search\extension`.
3. Open `http://127.0.0.1:5173/prototype` in the same Chrome profile. Reload if it was open before loading the extension. The connection status should say **Chrome extension connected**.
4. Enter keywords and location, choose remote preference and ATS platforms, then click **Search**. One combined Boolean query navigates an extension-owned inactive helper tab. Search reconnects on demand after worker idle/disconnection; **Check connection** and page reload are not prerequisites.
5. **Load more** retrieves only Google's saved next-page link for the submitted query. It appends deduplicated cards while preserving scroll. Editing the form does not change that submitted query. Loading stops when Google exposes no next-page link.
6. After successful extraction, pagination state is saved in session storage before the extension closes only its helper tab. JobScape remains focused. If Google requires consent or verification, choose **Open helper tab** and handle it manually. Return to JobScape and explicitly repeat Search or Load more. Failures retain the helper tab; there is no bypass or retry loop.

## Reloading this update

In `chrome://extensions`, click the JobScape extension card's **Reload** button, then reload `http://127.0.0.1:5173/prototype` once to replace its old content script. Subsequent worker idle/disconnect requires only clicking Search or Load more. If the extension is actually disabled, enable it first; replacing/reloading the extension invalidates old content scripts and does require that one page reload.

Manual checks: let the worker idle, Clear the platforms, select three, then Search without Check connection. Verify one combined query, cards, JobScape focus and no leftover helper after successful extraction. Load more should append cards without scrolling and continue the submitted query after form edits; at the final page it should disappear. Consent/verification should retain the helper for the explicit manual action.

The alternate allowed development origin is `http://localhost:5173`. Other ports and production origins are rejected by both the bridge and worker. No private deployment settings are modified. Chrome match patterns cannot restrict ports, so the bridge checks the exact origin before doing anything. Communication is confined to the top-level development page; it cannot access arbitrary tabs.

The extension requests `scripting`, session `storage`, Google search access and host access for the existing ATS domain definitions. ATS access is used only for a selected posting after an explicit Check remote eligibility click. URL/domain/path checks still apply before reading; redirects to other destinations are rejected. No cookies, credentials, browsing-history API, or broad `tabs` permission are requested. Session storage holds its own helper tab ID/owner and each JobScape tab's submitted query, platform IDs and pagination cursor. This survives worker idle, not browser-session termination. Queries are sent to Google using the user's existing Chrome profile; signing in is not required.

## Bounds and limitations

- One combined query per Search click and one next page per Load more click, maximum 20 selected-ATS cards per page. No startup searches, per-platform requests, employer allowlist, age cutoff, automatic pagination, reader, or feed fallback.
- Navigation has a 20-second deadline; one retrieval may run at a time across connected pages. Synchronous UI and worker guards prevent concurrent duplicate requests. Every request creates a fresh port and closes it after replying, with no polling, keep-alive or retransmission of uncertain searches. The UI drops obsolete responses. Connection checks send a handshake only, never a Google search.
- Next-page links must be HTTPS Google search links with the same submitted query and a strictly increasing page offset. Saved cursors are scoped to the requesting JobScape tab and rotated after success; stale/replayed cursors are rejected without navigation. Missing next-page markup stops pagination; it does not prove exhaustive ATS coverage. Actual focus, scroll and Google markup behavior remain for manual Chrome testing.
- Results display only titles, snippets, source labels and HTTPS original links. Text renders through React escaping. Destination domains and path prefixes must match the selected ATS definitions. Tracking parameters and fragments are removed for deduplication.
- Google DOM extraction is experimental. Consent, verification, redirects, unsupported markup and empty extraction are reported instead of invented results. No exhaustive coverage, freshness, active status, company/location metadata or remote eligibility is claimed. Large Boolean queries may omit platforms.
- Existing registry-based search remains at `/`; its code and adapters are preserved. `/prototype` is the isolated extension milestone and never falls back to those feeds.
- After changing ATS definitions, regenerate the extension snapshot with `node scripts/extension-platforms.mjs`, then reload the unpacked extension.

Live validation evidence is recorded in the PR. Loading the extension and unit fixtures alone are not evidence that Google retrieval works.

## Check remote eligibility

Each result has **Check remote eligibility**. Clicking it retrieves that exact ATS posting in the inactive owned helper, reads structured JobPosting description data or a supported job-content container, and shows stated countries/regions or Worldwide with literal supporting quotes. Applicant location requirements and explicit restrictions take precedence. Employer HQ is ignored. Unconfirmed remote work, conflicting terms, inaccessible pages, unsupported markup or truncated descriptions produce Unknown. This is an English heuristic about stated terms, not a guarantee of individual eligibility.

Successful descriptions are cached as inert text, heading/paragraph/list blocks and HTTPS links in session storage for a future reader: 30 minutes, at most ten entries and a 2 MB budget. Raw HTML is not rendered or cached. Cache hits do not navigate; checks never issue Google searches or change the saved pagination cursor. The helper closes after a posting check, including inaccessible/Unknown outcomes; Google consent helpers retain their existing manual-handling behavior. No bulk scanning, prefetching, reader UI or AI service is added.

For this update, reload the unpacked extension in `chrome://extensions`, review the added ATS host access if Chrome prompts, then reload JobScape once. Search, click a result's Check remote eligibility, inspect its evidence, and verify JobScape keeps focus and its helper closes. Repeating the check should say cached. Real posting evidence and the remaining Chrome verification limit are in [REMOTE-ELIGIBILITY.md](../REMOTE-ELIGIBILITY.md).

## Local hiring-region filtering

On `/prototype`, select Global, EU, EMEA, APAC or US to filter already loaded titles/snippets. Global shows everything; regional views hide Unknown unless Include unknown is checked. Country-only matches retain their country restrictions and literal evidence. Employer HQ is not hiring scope. The filter also applies to later Load more pages and preserves all loaded cards when changed. No query, extension request or description fetch is triggered. Complete mappings and sources are in [HIRING-REGIONS.md](../HIRING-REGIONS.md). This website-only update requires refreshing JobScape, not reloading the extension.
