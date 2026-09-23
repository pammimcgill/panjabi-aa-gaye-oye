import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, readdirSync } from 'node:fs';
import { sectionOf, parseHistoryIssue, articlePage } from '../src/articles.js';
import {
  isoWeek, pickTopic, buildPrompt, collectSearchResults, normUrl, parseDraft, buildIssue, validateDraft, parseReadyFile,
  usedTopicIds, readMarker, topicMarker, longQuotes, callClaude, runWeekly, extractText, AI_OPTION
} from '../scripts/draft-lib.mjs';

const calendar = JSON.parse(readFileSync(new URL('../editorial/calendar.json', import.meta.url), 'utf8')).topics;
const styleGuide = readFileSync(new URL('../editorial/STYLE_GUIDE.md', import.meta.url), 'utf8');
const day = s => new Date(`${s}T12:00:00Z`);

// ---------------------------------------------------------------- parsing hardening
test('an article may use ### subheadings without being cut short', () => {
  const body = '### Summary\n\nS\n\n### Article\n\nIntro.\n\n### A subheading\n\nMore.\n\n#### Deeper\n\nx\n\n### Sources\n\n- https://a.org/x\n\n### Verification notes\n\nprivate';
  assert.equal(sectionOf(body, 'Article'), 'Intro.\n\n### A subheading\n\nMore.\n\n#### Deeper\n\nx');
  assert.equal(sectionOf(body, 'Sources'), '- https://a.org/x');
  assert.equal(sectionOf(body, 'Verification notes'), 'private');
});

test('the AI assistance field drives the reader note, and private notes never reach the page', () => {
  const issue = { number: 5, title: 'T', created_at: '2026-01-01T00:00:00Z', labels: [{ name: 'history' }],
    body: `### Summary\n\nS\n\n### Article\n\nBody text here.\n\n### Sources\n\n- https://a.org/x\n\n### AI assistance\n\n${AI_OPTION}\n\n### Verification notes\n\nSECRET EDITOR NOTE` };
  const article = parseHistoryIssue(issue);
  assert.equal(article.aiAssisted, true);
  const html = articlePage(article, { origin: 'https://site.test' });
  assert.match(html, /<details class="ai-disclosure"><summary>About AI assistance<\/summary>/);
  assert.match(html, /drafted with AI assistance using Claude/); assert.ok(!/SECRET EDITOR NOTE/.test(html));
  const plain = parseHistoryIssue({ ...issue, body: issue.body.replace(AI_OPTION, 'No AI used') });
  assert.equal(plain.aiAssisted, false); assert.ok(!/drafted with AI/.test(articlePage(plain, { origin: '' })));
});

// ---------------------------------------------------------------- topic selection
test('ISO weeks are computed correctly', () => {
  assert.equal(isoWeek(day('2026-01-01')), 1); assert.equal(isoWeek(day('2026-09-04')), 36);
  assert.equal(isoWeek(day('2026-09-21')), 39); assert.equal(isoWeek(day('2026-12-31')), 53);
});

test('the calendar is well formed', () => {
  assert.ok(calendar.length >= 50);
  assert.equal(new Set(calendar.map(t => t.id)).size, calendar.length);
  for (const t of calendar) {
    assert.match(t.id, /^[a-z0-9-]+$/); assert.ok(t.title && t.angle && t.region, t.id);
    if (t.weeks) assert.ok(t.weeks[0] >= 1 && t.weeks[1] <= 53 && t.weeks[0] <= t.weeks[1], t.id);
  }
  for (const id of ['partition-1947', 'nineteen-eighty-four']) assert.equal(calendar.find(t => t.id === id).auto, false);
});

test('automatic topics follow the North American arrival timeline without anniversary jumps', () => {
  assert.equal(pickTopic(calendar, { week: 36 }).id, 'diamond-jubilee-1897');
  assert.equal(pickTopic(calendar, { week: 21 }).id, 'diamond-jubilee-1897');
  assert.equal(pickTopic(calendar, { week: 36, used: new Set(['diamond-jubilee-1897']) }).id, 'early-bc-work');
  const allowed = new Set(['pnw', 'bc', 'usa']);
  for (let week = 1; week <= 53; week++) assert.ok(allowed.has(pickTopic(calendar, { week }).region), `week ${week}`);
});

