# Panjabi Aa Gaye Oye — Event & Culture Hub v3.11.0

This Cloudflare Worker package extends the existing Seattle event calendar into a Seattle–Vancouver culture hub.

## v3.11.0 reviewed comic automation

Published history articles can now receive their own optional six-page kids’ comic without making the main History page busy.

- Add the label **`make-comic`** to an open issue that already has the **`history`** label.
- GitHub Actions first runs every test. Claude then adapts only the published article into a six-page child-friendly storyboard; it does not search for or add new facts.
- OpenAI generates six landscape illustrations using the existing orange-turban child as the recurring-character reference.
- Lettering is never generated inside the artwork. Titles and captions remain safe, editable HTML.
- The automation opens a pull request for review. It never publishes the comic by itself. Merging the pull request publishes it through the normal deploy workflow.
- Once published, the article links to `/history/<article-slug>/kids`. The simple `/history` article list remains unchanged.
- An existing comic is not regenerated accidentally, preventing duplicate API charges. A deliberate replacement requires the manual workflow’s **force** option.

### One-time comic setup

1. In GitHub, open **Settings → Secrets and variables → Actions**. Under **Repository secrets**, confirm all three names exist:
   - `ANTHROPIC_API_KEY`
   - `OPENAI_API_KEY`
   - `GITHUB_TOKEN` is supplied automatically by GitHub Actions; do not paste either AI key into a file.
2. Under **Settings → Actions → General → Workflow permissions**, choose **Read and write permissions** and enable **Allow GitHub Actions to create and approve pull requests**. Save.
3. In **Issues → Labels**, create `make-comic` if it does not already exist.
4. Push this package to `main`. The new **Make kids comic** workflow will appear under Actions.

### Make a comic for an article

1. Open the published history issue.
2. Confirm it has the `history` label and that you have reviewed the article’s dates, claims, quotations and sources.
3. Add the `make-comic` label. That is the only trigger needed.
4. Wait for **Actions → Make kids comic** to finish. The issue receives a comment linking to a review pull request.
5. Open the pull request and check all six pictures and captions. If anything is inaccurate, do not merge it.
6. When everything is correct, choose **Merge pull request**. The normal deploy Action publishes the article-specific comic.

