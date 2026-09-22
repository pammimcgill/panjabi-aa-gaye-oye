// Weekly history drafting. Everything here is plain functions so it can be tested without a network.
import { sectionOf, extractSources, FORM_LABELS } from '../src/articles.js';

export const DEFAULT_MODEL = 'claude-sonnet-5';
export const AI_OPTION = 'Drafted with AI, reviewed and edited by a person';
const MIN_ARTICLE_WORDS = 450;
const MIN_SOURCES = 3;

// ---------------------------------------------------------------- choosing a topic
export function isoWeek(date) {
  const d = new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate()));
  d.setUTCDate(d.getUTCDate() + 4 - (d.getUTCDay() || 7));
  const yearStart = new Date(Date.UTC(d.getUTCFullYear(), 0, 1));
  return Math.ceil(((d - yearStart) / 86400000 + 1) / 7);
}

export const topicMarker = id => `<!-- topic: ${id} -->`;
export const readMarker = body => (String(body || '').match(/<!--\s*topic:\s*([\w.-]+)\s*-->/) || [])[1] || null;

export function usedTopicIds(issues) {
  return new Set((issues || []).map(issue => readMarker(issue.body)).filter(Boolean));
}

// Timely topics for this week come first, then evergreen topics in calendar order. Topics marked
// auto:false (sensitive, human-led) are never picked automatically. When every topic has been used
// once, the cycle starts again.
export function pickTopic(calendar, { week, used = new Set(), override = '' } = {}) {
  if (override) {
    const topic = calendar.find(t => t.id === override);
    if (!topic) throw new Error(`Unknown topic "${override}"`);
    return topic;
  }
  const automatic = calendar.filter(t => t.auto !== false);
  let pool = automatic.filter(t => !used.has(t.id));
  if (!pool.length) pool = automatic;
  const timely = pool.filter(t => t.weeks && week >= t.weeks[0] && week <= t.weeks[1]);
  return timely[0] || pool.find(t => !t.weeks) || pool[0];
}

// ---------------------------------------------------------------- prompt
export function buildPrompt(topic, { styleGuide = '', today = new Date() } = {}) {
  const system = `You write history articles for Panjabi Aa Gaye Oye, a site for Punjabi communities in Seattle and Vancouver. The name means "the Punjabis have arrived," and the archive tells how, in order. Each article must help readers see one step of that arrival: who came, who was kept out, who stayed, and what they built. Readers are curious, not specialists.

Follow this editorial standard exactly:

${styleGuide.trim() || '(no style guide supplied: be accurate, cite sources, never invent quotations)'}

Working rules:
- Use web search. Base every fact on the pages you read. If you could not confirm something, leave it out.
- Prefer encyclopedias, university projects, museums, archives, scholarly work and major news. Do not rely on Wikipedia alone.
- In "Sources", list only pages you actually opened through search, as markdown links with a short readable label.
- Never invent quotations. Quote at most one short phrase per source, and attribute it.
- Where sources disagree, give the range and say the sources differ.
- Write in your own words, 550 to 900 words, plain and precise.`;
  const user = `Today is ${today.toISOString().slice(0, 10)}.

Topic: ${topic.title}
Angle: ${topic.angle}${topic.year ? `\nYear the story is about: ${topic.year}` : ''}
Focus: ${topic.region === 'pnw' || topic.region === 'bc' ? 'the Pacific Northwest and British Columbia' : topic.region === 'panjab' ? 'Panjab' : topic.region === 'music' ? 'Punjabi music and culture' : 'the Punjabi diaspora'}

Write the article. Output ONLY these sections, each starting with the exact heading shown, with no text before the first heading and none after the last:

### Summary
(two or three sentences)

### Article
(markdown; use ## for subheadings. End with a short paragraph headed "## In the story of arrival" saying where this sits in the journey, using only what the sources support.)

### Sources
(a markdown list of links)

### Topics
(two or three topics, separated by commas)

### Year
(the single year the story is about, four digits)

### Verification notes
(a short list: figures sources disagree on, claims resting on one source, anything you inferred rather than read)`;
  return { system, user };
}

// ---------------------------------------------------------------- Claude API
export async function callClaude(fetchImpl, { apiKey, model = DEFAULT_MODEL, system, user, maxSearches = 8 }) {
  const messages = [{ role: 'user', content: user }];
  const blocks = [];
  for (let turn = 0; turn < 4; turn++) {
    const response = await fetchImpl('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: { 'content-type': 'application/json', 'x-api-key': apiKey, 'anthropic-version': '2023-06-01' },
      body: JSON.stringify({ model, max_tokens: 6000, system, messages,
        tools: [{ type: 'web_search_20250305', name: 'web_search', max_uses: maxSearches }] })
    });
    if (!response.ok) throw new Error(`Anthropic API HTTP ${response.status}: ${(await response.text?.().catch(() => '')) || ''}`.slice(0, 300));
    const data = await response.json();
    blocks.push(...(data.content || []));
    if (data.stop_reason !== 'pause_turn') return blocks;
    messages.push({ role: 'assistant', content: data.content });
  }
  return blocks;
}

