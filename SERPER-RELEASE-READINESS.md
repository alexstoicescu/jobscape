# PR #15 release-readiness review

20 October 2026. No Serper API calls, infrastructure creation, access changes, secret updates, merges or deployments were performed in this review.

## 1. Existing private hosting and D1

Read-only Sites inspection confirmed the retained project `appgprj_6abf8c8c334c8191b59398eb8d83ea22` is active, owned by Alex, and still serves version 1 at `https://role-radar.st0icescu.chatgpt.site`. Its policy is `custom`, with only the owner, no other viewers/editors/groups and no external visitors. The runtime environment has zero configured entries (revision 0), so no hosted Serper flag or key is currently configured through that environment store.

**Capability confirmed; resource/binding not provisioned.** The installed Sites storage contract explicitly says: “Declare logical `d1` and `r2` bindings in `.openai/hosting.json`” and “Sites provisions and connects the hosted resources.” It also states that Sites applies packaged hosted migrations before uploading the Worker. This is platform capability evidence, not evidence that JobScape already has a working database. Sources: installed Sites skill `references/storage.md` and `references/identity-and-secrets.md`, plus native `get_site` / `get_environment_variables` results. The current manifest remains `d1: null`.

The smallest supported managed-host release path, requiring separate release/infrastructure approval, is:

1. Preserve the existing project ID and owner-only policy; declare the logical binding as `d1: "SERPER_DB"`.
2. Put the ledger schema into the starter's `db/schema.ts` / generated `drizzle/` migration workflow. The build plugin copies only `drizzle/` into `dist/.openai/drizzle`; `db/serper.sql` alone is **not** a hosted migration. Its journal is currently empty. Do not assume a local Wrangler schema application updates hosted D1.
3. Have Sites provision/bind that declaration during an approved release. Inspect the resulting binding/migration outcome before enabling discovery. The managed control plane supplies the real binding; a user-owned Cloudflare account/database ID is not established as necessary for this host.
4. Set runtime secret `SERPER_API_KEY` through Sites' secret configuration, and separately configure flag/caps within remaining free credits. Those operations are not performed here.

The Vite `SERPER_D1_DATABASE_ID` override is a possible standalone Cloudflare path, not proof that this managed host consumes it. A local placeholder binding cannot authorize production storage. The prior Vite composition would also duplicate the `SERPER_DB` name if the managed declaration were added. A one-line configuration correction removes that duplicate while retaining the single local binding; this does not declare or provision storage. Host provisioning/migration success remains unverified until an approved release. No infrastructure declaration was changed in this review.

## 2. Endpoint exposure and smallest safeguard

`/api/discovery` has **no application authentication**. Missing Origin is accepted; non-browser clients can forge Origin. JSON/body/domain validation and client-side button guards do not authorize a caller. If directly reachable on a public deployment, any caller could consume the shared Serper budget.

The current host supplies a real outer access boundary. Three unauthenticated, redirect-disabled probes returned **401**: GET `/`, POST `/api/discovery` with `{}` and no Origin, and another empty POST with matching Origin plus forged identity headers. The empty POSTs cannot issue a valid discovery search. Together with the confirmed owner-only policy and documented Sites dispatch authentication, this supports using this host for a personal tool. It verifies the **current host**, not a future deployed route or alternate Worker origin. Private Sites accept either an authenticated allowed visitor or a protected service credential; the latter must never be shipped to the browser. No service credential was used or printed in this review.

The durable API caps limit provider dispatches, **not D1 write traffic**. A valid first-page request inserts its session before the budget reservation. Fresh UUIDs can therefore create sessions even when provider quota is exhausted. Cached searches also create uncharged session/page rows. Expiry is checked on reads, while cleanup only runs after successful pages: failed/capped requests can accumulate expired records. The 8 KB body limit bounds each body, not total rows, writes or invocations. A daily API cap is not a database/storage/rate cap.

**Smallest practical safeguard for this personal deployment:** retain and verify owner-only Sites dispatch protection on the entire origin, including `/api/*`, and ensure there is no publicly accessible Worker/service ingress bypass. This blocks outsiders before any session write, without a new account/login system. Keep shared spending caps as defense in depth. There is no evidence requiring an extra application authentication system for the currently confirmed owner-only host, so none was added.

This recommendation depends on that boundary. Before enabling Serper, verify anonymous/spoofed-identity requests are rejected, and confirm a normal owner request reaches the route. If the host cannot cover every ingress, **do not enable discovery**. An authenticated edge allowlist plus a request-rate limit **before the Worker/D1** is the next smallest deployment safeguard, but its availability on Sites was not confirmed; it would need explicit host/operator approval. Do not substitute a plaintext browser token or Origin check. Public/shared release is outside this approval: it would require explicit authorization/admission controls and bounded session-write retention, not just larger Serper caps. An allowed owner or leaked owner/service credential can still exhaust the personal budget and create writes; this review does not claim otherwise.

