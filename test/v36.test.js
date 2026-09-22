import test from 'node:test';
import assert from 'node:assert/strict';
import {
  screenEventIdentity, isRoutineReligiousTitle, isTicketProduct, categoryFor, EVENT_SOURCES, REFRESH_GROUPS,
  TICKETMASTER_KEYWORDS, COMEDIAN_TERMS, ARTIST_TERMS, EVENTBRITE_SEARCH_URLS, CONFIGURED_SOURCE_KEYS
} from '../src/config.js';
import { collectTicketmaster, ticketmasterEvent, collectGroup, normalizeEvent, newRun } from '../src/collectors.js';
import { createDb } from '../tests-support/d1-shim.js';

const venue = { key: 'v', name: 'Venue', type: 'venue', region: 'Seattle', city: 'Seattle', url: 'https://example.com' };
const ticketing = { ...venue, type: 'ticketing' };
const religious = { key: 'g', name: 'Gurdwara', type: 'religious', region: 'Seattle', city: 'Renton', url: 'https://example.com' };
const manual = { key: 'github-events', name: 'GitHub manual events', type: 'manual', region: 'Seattle', url: 'https://github.com/' };
const future = days => new Date(Date.now() + days * 86400000).toISOString();

// 1. routine Gurdwara programs ------------------------------------------------
test('routine Gurdwara programs are rejected by pattern, not just two exact titles', () => {
  for (const title of ['Regular Sunday Program', 'Family Youth Kirtan Darbar', 'Sunday Diwan', 'Weekly Kirtan Program', 'Sukhmani Sahib Path',
    'Asa Di Vaar Kirtan', 'Rehras Sahib', 'Daily Nitnem', 'Saturday Gurmat Class', 'Punjabi School', 'Sangrand Diwan', 'Monthly Katha', 'Langar Seva']) {
    assert.equal(screenEventIdentity({ title }, religious).keep, false, title);
    assert.equal(screenEventIdentity({ title }, religious).reason, 'routine_gurdwara_program', title);
  }
});

test('special Gurdwara occasions and guest programs still pass', () => {
  for (const title of ['Guru Nanak Gurpurab Celebration', 'Sunday Diwan - Guru Nanak Gurpurab', 'Vaisakhi Nagar Kirtan', 'Kirtan Darbar with Bhai Harjinder Singh',
    'Akhand Path Sahib', 'Bandi Chhor Divas Diwan', 'Annual Youth Kirtan Camp', 'Special Weekly Kirtan Program with Visiting Jatha', 'Hola Mohalla']) {
    assert.equal(screenEventIdentity({ title }, religious).keep, true, title);
  }
  assert.equal(isRoutineReligiousTitle('Gurpurab Celebration'), false);
});

test('the routine filter only applies to Gurdwara sources', () => {
  assert.equal(screenEventIdentity({ title: 'Sunday Kirtan Night Punjabi Fusion' }, venue).keep, true);
});

// 2. comedians on Ticketmaster ---------------------------------------------------
test('every comedian is searched on Ticketmaster and in the screening list', () => {
  const searched = [...TICKETMASTER_KEYWORDS.comedyA, ...TICKETMASTER_KEYWORDS.comedyB];
  for (const name of COMEDIAN_TERMS) { assert.ok(searched.includes(name), `${name} is not searched`); assert.ok(ARTIST_TERMS.includes(name), `${name} not screened in`); }
  assert.ok(['desi comedy', 'indian comedy', 'punjabi comedy'].every(k => TICKETMASTER_KEYWORDS.comedyA.includes(k)));
  for (const set of ['comedyA', 'comedyB']) assert.ok(TICKETMASTER_KEYWORDS[set].length * 2 <= 36, `${set} fits one run`);
});

