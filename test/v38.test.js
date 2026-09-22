import test from 'node:test';
import assert from 'node:assert/strict';
import { createDb } from '../tests-support/d1-shim.js';
import worker from '../src/worker.js';
import {
  eventPath, eventIdFromSlug, rowToEvent, dedupeEvents, eventsAreDuplicates, moderationRulesFromIssues, applyModeration,
  mediaFromIssues, storyFromIssues, safeComments, eventPage, pacificWeekendBounds
} from '../src/events.js';
import { parseDriveBc, parseWsdotRss, fetchTravel } from '../src/travel.js';
import { normalizeEvent } from '../src/collectors.js';

const row = (overrides = {}) => ({ id: 'evt-abc123', title: 'Diljit Dosanjh Live', description: 'A community concert.', category: 'concert', region: 'Vancouver', city: 'Vancouver', venue: 'BC Place', venue_address: '777 Pacific Blvd', performers: 'Diljit Dosanjh', starts_at: '2026-10-20T03:00:00.000Z', ends_at: null, url: 'https://tickets.example/diljit', image_url: 'https://images.example/diljit.jpg', video_url: '', video_caption: '', source_name: 'Ticketmaster', source_kind: 'ticketing', source_event_id: 'tm1', is_active: 1, ...overrides });

test('event paths are stable and cross-source duplicates keep the richer listing', () => {
  const basic = rowToEvent(row({ id: 'evt-one', image_url: null, description: '' }));
  const rich = rowToEvent(row({ id: 'evt-two', source_name: 'GitHub manual events', source_kind: 'manual' }));
  assert.equal(eventPath(rich), '/events/evt-two-diljit-dosanjh-live');
  assert.equal(eventIdFromSlug('evt-two-old-title'), 'evt-two');
  assert.deepEqual(dedupeEvents([basic, rich]).map(x => x.id), ['evt-two']);
});

test('title variations, tracking links and missing city data do not create repeated events', () => {
  const basic = rowToEvent(row({
    id: 'evt-basic', title: 'Karan Aujla Live — Vancouver 2026', description: '', image_url: null,
    url: 'https://www.tickets.example/karan?utm_source=facebook&fbclid=abc', performers: '', city: 'Vancouver'
  }));
  const rich = rowToEvent(row({
    id: 'evt-rich', title: 'Karan Aujla Official World Tour Tickets',
    url: 'https://tickets.example/karan', performers: 'Karan Aujla', city: '', source_kind: 'manual', source_name: 'GitHub manual events'
  }));
  assert.equal(eventsAreDuplicates(basic, rich), true);
  assert.deepEqual(dedupeEvents([basic, rich]).map(x => x.id), ['evt-rich']);
});

test('similar event names remain separate when the date or city is different', () => {
  const vancouver = rowToEvent(row({ id: 'evt-vancouver', title: 'Punjabi Comedy Night', city: 'Vancouver', region: 'Vancouver', venue: 'Vancouver Playhouse' }));
  const seattle = rowToEvent(row({ id: 'evt-seattle', title: 'Punjabi Comedy Night Live', city: 'Seattle', region: 'Seattle', venue: 'Moore Theatre' }));
  const nextDay = rowToEvent(row({ id: 'evt-next-day', title: 'Punjabi Comedy Night Tickets', city: 'Vancouver', region: 'Vancouver', venue: 'Vancouver Playhouse', starts_at: '2026-10-21T03:00:00.000Z' }));
  assert.equal(eventsAreDuplicates(vancouver, seattle), false);
  assert.equal(eventsAreDuplicates(vancouver, nextDay), false);
  assert.deepEqual(dedupeEvents([vancouver, seattle, nextDay]).map(x => x.id), ['evt-vancouver', 'evt-seattle', 'evt-next-day']);
});

test('an open event-hide issue removes a duplicate and can point to the preferred event', () => {
  const issues = [{ body: '### Event page URL or ID\n\nevt-old\n\n### Preferred event page URL\n\nhttps://panjabiaagayeoye.com/events/evt-good-correct\n\n### Reason\n\nDuplicate' }];
  const rules = moderationRulesFromIssues(issues);
  const result = applyModeration([{ ...rowToEvent(row()), id: 'evt-old' }, { ...rowToEvent(row()), id: 'evt-good' }], rules);
  assert.deepEqual(result.visible.map(x => x.id), ['evt-good']);
  assert.equal(result.redirects.get('evt-old'), 'evt-good');
});

test('community media requires an HTTPS video and a rights confirmation', () => {
  const event = rowToEvent(row());
  const body = target => `### Event page URL or ID\n\n${target}\n\n### Artist\n\nDiljit Dosanjh\n\n### Video URL\n\nhttps://youtu.be/abc123XYZ\n\n### Caption\n\nVancouver finale\n\n### Rights confirmation\n\n- [x] I recorded this video myself.`;
  assert.equal(mediaFromIssues([{ body: body(event.id) }], event).length, 1);
  assert.equal(mediaFromIssues([{ body: body('evt-other') }], event).length, 0);
  assert.equal(mediaFromIssues([{ body: body(event.id).replace('I recorded this video myself.', 'No response') }], event).length, 0);
});

