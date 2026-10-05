import test from 'node:test';
import assert from 'node:assert/strict';
import { EVENT_SOURCES, CONFIGURED_SOURCE_KEYS, screenEventIdentity, categoryFor } from '../src/config.js';
import { pickDetailLinks } from '../src/collectors.js';

const rainier = EVENT_SOURCES.find(source => source.key === 'rainier-arts-center');

test('Rainier Arts Center is collected with the Seattle venues without trusting every listing', () => {
  assert.ok(rainier);
  assert.equal(rainier.name, 'Rainier Arts Center');
  assert.equal(rainier.region, 'Seattle');
  assert.equal(rainier.city, 'Seattle');
  assert.equal(rainier.group, 'venues-seattle');
  assert.equal(rainier.trusted, undefined);
  assert.ok(CONFIGURED_SOURCE_KEYS.has('rainier-arts-center'));
});

test('Rainier screening follows South Asian comedy and ignores unrelated venue events', () => {
  const links = [
    { label: 'Monster Ft. Gurleen Pannu Standup Comedy Live', href: 'https://rainierartscenter.org/events/gurleen-pannu/' },
    { label: 'Jaspreet Singh Live 2026', href: 'https://rainierartscenter.org/events/jaspreet-singh/' },
    { label: 'Cultural Candidate Forum', href: 'https://rainierartscenter.org/events/candidate-forum/' },
    { label: 'Valley and Mountain Sunday Celebration', href: 'https://rainierartscenter.org/events/sunday/' }
  ];
  assert.deepEqual(pickDetailLinks(links, rainier).map(link => link.label), [
    'Monster Ft. Gurleen Pannu Standup Comedy Live',
    'Jaspreet Singh Live 2026'
  ]);
  assert.equal(screenEventIdentity({ title: links[0].label }, rainier).keep, true);
  assert.equal(categoryFor(links[0].label), 'comedy');
  assert.equal(screenEventIdentity({ title: links[2].label }, rainier).keep, false);
});