export const extractText = blocks => blocks.filter(b => b.type === 'text').map(b => b.text).join('');

export const normUrl = url => {
  try {
    const u = new URL(url); u.hash = '';
    for (const key of [...u.searchParams.keys()]) if (/^(utm_|ref$|fbclid|gclid)/i.test(key)) u.searchParams.delete(key);
    return `${u.hostname.replace(/^www\./, '')}${u.pathname.replace(/\/+$/, '')}${u.search}`.toLowerCase();
  } catch { return String(url).toLowerCase(); }
};

// URL -> title for every page the search tool returned (and every page it cited).
export function collectSearchResults(blocks) {
  const found = new Map();
  for (const block of blocks) {
    if (block.type === 'web_search_tool_result' && Array.isArray(block.content)) {
      for (const item of block.content) if (item.url) found.set(normUrl(item.url), { url: item.url, title: item.title || '' });
    }
    for (const cite of block.citations || []) if (cite.url && !found.has(normUrl(cite.url))) found.set(normUrl(cite.url), { url: cite.url, title: cite.title || '' });
  }
  return found;
}

// ---------------------------------------------------------------- draft -> issue
export function parseDraft(text) {
  const clean = String(text || '').replace(/\r\n?/g, '\n').trim();
  const draft = {};
  for (const label of ['Summary', 'Article', 'Sources', 'Topics', 'Year', 'Verification notes']) draft[label] = sectionOf(clean, label);
  return draft;
}

export const wordCount = text => String(text || '').trim().split(/\s+/).filter(Boolean).length;

