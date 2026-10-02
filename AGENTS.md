# JobScape project instructions

Read CODEX-HANDOFF.md before the first change. This is an existing, working beta. Continue from the included source.

## Product intent

Alex wants a clean, free site where jobseekers enter a job title or keywords and location to find jobs directly on major ATS platforms without manually writing repeated Google queries. It should be credible as a technical portfolio project for his DevRel work.

The existing visual direction was approved: a restrained light interface with cobalt blue accents, immediately available search controls, platform selection, and readable job cards. Preserve it unless Alex requests a redesign.

## Preserve correct behavior

- Never invent listings, freshness, salary, language requirements, geographic eligibility, or coverage.
- Live results use a finite company registry. Supported providers are defined by shared capability metadata and adapter implementations. Broader searches are generated Google links for 18 ATS platforms.
- Label partial results when a feed fails. Show the scope and number of responding company boards.
- Keep title alternatives, location filtering, remote filtering, application URLs, caching, and URL-restored searches working.
- An Updated date is not the initial posting date. Remote does not automatically mean available in Germany.
- Do not replace these adapters with mock data or scrape Google as a shortcut.
- Keep the free path usable without a paid API key.

## Development

- Use the existing React, TypeScript, Vinext, Tailwind, and Cloudflare-compatible project.
- Preserve the pnpm lockfile and use pnpm 11.25.0, the version used for this snapshot.
- Follow the portable execution path on a normal local checkout. Do not copy managed-linux runtime state from the original environment.
- Use relevant existing UI primitives, meaningful validation, and focused changes.
- Test the actual user flow in a browser when available. Browser QA remains outstanding.
- Never commit credentials or generated runtime state.

## Hosting and scope

The existing private Site identity is in .openai/hosting.json. Preserve it when working on that Site. Do not create a duplicate Site merely to obtain a preview. Access to Sites tools or credentials must be checked in the new environment; the ZIP grants no deployment access.

This handoff moves development into Codex. Start with setup, verification, and a local preview. Keep the current deployment and audience intact. Use the hosting workflow if the user subsequently requests publication; honor any explicit choice of another provider.

Recommended improvements in the handoff are suggestions, not already approved new product scope. Do not add accounts, paid services, AI ranking, recurring alerts, or a large tracking system without a concrete user request.

## Communication

Be concise and direct. No hype, no em dashes. Explain meaningful limits and distinguish completed tests from unverified behavior. Progress with routine reversible work instead of repeatedly requesting confirmation.