## 3. Homepage flag correction

The reviewed revision always rendered `DiscoverySearch`, passing `enabled=false` when the flag was unset. That concretely replaced the preceding homepage with a disabled form. The homepage correction here is server-side selection:

| Flag | Homepage | Discovery endpoint |
| --- | --- | --- |
| Unset / empty / any value other than `serper` | Existing PR #13 extension interface | Disabled before D1/provider work |
| Exactly `serper` | Enabled Serper interface | Requires server key, shared D1 and caps |

No redirect drops query parameters. The same predecessor component handles URL restoration/theme; it does not initiate a Serper request. Enabled-provider failures remain errors and do not trigger the extension or registry. `/prototype` is unchanged. The fallback preserves the immediate base branch's homepage; it does not revert the entire #12/#13 stack to the old hosted version-1 registry UI. Deploying those parent PRs remains a separate release decision.

Focused regression executes the real `app/page.tsx` with component/env stubs for unset, empty, off, unknown and enabled flags, without a provider call. This preserves the feature flag instead of silently enabling a paid dependency.

The final focused suite and project TypeScript check pass; the production build passes with its existing Vinext route-classification/timing notices. The suite also evaluates the real Vite binding expression with no managed declaration, `DB`, and `SERPER_DB`, proving that each configuration contains exactly one Serper binding. No passing live provider benchmark was rerun.

## 4. Production verification without paid Serper risk

**Not executed; requires approved managed provisioning and an operator access path.** No production D1 or Serper credentials are assumed available. Do not weaken privacy or add a public diagnostic route to run these steps.

1. **Access first:** with Serper disabled, verify owner access, anonymous API denial and rejection of forged identity headers. Check every deployed ingress; do not rely on a homepage-only access test. Unauthorized probes must not change D1 row counts.
2. **Atomicity without Serper:** use an operator-authorized harness against the real bound D1, executing the exact reservation SQL under concurrent independent requests with deterministic test data and a final-slot cap of one. Use an isolated verification table/namespace mirroring the schema so production credit reservations are neither deleted nor reset. Assert exactly one reservation; repeat separately for daily, monthly, total, per-search and duplicate-page constraints. Do not put a Serper key in this SQL harness, and give it no Serper network operation. This establishes the real D1 primitive; local SQLite alone did not establish production atomicity.
3. **Actual application path:** where the host permits a trusted operator harness, invoke the existing `discovery` function with the real D1 binding and its existing injected `fetcher` parameter set to a local recording stub. Use a sentinel key, zero external requests, isolated test data and no public endpoint. Race independent invocations and assert one stub call, retained failed reservations and replay/cache behavior. Fixtures must never enter the user-facing application. If Sites offers no supported execution/admin channel, record this as a verification blocker rather than creating infrastructure or a test API. No such channel was confirmed here.
4. **Secret injection separately:** configure the real key as `is_secret=true` through an approved Sites environment update; inspect only secret metadata. A valid fresh first-page request with search limit 1 and **all provider caps zero**, against an empty cache, must return `quota_exhausted` rather than `missing_key` or `usage_store`. This exercises runtime presence and store access while the reservation guard forbids provider dispatch. Use a reviewed build after the stub tests; never increase caps to test the key without separate API-call approval. A metadata/presence check does **not** prove the key's value is correct or accepted by Serper. Never log, return or hash the key for diagnostics.
5. **Quota enforcement:** using fresh uncached specs, verify each zero-cap setting independently (other limits nonzero), plus flag-off/missing-key behavior. Confirm no reservation charged/no provider dispatch on rejected calls. Until the first separately approved authenticated production smoke test, leave the caps at zero. Do not top up credits, use a paid key, or delete reservations to regain budget.

These steps split D1 correctness, application dispatch decisions, platform authentication and secret presence. A real provider acceptance check is a later explicitly approved free-credit smoke test, not evidence supplied by CI or this review.

## Decision

**Merge: GO after the narrow flag correction passes refreshed CI and the #12 → #13 dependency order is respected.** Core review/CI at `6517405` was verified green; it does not certify the follow-up commit automatically. Merging source does not provision or deploy this Site.

**Deploy/enable Serper: NO-GO.** Managed binding/migrations, runtime secret/caps, all-ingress private access and the real-D1 no-provider-call verification remain release prerequisites. No permission to provision, change access, merge or deploy is inferred from this recommendation.
