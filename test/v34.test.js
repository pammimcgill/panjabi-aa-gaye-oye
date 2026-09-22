import test from 'node:test';
import assert from 'node:assert/strict';
import { screenEventIdentity, matchText, relevant, groupForTime, REFRESH_GROUPS, REFRESH_SLOT_MS, EVENT_SOURCES, TICKETMASTER_KEYWORDS, categoryFor } from '../src/config.js';
import { extractJsonLdEvents, discoverEventLinks } from '../src/parsers.js';
import {
  evaluateEvent, normalizeEvent, pickDetailLinks, upsertEvents, collectTicketmaster, collectGithubEvents,
  rescreenStoredEvents, collectGroup, setSourceStatus, newRun, ticketmasterEvent
} from '../src/collectors.js';
import { describeSource } from '../src/health.js';
import { createDb } from '../tests-support/d1-shim.js';

const venue = { key:'v', name:'Venue', type:'venue', region:'Seattle', city:'Seattle', url:'https://example.com' };
const religious = { key:'g', name:'Gurdwara', type:'religious', region:'Seattle', city:'Renton', url:'https://example.com' };
const manual = { key:'github-events', name:'GitHub manual events', type:'manual', region:'Seattle', url:'https://github.com/' };
const future = days => new Date(Date.now() + days * 86400000).toISOString();

// ---------------------------------------------------------------- screening
test('keeps Punjabi artists, Sikh terms and Gurmukhi titles that used to be rejected', () => {
  for (const title of ['Arijit Singh Live in Concert', 'Shubh Still Here Tour', 'Amrinder Gill Live', 'Jasmine Sandlas Live',
    'Yo Yo Honey Singh Millionaire India Tour', 'Gurpurab Celebration', 'Guru Nanak Dev Ji Parkash Purab',
    'Jashan Lohri Night', 'ਪੰਜਾਬੀ ਕਲਚਰਲ ਨਾਈਟ', 'Punjab Da Mela']) {
    assert.equal(screenEventIdentity({ title }, venue).keep, true, title);
  }
});

test('still rejects unrelated listings', () => {
  for (const title of ['Seattle Comedy Showcase', 'Generic DJ Dance Party', 'Holiday Pops', 'Amplified Access - Punjabi Night']) {
    assert.equal(screenEventIdentity({ title }, venue).keep, false, title);
  }
});

test('Gurmukhi vowel signs survive normalization', () => {
  assert.equal(matchText('ਪੰਜਾਬੀ ਕਲਚਰਲ'), 'ਪੰਜਾਬੀ ਕਲਚਰਲ');
  assert.equal(relevant('ਗੁਰਦੁਆਰਾ ਸਾਹਿਬ ਕੀਰਤਨ ਦਰਬਾਰ'), true);
});

test('a performer or the description can identify an event whose title does not', () => {
  assert.equal(screenEventIdentity({ title: 'DIL-LUMINATI TOUR', performers: ['Diljit Dosanjh'] }, venue).keep, true);
  assert.equal(screenEventIdentity({ title: 'Spring Gala', description: 'An evening of bhangra and giddha.' }, venue).keep, true);
  // generic words in a description are not enough for venue feeds
  assert.equal(screenEventIdentity({ title: 'Spring Gala', description: 'Indian food will be served.' }, venue).keep, false);
});

test('manually approved and trusted-source events skip keyword screening', () => {
  assert.equal(screenEventIdentity({ title: 'Sunday Live at Nirvana Restaurant' }, manual).keep, true);
  assert.equal(screenEventIdentity({ title: 'Sunday Live at Nirvana Restaurant' }, { ...venue, trusted: true }).keep, true);
  assert.equal(screenEventIdentity({ title: 'Reserved Parking' }, { ...venue, trusted: true }).keep, false);
  assert.equal(screenEventIdentity({ title: '' }, manual).keep, false);
});

test('DJ category matches the word, not letters inside other words', () => {
  assert.equal(categoryFor('Punjabi DJ Night'), 'nightlife');
  assert.notEqual(categoryFor('Adjacent Room Exhibit'), 'nightlife');
});

// ---------------------------------------------------------------- parsing
const ld = obj => `<script type="application/ld+json">${JSON.stringify(obj)}</script>`;

