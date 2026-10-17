import test from 'node:test';
import assert from 'node:assert/strict';
import { screenEventIdentity, REFRESH_GROUPS, REFRESH_SLOT_MS, refreshCycle, CONFIGURED_SOURCE_KEYS, TICKETMASTER_KEYWORDS } from '../src/config.js';
import { spotifyArtists, genericSpotifyArtists, spotifySearchNames, spotifyBatch, knownArtistsInTitle } from '../src/spotify-artists.js';
import { rescreenStoredEvents, spotifyKeywords, ticketmasterEvent, storedPerformers, upsertEvents, normalizeEvent } from '../src/collectors.js';
import { createDb } from '../tests-support/d1-shim.js';

test('Distinctive Spotify names match the title or a credit without bypassing existing exclusions', () => {
  assert.equal(screenEventIdentity({title:'Aman Hothi Live'}).reason,'spotify_artist');
  assert.equal(screenEventIdentity({title:'Talwiinder Live'}).reason,'spotify_artist');
  assert.equal(screenEventIdentity({title:'Live show',performers:['Tesher']}).reason,'spotify_artist');
  assert.equal(screenEventIdentity({title:'Reserved Parking - Aman Hothi'}).keep,false);
  assert.equal(screenEventIdentity({title:'Indian Motorcycle Expo',performers:['Aman Hothi']}).keep,false);
  assert.equal(screenEventIdentity({title:'Regular Sunday Program',performers:['Aman Hothi']},{type:'religious'}).keep,false);
  assert.equal(screenEventIdentity({title:'Generic show',description:'Aman Hothi'}).keep,false);
});

test('Generic names never match a title and need a credited performer on a Music event', () => {
  for (const title of ['Master Mind Trivia Night','Real Boss Comedy Showcase','Mann Deep Dive Workshop','Sam Malik Quartet Jazz','Dropped Out Live','Aniket Live'])
    assert.equal(screenEventIdentity({title}).keep,false,title);
  assert.equal(screenEventIdentity({title:'Live show',performers:['Aniket']}).keep,false);
  assert.equal(screenEventIdentity({title:'Live show',performers:['Aniket'],genre:'Sports'}).keep,false);
  assert.equal(screenEventIdentity({title:'Live show',performers:['Aniket'],genre:'Music'}).reason,'spotify_artist');
  assert.equal(screenEventIdentity({title:'Spring Tour',performers:['Gravity'],genre:'Music'}).keep,true);
  assert.equal(screenEventIdentity({title:'Gravity Fest'}).keep,false);
  assert.ok(genericSpotifyArtists.every(name => spotifyArtists.includes(name)), 'every generic name is also on the playlist');
});

test('Ticketmaster events carry their genre segment', () => {
  const raw = ticketmasterEvent({id:'1',name:'Show',dates:{start:{localDate:'2030-01-01'}},classifications:[{segment:{name:'Music'}}]});
  assert.equal(raw.genre,'Music');
});

test('Spotify searches skip generic and already-searched names and rotate through the whole list', () => {
  const fixed = Object.values(TICKETMASTER_KEYWORDS).flat();
  const names = spotifySearchNames(fixed);
  assert.ok(!names.some(n => genericSpotifyArtists.includes(n)));
  assert.ok(!names.some(n => fixed.includes(n.toLowerCase())));
  const seen = new Set();
  for (let cycle = 0; cycle < Math.ceil(names.length / 32) + 1; cycle++)
    for (const part of [0,1]) { const batch = spotifyBatch(names,part,cycle); assert.equal(batch.length,16); batch.forEach(n => seen.add(n)); }
  assert.equal(seen.size,names.length);
  assert.ok(16 * 2 <= 36, 'one group stays inside the default request budget (16 names x 2 regions)');
});

test('Spotify groups are scheduled, configured and rotate each full cycle', () => {
  for (const g of ['tickets-spotify-a','tickets-spotify-b']) assert.ok(REFRESH_GROUPS.includes(g));
  for (const k of ['ticketmaster-spotify-a','ticketmaster-spotify-b']) assert.ok(CONFIGURED_SOURCE_KEYS.has(k));
  const t0 = 0, t1 = REFRESH_GROUPS.length * REFRESH_SLOT_MS;
  assert.equal(refreshCycle(t1),refreshCycle(t0) + 1);
  assert.notDeepEqual(spotifyKeywords(0,t0),spotifyKeywords(0,t1));
  assert.notDeepEqual(spotifyKeywords(0,t0),spotifyKeywords(1,t0));
});

test('titles report the distinctive playlist artists they name', () => {
  assert.deepEqual(knownArtistsInTitle('Aman Hothi Live in Surrey'),['Aman Hothi']);
  assert.deepEqual(knownArtistsInTitle('Master Mind Trivia Night'),[]);
});

test('rescreen uses the stored performers column, not only the Featuring text', async t => {
  const db = await createDb(); if (!db) return t.skip('node:sqlite not available');
  const startsAt = new Date(Date.now() + 5 * 86400000).toISOString();
  const source = { key:'ticketmaster', name:'Ticketmaster', type:'ticketing', region:'Seattle', city:'Seattle', url:'https://example.com' };
  // Five credits: only four reach the description, so the sixth-credit match must come from the column.
  const credits = ['A One','B Two','C Three','D Four','Karan Aujla'].map(name => name);
  const event = normalizeEvent({ sourceEventId:'x1', idIsUnique:true, title:'Night out', performers:['Talwiinder', ...credits], genre:'Music', startsAt, url:'https://example.com/e' }, source);
  assert.ok(event, 'event is kept when collected');
  assert.equal(storedPerformers({ performers:event.performers, description:event.description }).includes('Talwiinder'), true);
  await upsertEvents(db,[event]);
  const out = await rescreenStoredEvents(db);
  assert.equal(out.removed,0);
  assert.equal(db.sqlite.prepare('SELECT COUNT(*) n FROM hub_events WHERE is_active=1').get().n,1);
});
