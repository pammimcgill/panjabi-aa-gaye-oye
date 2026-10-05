import test from 'node:test';
import assert from 'node:assert/strict';
import {
  EVENT_SOURCES, REFRESH_GROUPS, CONFIGURED_SOURCE_KEYS, screenEventIdentity, categoryFor
} from '../src/config.js';
import {
  pickDetailLinks, DEFAULT_FETCH_BUDGET, DETAIL_LINKS_PER_SOURCE
} from '../src/collectors.js';

const tacomaComedy = EVENT_SOURCES.find(source => source.key === 'tacoma-comedy-club');
const superFunny = EVENT_SOURCES.find(source => source.key === 'super-funny-comedy-club');

test('both Tacoma comedy calendars use a focused, budget-safe refresh group', () => {
  for (const source of [tacomaComedy, superFunny]) {
    assert.ok(source);
    assert.equal(source.type, 'venue');
    assert.equal(source.region, 'Seattle');
    assert.equal(source.city, 'Tacoma');
    assert.equal(source.group, 'venues-tacoma');
    assert.equal(source.trusted, undefined);
    assert.ok(CONFIGURED_SOURCE_KEYS.has(source.key));
  }

  assert.ok(REFRESH_GROUPS.includes('venues-tacoma'));
  const sourcesInGroup = EVENT_SOURCES.filter(source => source.group === 'venues-tacoma').length;
  assert.ok(sourcesInGroup * (DETAIL_LINKS_PER_SOURCE + 1) <= DEFAULT_FETCH_BUDGET);
});

test('Tacoma calendars keep Russell Peters but do not import unrelated club listings', () => {
  const links = [
    { label: 'Russell Peters Live', href: 'https://example.com/events/russell-peters' },
    { label: 'Open Mic Night', href: 'https://example.com/events/open-mic' },
    { label: 'T.J. Miller', href: 'https://example.com/events/tj-miller' }
  ];

  for (const source of [tacomaComedy, superFunny]) {
    assert.deepEqual(pickDetailLinks(links, source).map(link => link.label), ['Russell Peters Live']);
    assert.equal(screenEventIdentity({ title: links[0].label }, source).keep, true);
    assert.equal(screenEventIdentity({ title: links[1].label }, source).keep, false);
  }
  assert.equal(categoryFor(links[0].label), 'comedy');
});