test('reads MusicEvent, TheaterEvent and other Event subtypes', () => {
  for (const type of ['MusicEvent', 'TheaterEvent', 'ComedyEvent', 'SocialEvent', 'https://schema.org/DanceEvent', 'Festival']) {
    const rows = extractJsonLdEvents(ld({ '@type': type, name: 'Punjabi Night', startDate: '2027-01-03T19:00:00-08:00', url: '/x' }), 'https://example.com/');
    assert.equal(rows.length, 1, type);
  }
  assert.equal(extractJsonLdEvents(ld({ '@type': 'Article', name: 'x', startDate: '2027-01-03' }), 'https://example.com/').length, 0);
});

test('reads events wrapped in an ItemList, performers and array locations; skips cancelled', () => {
  const html = ld({ '@type': 'ItemList', itemListElement: [
    { '@type': 'ListItem', item: { '@type': 'MusicEvent', name: 'Tour', startDate: '2027-01-03T19:00:00Z', url: '/a',
      performer: [{ '@type': 'Person', name: 'Diljit Dosanjh' }], location: [{ name: 'The Hall', address: { addressLocality: 'Seattle' } }] } },
    { '@type': 'ListItem', item: { '@type': 'MusicEvent', name: 'Called Off', startDate: '2027-01-04T19:00:00Z', url: '/b', eventStatus: 'https://schema.org/EventCancelled' } }
  ] });
  const rows = extractJsonLdEvents(html, 'https://example.com/');
  assert.equal(rows.length, 1);
  assert.deepEqual(rows[0].performers, ['Diljit Dosanjh']);
  assert.equal(rows[0].venue, 'The Hall');
});

test('listing links are de-duplicated ignoring #fragments', () => {
  const html = '<a href="/events/a#top">Show A</a><a href="/events/a">Show A</a>';
  assert.equal(discoverEventLinks(html, 'https://example.com/calendar', 10).length, 1);
});

// ---------------------------------------------------------------- link picking
test('follows several relevant links instead of one', () => {
  const html = [1, 2, 3, 4, 5, 6, 7].map(i => `<a href="/events/punjabi-night-${i}">Punjabi Night ${i}</a>`).join('')
    + '<a href="/events/holiday-pops">Holiday Pops</a>';
  const links = discoverEventLinks(html, 'https://example.com/calendar', 80);
  const picked = pickDetailLinks(links, venue, 'https://example.com/calendar');
  assert.equal(picked.length, 5);
  assert.ok(picked.every(l => /punjabi/.test(l.href)));
});

test('venues only open South Asian-looking links; Gurdwara sites open any event link', () => {
  const links = [{ href: 'https://example.com/events/holiday-pops', label: 'Holiday Pops' }, { href: 'https://example.com/events/gurpurab', label: 'Gurpurab' }];
  assert.deepEqual(pickDetailLinks(links, venue, '').map(l => l.label), ['Gurpurab']);
  assert.deepEqual(pickDetailLinks(links, religious, '').map(l => l.label), ['Gurpurab', 'Holiday Pops']);
});

// ---------------------------------------------------------------- events
test('evaluateEvent reports why an event was dropped', () => {
  const base = { title: 'Punjabi Night', startsAt: future(10), url: 'https://example.com/e' };
  assert.equal(evaluateEvent({ ...base, startsAt: 'nope' }, venue).reason, 'invalid_or_missing_date');
  assert.equal(evaluateEvent({ ...base, startsAt: '2001-01-01T00:00:00Z' }, venue).reason, 'past_event');
  assert.equal(evaluateEvent({ ...base, title: 'Holiday Pops' }, venue).reason, 'no_south_asian_identity_signal');
  assert.ok(evaluateEvent(base, venue).event);
});

test('performers are shown on the card and survive re-screening', () => {
  const raw = { title: 'DIL-LUMINATI TOUR', performers: ['Diljit Dosanjh'], description: 'Doors at 7.', startsAt: future(30), url: 'https://example.com/t', sourceEventId: 'tm1', idIsUnique: true };
  const event = normalizeEvent(raw, { ...venue, type: 'ticketing' });
  assert.match(event.description, /^Featuring Diljit Dosanjh — Doors at 7\./);
});