test('event stories and comments are safe, editable GitHub-backed content', () => {
  const event = rowToEvent(row());
  const issue = { number: 22, title: '[Event story] A Vancouver night', html_url: 'https://github.com/o/r/issues/22', comments_url: 'https://api.github.com/repos/o/r/issues/22/comments', created_at: '2026-09-01T00:00:00Z', updated_at: '2026-09-02T00:00:00Z', body: `### Event page URL or ID\n\n${event.id}\n\n### Summary\n\nA memorable night.\n\n### Story\n\n## The finale\n\n<script>alert(1)</script> The crowd sang.\n\n### Byline\n\nParminder` };
  const story = storyFromIssues([issue], event);
  const comments = safeComments([{ user: { login: 'guest', type: 'User', html_url: 'https://github.com/guest' }, body: '<img src=x onerror=alert(1)> Great show!', created_at: '2026-09-03T00:00:00Z', html_url: 'https://github.com/o/r/issues/22#issuecomment-1' }]);
  const html = eventPage(event, { origin: 'https://panjabiaagayeoye.com', story, comments, media: [{ videoUrl: 'https://youtu.be/abc123XYZ', caption: 'My recording' }] });
  assert.match(html, /A Vancouver night/);assert.match(html, /People who were there/);assert.match(html, /youtube-nocookie\.com/);
  assert.ok(!html.includes('<script>alert(1)</script>'));assert.ok(!html.includes('<img src=x'));
  assert.match(html, /WhatsApp/);assert.match(html, /facebook\.com\/sharer/);assert.match(html, /application\/ld\+json/);
});

test('Pacific weekend means Friday through Sunday, including when viewed on Sunday', () => {
  const monday = pacificWeekendBounds(new Date('2026-09-21T12:00:00Z'));
  assert.equal(monday.start, '2026-09-25T07:00:00.000Z');
  assert.equal(monday.end, '2026-09-28T07:00:00.000Z');
  const sunday = pacificWeekendBounds(new Date('2026-09-27T18:00:00Z'));
  assert.equal(sunday.start, monday.start);assert.equal(sunday.end, monday.end);
});

test('manual GitHub events may create an archive page for an earlier concert', () => {
  const past = new Date(Date.now() - 30 * 86400000).toISOString();
  const source = { key: 'github-events', name: 'GitHub manual events', type: 'manual', region: 'Vancouver', allowPast: true };
  const event = normalizeEvent({ title: 'Karan Aujla Vancouver', startsAt: past, url: 'https://example.com/past-show', sourceEventId: '88', idIsUnique: true }, source);
  assert.ok(event);assert.equal(event.region, 'Vancouver');
});

test('official travel feeds are reduced to Seattle-Vancouver corridor advisories', async () => {
  const rss = `<rss><channel><item><title>I-5 collision near Bellingham</title><description>Lane blocked</description><link>https://wsdot.example/1</link><pubDate>Sun, 20 Sep 2026 12:00:00 GMT</pubDate></item><item><title>US 2 notice</title><description>Elsewhere</description><link>https://wsdot.example/2</link></item></channel></rss>`;
  assert.equal(parseWsdotRss(rss).length, 1);
  const bc = parseDriveBc({ events: [{ id: 'd1', headline: 'Highway 99 closure', description: 'Closed near Surrey', severity: 'MAJOR', updated: '2026-09-20T12:00:00Z', url: '/events/drivebc.ca/1', roads: [{ name: 'Highway 99', direction: 'BOTH' }] }] });
  assert.equal(bc[0].severity, 'major');assert.match(bc[0].road, /Highway 99/);
  const fakeFetch = async url => String(url).includes('open511') ? { ok: true, json: async () => ({ events: [] }) } : { ok: true, text: async () => rss };
  const result = await fetchTravel(fakeFetch);assert.equal(result.errors.length, 0);assert.equal(result.items.length, 2);
});

test('expired events remain searchable and every listing opens its own server-rendered page', async t => {
  const db = await createDb();if(!db){t.skip('node:sqlite unavailable');return;}
  const future = new Date(Date.now() + 20 * 86400000).toISOString();
  const past = new Date(Date.now() - 20 * 86400000).toISOString();
  const insert = db.sqlite.prepare(`INSERT INTO hub_events (id,title,description,category,region,city,venue,starts_at,url,source_name,source_kind,source_event_id,is_active,performers) VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?)`);
  insert.run('evt-future','Karan Aujla Live','Concert','concert','Vancouver','Vancouver','Arena',future,'https://tickets.example/k','Source','ticketing','k1',1,'Karan Aujla');
  insert.run('evt-past','Diljit Vancouver Memory','Past show','concert','Vancouver','Vancouver','BC Place',past,'https://tickets.example/d','Source','ticketing','d1',0,'Diljit Dosanjh');
  const env={DB:db,SITE_ORIGIN:'https://site.test',ASSETS:{fetch:async()=>new Response('asset')}};
  const upcoming=await (await worker.fetch(new Request('https://site.test/api/events'),env,{waitUntil(){}})).json();
  assert.deepEqual(upcoming.events.map(x=>x.id),['evt-future']);assert.match(upcoming.events[0].pageUrl,/^\/events\/evt-future-/);
  const archive=await (await worker.fetch(new Request('https://site.test/api/events?past=1'),env,{waitUntil(){}})).json();
  assert.deepEqual(archive.events.map(x=>x.id),['evt-past']);
  const page=await worker.fetch(new Request(`https://site.test${upcoming.events[0].pageUrl}`),env,{waitUntil(){}});
  assert.equal(page.status,200);assert.match(await page.text(),/Karan Aujla Live/);
});
