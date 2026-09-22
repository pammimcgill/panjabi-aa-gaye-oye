import test from 'node:test';
import assert from 'node:assert/strict';
import { renderMarkdown, parseHistoryIssue, extractSources, slugify, articleNumber, isHistoryIssue, articlePage, sitemapXml, readingMinutes } from '../src/articles.js';
import { parseFeed, extractOpenGraph } from '../src/parsers.js';
import { collectNewsSource, collectHistorySource } from '../src/collectors.js';
import { NEWS_SOURCES } from '../src/config.js';
import { describeSource } from '../src/health.js';
import worker from '../src/worker.js';
import { createDb } from '../tests-support/d1-shim.js';

const run = () => ({ fetches: 0, limit: 100, delayMs: 0 });
const withFetch = async (handler, fn) => { const real = globalThis.fetch; globalThis.fetch = handler; try { return await fn(); } finally { globalThis.fetch = real; } };
const iso = daysAgo => new Date(Date.now() - daysAgo * 86400000).toUTCString();

// ---------------------------------------------------------------- markdown safety
test('markdown renders structure and escapes everything dangerous', () => {
  const html = renderMarkdown('## Heading\n\nText with **bold**, _italic_ and [a link](https://x.org/a?b=1&c=2).\n\n- one\n- two\n\n1. first\n2. second\n\n> quoted\n\n---');
  assert.match(html, /<h3>Heading<\/h3>/); assert.match(html, /<strong>bold<\/strong>/); assert.match(html, /<ul><li>one<\/li>/);
  assert.match(html, /<ol>/); assert.match(html, /<blockquote>quoted<\/blockquote>/); assert.match(html, /<hr>/);
  assert.match(html, /href="https:\/\/x\.org\/a\?b=1&amp;c=2" target="_blank" rel="noopener noreferrer nofollow"/);
});