// Long quotations are the most likely place for an invented or altered quote.
export function longQuotes(article) {
  return [...String(article || '').matchAll(/[“"]([^”"\n]{40,})[”"]/g)].map(m => m[1].trim());
}

export function validateDraft(draft) {
  const problems = [];
  if (wordCount(draft.Article) < MIN_ARTICLE_WORDS) problems.push(`the article is too short (${wordCount(draft.Article)} words; at least ${MIN_ARTICLE_WORDS})`);
  if (!draft.Summary) problems.push('there is no summary');
  if (extractSources(draft.Sources).length < 1) problems.push('there are no source links');
  return problems;
}

export function buildIssue({ topic, draft, results = new Map(), today = new Date(), model = DEFAULT_MODEL }) {
  const listed = extractSources(draft.Sources);
  const verified = []; const unverified = [];
  for (const source of listed) {
    const hit = results.get(normUrl(source.url));
    if (hit) verified.push({ url: source.url, label: source.label && source.label !== new URL(source.url).hostname.replace(/^www\./, '') ? source.label : (hit.title || source.label) });
    else unverified.push(source);
  }
  const quotes = longQuotes(draft.Article);
  const warnings = [];
  if (verified.length < MIN_SOURCES) warnings.push(`Only ${verified.length} source link(s) were confirmed by the search tool (at least ${MIN_SOURCES} wanted). Add sources you have checked.`);

  const notes = [];
  if (topic.note) notes.push(`**Editorial flag:** ${topic.note}`);
  if (warnings.length) notes.push(...warnings.map(w => `**Warning:** ${w}`));
  if (unverified.length) notes.push(`**Links the model listed that the search tool did not return. They were removed from Sources. Open each one, and add it back only if it is real and supports the article:**\n${unverified.map(s => `- ${s.url}`).join('\n')}`);
  if (quotes.length) notes.push(`**Direct quotations to confirm against the source (${quotes.length}):**\n${quotes.map(q => `- "${q.slice(0, 120)}${q.length > 120 ? '…' : ''}"`).join('\n')}`);
  if (draft['Verification notes']) notes.push(`**The drafter's own notes:**\n${draft['Verification notes']}`);
  notes.push('**Before publishing:** open each source and check every date and number; resolve the items above; read it aloud once; then add the `history` label.');

  const body = [
    topicMarker(topic.id),
    `<!-- drafted ${today.toISOString().slice(0, 10)} with ${model}. Not published until the history label is added. -->`,
    '',
    '### Summary', '', draft.Summary, '',
    '### Article', '', draft.Article, '',
    '### Sources', '', verified.map(s => `- [${s.label}](${s.url})`).join('\n') || '_No confirmed sources yet._', '',
    '### Topics', '', draft.Topics || '', '',
    '### Year', '', String((draft.Year || '').match(/\b(1[0-9]{3}|20[0-9]{2})\b/)?.[1] || topic.year || ''), '',
    '### Byline', '', 'Editorial desk', '',
    '### AI assistance', '', AI_OPTION, '',
    '### Verification notes', '', notes.join('\n\n')
  ].join('\n');
  return { title: topic.title, body, labels: ['draft', 'ai-draft'], verified, unverified, quotes, warnings };
}

// A prepared article file: a small header, then the same sections the History issue form uses.
export function parseReadyFile(text) {
  const match = String(text).replace(/\r\n?/g, '\n').match(/^---\n([\s\S]*?)\n---\n([\s\S]*)$/);
  if (!match) throw new Error('A ready file must start with a --- header containing title: and topic:');
  const meta = {};
  for (const line of match[1].split('\n')) {
    const m = line.match(/^(\w+):\s*(.*)$/);
    if (m) meta[m[1]] = m[2].trim().replace(/^"(.*)"$/, '$1');
  }
  if (!meta.title || !meta.topic) throw new Error('The header needs both title: and topic:');
  const sections = match[2].trim();
  for (const label of ['Summary', 'Article', 'Sources']) if (!sectionOf(sections, label)) throw new Error(`The file is missing the "${label}" section`);
  return { title: meta.title, topic: meta.topic, body: `${topicMarker(meta.topic)}\n<!-- prepared article. Not published until the history label is added. -->\n\n${sections}\n`, labels: ['draft'] };
}

// ---------------------------------------------------------------- GitHub
const ghHeaders = token => ({ accept: 'application/vnd.github+json', authorization: `Bearer ${token}`, 'x-github-api-version': '2022-11-28', 'user-agent': 'panjabi-history-desk', 'content-type': 'application/json' });

export async function listIssues(fetchImpl, { repo, token, label }) {
  const response = await fetchImpl(`https://api.github.com/repos/${repo}/issues?labels=${encodeURIComponent(label)}&state=all&per_page=100`, { headers: ghHeaders(token) });
  if (!response.ok) throw new Error(`GitHub API HTTP ${response.status} while listing "${label}" issues`);
  return (await response.json()).filter(i => !i.pull_request);
}

export async function createIssue(fetchImpl, { repo, token, title, body, labels }) {
  const response = await fetchImpl(`https://api.github.com/repos/${repo}/issues`, { method: 'POST', headers: ghHeaders(token), body: JSON.stringify({ title, body, labels }) });
  if (!response.ok) throw new Error(`GitHub API HTTP ${response.status} while creating the issue: ${(await response.text?.().catch(() => '')) || ''}`.slice(0, 300));
  return response.json();
}

// ---------------------------------------------------------------- the weekly run
export async function runWeekly({ env, fetchImpl = fetch, now = new Date(), log = console.log, calendar, styleGuide = '', dryRun = false, topicId = '', readyText = null }) {
  const repo = env.GITHUB_REPOSITORY; const token = env.GITHUB_TOKEN;
  if (!dryRun && (!repo || !token)) throw new Error('GITHUB_REPOSITORY and GITHUB_TOKEN are required');

  if (readyText) {
    const ready = parseReadyFile(readyText);
    if (dryRun) { log(`# ${ready.title}\n\n${ready.body}`); return { dryRun: true, title: ready.title }; }
    const existing = usedTopicIds([...(await listIssues(fetchImpl, { repo, token, label: 'draft' })), ...(await listIssues(fetchImpl, { repo, token, label: 'history' }))]);
    if (existing.has(ready.topic)) { log(`A draft or article for "${ready.topic}" already exists. Nothing created.`); return { skipped: true, topic: ready.topic }; }
    const issue = await createIssue(fetchImpl, { repo, token, ...ready });
    log(`Created draft #${issue.number}: ${issue.html_url}`);
    return { created: true, number: issue.number, url: issue.html_url, topic: ready.topic };
  }

  if (!env.ANTHROPIC_API_KEY) throw new Error('ANTHROPIC_API_KEY is not set');
  let used = new Set();
  if (repo && token) used = usedTopicIds([...(await listIssues(fetchImpl, { repo, token, label: 'draft' })), ...(await listIssues(fetchImpl, { repo, token, label: 'history' }))]);
  const topic = pickTopic(calendar, { week: isoWeek(now), used, override: topicId });
  log(`Topic: ${topic.title} (${topic.id})`);

  const { system, user } = buildPrompt(topic, { styleGuide, today: now });
  const model = env.ANTHROPIC_MODEL || DEFAULT_MODEL;
  const blocks = await callClaude(fetchImpl, { apiKey: env.ANTHROPIC_API_KEY, model, system, user });
  const draft = parseDraft(extractText(blocks));
  const problems = validateDraft(draft);
  if (problems.length) throw new Error(`The draft for "${topic.id}" was not saved because ${problems.join('; ')}.`);

  const issue = buildIssue({ topic, draft, results: collectSearchResults(blocks), today: now, model });
  log(`Draft: ${wordCount(draft.Article)} words, ${issue.verified.length} confirmed sources, ${issue.unverified.length} unconfirmed removed, ${issue.quotes.length} long quotations.`);
  if (dryRun) { log(`\n# ${issue.title}\n\n${issue.body}`); return { dryRun: true, title: issue.title, issue }; }
  const created = await createIssue(fetchImpl, { repo, token, title: issue.title, body: issue.body, labels: issue.labels });
  log(`Created draft #${created.number}: ${created.html_url}`);
  return { created: true, number: created.number, url: created.html_url, topic: topic.id, issue };
}