test('a comedy search group runs and keeps stand-up shows whose titles have no desi keyword', async t => {
  const db = await createDb(); if (!db) return t.skip('node:sqlite not available');
  const asked = []; const realFetch = globalThis.fetch;
  globalThis.fetch = async url => {
    const keyword = new URL(url).searchParams.get('keyword'); asked.push(keyword);
    const events = keyword === 'zakir khan' ? [
      { id: 'C1', name: 'Tathastu Tour', url: 'https://tm/c1', dates: { start: { dateTime: future(30) } }, classifications: [{ genre: { name: 'Comedy' } }],
        _embedded: { venues: [{ name: 'Paramount Theatre', city: { name: 'Seattle' } }], attractions: [{ name: 'Zakir Khan' }] } },
      { id: 'C2', name: 'VIP Package - Zakir Khan', url: 'https://tm/c2', dates: { start: { dateTime: future(30) } }, _embedded: { attractions: [{ name: 'Zakir Khan' }] } }
    ] : [];
    return { ok: true, json: async () => ({ _embedded: { events } }) };
  };
  try {
    const run = newRun({}); run.delayMs = 0;
    const result = await collectTicketmaster({ DB: db, TICKETMASTER_API_KEY: 'k' }, run, 'comedyA');
    assert.equal(result.count, 1);
    assert.ok(asked.includes('zakir khan') && asked.includes('desi comedy'));
    assert.equal(db.sqlite.prepare('SELECT category FROM hub_events').get().category, 'comedy');
    assert.equal(db.sqlite.prepare("SELECT source_name FROM source_status WHERE source_key='ticketmaster-comedy-a'").get().source_name, 'Ticketmaster (comedy search 1)');
  } finally { globalThis.fetch = realFetch; }
});

test('comedians are categorized as comedy even when the title says "Tour"', () => {
  assert.equal(categoryFor('Tathastu Tour Zakir Khan'), 'comedy');
  assert.equal(ticketmasterEvent({ id: 'x', name: 'n', classifications: [{ genre: { name: 'Comedy' } }] }).category, 'comedy');
  assert.equal(ticketmasterEvent({ id: 'x', name: 'n', classifications: [{ genre: { name: 'Pop' } }] }).category, '');
});

// 3. Eventbrite ----------------------------------------------------------------------
test('Eventbrite searches cover desi, indian, Bollywood/Punjabi DJ and comedy in both cities', () => {
  const urls = EVENTBRITE_SEARCH_URLS.map(x => x.url);
  for (const q of ['desi', 'indian', 'bollywood-dj', 'punjabi-dj', 'indian-comedy', 'desi-comedy', 'punjabi', 'bollywood']) {
    assert.ok(urls.some(u => u.includes('wa--seattle/' + q + '/')), 'Seattle ' + q);
    assert.ok(urls.some(u => u.includes('canada--vancouver/' + q + '/')), 'Vancouver ' + q);
  }
});

// 4. community sources -----------------------------------------------------------------
test('community sources are trusted, scheduled, and known to the health panel', () => {
  const community = EVENT_SOURCES.filter(s => s.type === 'community');
  assert.ok(community.length >= 1);
  for (const s of community) { assert.equal(s.trusted, true, s.key); assert.ok(REFRESH_GROUPS.includes(s.group), s.key); assert.ok(CONFIGURED_SOURCE_KEYS.has(s.key), s.key); }
});

test('a trusted community listing keeps desi events with no keyword in the title, but not parking', () => {
  const source = { ...venue, type: 'community', trusted: true };
  assert.equal(screenEventIdentity({ title: 'Saturday Night Bhaithak with Hardik Tailor' }, source).keep, true);
  assert.equal(screenEventIdentity({ title: 'VIP Parking - Sooraj Dooba Hain' }, source).keep, false);
});

