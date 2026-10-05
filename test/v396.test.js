import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { groupEventsForMap, mapLocationForEvent } from '../public/event-map.js';
import { travelCardHtml, travelPageShell } from '../src/travel.js';
import { sitemapXml } from '../src/articles.js';

test('event map groups listings at known city coordinates', () => {
  const groups = groupEventsForMap([
    { title: 'First', city: 'Surrey, BC', region: 'Vancouver', startsAt: '2026-10-02T20:00:00Z', pageUrl: '/events/first' },
    { title: 'Second', city: 'Surrey', region: 'Vancouver', startsAt: '2026-10-01T20:00:00Z', pageUrl: '/events/second' },
    { title: 'Third', city: 'Bellevue, WA', region: 'Seattle', startsAt: '2026-10-03T20:00:00Z', pageUrl: '/events/third' }
  ]);
  assert.equal(groups.length, 2);
  assert.equal(groups.find(group => group.key === 'surrey').events.length, 2);
  assert.deepEqual(groups.find(group => group.key === 'bellevue').events.map(event => event.title), ['Third']);
});

test('unknown cities use an honest regional fallback', () => {
  const location = mapLocationForEvent({ city: 'A venue to be announced', region: 'Vancouver' });
  assert.equal(location.key, 'region-vancouver');
  assert.equal(location.approximate, true);
  assert.deepEqual([location.lat, location.lng], [49.2827, -123.1207]);
});

test('event pages expose map containers while retaining event lists for no-JS readers', async () => {
  const [home, weekend] = await Promise.all([
    readFile(new URL('../public/index.html', import.meta.url), 'utf8'),
    readFile(new URL('../public/weekend.html', import.meta.url), 'utf8')
  ]);
  for (const html of [home, weekend]) {
    assert.match(html, /id="eventMap"/);
    assert.match(html, /id="eventsGrid"/);
    assert.match(html, /city-level|city level/);
  }
});

test('travel page server-renders advisories, canonical metadata and source links', () => {
  const html = travelPageShell({
    generatedAt: '2026-09-25T18:00:00.000Z',
    errors: [],
    sources: [{ name: 'Official source', url: 'https://travel.example/map' }],
    items: [{ source: 'WSDOT', severity: 'major', title: 'I-5 lane closure', road: 'I-5 northbound', description: 'Two lanes closed near Everett.', url: 'https://travel.example/notice' }]
  }, { origin: 'https://site.test' });
  assert.match(html, /I-5 lane closure/);
  assert.match(html, /Two lanes closed near Everett/);
  assert.match(html, /href="https:\/\/travel\.example\/map"/);
  assert.match(html, /rel="canonical" href="https:\/\/site\.test\/travel"/);
  assert.match(html, /loading hidden/);
});

test('travel rendering escapes feed content and refuses unsafe links', () => {
  const html = travelCardHtml({ title: '<script>alert(1)</script>', description: '<img src=x onerror=alert(1)>', url: 'javascript:alert(1)' });
  assert.ok(!/<script>/i.test(html));
  assert.ok(!/<img/i.test(html));
  assert.ok(!/href="javascript:/i.test(html));
  assert.match(html, /&lt;script&gt;/);
});

test('sitemap includes discovery pages and event URLs once', () => {
  const xml = sitemapXml('https://site.test', [{ slug: '42-arrival' }], ['/events/show-one', '/events/show-one', 'javascript:bad']);
  for (const path of ['/weekend', '/travel', '/archive', '/history/kids', '/history/42-arrival', '/events/show-one']) {
    assert.match(xml, new RegExp(`<loc>https://site\\.test${path}</loc>`));
  }
  assert.equal((xml.match(/\/events\/show-one/g) || []).length, 1);
  assert.ok(!xml.includes('javascript:bad'));
});
