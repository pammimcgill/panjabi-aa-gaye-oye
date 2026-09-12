# Panjabi Aa Gaye Oye — Event & Culture Hub v3

This Cloudflare Worker package extends the existing Seattle event calendar into a Seattle–Vancouver culture hub.

## Included

- Live event API and filterable events page
- Seattle Theatre Group, TicketLeader Vancouver, Bell Performing Arts Centre and Vancouver Civic Theatres collectors
- Dedicated Sikh/religious sources for Renton and Surrey, including recurring Sunday programs
- SeatGeek event API adapter for Seattle and Vancouver
- Separate `/news` page using attributed RSS metadata from PTC Punjabi, BritAsia TV and Rolling Stone India
- Separate `/history` page using source-backed reading links from SikhRI plus editorial seed articles
- Source-health panel that reports crawler failures instead of silently returning nothing
- Six-hour scheduled refresh and manual authenticated refresh endpoint

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

Enter `YOUR-GITHUB-USERNAME/YOUR-REPOSITORY`. Public repositories need no GitHub token. For a private repository, also store a read-only fine-grained token with `npx wrangler secret put GITHUB_TOKEN`.

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

7. Deploy: `npm run deploy`.
8. Start the first collection:

   ```sh
   curl -X POST https://YOUR-WORKER/api/admin/refresh \
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
