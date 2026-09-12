Community screening update
Extract this ZIP in your existing GitHub checkout, commit and push.
Includes Ticketmaster restoration and exclusion of routine Gurdwara programs.
Adds Markets & Bazaars and broader cultural terms, plus the four original community sources.
Dedicated Indian listing pages use geographic/date screening; general sources require cultural relevance.
No preloaded or fabricated events are added.
Scheduled refresh: one least-recently-run source every five minutes (roughly 100 minutes for a full cycle).
Optional initial refresh: run scripts/refresh-sources.ps1 from PowerShell after deployment.
No new database migration or SeatGeek key is required.
The Eventbrite source is a public page parser, not a general Eventbrite API search.
Blocked sites or pages without structured event data may still return zero; inspect /api/sources.
This package contains only changed files plus the existing regular-program exclusion module.
