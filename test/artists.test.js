import test from 'node:test';
import assert from 'node:assert/strict';
import { eventArtists, artistEvents, artistPage, artistPath, upcomingArtistPaths } from '../src/artists.js';
import { rowToEvent, eventPage } from '../src/events.js';
import { eventCard } from '../src/list-pages.js';
import { sitemapXml } from '../src/articles.js';

const day = 86400000;
const row = (id, title, days, extra = {}) => ({ id, title, description:'', category:'concert', region:'Seattle', city:'Seattle', venue:'Venue',
  performers:'', starts_at:new Date(Date.now() + days * day).toISOString(), url:'https://example.com/t', source_name:'Ticketmaster', source_kind:'ticketing', is_active:1, ...extra });

test('artists come from credits and distinctive playlist names in the title, once each', () => {
  const event = rowToEvent(row('evt-a1','Aman Hothi Live',3,{ performers:'Aman Hothi|Karan Aujla' }));
  assert.deepEqual(eventArtists(event),['Aman Hothi','Karan Aujla']);
  assert.deepEqual(event.artists.map(a => a.path),['/artists/aman-hothi','/artists/karan-aujla']);
  assert.deepEqual(eventArtists(rowToEvent(row('evt-a2','Master Mind Trivia Night',3))),[]);
});

test('artist events split into upcoming and past and hide when nothing matches', () => {
  const events = [rowToEvent(row('evt-b1','Aman Hothi Live',10)), rowToEvent(row('evt-b2','Aman Hothi Night',2)),
    rowToEvent(row('evt-b3','Aman Hothi Old',-30,{ is_active:0 })), rowToEvent(row('evt-b4','Someone Else',4))];
  const found = artistEvents(events,'aman-hothi');
  assert.equal(found.name,'Aman Hothi');
  assert.deepEqual(found.upcoming.map(e => e.id),['evt-b2','evt-b1']);
  assert.deepEqual(found.past.map(e => e.id),['evt-b3']);
  assert.equal(artistEvents(events,'nobody'),null);
  assert.deepEqual(upcomingArtistPaths(events),['/artists/aman-hothi']);
});

test('artist page lists events, links to Spotify, and is noindex without upcoming events', () => {
  const events = [rowToEvent(row('evt-c1','Aman Hothi Live',5,{ performers:'Aman Hothi' }))];
  const html = artistPage(artistEvents(events,'aman-hothi'),{ origin:'https://panjabiaagayeoye.com' });
  assert.match(html,/<h1>Aman Hothi<\/h1>/);
  assert.match(html,/canonical" href="https:\/\/panjabiaagayeoye.com\/artists\/aman-hothi"/);
  assert.match(html,/open\.spotify\.com\/search\/Aman%20Hothi/);
  assert.match(html,/Aman Hothi Live/);
  assert.doesNotMatch(html,/noindex/);
  const old = artistPage(artistEvents([rowToEvent(row('evt-c2','Aman Hothi Old',-40,{ is_active:0 }))],'aman-hothi'));
  assert.match(old,/noindex/);
  assert.match(old,/No upcoming events/);
});

test('event page and cards link performers to their artist page', () => {
  const event = rowToEvent(row('evt-d1','Aman Hothi Live',5,{ performers:'Aman Hothi|Unknown Opener' }));
  assert.match(eventPage(event,{ origin:'https://x.test' }),/<a href="\/artists\/aman-hothi">Aman Hothi<\/a>/);
  const card = eventCard(event);
  assert.match(card,/Featuring <a href="\/artists\/aman-hothi">Aman Hothi<\/a>, <a href="\/artists\/unknown-opener">Unknown Opener<\/a>/);
});

test('artist names are escaped and sitemap keeps only safe artist paths', () => {
  const event = rowToEvent(row('evt-e1','Show',5,{ performers:'<script>x</script> Band' }));
  assert.doesNotMatch(eventCard(event),/<script>x/);
  const xml = sitemapXml('https://x.test',[],[artistPath('Karan Aujla'),'/artists/<bad>']);
  assert.match(xml,/\/artists\/karan-aujla/);
  assert.doesNotMatch(xml,/<bad>/);
});
