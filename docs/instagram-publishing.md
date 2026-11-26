# Instagram publishing: @5abiaagayeoye

This system extends the existing history/comic editorial flow without changing the
website's existing publishing rules. **No Instagram post is published by creating
an article or a comic.** Only a separately reviewed Instagram carousel PR is eligible.

## What exists

- Existing comic generator: `.github/workflows/history-comic.yml`
- Instagram JPEG exporter: `scripts/instagram_prepare.py`
- Reviewable carousel PR: `.github/workflows/instagram-prepare.yml`
- Instagram publisher: `scripts/instagram_publish.mjs`
- Auto-publish on merge (new manifests only): `.github/workflows/instagram-publish.yml`

The source pages are already saved under
`public/history-comics/generated/<slug>/page-1.webp` etc., with captions and titles
in `comic.json`. The exporter creates **six 1080x1350 JPEG slides**, retaining
original artwork and including branded title panels. Its manifest is stored under
`public/instagram/<slug>/manifest.json` and is reviewed alongside those images.

### Editorial process

1. A person reviews the history article and approves publishing on the website.
2. A person reviews the complete comic, fixing any inaccurate illustrations or emotions.
3. In GitHub Actions run **Prepare Instagram comic carousel** with an existing comic slug.
4. Inspect **every slide and caption** in the generated Instagram PR.
5. Merge the Instagram PR only when ready for the account to publish.
6. If Instagram API secrets have been configured, a push to `main` with a *new*
   Instagram manifest automatically publishes it as a carousel. If not configured,
   the publisher skips with a clear log entry and the content is still available
   for later manual publishing.
7. The publisher comments on the matching GitHub history issue with an
   `[instagram-published:<slug>]` marker and media ID. Future executions check
   this marker and recent account posts to reduce accidental double-publishing.

A merged PR, not a timer, is the final human editorial approval. Never auto-publish
drafts, unverified sources, or comic illustrations that have not been checked.
The scripts reuse the *existing* approved comic images and never call image-generation
models. Instagram does not receive the complete article text in the feed; the
caption points readers back to the website through the account's bio.

## One-time Instagram connection

Instagram does **not** publish through GitHub alone. The account needs authorized
Meta publishing API access. Use the official **Instagram API with Instagram Login**
route (no Facebook Page required with that route):

1. Switch Instagram `@5abiaagayeoye` to a **professional Business or Creator**
   account, if it is still personal.
2. Use Meta for Developers to create/configure an app with Instagram API access.
   Grant/authorize publishing for this Instagram account. The relevant permissions
   include `instagram_business_basic` and
   `instagram_business_content_publish`, subject to Meta's app/access requirements.
3. Obtain the numerical Instagram user ID and a working Instagram user access
   token with permission to publish. Set up token renewal/rotation before expiry.
4. In GitHub: **Settings → Secrets and variables → Actions**, add two repository
   secrets:
   - `INSTAGRAM_USER_ID`
   - `INSTAGRAM_ACCESS_TOKEN`
   Optionally set the Actions variable `INSTAGRAM_API_VERSION` (default: `v27.0`).
5. Set the account bio link to `https://panjabiaagayeoye.com`. Instagram caption
   links are generally not clickable, so the captions say "link in bio".

**Never** paste credentials into issues, PRs, committed files, or the website.
GitHub Actions injects them through secrets only.

For reference: https://developers.facebook.com/docs/instagram-platform/content-publishing/
and https://docs.github.com/en/actions/security-for-github-actions/security-guides/using-secrets-in-github-actions

## First dry run and initial rollout

Start with the already published Vancouver or Bellingham comic, after checking
that its existing visuals and captions match the approved historical account.

In **Actions → Prepare Instagram comic carousel**, enter the exact directory name
from `public/history-comics/generated`. Check the resulting PR and merge only when
ready. The JPEGs are public static assets on the website after deployment.

Use **Actions → Publish reviewed Instagram carousel** with the same slug, leaving
`publish = false` for a safe dry run. Set `publish = true` only to actually post.

With Meta credentials set, future approved Instagram carousel PR merges trigger
the publishing workflow automatically. The action waits for the public JPEG assets
to become available on the deployed website before calling Meta.

**Known limitation:** Meta may change permission, token, account, image and API
requirements; test one post first. A Meta post can succeed even if the GitHub
issue-comment ledger write fails; the publisher also checks recent account captions
to reduce duplicates, but the latest media list is not a permanent transaction log.
Inspect action logs after any uncertain failure before re-running.