// ---------------------------------------------------------------- database
test('rescheduling an event updates it instead of failing the batch (old bug)', async t => {
  const db = await createDb(); if (!db) return t.skip('node:sqlite not available');
  const source = { key: 'ticketmaster', name: 'Ticketmaster', type: 'ticketing', region: 'Seattle', url: 'https://tm' };
  const mk = start => normalizeEvent({ title: 'Punjabi Night', startsAt: start, url: 'https://tm/e', sourceEventId: 'Z7r9', idIsUnique: true }, source);
  const other = normalizeEvent({ title: 'Bhangra Night', startsAt: future(12), url: 'https://tm/o', sourceEventId: 'Z7r8', idIsUnique: true }, source);
  assert.deepEqual(await upsertEvents(db, [mk(future(10)), other]), { stored: 2, failed: 0 });
  assert.deepEqual(await upsertEvents(db, [mk(future(11)), other]), { stored: 2, failed: 0 });
  const rows = db.sqlite.prepare('SELECT starts_at FROM hub_events ORDER BY title').all();
  assert.equal(rows.length, 2);
});

test('several dates that share one page identifier are all kept', async t => {
  const db = await createDb(); if (!db) return t.skip('node:sqlite not available');
  const raw = start => ({ title: 'Punjabi Night', startsAt: start, url: 'https://example.com/run', sourceEventId: 'same-id' });
  const events = [normalizeEvent(raw(future(10)), venue), normalizeEvent(raw(future(11)), venue)];
  assert.equal(events[0].sourceEventId === events[1].sourceEventId, false);
  assert.deepEqual(await upsertEvents(db, events), { stored: 2, failed: 0 });
});

test('one bad row does not hide the others', async t => {
  const db = await createDb(); if (!db) return t.skip('node:sqlite not available');
  const good = normalizeEvent({ title: 'Punjabi Night', startsAt: future(10), url: 'https://e/1', sourceEventId: '1' }, venue);
  const bad = { ...good, id: 'evt-bad', sourceEventId: '2', title: null };
  const result = await upsertEvents(db, [good, bad]);
  assert.deepEqual(result, { stored: 1, failed: 1 });
});

test('setSourceStatus falls back when migration 0004 has not been applied', async t => {
  const db = await createDb(); if (!db) return t.skip('node:sqlite not available');
  db.sqlite.exec('ALTER TABLE source_status DROP COLUMN raw_count');
  await setSourceStatus(db, { key: 'x', name: 'X', url: 'https://x', type: 'venue' }, 3, null, { raw: 5, rejected: 2, linksFollowed: 1, samples: [] });
  assert.equal(db.sqlite.prepare("SELECT last_count FROM source_status WHERE source_key='x'").get().last_count, 3);
});

// ---------------------------------------------------------------- Ticketmaster
test('Ticketmaster is searched by keyword and keeps events whose title lacks a keyword', async t => {
  const db = await createDb(); if (!db) return t.skip('node:sqlite not available');
  const requested = [];
  const realFetch = globalThis.fetch;
  globalThis.fetch = async url => {
    const u = new URL(url); requested.push(u.searchParams.get('keyword') + '@' + u.searchParams.get('countryCode'));
    const keyword = u.searchParams.get('keyword');
    const events = keyword === 'punjabi' ? [
      { id: 'A1', name: 'DIL-LUMINATI TOUR', url: 'https://tm/a1', dates: { start: { dateTime: future(40) } }, _embedded: { venues: [{ name: 'Climate Pledge Arena', city: { name: 'Seattle' } }], attractions: [{ name: 'Diljit Dosanjh' }] } },
      { id: 'A2', name: 'Reserved Parking - Punjabi Night', url: 'https://tm/a2', dates: { start: { dateTime: future(41) } } },
      { id: 'A3', name: 'Called Off Bhangra', url: 'https://tm/a3', dates: { start: { dateTime: future(42) }, status: { code: 'cancelled' } } }
    ] : [];
    return { ok: true, json: async () => ({ _embedded: { events } }) };
  };
  try {
    const run = newRun({}); run.delayMs = 0;
    const result = await collectTicketmaster({ DB: db, TICKETMASTER_API_KEY: 'k' }, run, 'core');
    assert.equal(result.count, 1);
    assert.equal(requested.length, TICKETMASTER_KEYWORDS.core.length * 2);
    assert.ok(requested.includes('bhangra@CA') && requested.includes('sikh@US'));
    const stored = db.sqlite.prepare('SELECT title,description FROM hub_events').all();
    assert.equal(stored[0].title, 'DIL-LUMINATI TOUR');
    assert.match(stored[0].description, /Diljit Dosanjh/);
    const status = db.sqlite.prepare("SELECT raw_count,rejected_count FROM source_status WHERE source_key='ticketmaster'").get();
    assert.equal(status.raw_count, 4); assert.equal(status.rejected_count, 2);
  } finally { globalThis.fetch = realFetch; }
});

