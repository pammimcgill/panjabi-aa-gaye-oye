# Pilot execution checkpoint — 9 October 2026

## Current verified status
- Source manuscripts exist as local editorial artifacts, not automatically in this GitHub repository.
- Existing standalone PNW prototype has five *short placeholder* chapters, toggle, quizzes, and local stamp. It is **not** a finished site or a complete manuscript adaptation.
- A source verification ledger documents supported facts and outstanding checks.
- No verified Cloudflare preview deployment from this branch. No production changes.
- Do not use a paid OpenAI or Claude API until the key is available through an authorized secure environment; permission to use a key is not the key itself.

## Immediate engineering acceptance
1. Extract all five full Grown-Ups PNW chapters verbatim from the editorial manuscript and five Young Readers chapters from the editorial pilot, excluding editor-only material.
2. Use a standalone storybook layout with world map and four real routes. Do not substitute PNW chapters for the other three routes.
3. Provide five distinct playable activities for the PNW region; keep all story text accessible even when games are skipped.
4. Make chapter completion/stamps meaningful, persisted in localStorage; provide reset.
5. Link historical sources to the relevant claims and separate verified claims from review-pending details.
6. Run Node static tests and browser checks before calling a preview tested.
7. Deploy **only** an isolated Cloudflare Worker preview with no D1, cron, or production routes, after checking the deployment configuration.
8. Request owner review before touching production.

## Editorial blockers
Young Readers text for England, East Africa, and Asia; full fact verification; licensed historical imagery; reviewed Punjabi narration; family voice consent if relevant.

See `docs/panjabi-kids-editorial-spec-2026-10.md` and `docs/panjabi-kids-pnw-source-ledger.md`.
