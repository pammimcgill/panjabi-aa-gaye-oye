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

test('the history page is a simple chronological article list without chapter roadmap headings', async () => {
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
  assert.ok(at('Story 2') < at('Story 3') && at('Story 3') < at('Story 1'), 'stories are ordered by year');
  assert.ok(at('Story 1') < at('Story 4') && at('Story 4') < at('External reading'), 'undated and external reading come last');
  assert.match(html, /<strong class="year">1907<\/strong>/);
  assert.ok(!/chapter-head/.test(html));
  assert.ok(!/story-card lead/.test(html));
  assert.doesNotMatch(els['#storyTools'].innerHTML, /The story so far|Newest first/);
});

test('the news page never shows chapters', async () => {
  const els = fakePage();
  const items = Array.from({ length: 5 }, (_, i) => ({ id: `n${i}`, title: `Headline ${i}`, dek: 'd', url: `https://n/${i}`, internal: false, source: 'PTC Punjabi', publishedAt: new Date(Date.now() - i * 3600e3).toISOString(), topics: [] }));
  globalThis.fetch = async () => ({ ok: true, json: async () => ({ items, sources: [{ name: 'PTC Punjabi', count: 5 }] }) });
  const { mountStories } = await import('../public/app.js');
  await mountStories('music');
  assert.ok(!/chapter-head/.test(els['#storyGrid'].innerHTML)); assert.match(els['#storyGrid'].innerHTML, /story-card lead/);
});
