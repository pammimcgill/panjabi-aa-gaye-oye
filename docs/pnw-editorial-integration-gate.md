# Pacific Northwest editorial integration gate
**Status:** Working editorial checklist, not publication approval. Prepared 2026-10-09.

## Principle
The researched Grown-Ups manuscript is the historical anchor; the Young Readers mode is a faithful simplification, **not** an independent retelling that can add invented historical specifics. The research expansion in `docs/pnw-grown-ups-research-expansion.md` is still an editorial draft. Keep the existing pilot live only as a draft, and do not deploy.

| Chapter | Evidence-backed adult focus | Young Readers anchor | Illustration direction | Editorial check |
|---|---|---|---|---|
| 1. Leaving Punjab | Early-1900s migration; family separation; British imperial movement restrictions; 1902 Golden record | Some people left Punjab seeking work; families remained and missed them | Punjab household, packed trunk, farewell; composite illustration clearly labeled | Avoid implying a particular real family or universal motive |
| 2. Crossing the Ocean | Multiple routes; 1914 Komagata Maru as specific documented case; 376 passengers, Sikh/Muslim/Hindu diversity | Long ship journeys; not every traveler took the same route | Ship at sea; optional documented 1914 inset only with explicit label | Do not merge all voyages with Komagata Maru |
| 3. Work and Neighbors | BC sawmills and community life; 1908 Vancouver gurdwara; 1912 Stockton connection | Sawmills, farms, railway work, shared food and community | Lumber work, gathering space; no invented exact historical building | Verify jobs and buildings before depicting precise historical architecture |
| 4. When People Were Treated Unfairly | 1907 Bellingham anti-South Asian violence; 1914 Vancouver exclusion and resistance | The attacks were wrong; people were excluded and resisted | Symbolic exclusion scene without fabricated violence or invented dialogue | Distinguish Bellingham from Vancouver; do not imply all passengers were Sikh |
| 5. Aa Gaye Oye! | Cross-border institutions and families, diverse identities, belonging over generations | People built communities and loved more than one place | Community gathering and multigenerational family | Don't present editorial slogan as historical quotation |

## Integration work order
1. Verify each source URL, claim, date and archival interpretation. The current references are **leads**, not publication sign-off.
2. Compare the research expansion line-by-line against the original adult manuscript; record discrepancies rather than silently rewriting them.
3. Create the full Grown-Ups story chapters, with visible inline sources and separate editorial notes. Historical prose must remain accessible and engaging, not academic abstracts.
4. Adapt the Young Readers chapters to ages 7–9: short sentences, concrete scenes, grandfather framing explicitly fictional, respectful handling of violence.
5. Commission original story-specific comic art and clear rights for any archival photographs; distinguish fictional composite scenes from documented scenes.
6. Have a Punjabi-language reviewer approve narration, a historical reviewer approve factual claims, and test reader switching, stamp persistence, keyboard access, mobile display, and all five activities.
7. Publish to isolated preview only after these checks; production requires separate explicit approval.

## Known blockers
- Claude API not currently connected through available tools; no Claude research has been executed.
- No documented approval from historical/community or Punjabi reviewers.
- Narration audio and professional-quality illustrations are not finished.
- Current GitHub pilot has text and a lightweight UI, not the complete illustrated reader.

## Safety
Never change the production Cloudflare Worker routes, cron, D1 database, or existing main-site comics. No deployment without explicit approval.
