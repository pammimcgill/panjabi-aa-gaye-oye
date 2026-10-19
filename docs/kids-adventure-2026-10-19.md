# Kids adventure chapter redesign

Implemented the approved visual direction with sea ink, teal, saffron, coral and sky tokens; self-hosted Baloo Paaji 2, Nunito and Noto Sans Gurmukhi (OFL licenses included); 18px body type; 48px controls; visible focus; reduced-motion and iOS safe-area support; locally persisted dark mode.

Five linked trail stops show current, completed and upcoming chapters. Original triptych illustrations are displayed as three SVG viewports (the underlying images are unchanged), with scroll snap, panel dots/counter, guide bubbles and fullscreen zoom. Singapore chapter 1 retains the exact supplied About this art disclaimer. The portrait is a CSS crop of the existing illustrated fictional elder, not a newly drawn SVG or family photograph.

The custom player uses the existing twenty MP3s, real seeking, elapsed/duration and 1×/0.75× controls. English is the default transcript; Punjabi is user-selected. Both full reading modes and historical citations remain. Completion stores progress locally, animates a stamp notice and advances to the next chapter; returning visitors resume their last chapter. No accounts, ads, analytics, per-view AI requests or Basanti integration.

Sentence highlighting is implemented behind per-chapter `{start, pa, en}` timing data, but disabled while verified timings are unavailable. The existing ElevenLabs repository key returned 401 for the forced-alignment endpoint on 19 October. No fabricated timings were added. The transcript explicitly says sentence highlighting is not available yet. Enabling Forced Alignment on the same key is required to finish this part. Alignment is a build-time operation only; ordinary page views fetch static JSON.

Validation covers real audio play/pause/seek and pitch-preserving slowdown, both transcripts, exact disclaimer, original art viewports, trail links, fullscreen zoom, reduced-motion completion/advance, theme and chapter persistence, and the existing twenty-chapter modes/quizzes/passport/mobile/keyboard checks. Main History, event screening, Worker bindings/routes, cron and database remain unchanged.
