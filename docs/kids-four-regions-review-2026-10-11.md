# Four-region illustrated review milestone — 11 October 2026

## Scope

Adds fifteen source-backed paired chapters to the existing five Pacific Northwest chapters: five each for England, East Africa and Asia. This is a complete twenty-chapter **review edition**, not final historical/community approval or a claim of comprehensive diaspora coverage.

The source-backed adult drafts anchor the shorter Young Readers adaptations. The reader preserves the fictional grandfather frame, distinguishes imagined art from evidence, provides direct claim citations and has no live AI requests. Claude API research was not connected or executed.

## Evidence ledger and limits

Sources were opened and read on 11 October 2026. Detailed URLs are included next to each chapter in the paired manuscripts and the reader.

| Chapters | Evidence checked | Interpretation / boundary |
| --- | --- | --- |
| England 1 | Royal Collection Trust biography and collection context | Earlier exile differs from later labor migration; no invented private thoughts. |
| England 2, 5 | digital:works Panjabis of Southall project description | Project summary checked; embedded film/interviews not fully reviewed or transcribed. |
| England 3 | Vilayati Tarti creator’s project description | Women’s work and memories included; no invented quotation or named workplace. |
| England 4 | IWA project description; London Museum collection account of Sophia Duleep Singh | Distinct periods and movements, no claim of institutional continuity. |
| East Africa 1 | Uganda Railways institutional history; Hansard 6 May 1902 | Modern Kenyan geography distinguished from railway name; official figures not treated as individual testimony. |
| East Africa 2 | Hansard 18 December 1902; Uganda Railways history | Colonial and racialized language contextualized, never adopted as factual judgments about people. |
| East Africa 3 | Richa Nagar’s 1997 peer-reviewed article, text and metadata exposed by University of Minnesota | Historical study, not present-day population claim; gender/class differences retained. |
| East Africa 4 | National Archives education pack PDF, background and reproduced Cabinet transcript | HTML page access failed; PDF succeeded. Expulsion specific to Uganda, not all East Africa. Nationality categories and changing orders distinguished. |
| East Africa 5 | Hansard 11 December 1972 | Date-bound resettlement snapshot; arrivals differ from applications. No final totals asserted. |
| Asia 1 | National Library Board BiblioAsia police history | Recruitment event, not claim of first-ever Punjabi arrival; colonial context retained. |
| Asia 2 | Hong Kong Police Museum uniform record | Institutional viewpoint; reject generalized racial evaluations; Hong Kong distinct from Singapore. |
| Asia 3, 4 | Central Sikh Gurdwara Board institutional history | Founding, accommodation and wartime care; no exact architectural reconstruction. |
| Asia 5 | Istri Sat Sang institutional history | Oral-history founding date distinguished from formal registration. |

The blocked Roots exhibition page was not used as detailed evidence. No newspaper or museum photographs were copied into this edition. All new comics are original AI-assisted illustrative composites.

## Reader behavior

- Four deep-linkable region routes and five chapters per route.
- Both reading modes use the same chapter controls, quiz, activity and stamp state.
- Existing `panjabi-kids-pnw-progress-v2` retained; each new region has its own equivalent key.
- Only the explicit completion button awards completion; navigation and quizzes do not.
- Reset names the current region and preserves other regions. Changing routes closes a pending reset confirmation.
- All four passport stamps can coexist. Final chapters link onward to another region.
- Enlarged artwork dialog offers sideways scrolling on small screens; keyboard Escape closes it.
- Corrupt/blocked storage handled without breaking the story.

## Review still needed

Community/historical reviewers should assess interpretation, regional representation, generated clothing/architecture and the age 7–9 reading level. These selective routes do not cover every Punjabi faith or community equally; the Asia route explicitly focuses on selected Sikh histories. Wider coverage and deeper adult research can build on this edition.

Punjabi narration, fluent-speaker review and any permission for a real family voice remain pending. No audio or voice cloning is claimed. The earlier family-photo-inspired PNW chapter five stays intact; the original photo is not committed or deployed.

## Deployment boundary

Only the existing isolated static worker `panjabi-kids-pr13-review-202610` may be updated through the PR #13 preview workflow. No production Worker, routes, cron, D1, main-site code or production deploy workflow is modified. PR remains draft and unmerged.

## Validation completed

- Six focused static/content/isolated-hosting checks passed.
- 316 browser assertions passed across all twenty chapters, including both modes, quiz retries, optional activities, four stamps, region-isolated reset/persistence, malformed routes, keyboard close-up dialog, and 320/390/768-pixel layouts.
- Full repository test run: 149 tests passed, zero failures (including the browser runner).
- Mobile screenshot reviewed; no horizontal overflow in the normal reader. Enlarged comic deliberately scrolls inside its own dialog.