test('the community group runs its sources within budget', async t => {
  const db = await createDb(); if (!db) return t.skip('node:sqlite not available');
  const realFetch = globalThis.fetch; let calls = 0;
  globalThis.fetch = async url => { calls++; return { ok: true, url, text: async () => '<html></html>' }; };
  try {
    const out = await collectGroup({ DB: db }, 'community');
    assert.equal(out.group, 'community'); assert.ok(out.results.length >= 1); assert.ok(calls <= out.limit);
  } finally { globalThis.fetch = realFetch; }
});

// 5. ticket products --------------------------------------------------------------------
test('ticket add-ons and packages are rejected even when they name a headliner', () => {
  for (const title of ['VIP Parking - Diljit Dosanjh', 'VIP Package - Arijit Singh', 'Official Platinum - Karan Aujla', 'Reserved Parking - Punjabi Night',
    'Amplified Access - Punjabi Night', 'Club Level - Diljit Dosanjh', 'Suite Rental - Punjabi Night', 'Private Suite - Bhangra Empire', 'Premium Parking Diljit',
    'Meet & Greet - Shubh', 'VIP Experience - Karan Aujla', 'Loge Box - Arijit Singh']) {
    assert.equal(isTicketProduct(title), true, title);
    assert.equal(screenEventIdentity({ title }, ticketing).keep, false, title);
  }
});

test('real shows are not mistaken for products', () => {
  for (const title of ['Diljit Dosanjh: Dil-Luminati Tour', 'Karan Aujla - It Was All A Dream', 'Arijit Singh Live', 'Parking Lot Bhangra Party', 'Punjabi Club Night']) {
    assert.equal(isTicketProduct(title), false, title);
    assert.equal(screenEventIdentity({ title }, ticketing).keep, true, title);
  }
});

// 6. "Indian" ---------------------------------------------------------------------------------
test('unrelated "Indian" events are rejected', () => {
  for (const title of ['Indian Gaming Conference', 'Indian Scout Demo Day', '37th Annual Indian Days Powwow', 'Indian Wells Tennis Night', 'Indian Motorcycle Night',
    'Indian Health Fair', 'Indian Summer Festival Downtown']) {
    assert.equal(screenEventIdentity({ title }, venue).keep, false, title);
  }
});

test('"Indian" next to a cultural word still counts', () => {
  for (const title of ['Indian Classical Music Night', 'Indian Comedy Show', 'Indian Independence Day Celebration', 'Indian Wedding Expo Food Festival', 'Indian Fusion DJ Party']) {
    assert.equal(screenEventIdentity({ title }, venue).keep, true, title);
  }
  assert.equal(screenEventIdentity({ title: 'Indian Business Summit' }, venue).keep, false);
});

test('desi and Bollywood DJ nights seen on Seattle listings are recognized', () => {
  for (const title of ['CHAK DE! INDIA: Desi Independence Party • DJ Prashant | Seattle', 'BOLLYWOOD-INDEPENDENCE DAY PARTY - | DJ SATS | AUG 14',
    'Sooraj Dooba Hain: Desi Vibes Annual Sunset Boat Party', "SEATTLE'S BHAITHAK- A BOLLYWOOD SUFI MEHFIL FT. HARDIK TAILOR @ORIGEN", 'DJ TEJAS - Saturday Night', 'A Day in Punjab']) {
    assert.equal(screenEventIdentity({ title }, venue).keep, true, title);
  }
});

// 7. manual approval ------------------------------------------------------------------------------
test('an accidentally approved add-on issue is refused, real manual events are kept', () => {
  assert.equal(screenEventIdentity({ title: 'Reserved Parking' }, manual).keep, false);
  assert.equal(screenEventIdentity({ title: 'VIP Package - Diljit Dosanjh' }, manual).keep, false);
  assert.equal(screenEventIdentity({ title: 'Sunday Live at Nirvana Restaurant' }, manual).keep, true);
  assert.equal(normalizeEvent({ title: 'Reserved Parking', startsAt: future(5), url: 'https://e/1', sourceEventId: '9', idIsUnique: true }, manual), null);
});