test('a bad Ticketmaster key is reported as an error, not as zero events', async t => {
  const db = await createDb(); if (!db) return t.skip('node:sqlite not available');
  const realFetch = globalThis.fetch;
  globalThis.fetch = async () => ({ ok: false, status: 401, json: async () => ({}) });
  try {
    const run = newRun({}); run.delayMs = 0;
    const result = await collectTicketmaster({ DB: db, TICKETMASTER_API_KEY: 'bad' }, run, 'core');
    assert.match(result.error, /401/);
  } finally { globalThis.fetch = realFetch; }
});

test('ticketmasterEvent skips cancelled events', () => {
  assert.equal(ticketmasterEvent({ id: 'x', name: 'n', dates: { status: { code: 'cancelled' } } }), null);
});

// ---------------------------------------------------------------- manual events
test('approved GitHub events are published and closing the issue removes them', async t => {
  const db = await createDb(); if (!db) return t.skip('node:sqlite not available');
  const realFetch = globalThis.fetch;
  const issue = number => ({ number, title: `[Event] Sunday Live ${number}`, html_url: `https://github.com/o/r/issues/${number}`, labels: [{ name: 'event' }, { name: 'approved' }],
    body: `### Event link\n\nhttps://example.com/x\n\n### Event title\n\nSunday Live at Nirvana Restaurant ${number}\n\n### Start date and time\n\n${future(20)}\n\n### Region\n\nSeattle` });
  let open = [issue(7), issue(8)];
  globalThis.fetch = async () => ({ ok: true, json: async () => open });
  try {
    const run = () => { const r = newRun({}); r.delayMs = 0; return r; };
    assert.equal((await collectGithubEvents({ DB: db, GITHUB_REPO: 'o/r' }, run())).count, 2);
    open = [issue(7)];
    await collectGithubEvents({ DB: db, GITHUB_REPO: 'o/r' }, run());
    assert.equal(db.sqlite.prepare('SELECT COUNT(*) n FROM hub_events WHERE is_active=1').get().n, 1);
    assert.equal((await rescreenStoredEvents(db)).removed, 0);
  } finally { globalThis.fetch = realFetch; }
});

// ---------------------------------------------------------------- scheduling
test('every event source belongs to a scheduled group and slots rotate through all groups', () => {
  for (const s of EVENT_SOURCES) assert.ok(REFRESH_GROUPS.includes(s.group), s.key);
  const seen = new Set();
  for (let i = 0; i < REFRESH_GROUPS.length; i++) seen.add(groupForTime(i * REFRESH_SLOT_MS));
  assert.equal(seen.size, REFRESH_GROUPS.length);
});

test('a group run stops at its request budget', async t => {
  const db = await createDb(); if (!db) return t.skip('node:sqlite not available');
  const realFetch = globalThis.fetch; let calls = 0;
  globalThis.fetch = async () => { calls++; return { ok: true, text: async () => '<html></html>', url: 'https://x' }; };
  try {
    const out = await collectGroup({ DB: db, FETCH_BUDGET: '3' }, 'religious');
    assert.ok(calls <= 3, `made ${calls} requests`);
    assert.ok(out.results.length === 5);
  } finally { globalThis.fetch = realFetch; }
});

// ---------------------------------------------------------------- health panel text
test('health descriptions explain zero-event sources', () => {
  assert.equal(describeSource({ last_error: 'Waiting for SEATGEEK_CLIENT_ID' }).state, 'setup');
  assert.match(describeSource({ last_error: 'HTTP 403' }).detail, /blocks automated/);
  assert.equal(describeSource({ last_count: 0, raw_count: 0, source_type: 'religious' }).label, 'No event data found');
  const filtered = describeSource({ last_count: 0, raw_count: 4, rejected_count: 4, source_type: 'venue', sample_rejected: JSON.stringify([{ title: 'Holiday Pops', reason: 'no_south_asian_identity_signal' }]) });
  assert.equal(filtered.state, 'filtered'); assert.match(filtered.detail, /Holiday Pops/);
  assert.equal(describeSource({ last_count: 2, raw_count: 5, rejected_count: 3, source_type: 'venue' }).state, 'ok');
  assert.equal(describeSource({ last_count: 5, source_type: 'news' }).label, '5 stories');
});