test('markdown cannot inject scripts, event handlers or javascript: links', () => {
  const html = renderMarkdown('<script>alert(1)</script> <img src=x onerror=alert(1)>\n\n[bad](javascript:alert(1)) [worse](data:text/html;base64,AAAA) ![x](http://insecure.example/i.png) [q](https://x.org/"onmouseover="alert(1))');
  assert.ok(!/<script/i.test(html)); assert.ok(!/<img src=x/i.test(html));
  assert.ok(!/href="javascript:/i.test(html)); assert.ok(!/href="data:/i.test(html));
  assert.ok(!/<img[^>]*insecure/i.test(html)); assert.ok(!/" onmouseover=/i.test(html));
});

// ---------------------------------------------------------------- GitHub issue -> article
const issue = (extra = {}) => ({ number: 42, title: '1947: Panjab, Partition & Memory', state: 'open', created_at: '2026-09-01T10:00:00Z', updated_at: '2026-09-02T10:00:00Z',
  labels: [{ name: 'history' }, { name: 'featured' }], html_url: 'https://github.com/o/r/issues/42',
  body: '### Summary\n\nWhy this matters.\n\n### Article\n\nFirst paragraph here.\n\nSecond paragraph.\n\n### Sources\n\n- [Panjab Digital Library](https://panjab.org.in/a)\n- https://sikhri.org/videos/x\n\n### Topics\n\nPartition, Diaspora\n\n### Byline\n\nA. Kaur\n\n### Cover image URL\n\nhttps://example.org/cover.jpg\n\n### Editorial check\n\n- [x] checked', ...extra });

test('parses a history issue form into an article', () => {
  const a = parseHistoryIssue(issue());
  assert.equal(a.slug, '42-1947-panjab-partition-memory'); assert.equal(a.dek, 'Why this matters.');
  assert.deepEqual(a.topics, ['Partition', 'Diaspora']); assert.equal(a.byline, 'A. Kaur'); assert.equal(a.featured, true);
  assert.equal(a.imageUrl, 'https://example.org/cover.jpg'); assert.match(a.body, /^First paragraph/); assert.ok(!/Sources/.test(a.body));
  assert.deepEqual(a.sources.map(s => s.label), ['Panjab Digital Library', 'sikhri.org']);
});

test('a free-form issue still works; defaults are safe', () => {
  const a = parseHistoryIssue(issue({ body: 'Just a plain write-up of the story of the Ghadar movement.' }));
  assert.match(a.dek, /Ghadar movement/); assert.equal(a.byline, 'Editorial desk'); assert.deepEqual(a.topics, []);
  assert.equal(parseHistoryIssue(issue({ body: '### Cover image URL\n\nhttp://insecure.example/x.jpg\n\n### Article\n\nx' })).imageUrl, null);
});

test('slugs, article numbers and eligibility', () => {
  assert.equal(slugify('  Sikh Empire — Maharaja Ranjit Singh! '), 'sikh-empire-maharaja-ranjit-singh');
  assert.equal(articleNumber('42-any-old-title'), 42); assert.equal(articleNumber('nope'), null);
  assert.equal(isHistoryIssue(issue()), true); assert.equal(isHistoryIssue(issue({ state: 'closed' })), false);
  assert.equal(isHistoryIssue(issue({ labels: [{ name: 'bug' }] })), false); assert.equal(isHistoryIssue(issue({ pull_request: {} })), false);
  assert.equal(readingMinutes('word '.repeat(450)), 2);
  assert.equal(extractSources('- Some Book (1999): https://books.example/b.').length, 1);
});

test('article page has share tags, escapes titles and lists sources', () => {
  const a = parseHistoryIssue(issue({ title: 'Tricky <b>"title"</b>' }));
  const html = articlePage(a, { origin: 'https://site.test', more: [{ url: '/history/1-x', internal: true, title: 'Other', source: 'Panjabi Aa Gaye Oye' }] });
  assert.match(html, /<meta property="og:title" content="Tricky &lt;b&gt;&quot;title&quot;&lt;\/b&gt;">/);
  assert.match(html, /rel="canonical" href="https:\/\/site\.test\/history\/42-/); assert.match(html, /Sources &amp; further reading/);
  assert.match(html, /og:image" content="https:\/\/example\.org\/cover\.jpg"/); assert.ok(!/<b>"title"/.test(html)); assert.match(html, /Keep following the story/);
});

test('sitemap lists articles', () => {
  assert.match(sitemapXml('https://site.test', [{ slug: '42-x' }]), /<loc>https:\/\/site\.test\/history\/42-x<\/loc>/);
});

// ---------------------------------------------------------------- feeds and Open Graph
test('feeds: undated items stay undated and images are found inside the description', () => {
  const xml = `<rss><channel><item><title>Song drops</title><link>https://n.example/a</link>
    <description><![CDATA[<p><img src="/img/a.jpg"> Fresh single out now.</p>]]></description></item></channel></rss>`;
  const [item] = parseFeed(xml, 'https://n.example/feed');
  assert.equal(item.publishedAt, ''); assert.equal(item.imageUrl, 'https://n.example/img/a.jpg'); assert.match(item.dek, /Fresh single/);
});

test('reads Open Graph tags in any attribute order', () => {
  const og = extractOpenGraph(`<head><title>Fallback | Site</title><meta content="Real Title | Sikh Research Institute" property="og:title">
    <meta property='og:description' content='A &amp; B'><meta property="og:image" content="/i.jpg"><meta property="article:published_time" content="2025-02-03T04:05:06Z">
    <meta property="og:site_name" content="Sikh Research Institute"></head>`, 'https://sikhri.org/articles/x');
  assert.equal(og.title, 'Real Title | Sikh Research Institute'); assert.equal(og.dek, 'A & B');
  assert.equal(og.imageUrl, 'https://sikhri.org/i.jpg'); assert.equal(og.publishedAt, '2025-02-03T04:05:06Z');
});

// ---------------------------------------------------------------- news collector
const feedXml = items => `<rss><channel>${items.map(i => `<item><title>${i.title}</title><link>${i.link}</link>${i.date ? `<pubDate>${i.date}</pubDate>` : ''}<description>${i.dek || ''}</description></item>`).join('')}</channel></rss>`;

test('news: trusted feeds keep everything, others need a music term; old and duplicate stories are dropped', async t => {
  const db = await createDb(); if (!db) return t.skip('node:sqlite not available');
  const xml = feedXml([
    { title: 'Diljit announces tour', link: 'https://n/1', date: iso(1) },
    { title: 'Local election results', link: 'https://n/2', date: iso(1) },
    { title: 'Diljit announces tour', link: 'https://n/3', date: iso(2) },
    { title: 'Bhangra archive story', link: 'https://n/4', date: iso(400) }
  ]);
  await withFetch(async () => ({ ok: true, text: async () => xml, url: 'https://n/feed' }), async () => {
    const strict = await collectNewsSource(db, { key: 'strict', name: 'Strict', url: 'https://n/feed' }, run());
    assert.equal(strict.count, 1); assert.equal(strict.found, 4);
    const trusted = await collectNewsSource(db, { key: 'trusted', name: 'Trusted', url: 'https://n/feed', trusted: true }, run());
    assert.equal(trusted.count, 2);
    const status = db.sqlite.prepare("SELECT raw_count,rejected_count,sample_rejected FROM source_status WHERE source_key='strict'").get();
    assert.equal(status.raw_count, 4); assert.match(status.sample_rejected, /Local election results/);
  });
});

test('news: an undated story keeps its first-seen date on later refreshes', async t => {
  const db = await createDb(); if (!db) return t.skip('node:sqlite not available');
  const xml = feedXml([{ title: 'Undated bhangra story', link: 'https://n/u' }]);
  await withFetch(async () => ({ ok: true, text: async () => xml, url: 'https://n/feed' }), async () => {
    const source = { key: 'u', name: 'U', url: 'https://n/feed', trusted: true };
    await collectNewsSource(db, source, run());
    db.sqlite.exec("UPDATE content_items SET published_at='2026-01-01T00:00:00.000Z'");
    await collectNewsSource(db, source, run());
    assert.equal(db.sqlite.prepare('SELECT published_at FROM content_items WHERE section=\'music\'').get().published_at, '2026-01-01T00:00:00.000Z');
    assert.equal(db.sqlite.prepare('SELECT COUNT(*) n FROM content_items WHERE section=\'music\'').get().n, 1);
  });
});

test('the two Punjabi-only feeds are trusted; the general one is filtered', () => {
  assert.deepEqual(NEWS_SOURCES.filter(s => s.trusted).map(s => s.key), ['ptc', 'rollingstone-punjabi']);
});

// ---------------------------------------------------------------- history collector
test('history: finds article links, reads Open Graph, and only opens new ones on later runs', async t => {
  const db = await createDb(); if (!db) return t.skip('node:sqlite not available');
  const listing = '<nav><a href="/about">About</a><a href="/donate">Donate</a></nav>' + [1, 2, 3].map(i => `<a href="/articles/story-${i}">Story ${i}</a>`).join('') + '<a href="/articles/story-1#top">Story 1 again</a>';
  const page = i => `<head><title>x</title><meta property="og:title" content="Story ${i} | Sikh Research Institute"><meta property="og:description" content="About story ${i}"><meta property="og:image" content="/img/${i}.jpg"><meta property="og:site_name" content="Sikh Research Institute"><meta property="article:published_time" content="2025-01-0${i}T00:00:00Z"></head>`;
  const requested = [];
  await withFetch(async url => { requested.push(url); const m = url.match(/story-(\d)/); return { ok: true, url, text: async () => m ? page(m[1]) : listing }; }, async () => {
    const source = { key: 'sikhri', name: 'Sikh Research Institute', url: 'https://sikhri.org/articles', type: 'history', trusted: true, pathPattern: '^/articles/[^/]+' };
    const first = await collectHistorySource(db, source, run());
    assert.equal(first.count, 3); assert.equal(requested.length, 4);
    const row = db.sqlite.prepare("SELECT title,dek,image_url,published_at FROM content_items WHERE canonical_url LIKE '%story-2'").get();
    assert.equal(row.title, 'Story 2'); assert.equal(row.dek, 'About story 2'); assert.equal(row.image_url, 'https://sikhri.org/img/2.jpg'); assert.match(row.published_at, /2025-01-02/);
    requested.length = 0;
    const second = await collectHistorySource(db, source, run());
    assert.equal(second.count, 3); assert.equal(requested.length, 1, 'only the listing page is fetched once everything is known');
  });
});

test('history: a page with no article links is reported, not silently empty', async t => {
  const db = await createDb(); if (!db) return t.skip('node:sqlite not available');
  await withFetch(async url => ({ ok: true, url, text: async () => '<a href="/about">About</a>' }), async () => {
    const source = { key: 'h', name: 'H', url: 'https://h.example/articles', type: 'history', trusted: true, pathPattern: '^/articles/[^/]+' };
    await collectHistorySource(db, source, run());
    const row = db.sqlite.prepare("SELECT source_type,last_count,raw_count FROM source_status WHERE source_key='h'").get();
    assert.equal(describeSource(row).label, 'No article links found');
  });
});

test('health text for news feeds', () => {
  assert.equal(describeSource({ last_count: 0, raw_count: 0, source_type: 'news' }).label, 'Feed has no items');
  const d = describeSource({ last_count: 0, raw_count: 6, source_type: 'news', sample_rejected: JSON.stringify([{ title: 'Election', reason: 'no_music_keyword' }]) });
  assert.match(d.detail, /no Punjabi music keyword/);
});

// ---------------------------------------------------------------- worker routes and API
test('/history/<slug> renders our article, redirects a stale slug, and 404s anything else', async t => {
  const env = { GITHUB_REPO: 'o/r', SITE_ORIGIN: 'https://site.test' };
  let status = 200; let payload = issue();
  await withFetch(async url => ({ ok: status === 200, status, json: async () => (String(url).includes('/issues/42') ? payload : [payload]) }), async () => {
    const good = await worker.fetch(new Request('https://site.test/history/42-1947-panjab-partition-memory'), env, { waitUntil() {} });
    assert.equal(good.status, 200); assert.match(await good.text(), /<h1>1947: Panjab, Partition &amp; Memory<\/h1>/);
    const stale = await worker.fetch(new Request('https://site.test/history/42-old-title'), env, { waitUntil() {} });
    assert.equal(stale.status, 301); assert.match(stale.headers.get('location'), /\/history\/42-1947-panjab/);
    payload = issue({ labels: [{ name: 'bug' }] });
    assert.equal((await worker.fetch(new Request('https://site.test/history/42-x'), env, { waitUntil() {} })).status, 404);
    payload = issue(); status = 404;
    assert.equal((await worker.fetch(new Request('https://site.test/history/42-x'), env, { waitUntil() {} })).status, 404);
  });
  assert.equal((await worker.fetch(new Request('https://site.test/history/42-x'), {}, { waitUntil() {} })).status, 404);
});

test('/api/history and /api/news: merge, dedupe, topics, sources and recency', async t => {
  const db = await createDb(); if (!db) return t.skip('node:sqlite not available');
  const ins = db.sqlite.prepare("INSERT INTO content_items (id,section,title,dek,body,canonical_url,image_url,source_name,author,published_at,status) VALUES (?,?,?,?,'',?,NULL,?,NULL,?,'published')");
  const now = Date.now(); const day = 86400000;
  ins.run('n1', 'music', 'Fresh Diljit story', 'd', 'https://n/1', 'PTC Punjabi', new Date(now - day).toISOString());
  ins.run('n2', 'music', 'Fresh Diljit story', 'dup from another feed', 'https://n/2', 'BritAsia TV', new Date(now - 2 * day).toISOString());
  ins.run('n3', 'music', 'Ancient story', 'd', 'https://n/3', 'PTC Punjabi', new Date(now - 300 * day).toISOString());
  ins.run('h1', 'history', 'External reading', 'd', 'https://sikhri.org/articles/a', 'Sikh Research Institute', new Date(now - day).toISOString());
  const env = { DB: db, GITHUB_REPO: 'o/r' };
  await withFetch(async () => ({ ok: true, json: async () => [issue()] }), async () => {
    const news = await (await worker.fetch(new Request('https://site.test/api/news'), env, {})).json();
    assert.equal(news.items.length, 1); assert.deepEqual(news.sources, [{ name: 'PTC Punjabi', count: 1 }]);
    const history = await (await worker.fetch(new Request('https://site.test/api/history'), env, {})).json();
    assert.equal(history.items[0].internal, true); assert.match(history.items[0].url, /^\/history\/42-/); assert.equal(history.items[1].internal, false);
    assert.deepEqual(history.topics.map(x => x.name), ['Diaspora', 'Partition']); assert.ok(!('body' in history.items[0]));
  });
});

test('sitemap is generated with article pages', async () => {
  await withFetch(async () => ({ ok: true, json: async () => [issue()] }), async () => {
    const res = await worker.fetch(new Request('https://site.test/sitemap.xml'), { GITHUB_REPO: 'o/r', SITE_ORIGIN: 'https://site.test' }, {});
    assert.match(await res.text(), /https:\/\/site\.test\/history\/42-/);
  });
});
