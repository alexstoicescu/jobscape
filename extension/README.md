# Search-only Chrome prototype

## Windows setup

1. Start the existing site with `pnpm dev` (pnpm 11.25.0).
2. In your existing Chrome, open `chrome://extensions`, enable **Developer mode**, choose **Load unpacked**, and select `G:\ATS job search\extension`.
3. Open `http://127.0.0.1:5173/prototype` in the same Chrome profile. Reload if it was open before loading the extension. The connection status should say **Chrome extension connected**.
4. Enter keywords and location, choose remote preference and ATS platforms, then click **Search**. One combined Boolean query navigates one reusable inactive helper tab. Only the explicit Search action retrieves results.
5. If Google requires consent or verification, choose **Open helper tab** and handle it manually. Return to JobScape and explicitly click Search again. There is no bypass or retry loop.

The alternate allowed development origin is `http://localhost:5173`. Other ports and production origins are rejected by both the bridge and worker. No private deployment settings are modified. Chrome match patterns cannot restrict ports, so the bridge checks the exact origin before doing anything. Communication is confined to the top-level development page; it cannot access arbitrary tabs.

The extension requests only `scripting`, session `storage`, and `https://www.google.com/*`. No ATS host permissions are needed because this milestone never retrieves a posting. No cookies, credentials, browsing-history API, or broad `tabs` permission are requested. The service worker stores only its own helper tab ID for the current browser session. Queries are sent to Google using the user's existing Chrome profile; signing in is not required.

## Bounds and limitations

- One query and one results page per Search click, maximum 20 deduplicated selected-ATS destination cards. No startup searches, per-platform requests, employer allowlist, age cutoff, automatic pagination, reader, or feed fallback.
- Navigation has a 20-second deadline; one search may run at a time across connected pages. The UI drops obsolete responses. Connection checks send a handshake only, never a Google search.
- Results display only titles, snippets, source labels and HTTPS original links. Text renders through React escaping. Destination domains and path prefixes must match the selected ATS definitions. Tracking parameters and fragments are removed for deduplication.
- Google DOM extraction is experimental. Consent, verification, redirects, unsupported markup and empty extraction are reported instead of invented results. No exhaustive coverage, freshness, active status, company/location metadata or remote eligibility is claimed. Large Boolean queries may omit platforms.
- Existing registry-based search remains at `/`; its code and adapters are preserved. `/prototype` is the isolated extension milestone and never falls back to those feeds.
- After changing ATS definitions, regenerate the extension snapshot with `node scripts/extension-platforms.mjs`, then reload the unpacked extension.

Live validation evidence is recorded in the PR. Loading the extension and unit fixtures alone are not evidence that Google retrieval works.
