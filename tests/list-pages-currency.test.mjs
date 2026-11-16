import test from 'node:test';
import assert from 'node:assert/strict';
import { renderHomeHistorySnapshot, renderStorySnapshot, renderEventSnapshot } from '../src/list-pages.js';

const text = "The $200 requirement; $20, $1, $$, $& and $' must stay literal.";
const escaped = "The $200 requirement; $20, $1, $$, $&amp; and $&#39; must stay literal.";
const story = {title: text, dek: text, internal: true, url: '/history/example', source: 'Our history', year: 1908};
const fixture = id => '<main><div id="' + id + '"></div><aside>After the cards</aside></main>';

test('homepage history keeps dollar amounts and card boundaries intact', () => {
  const result = renderHomeHistorySnapshot(fixture('historyFrontGrid'), [story]);
  assert.ok(result.includes('<h3>' + escaped + '</h3><p>' + escaped + '</p></a></div><aside>After the cards</aside>'));
  assert.equal((result.match(/<a class="history-teaser"/g) || []).length, 1);
});
for (const news of [false, true]) {
  test((news ? 'news' : 'history') + ' snapshots preserve literal currency', () => {
    const result = renderStorySnapshot(fixture('storyGrid'), [story], {news});
    assert.ok(result.includes('<h2>' + escaped + '</h2>'));
    assert.ok(result.includes('<p>' + escaped + '</p>'));
    assert.ok(result.endsWith('</article></div><aside>After the cards</aside></main>'));
  });
}
test('event snapshots preserve prices and descriptions without inserting markup', () => {
  const event = {title: text, description: text, pageUrl: '/events/example', startsAt: '2026-12-01T20:00:00-08:00'};
  const result = renderEventSnapshot(fixture('eventsGrid'), [event]);
  assert.ok(result.includes('<h3>' + escaped + '</h3>'));
  assert.ok(result.includes('<br>' + escaped + '</div>'));
  assert.ok(result.endsWith('</article></div><aside>After the cards</aside></main>'));
});
