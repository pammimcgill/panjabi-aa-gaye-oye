# The weekly history routine

Goal: one careful history article a week, with about 15 minutes of human review, telling the story of how
Punjabis arrived in the Pacific Northwest and British Columbia (the site's name, *Panjabi aa gaye oye*, means
"the Punjabis have arrived").

## How it works
1. Every Monday morning (Pacific) a GitHub Action picks the next topic from `calendar.json`.
   Timely topics come first (Vaisakhi in April, the Komagata Maru in May, Bellingham in September).
2. It asks Claude to research the topic with web search and write a draft that follows `STYLE_GUIDE.md`.
3. It opens a GitHub issue labeled `draft`. Drafts are invisible on the site.
4. You review the draft (checklist in the style guide), edit the issue text, and add the `history` label.
   The article appears at `/history/<number>-<title>` within about five minutes.

The automation never publishes. It also refuses to save a draft that is too short or has no sources.

### What protects against mistakes
- Only source links that the search actually returned stay under "Sources". Any other link the model wrote
  is moved to "Verification notes" for you to check.
- Long direct quotations are counted and listed for you to confirm.
- Sensitive topics (Partition, 1984) are never auto-drafted.
- Published articles show a short "drafted with AI, checked by a person" note (the AI assistance field).

## One-time setup
1. In the GitHub repository choose Settings, Secrets and variables, Actions, and add a secret named
   `ANTHROPIC_API_KEY`. Optional variable: `ANTHROPIC_MODEL` (default `claude-sonnet-5`).
2. Settings, Actions, General: allow workflows to read and write (the workflow only asks for `issues: write`).
3. Add the two starter articles: Actions, "Weekly history draft", Run workflow, and put
   `editorial/ready/01-bellingham-1907.md` in "ready_file". Repeat for the other files in that folder.
4. Or wait for Monday.

## Running a draft on demand
Actions, "Weekly history draft", Run workflow. Optionally give a `topic_id` from `calendar.json`.
From your computer: `GITHUB_TOKEN=... GITHUB_REPOSITORY=you/repo ANTHROPIC_API_KEY=... node scripts/weekly-history-draft.mjs --dry-run`
prints the draft without creating an issue.

## Drafting by hand with Claude
Paste this into a chat, with web search on:

> Write a history article for Panjabi Aa Gaye Oye about: **TOPIC**. Follow the attached style guide.
> Search the web and use at least three reputable sources. Do not invent quotations or facts. Where
> sources disagree, give the range. Output only these sections with these exact headings: Summary,
> Article, Sources (a list of links), Topics, Verification notes.

Then paste the sections into the History issue form and review them the same way.

## Adding topics
Edit `calendar.json`. Fields: `id`, `title`, `angle`, `region`, optional `weeks` (ISO week range when timely)
and `auto: false` (never automated). Topics run in the order listed (arrival story first, then Panjab and culture) and are used once; then the cycle restarts.
`year` puts an article on the timeline (chapters: Before the journey, The first arrivals, Putting down roots, The exclusion years, The doors reopen, Building a home, Punjabis here today).