Each run makes one Claude storyboard request and six OpenAI image-edit requests. OpenAI usage is visible at [platform.openai.com/usage](https://platform.openai.com/usage); Anthropic usage is visible in the Anthropic Console. The workflow uses `gpt-image-2.5-sunburst` at medium quality by default. You can set the repository variable `OPENAI_IMAGE_MODEL` to a compatible image model if needed.

To remake a comic that is already on `main`, open **Actions → Make kids comic → Run workflow**, enter the issue number, and check **force**. This intentionally spends for six new images and creates another review pull request.

## v3.10.2 simpler history page

- The main History page is now only a clean chronological list of published articles.
- The seven-chapter roadmap and its “Story so far / Newest first” controls are removed from the main page.
- The kids comic is no longer promoted at the top. A small optional link appears after the article list.
- The six-page flipbook remains available only at `/history/kids`.

## v3.10.1 simplified history page

- Restores `/history` to the simpler chronological article archive. The seven-stop children's timeline and full comic no longer compete with the main history list.
- Adds one small **Open the kids’ comic** link on the History page. The six-page swipeable comic now lives by itself at `/history/kids`.
- Removes the decorative religious symbol from both the History design and the homepage history preview.
- Reduces the event map from 460 to 300 pixels high on larger screens and from 360 to 240 pixels on phones.
- The dedicated comic remains fully readable by crawlers and is included in the sitemap.
- No database migration is required.

## v3.10.0 page-turning kids’ history and archive photographs

- Replaces the dense six-panel **Why They Left** sheet with six separate illustrated pages. Children can use Previous/Next, page dots, keyboard arrows or a horizontal swipe.
- The illustrations contain no generated lettering. Exact titles, captions and image descriptions are real HTML, which keeps them readable, searchable, accessible and easy to correct.
- Every comic page remains present in the server HTML so crawlers can read the complete story without executing JavaScript.
- History issues can now add one historical photograph with caption, creator credit, original file/record link, licence name and licence link. Article pages display all of that information together beneath the image.
- For Wikimedia Commons, use the direct image URL for **Historical image URL** and the Commons file-description page for **Historical image source URL**. Copy the credit and licence exactly from that page; never assume every Wikipedia image is reusable.
- No database migration is required.

**Kesur Singh example**

The Commons file page identifies the portrait as an unknown photographer's image published in *The Navy and Army Illustrated* on 10 December 1897 and marks the scan as public domain. Paste the original image address into **Historical image URL**, that file page into **Historical image source URL**, `Unknown photographer` into **Historical image credit**, and `Public domain` into **Historical image license**.

## v3.9.9 Tacoma stand-up comedy sources

- Adds the official Tacoma Comedy Club calendar and Nate Jackson's Super Funny Comedy Club calendar.
- Both are focused venue sources. The collector follows recognized South Asian comedians and cultural terms, but rejects unrelated acts and general club listings.
- Russell Peters is already in the recognized comedian list, so a listing bearing his name is kept and categorized as comedy.
- Tacoma has its own `venues-tacoma` refresh group. This keeps both clubs inside Cloudflare's free-plan request budget; all 12 groups now complete a rotation in about four hours.
- No database migration is required.

## v3.9.8 Rainier Arts Center

- Adds the official Rainier Arts Center event calendar to the rotating `venues-seattle` collection group.
- Rainier remains a focused venue source, not a trusted all-events source. Recognized South Asian performers and cultural terms are kept; unrelated meetings, rentals and general venue events are rejected.
- Current comedian matching already includes Gurleen Pannu and Jaspreet Singh, and qualifying listings are categorized as stand-up comedy.
- The Seattle venue group remains within the Cloudflare free-plan request budget.
- No database migration is required.

## v3.9.7 kids’ visual history

- `/history` now begins with a colourful seven-stop story line for families and classrooms (roughly ages 8–13), followed by the complete archive on the same page.
- The journey starts with the reasons people left Panjab, continues through the first documented arrivals, exclusion and family separation, and ends with the communities here today.
- Published history articles automatically appear under the correct visual stop according to their **Year**. Each card opens the complete source-backed article.
- The History issue form has an optional **Kids summary**. Older articles need no editing: their regular Summary is used until a kids summary is added.
- Future Claude drafts include a child-friendly summary, but it must stay within the sourced article and cannot simplify away uncertainty.
- The seven-stop explanation and published article cards are server-rendered, so children, schools and search crawlers do not need JavaScript to read them.
- No database migration is required.

## v3.9.6 event map and search visibility

- The homepage and **Happening this weekend** page now have an interactive OpenStreetMap map. Markers group events by city and open links to the site's own permanent event pages. The map uses city centres because many source listings do not supply trustworthy coordinates; the event page keeps the exact venue and directions.
- Search, category and region filters update the map and event list together. If the map service is unavailable, every event remains usable in the list.
- The map is a JavaScript enhancement, not the content source. The Worker still server-renders the first event cards so crawlers, link-preview tools and people without JavaScript can read them.
- `/travel` now server-renders its current WSDOT and DriveBC briefing, source links, canonical URL and social metadata. Crawlers no longer receive only “Checking WSDOT and DriveBC…”.
- `/sitemap.xml` explicitly includes Weekend, Travel, Archive, every published history article and every visible current or archived event page, with duplicates removed.
- No database migration or map API key is required.

**Deploy this update on a Mac**

```sh
cd ~/Downloads/panjabi-aa-gaye-oye-v3.10.2-clean-history
npm install
npm test
npx wrangler deploy
curl -s https://panjabiaagayeoye.com/health
```

The final command should show `"version":"3.10.2"`. Cloudflare Worker secrets already attached to the existing Worker remain in place. Do not create a new Worker name. If GitHub Actions normally deploys the site, copy these files into the existing Git repository, commit and push instead; the included workflow runs the tests before deployment.

## v3.9 smarter duplicate screening

The public calendar now groups cross-source copies even when their titles differ slightly, one source omits the city, or a link contains advertising/tracking parameters. It keeps the richest listing—giving extra weight to manually edited events—and still preserves events on different dates or in different cities. Existing database rows do not need to be deleted; the improved screening takes effect when this Worker is deployed.

## v3.8 permanent event pages and community memories

Every event now opens on its own Panjabi Aa Gaye Oye page instead of sending the visitor directly to a ticket seller. The page includes the date, performer, venue, directions, official ticket link, social previews and sharing buttons for the phone, WhatsApp, Facebook, email and copy link. It also contains `Event` structured data for search engines.

**New visitor pages**

- `/weekend` is a dedicated Friday-through-Sunday view with Seattle and Vancouver filters.
- `/travel` combines current official DriveBC and WSDOT corridor advisories with direct links to WSDOT, DriveBC and U.S. border wait times. Visitors are reminded to confirm conditions with the agency.
- `/archive` keeps expired events searchable by artist, year, city and venue. Collection jobs deactivate old events but do not delete them.
- `/events/<id>-<title>` is the permanent event or memory page. An old title redirects to the current address.

**Edit from GitHub without deploying**

Create these labels once under **GitHub repository → Issues → Labels**:

- `event-hide`
- `event-media`
- `event-story`

The package includes matching Issue forms:

1. **Hide a duplicate or incorrect event** — paste the local event URL. Keep the issue open to hide it; close it to restore it. An optional preferred URL redirects a duplicate to the correct listing.
2. **Add a community event video** — attach a YouTube or direct HTTPS MP4/WebM link to a current or expired event. The required checkbox confirms that you recorded it or have permission to share it.
3. **Write an event story** — add a description, review or memory from a phone. Editing the issue updates the event page without deployment. Visitors can comment on that GitHub issue; safely rendered copies of the comments appear on the event page. Delete an unwanted comment in GitHub to moderate it.

For Diljit and Karan Aujla Vancouver videos, upload each recording to YouTube as **Public** or **Unlisted**, open its matching past event in `/archive`, select **Add a community video**, and paste the YouTube link. If the old show is not in the archive, use **Add an event link** first, enter its original date and add the `approved` label; manual past events are accepted specifically for memory pages. Direct video links are supported, but YouTube is normally faster and cheaper than serving video through the Worker.

**Required upgrade commands**

Migration `0005_event_details.sql` adds performer, venue-address and video fields. On Windows PowerShell, use the `.cmd` commands below so the PowerShell execution policy does not block npm:

```powershell
cd "C:\path\to\panjabi-site-v3.9-smarter-event-dedupe"
npm.cmd install
npm.cmd test
npx.cmd wrangler login
npm.cmd run db:migrate:remote
npm.cmd run deploy
```

Do not skip the remote migration. It preserves every existing event and only adds new columns.

## v3.7 the arrival series, and a weekly history routine

*Panjabi aa gaye oye* means "the Punjabis have arrived." The history section now tells how, in order.

**The timeline**
- Articles have a **Year** (new optional field in the History issue form). The year puts each article in a
  chapter: Before the journey, The first arrivals (1897 to 1907), Putting down roots (1908 to 1914), The
  exclusion years (1915 to 1946), The doors reopen (1947 to 1967), Building a home (1968 to 1999), and Punjabis
  here today (2000 onward). Articles without a year sit under "Culture and heritage".
- The History page opens as **The story so far**, with chapter headings, and can switch to **Newest first**.
  Each article page names its chapter and year and ends with "Keep following the story": the articles closest
  in time.
- Article pages show a short note when the **AI assistance** field says the article was drafted with AI.

**The weekly routine** (details in `editorial/README.md`)
- `editorial/calendar.json` holds the editorial topic bank. Weekly automation follows the North American arrival topics in strict story order, starting with 1897; anniversary weeks do not jump the queue
  (Vaisakhi in April, the Komagata Maru in May, Bellingham in September).
- `.github/workflows/weekly-history-draft.yml` runs every Monday. It asks Claude to research the next topic with
  web search and opens a **draft** GitHub issue. Drafts are invisible on the site until you add the `history`
  label. Nothing is ever published automatically.
- Safeguards: only source links the search tool actually returned stay under Sources (any other link is moved
  to private notes); long quotations are listed for checking; drafts that are too short or have no sources are
  refused; Partition, 1984 and Air India 1985 are never auto-drafted.
- `editorial/STYLE_GUIDE.md` is both the drafting instruction and your review checklist (about 15 minutes).
- Three researched starter articles are in `editorial/ready/` (Bellingham 1907, the Komagata Maru 1914, the
  Ghadar Party in Astoria 1913), each with private verification notes listing where the sources disagree.

**Setup**
1. Add a repository secret `ANTHROPIC_API_KEY` (Settings, Secrets and variables, Actions). Optional variable:
   `ANTHROPIC_MODEL` (default `claude-sonnet-5`).
2. Push, then run the workflow once per starter article (Actions, Weekly history draft, Run workflow, set
   `ready_file` to `editorial/ready/01-bellingham-1907.md`, and so on). This needs no API key.
3. Review each draft issue, fix what you find, and add the `history` label.
4. Test locally without creating anything: `node scripts/weekly-history-draft.mjs --dry-run`.

## v3.6 screening and discovery

Fewer routine Gurdwara listings, more DJ and comedy events:

- **Routine Gurdwara programs are caught by pattern.** Sunday Diwan, Weekly Kirtan Program, Sukhmani Sahib
  Path, Asa Di Vaar, Rehras Sahib, Nitnem, Sangrand, gurmat and Punjabi school classes, langar seva and similar
  are dropped. Titles that name a special occasion or a guest (Gurpurab, Vaisakhi, Nagar Kirtan, Akhand Path,
  "with Bhai ...", visiting jatha, annual, camp ...) still pass.
- **Comedians are searched on Ticketmaster by name** in two new groups (`tickets-comedy-a` and
  `tickets-comedy-b`), plus "desi comedy", "indian comedy" and "punjabi comedy". A show titled just
  "Tathastu Tour" is found and marked as comedy. Edit `COMEDIAN_TERMS` in `src/config.js` to change the list.
- **Eventbrite searches** now cover punjabi, bollywood, desi, indian, punjabi-dj, bollywood-dj, desi-comedy
  and indian-comedy in both Seattle and Vancouver, and read up to 8 event pages per run.
- **A community source is back.** Bollywood Seattle (Meetup) is added as a trusted source in a new `community`
  group. Simply Desi, Seattle Center Festál and Seattle Indian are still missing because their addresses are not
  in this project. Add each as one line in `EVENT_SOURCES` (see the example comment) with `trusted:true`.
- **Ticket products are rejected** even when they name a headliner: VIP parking, VIP package or upgrade or
  experience, official platinum, club level, suite rental, private suite, loge box, premium seating, meet and
  greet, soundcheck and similar. Any title with "parking" is rejected unless it says "parking lot".
- **"Indian" alone no longer counts.** It has to sit next to a cultural word (music, night, comedy, festival,
  Diwali, wedding ...). Indian Gaming Conference, Indian Scout Demo Day, Indian Days Powwow, Indian Wells and
  similar are rejected.
- **Approved GitHub events still skip keyword screening,** but an approved issue whose title is obviously a
  parking pass or VIP package is refused.
- **DJ names.** DJ Sats, DJ Prashant, DJ Tejas and a few others seen on Seattle Bollywood nights are
  recognized in titles.
- **Schedule:** the cron is now every 20 minutes across 12 groups (about 4 hours per cycle). Change
  `crons` in `wrangler.toml` before deploying; run the new groups once with the loop under "Upgrading from 3.3".

## v3.5 news and history

**History**
- **Your own articles are now real pages.** A history issue on GitHub (label `history`) is published at
  `/history/<number>-<title>` with the full text, byline, reading time, topics, a "Sources & further reading"
  list and share previews (WhatsApp, iMessage, Facebook). Before, the card sent readers to the GitHub issue.
  Editing the issue updates the page within about 5 minutes; closing it (or removing the label) unpublishes it.
  The renderer escapes everything, allows only http(s) links and https images, and supports headings,
  lists, quotes, bold, italic and links.
- **New optional fields in the History issue form:** Topics (become filter buttons), Byline, Cover image URL.
  Existing issues keep working.
- **The Sikh Research Institute collector was fixed.** It matched every link (the site's own name contains
  "sikh"), followed one, and found nothing. It now looks for article links by path, opens a few new ones per
  run, and reads each page's Open Graph title, summary, picture and date. Already-stored articles are not
  fetched again. Adjust `pathPattern` in `HISTORY_SOURCES` if the site's article addresses differ.
- **A dynamic `/sitemap.xml`** lists every published article.
- **History page:** lead story, search, topic filters, "Our article" versus "Reading link" labels, load more.

**News**
- **PTC Punjabi and the Rolling Stone India Punjabi tag are trusted feeds** (everything in them is Punjabi
  music), so their stories are no longer discarded for lacking a keyword. BritAsia is still filtered, now
  with a broader term and artist list.
- **Dates no longer reset.** Stories without a date used to be stamped "now" on every refresh, which kept old
  items at the top. A story now keeps the date it was first seen.
- **Pictures are found inside feed text**, the same story from two feeds appears once, and stories older than
  120 days drop off (`NEWS_MAX_AGE_DAYS`).
- **News page:** lead story, search, source filters, "3h ago" times, load more, and pictures that fail to load
  are hidden.
- **The health panel explains news and history sources** too, for example "Feed has no items" (check the feed
  address) or "6 found, none kept" with examples.

To add a news feed, add a line to `NEWS_SOURCES` in `src/config.js` (`trusted:true` if everything in it is
Punjabi music). Upgrade steps are the same as for 3.4; there is no new migration.

## v3.4 collection fixes

Why events were missing, and what changed:

- **Ticketmaster is searched by keyword.** It used to read only the 200 soonest events of any kind, so shows
  a few weeks out never appeared. It now searches punjabi, bhangra, bollywood, desi, sikh and hindi plus a
  list of touring artists (`TICKETMASTER_KEYWORDS` in `src/config.js`). Performers count as an identity signal,
  so "DIL-LUMINATI TOUR" is kept because Diljit Dosanjh is the headliner. The card shows "Featuring ...".
- **Event pages are read correctly.** Ticketing sites label events `MusicEvent`, `TheaterEvent`,
  `ComedyEvent` and so on. Only plain `Event` was accepted before. Events inside an `ItemList`, cancelled
  events and multi-location events are handled too.
- **More than one link per calendar is followed** (up to 5 per source instead of 1). Venue calendars only
  open links that look South Asian; Gurdwara and community sites open any event-looking link.
- **A wider, Unicode-aware word list.** Adds artists, Sikh and Punjabi terms (gurpurab, khalsa, lohri, jashan ...)
  and Gurmukhi/Devanagari words. The event's own description now counts when it contains a strong cultural
  word (punjabi, bhangra, sikh, gurdwara, kirtan ...).
- **Events you approve on GitHub are never screened out.** Closing the issue (or removing `approved`) takes the
  event off the site.
- **`trusted: true` sources.** For a listings site that is South Asian by nature, set `trusted:true` on the
  source in `EVENT_SOURCES` and only noise (parking passes and so on) is rejected.
- **Database conflict fixed.** A rescheduled event, or several dates sharing one page ID, used to make the
  database reject a whole batch of events. Events now update in place, and one bad row cannot hide the rest.
- **Rotating refresh.** The cron runs every 20 minutes and each run collects one group of sources, so a run
  never exceeds Cloudflare's request limit even with the extra searches. Every group refreshes about every
  4 hours.
- **A health panel that explains itself.** Each source now says whether it needs setup, is blocked, loaded a
  page with no event data, or found listings that were all screened out (with examples).

### Upgrading from 3.3

1. Apply the additive migration (adds the diagnostics columns; the site keeps working without it):

   ```sh
   npm install
   npm run db:migrate:remote
   ```

2. Add the two missing secrets (these are why "Add an event link" and SeatGeek were not working):

   ```sh
   npx wrangler secret put GITHUB_REPO      # YOUR-GITHUB-USERNAME/YOUR-REPOSITORY
   npx wrangler secret put SEATGEEK_CLIENT_ID
   ```

3. Deploy: `npm run deploy` (or push to `main`; the workflow tests, migrates and deploys).
4. Fill the calendar right away instead of waiting a few hours. Run each group once:

   ```sh
   for g in tickets-core tickets-artists-a tickets-artists-b tickets-comedy-a tickets-comedy-b venues-seattle venues-vancouver religious marketplaces community editorial; do
     curl -s -X POST "https://panjabiaagayeoye.com/api/admin/refresh?group=$g" -H "Authorization: Bearer YOUR_ADMIN_KEY"
     sleep 25
   done
   ```

   `POST /api/admin/refresh` with no group lists the groups. `?group=all` runs everything in one go and is only
   for paid Workers plans.
5. Open the "Event source health" panel at the bottom of the homepage.

### Adding or fixing sources

- Add a line to `EVENT_SOURCES` in `src/config.js` with a `group` (use `marketplaces` for new community sites).
- A source that says **No event data found** loaded fine but has no machine-readable events. It needs a different
  method (a calendar feed, or `/submit-event`), not more keywords.
- Missing an artist? Add the name to `ARTIST_TERMS` (and to `TICKETMASTER_KEYWORDS` if you want it searched).
- The sources Simply Desi, Seattle Center Festal, Seattle Indian and Eventbrite Indian Events were dropped
  before 3.3. They show under "Not collected in this version". To bring one back, add it to `EVENT_SOURCES`
  with `type:'community'`, `trusted:true` and its address.

## v3.3 expanded events

- Restores broad Ticketmaster discovery across the Seattle and Vancouver regions.
- Restores public Eventbrite discovery for Punjabi and Bollywood listings.
- Adds Punjabi/Indian DJ nights and a curated set of South Asian stand-up comedians while continuing to reject unrelated nightlife and comedy.
- Restores approved GitHub manual events and adds a one-link event issue form at `/submit-event`.
- Adds Auburn Performing Arts Center, Federal Way Performing Arts & Event Center and accesso ShoWare Center.
- Keeps external requests within a conservative Worker refresh budget to avoid subrequest-limit failures.

## v3.2 Gurdwara calendar cleanup

- Removes automatically generated weekly Sunday Gurdwara listings.
- Deactivates previously stored “Regular Sunday Program” and recurring “Family Youth Kirtan Darbar” entries during the next refresh.
- Continues collecting special Gurpurab, Kirtan, Vaisakhi, Nagar Kirtan, camp and other noteworthy Gurdwara events.

## v3.1 event-screening update

- Preserves the V3 history page, Punjabi music-news page and GitHub history publishing.
- Applies the same identity screening to venue and ticketing feeds; venue pages no longer bypass relevance checks.
- Requires a Punjabi, Sikh, Indian or South Asian signal in the event title. Trusted religious sources may also use their program description so recurring Kirtan/Divan listings remain visible.
- Rejects ticket add-ons such as Amplified Access, parking, lounge access, early-entry and premium upgrades.
- Re-screens stored future events after every refresh and deactivates old false positives.
- Retains both Seattle and Vancouver-area coverage.

## Included

- Live event API and filterable events page
- Seattle Theatre Group, TicketLeader Vancouver, Bell Performing Arts Centre and Vancouver Civic Theatres collectors
- Dedicated Sikh/religious sources for Renton and Surrey, including recurring Sunday programs
- SeatGeek event API adapter for Seattle and Vancouver
- Ticketmaster and Eventbrite event collectors for Seattle and Vancouver
- Approved GitHub event submissions with automatic linked-page extraction
- Separate `/news` page using attributed RSS metadata from PTC Punjabi, BritAsia TV and Rolling Stone India
- Separate `/history` page using source-backed reading links from SikhRI plus editorial seed articles
- Source-health panel that reports crawler failures instead of silently returning nothing
- Rotating scheduled refresh (every 20 minutes, one group per run) and a manual authenticated refresh endpoint

## Publish history from a phone

History posts can come from GitHub Issues, so publishing a story does not require a new site deployment.

1. Put this project in a public GitHub repository.
2. In the GitHub mobile app, open the repository and choose **Issues → New issue → History article**.
3. Enter the title, summary, source links and article text.
4. Keep the automatically added `history` label and submit the issue. Add the `featured` label to keep an article at the top.
5. Edit the issue to update the story, or close it to remove it from the live feed. Changes normally appear within five minutes.

Connect the repository to the Worker once:

```sh
npx wrangler secret put GITHUB_REPO
```

Enter `YOUR-GITHUB-USERNAME/YOUR-REPOSITORY`.

### Prevent GitHub API rate limits

The Worker reads published history, event moderation and event stories from GitHub Issues. Add a fine-grained personal access token even when the repository is public so those requests are authenticated instead of sharing GitHub's much smaller anonymous allowance.

1. In GitHub, open **Settings → Developer settings → Personal access tokens → Fine-grained tokens** and choose **Generate new token**.
2. Give it an expiry date and select only this site's repository under **Repository access**.
3. Under **Repository permissions**, set **Issues** to **Read-only**. Leave every other permission at its default; GitHub adds read-only Metadata automatically.
4. Copy the token once. In this project folder run:

   ```sh
   npx wrangler secret put GITHUB_TOKEN
   ```

   Paste the token when Wrangler asks for the value. Do not put it in `wrangler.toml`, `.env`, source code or a GitHub issue.
5. Confirm Cloudflare has the secret (its value will not be displayed):

   ```sh
   npx wrangler secret list
   ```

`src/worker.js` adds `Authorization: Bearer …` to every GitHub API call whenever this Worker secret is present. After adding or rotating the token, deploy again with `npm run deploy`.

Code and design changes are different: the included GitHub Action automatically tests and deploys them after a push to `main`. Add `CLOUDFLARE_API_TOKEN` and `CLOUDFLARE_ACCOUNT_ID` under **Repository Settings → Secrets and variables → Actions** once. History issues bypass that deployment workflow entirely.

## Install over the existing Worker

1. Confirm the D1 database binding in `wrangler.toml` still points to `punjabi-seattle-events-v2`.
2. Install dependencies: `npm install`.
3. Sign in if this computer has not used Wrangler before: `npx wrangler login`.
4. Apply the additive migration: `npm run db:migrate:remote`.
5. Add the admin secret:

   ```sh
   npx wrangler secret put ADMIN_KEY
   ```

6. After obtaining the free SeatGeek developer client ID, add it as a secret. Otherwise skip this step and the rest of the site will still work:

   ```sh
   npx wrangler secret put SEATGEEK_CLIENT_ID
   ```

   Keep the existing Ticketmaster key configured as `TICKETMASTER_API_KEY`. GitHub manual events use the same `GITHUB_REPO` and optional `GITHUB_TOKEN` settings as history publishing. Add the `approved` label to an event issue to publish it.

7. Deploy: `npm run deploy`.
8. Start the first collection, one group at a time (see "Upgrading from 3.3" above for the loop):

   ```sh
   curl -X POST "https://YOUR-WORKER/api/admin/refresh?group=tickets-core" \
     -H "Authorization: Bearer YOUR_ADMIN_KEY"
   ```

9. Check `/api/sources` and the “Event source health” panel on the homepage.

## SeatGeek key

Request a developer key from the SeatGeek developer portal. The collector uses only the public client ID to search future Punjabi and Bhangra events within 100 miles of Seattle and Vancouver. Until the secret is present, the rest of the site keeps working and SeatGeek appears as “Client ID needed.” Do not put the value in frontend JavaScript.

## Domain cutover

Both the root domain and `www` are configured as Worker Custom Domains in `wrangler.toml`. Cloudflare should create the required web DNS records and certificates during deployment. If it reports a conflicting GoDaddy web record, remove only the conflicting root/`www` web record in Cloudflare DNS and deploy again. Keep MX, SPF, DKIM and all other mail records unchanged.

## Editorial safeguards

The music page is intentionally “Music News,” not an automated rumor page. It stores a headline, short excerpt, publisher, date, image metadata and outbound link only. The history page also links back to named sources. Full articles are never copied.

## Local verification

```sh
npm test
npm run db:migrate:local
npm run dev
```

Then open `http://localhost:8787` and trigger a local refresh with the locally configured `ADMIN_KEY`.