test('topics are used once; manual overrides work; unknown ids fail', () => {
  const all = new Set(calendar.map(t => t.id));
  assert.equal(pickTopic(calendar, { week: 30, used: all }), null);
  assert.equal(pickTopic(calendar, { week: 1, override: 'partition-1947' }).id, 'partition-1947');
  assert.throws(() => pickTopic(calendar, { week: 1, override: 'nope' }), /Unknown topic/);
});

test('markers round-trip and identify used topics', () => {
  assert.equal(readMarker(`${topicMarker('bellingham-1907')}\n\n### Summary`), 'bellingham-1907');
  assert.deepEqual([...usedTopicIds([{ body: topicMarker('a') }, { body: 'none' }, { body: topicMarker('b') }])], ['a', 'b']);
});

// ---------------------------------------------------------------- prompt
test('the prompt carries the topic, the style guide and the exact output headings', () => {
  const { system, user } = buildPrompt(calendar.find(t => t.id === 'bellingham-1907'), { styleGuide, today: day('2026-09-21') });
  assert.match(system, /Never invent a quotation/); assert.match(system, /web search/i);
  assert.match(user, /Bellingham, September 1907/); assert.match(user, /Pacific Northwest/);
  for (const h of ['### Summary', '### Article', '### Sources', '### Topics', '### Year', '### Verification notes']) assert.ok(user.includes(h), h);
  assert.match(system, /arrived/); assert.match(user, /Year the story is about: 1907/); assert.match(user, /In the story of arrival/);
});

// ---------------------------------------------------------------- draft handling
const goodArticle = `Opening paragraph. ${'word '.repeat(480)}\n\n## A subheading\n\nHe said "this sentence is a long invented quotation that nobody can confirm anywhere" and left.`;
const draftText = `### Summary\n\nA short summary.\n\n### Article\n\n${goodArticle}\n\n### Sources\n\n- [Real page](https://example.org/real/)\n- [Second page](https://www.example.edu/second?utm_source=x)\n- [Third page](https://example.gov/third)\n- [Made up](https://made-up.example/fake)\n\n### Topics\n\nPacific Northwest, Migration\n\n### Verification notes\n\n- Figures differ by source.`;
const searchBlocks = [
  { type: 'server_tool_use', name: 'web_search' },
  { type: 'web_search_tool_result', content: [
    { type: 'web_search_result', url: 'https://example.org/real', title: 'The Real Page' },
    { type: 'web_search_result', url: 'https://example.edu/second', title: 'Second Page Title' },
    { type: 'web_search_result', url: 'https://example.gov/third/', title: 'Third' }] },
  { type: 'text', text: draftText }
];

test('search results are normalized so trailing slashes, www and tracking parameters do not matter', () => {
  assert.equal(normUrl('https://www.Example.org/a/?utm_source=x#top'), 'example.org/a');
  const found = collectSearchResults(searchBlocks);
  assert.ok(found.has('example.org/real') && found.has('example.edu/second') && found.has('example.gov/third'));
});

