import test from 'node:test';
import assert from 'node:assert/strict';

// A tiny stand-in for the browser, just enough to run the story pages.
function fakePage() {
  const make = () => { const listeners = {}; return { innerHTML: '', textContent: '', classList: { add() {}, remove() {}, toggle() {} }, dataset: {},
    addEventListener(type, fn) { (listeners[type] = listeners[type] || []).push(fn); }, fire(type, event) { (listeners[type] || []).forEach(fn => fn(event)); },
    querySelectorAll: () => [], setAttribute() {} }; };
  const els = { '#storyGrid': make(), '#loadingState': make(), '#errorState': make(), '#storyCount': make(), '#storyTools': make(), '#loadMore': make() };
  globalThis.document = { querySelector: q => els[q] || null };
  return els;
}

const item = (n, year, extra = {}) => ({ id: `github-${n}`, title: `Story ${n}`, dek: 'd', url: `/history/${n}-x`, internal: true, source: 'Panjabi Aa Gaye Oye',
  publishedAt: new Date(Date.UTC(2026, 0, n)).toISOString(), topics: [], minutes: 3, year, chapter: extra.chapter, chapterNumber: extra.chapterNumber, chapterSpan: extra.chapterSpan, ...extra });

test('the history page opens as a timeline with chapter headings, in order', async () => {
  const els = fakePage();
  // the API returns items newest first
  const items = [
    { id: 'ext', title: 'External reading', dek: 'd', url: 'https://sikhri.org/a', internal: false, source: 'Sikh Research Institute', publishedAt: '2026-01-10T00:00:00Z', topics: [] },
    item(1, 1947, { chapter: 'The doors reopen', chapterNumber: 4, chapterSpan: '1947 to 1967' }),
    item(2, 1907, { chapter: 'The first arrivals', chapterNumber: 1, chapterSpan: '1897 to 1907' }),
    item(3, 1914, { chapter: 'Putting down roots', chapterNumber: 2, chapterSpan: '1908 to 1914' }),
    item(4, null, { chapter: 'Culture and heritage', chapterNumber: 99 })
  ];
  globalThis.fetch = async () => ({ ok: true, json: async () => ({ items, topics: [], chapters: [] }) });
  const { mountStories } = await import('../public/app.js');
  await mountStories('history');
  const html = els['#storyGrid'].innerHTML;
  const at = text => html.indexOf(text);
  assert.ok(at('The first arrivals') > 0 && at('The first arrivals') < at('Putting down roots') && at('Putting down roots') < at('The doors reopen'), 'chapters run in order');
  assert.ok(at('The doors reopen') < at('Culture and heritage') && at('Culture and heritage') < at('Further reading'), 'undated and external come last');
  assert.ok(at('Story 2') < at('Story 3') && at('Story 3') < at('Story 1'), 'stories are ordered by year');
  assert.match(html, /Chapter 1/); assert.match(html, /<strong class="year">1907<\/strong>/); assert.match(html, /1897 to 1907/);
  assert.ok(!/story-card lead/.test(html), 'no lead card in timeline mode');
  assert.match(els['#storyTools'].innerHTML, /The story so far/); assert.match(els['#storyTools'].innerHTML, /Newest first/);
  // switching to newest first removes the chapter headings
  els['#storyTools'].fire('click', { target: { closest: sel => (sel === '.sort' ? { dataset: { sort: 'newest' } } : null) } });
  assert.ok(!/chapter-head/.test(els['#storyGrid'].innerHTML));
  assert.ok(els['#storyGrid'].innerHTML.indexOf('External reading') < els['#storyGrid'].innerHTML.indexOf('Story 1'), 'newest first puts the newest story first');
});

test('the news page never shows chapters', async () => {
  const els = fakePage();
  const items = Array.from({ length: 5 }, (_, i) => ({ id: `n${i}`, title: `Headline ${i}`, dek: 'd', url: `https://n/${i}`, internal: false, source: 'PTC Punjabi', publishedAt: new Date(Date.now() - i * 3600e3).toISOString(), topics: [] }));
  globalThis.fetch = async () => ({ ok: true, json: async () => ({ items, sources: [{ name: 'PTC Punjabi', count: 5 }] }) });
  const { mountStories } = await import('../public/app.js');
  await mountStories('music');
  assert.ok(!/chapter-head/.test(els['#storyGrid'].innerHTML)); assert.match(els['#storyGrid'].innerHTML, /story-card lead/);
});
