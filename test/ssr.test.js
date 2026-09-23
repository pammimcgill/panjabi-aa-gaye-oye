import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { createDb } from '../tests-support/d1-shim.js';
import worker, { githubHeaders } from '../src/worker.js';
import { renderEventSnapshot, renderStorySnapshot } from '../src/list-pages.js';

const root = new URL('../public/', import.meta.url);

test('GitHub requests use the Worker secret when configured', () => {
  assert.equal(githubHeaders({ GITHUB_TOKEN: 'secret-value' }).authorization, 'Bearer secret-value');
  assert.equal(githubHeaders({}).authorization, undefined);
});

test('event snapshots expose the first 16 safe event links without JavaScript', async () => {
  const shell = await readFile(new URL('index.html', root), 'utf8');
  const events = Array.from({ length: 18 }, (_, index) => ({
    title: index === 0 ? '<script>alert(1)</script> Concert' : `Event ${index + 1}`,
    category: 'concert', region: 'Vancouver', city: 'Surrey', venue: 'Hall',
    startsAt: '2026-10-20T03:00:00.000Z', source: 'Test source', performers: [],
    pageUrl: `/events/evt-${index + 1}-event`
  }));
  const html = renderEventSnapshot(shell, events);
  assert.match(html, /href="\/events\/evt-1-event"/);
  assert.match(html, /href="\/events\/evt-16-event"/);
  assert.doesNotMatch(html, /href="\/events\/evt-17-event"/);
  assert.match(html, /18 events/);
  assert.ok(!html.includes('<script>alert(1)</script> Concert'));
  assert.match(html, /&lt;script&gt;alert\(1\)&lt;\/script&gt; Concert/);
  assert.match(html, /id="loadingState" class="loading hidden"/);
});

test('history and news snapshots contain crawlable cards and safe outbound links', async () => {
  const historyShell = await readFile(new URL('history.html', root), 'utf8');
  const newsShell = await readFile(new URL('news.html', root), 'utf8');
  const own = { title: 'First arrivals', dek: 'A sourced story.', url: '/history/7-first-arrivals', internal: true, source: 'Panjabi Aa Gaye Oye', topics: ['Arrival'], minutes: 4, year: 1897, chapterNumber: 2, chapter: 'The first arrivals', chapterSpan: '1897–1907', publishedAt: '2026-09-20T00:00:00Z' };
  const second = { ...own, title: 'Second story', url: '/history/8-second', year: 1905 };
  const history = renderStorySnapshot(historyShell, [own, second]);
  assert.match(history, /Chapter 2/);
  assert.match(history, /href="\/history\/7-first-arrivals"/);
  assert.match(history, /2 stories/);
  const news = renderStorySnapshot(newsShell, [{ ...own, internal: false, title: 'Music headline', url: 'https://publisher.example/story', source: 'Publisher' }], { news: true });
  assert.match(news, /href="https:\/\/publisher\.example\/story"/);
  assert.match(news, /target="_blank" rel="noopener noreferrer"/);
  const unsafe = renderStorySnapshot(newsShell, [{ ...own, internal: false, url: 'javascript:alert(1)' }], { news: true });
  assert.ok(!unsafe.includes('javascript:'));
});

test('the homepage Worker response includes real server-rendered event content', async t => {
  const db = await createDb();
  if (!db) return t.skip('node:sqlite unavailable');
  const future = new Date(Date.now() + 14 * 86400000).toISOString();
  db.sqlite.prepare(`INSERT INTO hub_events (id,title,description,category,region,city,venue,starts_at,url,source_name,source_kind,source_event_id,is_active,performers) VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?)`)
    .run('evt-ssr', 'SSR Punjabi Concert', 'Visible in raw HTML', 'concert', 'Vancouver', 'Surrey', 'Hall', future, 'https://tickets.example/ssr', 'Test source', 'ticketing', 'ssr1', 1, 'Artist');
  const index = await readFile(new URL('index.html', root), 'utf8');
  const env = { DB: db, ASSETS: { fetch: async () => new Response(index, { headers: { 'content-type': 'text/html' } }) } };
  const response = await worker.fetch(new Request('https://site.test/'), env, { waitUntil() {} });
  const html = await response.text();
  assert.equal(response.status, 200);
  assert.match(html, /SSR Punjabi Concert/);
  assert.match(html, /href="\/events\/evt-ssr-ssr-punjabi-concert"/);
  assert.equal(response.headers.get('cache-control'), 'public, max-age=60, s-maxage=300');
});