test('an invented source link is removed from Sources and listed for the editor', () => {
  const issue = buildIssue({ topic: calendar.find(t => t.id === 'bellingham-1907'), draft: parseDraft(extractText(searchBlocks)), results: collectSearchResults(searchBlocks), today: day('2026-09-21') });
  assert.equal(issue.verified.length, 3); assert.equal(issue.unverified.length, 1);
  assert.equal(issue.unverified[0].url, 'https://made-up.example/fake');
  assert.deepEqual(issue.labels, ['draft', 'ai-draft']);
  const parsed = parseHistoryIssue({ number: 9, title: issue.title, body: issue.body, created_at: '2026-09-21T00:00:00Z', labels: [{ name: 'history' }] });
  assert.equal(parsed.sources.length, 3); assert.ok(!parsed.sources.some(s => s.url.includes('made-up')));
  assert.equal(parsed.aiAssisted, true); assert.deepEqual(parsed.topics, ['Pacific Northwest', 'Migration']);
  assert.match(parsed.body, /## A subheading/);
  assert.match(issue.body, /Direct quotations to confirm/); assert.match(issue.body, /made-up\.example/);
  assert.ok(!/made-up/.test(parsed.body) && !/Direct quotations/.test(parsed.body), 'private notes stay out of the article');
});

test('long quotations are counted; short ones are not', () => {
  assert.equal(longQuotes('He said "hello there" and "this is a long quotation that goes well past forty characters".').length, 1);
});

test('a draft that is too short or has no sources is refused', () => {
  assert.match(validateDraft(parseDraft('### Summary\n\nS\n\n### Article\n\nShort.\n\n### Sources\n\n- x'))[0], /too short/);
  assert.equal(validateDraft(parseDraft(draftText)).length, 0);
});

test('a sensitive topic carries its flag into the notes', () => {
  const topic = calendar.find(t => t.id === 'partition-1947');
  assert.match(buildIssue({ topic, draft: parseDraft(draftText), results: new Map() }).body, /Editorial flag.*Sensitive/);
});

// ---------------------------------------------------------------- prepared articles
test('the starter articles are valid, sourced and ready to open as drafts', () => {
  const dir = new URL('../editorial/ready/', import.meta.url);
  const files = readdirSync(dir).filter(f => f.endsWith('.md'));
  assert.ok(files.length >= 3);
  for (const file of files) {
    const text = readFileSync(new URL(file, dir), 'utf8');
    const ready = parseReadyFile(text);
    assert.ok(calendar.some(t => t.id === ready.topic), `${file}: topic is in the calendar`);
    const article = parseHistoryIssue({ number: 1, title: ready.title, body: ready.body, created_at: '2026-01-01T00:00:00Z', labels: [{ name: 'history' }] });
    assert.ok(article.body.split(/\s+/).length >= 500, `${file}: length`);
    assert.ok(article.sources.length >= 5, `${file}: sources`);
    assert.ok(article.sources.every(s => /^https:\/\//.test(s.url)), `${file}: https sources`);
    assert.equal(article.aiAssisted, true); assert.ok(article.topics.length >= 2, `${file}: topics`);
    assert.ok(article.dek.length > 50 && article.dek.length <= 420, `${file}: summary`);
    assert.ok(!/SECRET|TODO|\[\w+ \d+\]/.test(text), `${file}: no leftovers`);
    assert.match(sectionOf(text, 'Verification notes'), /-/, `${file}: has verification notes`);
    assert.ok(!/Verification notes|Sources &|- Numbers differ/.test(article.body), `${file}: private notes not in the article`);
  }
});

test('a ready file without the header or sections is rejected', () => {
  assert.throws(() => parseReadyFile('### Summary\n\nx'), /header/);
  assert.throws(() => parseReadyFile('---\ntitle: T\ntopic: t\n---\n### Summary\n\nx'), /missing the "Article"/);
});

// ---------------------------------------------------------------- API loop and full run
const jsonResponse = (data, ok = true, status = 200) => ({ ok, status, json: async () => data, text: async () => JSON.stringify(data) });

function fakeNetwork({ anthropic, existing = [] }) {
  const calls = { anthropic: [], posts: [], lists: [] };
  const fetchImpl = async (url, options = {}) => {
    if (String(url).startsWith('https://api.anthropic.com')) { calls.anthropic.push(JSON.parse(options.body)); return anthropic(calls.anthropic.length); }
    if (options.method === 'POST') { calls.posts.push(JSON.parse(options.body)); return jsonResponse({ number: 7, html_url: 'https://github.com/o/r/issues/7' }); }
    calls.lists.push(String(url)); return jsonResponse(String(url).includes('labels=draft') ? existing : []);
  };
  return { fetchImpl, calls };
}
const env = { GITHUB_REPOSITORY: 'o/r', GITHUB_TOKEN: 't', ANTHROPIC_API_KEY: 'k' };

test('the API loop continues after pause_turn and keeps the search results from every turn', async () => {
  const net = fakeNetwork({ anthropic: n => n === 1
    ? jsonResponse({ stop_reason: 'pause_turn', content: [searchBlocks[1]] })
    : jsonResponse({ stop_reason: 'end_turn', content: [searchBlocks[2]] }) });
  const blocks = await callClaude(net.fetchImpl, { apiKey: 'k', system: 's', user: 'u' });
  assert.equal(net.calls.anthropic.length, 2);
  assert.equal(net.calls.anthropic[0].tools[0].name, 'web_search'); assert.equal(net.calls.anthropic[0].model, 'claude-sonnet-5');
  assert.equal(net.calls.anthropic[1].messages.length, 2);
  assert.equal(collectSearchResults(blocks).size, 3); assert.match(extractText(blocks), /### Summary/);
});

test('the API loop can finish after more than four paused web-search turns', async () => {
  const net = fakeNetwork({ anthropic: n => n <= 5
    ? jsonResponse({ stop_reason: 'pause_turn', content: [searchBlocks[1]] })
    : jsonResponse({ stop_reason: 'end_turn', content: [searchBlocks[2]] }) });
  const blocks = await callClaude(net.fetchImpl, { apiKey: 'k', system: 's', user: 'u' });
  assert.equal(net.calls.anthropic.length, 6);
  assert.equal(net.calls.anthropic[0].max_tokens, 10000);
  assert.equal(net.calls.anthropic[0].tools[0].max_uses, 6);
  assert.match(extractText(blocks), /### Summary/);
});

test('the API loop reports the real stop reason when Claude returns no article text', async () => {
  const net = fakeNetwork({ anthropic: () => jsonResponse({ stop_reason: 'max_tokens', content: [searchBlocks[1]] }) });
  await assert.rejects(
    callClaude(net.fetchImpl, { apiKey: 'k', system: 's', user: 'u' }),
    /no article text.*stop_reason: max_tokens/
  );
});

test('a weekly run opens a draft issue for the next chronological topic and never publishes it', async () => {
  const net = fakeNetwork({ anthropic: () => jsonResponse({ stop_reason: 'end_turn', content: searchBlocks }) });
  const logs = [];
  const result = await runWeekly({ env, fetchImpl: net.fetchImpl, now: day('2026-09-04'), calendar, styleGuide, log: m => logs.push(m) });
  assert.equal(result.created, true); assert.equal(result.topic, 'diamond-jubilee-1897');
  assert.equal(net.calls.posts.length, 1);
  assert.deepEqual(net.calls.posts[0].labels, ['draft', 'ai-draft']); assert.ok(!net.calls.posts[0].labels.includes('history'));
  assert.match(net.calls.posts[0].body, /topic: diamond-jubilee-1897/);
  assert.match(logs.join('\n'), /3 confirmed sources, 1 unconfirmed removed/);
});

test('a topic that already has a draft is not repeated', async () => {
  const net = fakeNetwork({ anthropic: () => jsonResponse({ stop_reason: 'end_turn', content: searchBlocks }), existing: [{ body: topicMarker('bellingham-1907') }] });
  const result = await runWeekly({ env, fetchImpl: net.fetchImpl, now: day('2026-09-04'), calendar, styleGuide, log() {} });
  assert.notEqual(result.topic, 'bellingham-1907');
});

test('a weak draft creates no issue and fails loudly', async () => {
  const short = [{ type: 'text', text: '### Summary\n\nS\n\n### Article\n\nToo short.\n\n### Sources\n\n- [x](https://example.org/x)' }];
  const net = fakeNetwork({ anthropic: () => jsonResponse({ stop_reason: 'end_turn', content: short }) });
  await assert.rejects(runWeekly({ env, fetchImpl: net.fetchImpl, now: day('2026-09-04'), calendar, styleGuide, log() {} }), /too short/);
  assert.equal(net.calls.posts.length, 0);
});

test('API failures are reported and missing keys are caught early', async () => {
  const net = fakeNetwork({ anthropic: () => jsonResponse({}, false, 401) });
  await assert.rejects(runWeekly({ env, fetchImpl: net.fetchImpl, now: day('2026-09-04'), calendar, styleGuide, log() {} }), /HTTP 401/);
  await assert.rejects(runWeekly({ env: { ...env, ANTHROPIC_API_KEY: '' }, fetchImpl: net.fetchImpl, calendar, log() {} }), /ANTHROPIC_API_KEY/);
});

test('dry runs print the draft and create nothing', async () => {
  const net = fakeNetwork({ anthropic: () => jsonResponse({ stop_reason: 'end_turn', content: searchBlocks }) });
  const logs = [];
  const result = await runWeekly({ env: { ANTHROPIC_API_KEY: 'k' }, fetchImpl: net.fetchImpl, now: day('2026-09-04'), calendar, styleGuide, dryRun: true, log: m => logs.push(m) });
  assert.equal(result.dryRun, true); assert.equal(net.calls.posts.length, 0); assert.match(logs.join('\n'), /### Article/);
});

test('a prepared article opens as a draft once, and not again', async () => {
  const text = readFileSync(new URL('../editorial/ready/01-bellingham-1907.md', import.meta.url), 'utf8');
  const first = fakeNetwork({ anthropic: () => { throw new Error('the API must not be called for prepared articles'); } });
  const created = await runWeekly({ env: { GITHUB_REPOSITORY: 'o/r', GITHUB_TOKEN: 't' }, fetchImpl: first.fetchImpl, readyText: text, calendar, log() {} });
  assert.equal(created.created, true); assert.deepEqual(first.calls.posts[0].labels, ['draft']);
  assert.match(first.calls.posts[0].title, /Bellingham/);
  const again = fakeNetwork({ anthropic: () => { throw new Error('no'); }, existing: [{ body: first.calls.posts[0].body }] });
  const skipped = await runWeekly({ env: { GITHUB_REPOSITORY: 'o/r', GITHUB_TOKEN: 't' }, fetchImpl: again.fetchImpl, readyText: text, calendar, log() {} });
  assert.equal(skipped.skipped, true); assert.equal(again.calls.posts.length, 0);
});

// ---------------------------------------------------------------- the arrival timeline
import { chapterFor, ARRIVAL_CHAPTERS } from '../src/articles.js';
import worker from '../src/worker.js';

test('years map to arrival chapters, and every year lands in exactly one chapter', () => {
  const names = year => chapterFor(year).name;
  assert.equal(names(1699), 'Before the journey'); assert.equal(names(1897), 'The first arrivals'); assert.equal(names(1907), 'The first arrivals');
  assert.equal(names(1908), 'Putting down roots'); assert.equal(names(1914), 'Putting down roots'); assert.equal(names(1917), 'The exclusion years');
  assert.equal(names(1947), 'The doors reopen'); assert.equal(names(1967), 'The doors reopen'); assert.equal(names(1990), 'Building a home');
  assert.equal(names(2016), 'Punjabis here today'); assert.equal(names(null), 'Culture and heritage'); assert.equal(names('abc'), 'Culture and heritage');
  for (let y = 1000; y <= 2100; y++) assert.equal(ARRIVAL_CHAPTERS.filter(c => y >= c.from && y <= c.to).length, 1, String(y));
});

test('the Year field places an article, and the page shows its chapter', () => {
  const issue = { number: 3, title: 'T', created_at: '2026-01-01T00:00:00Z', labels: [{ name: 'history' }], body: '### Summary\n\nS\n\n### Article\n\nBody.\n\n### Sources\n\n- https://a.org/x\n\n### Year\n\nAbout 1907, in September' };
  const a = parseHistoryIssue(issue);
  assert.equal(a.year, 1907); assert.equal(a.chapter.name, 'The first arrivals');
  assert.match(articlePage(a, { origin: '' }), /The arrival · Chapter 1, The first arrivals · 1907/);
  assert.equal(parseHistoryIssue({ ...issue, body: issue.body.replace('About 1907, in September', '') }).year, null);
});

test('the calendar follows the arrival in order, and dated topics have sensible years', () => {
  const at = id => calendar.findIndex(t => t.id === id);
  const order = ['diamond-jubilee-1897', 'bellingham-1907', 'ghadar-astoria-1913', 'komagata-maru-1914', 'barred-zone-1917', 'thind-1923', 'voting-rights-canada-1947', 'doors-reopen-1967', 'baltej-dhillon-turban', 'ujjal-dosanjh-premier'];
  for (let i = 1; i < order.length; i++) assert.ok(at(order[i - 1]) >= 0 && at(order[i - 1]) < at(order[i]), `${order[i - 1]} before ${order[i]}`);
  for (const t of calendar) if (t.year) assert.ok(t.year >= 1400 && t.year <= 2026, t.id);
  assert.ok(calendar.filter(t => t.year && t.year >= 1897 && t.region !== 'music').length >= 20);
});

test('the AI draft carries a Year, from the draft or else the topic', () => {
  const topic = calendar.find(t => t.id === 'bellingham-1907');
  assert.deepEqual(parseDraft('### Year\n\n1907\n\n### Summary\n\nS').Year, '1907');
  const withYear = buildIssue({ topic, draft: parseDraft(`${draftText}\n\n### Year\n\n1907`), results: new Map() });
  assert.equal(sectionOf(withYear.body, 'Year'), '1907');
  const fromTopic = buildIssue({ topic, draft: parseDraft(draftText), results: new Map() });
  assert.equal(sectionOf(fromTopic.body, 'Year'), '1907');
});

test('the starter articles all have a year and sit in chapters', () => {
  const dir = new URL('../editorial/ready/', import.meta.url);
  const chapters = readdirSync(dir).filter(f => f.endsWith('.md')).map(f => {
    const ready = parseReadyFile(readFileSync(new URL(f, dir), 'utf8'));
    const a = parseHistoryIssue({ number: 1, title: ready.title, body: ready.body, created_at: '2026-01-01T00:00:00Z', labels: [{ name: 'history' }] });
    assert.ok(a.year, `${f}: year`); assert.match(a.body, /## In the story of arrival/, `${f}: arrival section`);
    return a.chapter.name;
  });
  assert.deepEqual(chapters.sort(), ['Putting down roots', 'Putting down roots', 'The first arrivals']);
});

test('the article page points to the neighbours in the story, closest years first', async () => {
  const mk = (n, title, year) => ({ number: n, title, state: 'open', created_at: `2026-0${n}-01T00:00:00Z`, labels: [{ name: 'history' }],
    body: `### Summary\n\nS ${n}\n\n### Article\n\nBody ${n}.\n\n### Sources\n\n- https://a.org/${n}\n\n### Year\n\n${year}` });
  const issues = [mk(1, 'Nineteen Seventeen', 1917), mk(2, 'Nineteen Thirteen', 1913), mk(3, 'Eighteen Ninety Seven', 1897), mk(4, 'Nineteen Forty Seven', 1947), mk(5, 'Nineteen Fourteen', 1914)];
  const realFetch = globalThis.fetch;
  globalThis.fetch = async url => ({ ok: true, status: 200, json: async () => (String(url).includes('/issues/5') ? issues[4] : issues) });
  try {
    const res = await worker.fetch(new Request('https://site.test/history/5-nineteen-fourteen'), { GITHUB_REPO: 'o/r' }, { waitUntil() {} });
    const html = await res.text();
    const order = ['Nineteen Thirteen', 'Nineteen Seventeen', 'Eighteen Ninety Seven'].map(t => html.indexOf(`<h3>${t}</h3>`));
    assert.ok(order.every(i => i > 0), 'three neighbours are shown'); assert.ok(order[0] < order[1] && order[1] < order[2], 'closest years first');
    assert.ok(!html.includes('<h3>Nineteen Forty Seven</h3>'), 'the fourth-closest is left out');
    assert.match(html, /Keep following the story/);
  } finally { globalThis.fetch = realFetch; }
});

test('/api/history returns years, chapters and a chapter tally', async () => {
  const issues = [{ number: 1, title: 'A', state: 'open', created_at: '2026-01-01T00:00:00Z', labels: [{ name: 'history' }], body: '### Summary\n\nS\n\n### Article\n\nB.\n\n### Sources\n\n- https://a.org\n\n### Year\n\n1907' }];
  const realFetch = globalThis.fetch; globalThis.fetch = async () => ({ ok: true, json: async () => issues });
  const db = { prepare: () => ({ bind: () => ({ all: async () => ({ results: [] }) }) }) };
  try {
    const data = await (await worker.fetch(new Request('https://site.test/api/history'), { DB: db, GITHUB_REPO: 'o/r' }, {})).json();
    assert.equal(data.items[0].year, 1907); assert.equal(data.items[0].chapter, 'The first arrivals'); assert.equal(data.items[0].chapterNumber, 1);
    assert.equal(data.items[0].chapterSpan, '1897 to 1907'); assert.deepEqual(data.chapters, [{ name: 'The first arrivals', count: 1 }]);
  } finally { globalThis.fetch = realFetch; }
});
