# Illustrated review milestone — 10 October 2026

## Scope and authorization
The owner explicitly authorized an isolated Cloudflare preview in the current task. This supersedes the older blanket “do not deploy” language in the integration gate **for this preview only**. Production remains prohibited. PR #13 remains a draft; no merge.

The static preview uses `wrangler.kids-preview.json`, Worker `panjabi-kids-pr13-review-202610`, an explicit empty routes list, empty cron list, no Worker application code and no database/service/storage bindings. The build copies only the standalone reader and its art. The production deployment workflow, production config, `public/`, `src/`, migrations and cron definitions are unchanged. The new workflow is limited to same-repository PR #13 on the named development branch, with read-only GitHub permissions. It uses the existing Cloudflare Actions secrets if present and stops if they are missing.

## Reader milestone
- Five original, optimized WebP comic triptychs replace the five lightweight SVG storyboards in the reader. Original SVGs remain available for comparison.
- Two paired reading modes; claim-level institutional references; fictional narrator clearly identified.
- Map and separate hash routes for four regions. PNW is readable; the other regions contain five labeled chapter plans each, not completed manuscripts.
- Five optional activities: packing reflection, ocean choice, place/evidence matching, event/date matching, and home reflection.
- Quizzes permit retries and never gate the story or stamp.
- Explicit chapter completion replaces “visited equals completed.” A versioned storage key deliberately does not import old visit-only stamps.
- Completion, quiz answers and mode persist; confirmed reset; malformed or unavailable storage handled.
- Punjabi narration remains disabled pending reviewed text and recording.

## Source recheck and discrepancies
All following pages were opened on 10 October 2026. This is source checking, not historian/community sign-off.

| Source | Used for | Cautions |
| --- | --- | --- |
| [UW Seattle Civil Rights project](https://depts.washington.edu/civilr/bham_history.shtml) | Doaba and migration context; Bellingham attack on 4 September 1907; displacement | Interpretive academic history with primary references. No casualty estimates imported. Contemporary racist terminology is not repeated in children's prose. |
| [Parks Canada](https://parks.canada.ca/culture/designation/evenement-event/komagata-maru) | 23 May 1914 arrival; 376 passengers and religious diversity; discriminatory restrictions; organizing | Page has inconsistent blanket “all” wording alongside its residency exception. Reader consistently says **most** were excluded/forced to leave. Do not import tactical encounter details without triangulation. |
| [Golden Museum](https://goldenbcmuseums.com/first-sikh-temple-in-north-america/) | Copy of 20 July 1902 telegram; sawmill/planer/lumberyard work; remittances | Its Komagata Maru date/count conflict with Parks Canada. **Do not use this page for ship chronology.** Distinguish sawmill work from logging camps, for which the museum says it has no evidence. Golden is inland BC, contextual to the wider provincial story. |
| [Canadian Register of Historic Places](https://www.historicplaces.ca/en/rep-reg/place-lieu.aspx?id=22922) | Vancouver gurdwara built in 1908; wider community support | Avoid “first/oldest in North America” superlatives: Golden and Vancouver accounts require comparison. |
| [UC Davis archive](https://punjabidiaspora.ucdavis.edu/contributions/religion/stockton-temple/) | 1912 founding; interfaith and family participation | Apparent “2012” land-purchase typo conflicts with its own chronology. Not used. Stockton is California, not PNW. No archival photos reproduced. |

## Manuscript comparison
The committed short pilot and committed research expansion were compared. New reader prose integrates selected supported claims, moves editorial process commentary out of the narrative where possible, and adapts corresponding claims for ages 7–9. Removed the broad unsupported farms claim in the child chapter. Added source markers in both modes. No claim is made that the unavailable full external manuscript has been imported verbatim. The short pilot's original prose remains in git history.

## Remaining editorial work
The complete twenty-chapter requirement is not finished. England, East Africa and Asia need full paired manuscripts, regional source ledgers and illustrations. PNW still needs deeper primary-source work, Indigenous perspectives and women's own voices, community review and Punjabi narration. No Claude API research was executed; no Anthropic key was available in the local environment. The existing weekly editorial automation is untouched.

## Local validation completed
- `npm test`: 148 tests passed, including existing live history/comic route regression tests.
- Browser harness: 75 assertions passed in Chromium 134 headless shell, including five chapters/two modes, correct/incorrect quizzes, all five activities, stamps and reset, reload and browser-back routing, keyboard focus, widths 320/390/768, corrupt storage and storage-disabled operation.
- Browser test found and fixed the chapter-four select/grid overflow at 320px.
- Explicit Cloudflare dry run: no bindings found; static asset upload only.
- Generated desktop/mobile screenshots for visual inspection. No claim of a full screen-reader or cross-browser audit.
