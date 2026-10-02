# Local hiring-region evidence

The `/prototype` filter uses only loaded Google titles and snippets. Global shows all loaded cards. EU, EMEA, APAC and US hide Unknown by default; Include unknown exposes it explicitly. Changing region never alters the submitted query, loads a page, fetches a description, discards cards or requests Google. Later Load more cards use the same local filter.

The classifier recognizes explicit English job-location/hiring phrases, permitted regions/countries and exclusions. Worldwide remote covers every filter unless explicit restrictions narrow it. Multiple permitted locations are combined; simultaneous explicit restrictions are intersected. Country-only roles may appear in their parent regions, but cards show the literal evidence and named country restrictions/exclusions. France-only is an EU/EMEA match, not a claim of EU-wide hiring. Employer headquarters, customer markets and time-zone overlap do not establish hiring location. Remote alone, missing or conflicting evidence is Unknown.

This is a conservative heuristic over incomplete search snippets, not verified eligibility. It can miss wording, non-English restrictions, unmapped cities or omitted/truncated conditions. Generic Europe is broader than EU; a regional match means the visible permitted scope overlaps the filter, not that every resident of that region can apply. Read the original posting for residence, authorization, visa, employment and time-zone conditions.

## Mapping sources

Snapshot read on **2 October 2026**, stored in `lib/hiring-region-map.ts`, with no runtime network lookup:

- **EU:** all 27 member states from the [European Union country list](https://european-union.europa.eu/principles-countries-history/eu-countries_en) and [EU easy-read member list](https://european-union.europa.eu/easy-read_en). The UK is not in EU.
- **EMEA:** every country/territory entry in Wikipedia's [EMEA “Component areas”](https://en.wikipedia.org/wiki/Europe,_the_Middle_East_and_Africa#Component_areas), including Central/Eastern Europe, Southern Caucasus/Central Asia, Northern/Southern/Western Europe, MENA and all four Sub-Saharan Africa groups. Duplicate Monaco is collapsed. Revision read: `1374954782`.
- **APAC:** all 48 entries in Wikipedia's [APAC “Traditional definition”](https://en.wikipedia.org/wiki/Asia-Pacific#Traditional_definition): East Asia, South Asia, Southeast Asia and Oceania, including territories. “Additional countries and territories” are deliberately excluded. Do not infer a territory's hiring scope from its administering country's HQ/name. The lists overlap at Afghanistan; membership is not forced into one region.
- **US:** explicit United States hiring/job-location evidence. US employer HQ does not restrict a role, and US citizenship is not inferred.

The EMEA/APAC definitions are the requested business groupings, not assertions of sovereignty or a universal geographic standard. Internal canonical names normalize Czech Republic/Czechia, Turkey/Türkiye, Ivory Coast/Côte d'Ivoire, Macau/Macao and other documented aliases. Existing `lib/geography.ts` normalization, country, city and region aliases are reused. Short ambiguous codes/pronouns are not treated as standalone country evidence. UI filter names remain Global, EU, EMEA, APAC and US; mapping country lists are not expanded in the selector.

## Focused validation

The separate, explicit **Check remote eligibility** action reuses these mappings against a selected full posting. It requires stated remote-work terms, considers structured `applicantLocationRequirements`, and uses `jobLocation` only when description hiring scope is absent. Restrictions narrow broader claims; conflicting requirements return Unknown. These full-posting checks do not change the snippet filter or remove loaded cards. Supporting quotes identify description versus structured-field evidence. See [REMOTE-ELIGIBILITY.md](REMOTE-ELIGIBILITY.md).

`node scripts/hiring-region-checks.mjs` covers US-only, US employer hiring worldwide/in EU, EU-wide, France-only and Unknown, plus multiple regions, exclusions, existing aliases, territory-name boundaries, every mapping entry and preserving loaded cards across region switches and added pages. These are local text fixtures; they do not establish a posting's actual eligibility or real Chrome/Google retrieval.
