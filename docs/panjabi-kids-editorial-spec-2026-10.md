# Panjabi Kids — editorial implementation specification (8 October 2026)

Status: **review branch only**. No production deploy or D1 changes.

## Locked decisions
- Two reading modes: **Young Readers** (default) and **Grown-Ups**, saved as `localStorage['panjabi-kids-reading-mode']`.
- Both modes share five chapters per region, illustrations, mini-games, quizzes, progress, and stamps. Only the chapter prose changes.
- Grown-Ups manuscript is the factual source; verify it against archives before adapting Young Readers.
- English on-screen. Young Readers gets Punjabi prerecorded grandfather-style narration first. Audio provider not chosen. Do not voice-clone or publish family voices without explicit consent.
- Story before quiz. Every region has its own route. No placeholder redirects.
- Stamp label: **Aa gaye oye! — [region]**. Opening and arrival ending repeat this motif.
- A recurring grandfather storyteller frames the history but never pretends to be an eyewitness.
- Avoid editor notes in visitor-facing prose; maintain separate editorial notes.
- Respect Sikh, Muslim, and Hindu Punjabi experiences; women's and children's histories; Indigenous and African perspectives; colonial context; Partition; Bellingham 1907, Komagata Maru 1914, Uganda 1972 without conflating countries.
- Historical photographs must have independently checked licenses and credits; illustrations explicitly labeled.
- No Basanti, ads, child accounts, live AI calls, or unnecessary personal data. Preserve existing comics, main History routes, events, CMS, production Worker routes and D1.

## First pilot: Pacific Northwest
1. Leaving Punjab — everyday life, reasons to migrate, women's and children's experiences.
2. Across the ocean — documented routes and ports; avoid inventing individual journeys.
3. Work and community — BC sawmills, Washington, and verified California links.
4. Facing unfairness — Bellingham 1907 and Komagata Maru 1914, age-sensitive but honest.
5. Aa gaye oye! — community institutions and multigenerational belonging.

Each chapter: paired Young Readers/Grown-Ups prose, source references, labeled visual, optional Punjabi audio, one interactive activity, short quiz, and progression without quiz gating.

## Editorial verification queue
- Primary evidence: Komagata Maru, 1907 Bellingham, Hong Kong and Shanghai, Uganda 1972.
- Verify Stockton and Yuba City history and dates; early UK community landmarks; Partition migration consequences.
- Community review and fluent Punjabi script/pronunciation review.
- Confirm image licenses, attribution, consent for any recorded family voice.

## Acceptance before preview
- Read-first routes and complete content; toggle persists across refresh.
- No audio autoplay; accessible play/pause/replay and English transcript.
- Mobile and keyboard navigation, alt text, readable contrast, error handling.
- All four region links functional, no broken redirects.
- Test existing main-site history/comic routes; no changes to production configuration.
- No production deploy until owner reviews preview.

This file documents implementation decisions, not a claim that the full site or research has been completed.
