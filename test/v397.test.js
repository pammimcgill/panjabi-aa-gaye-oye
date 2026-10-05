import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { parseHistoryIssue, articlePage } from '../src/articles.js';
import { buildPrompt, parseDraft, buildIssue } from '../scripts/draft-lib.mjs';

const historyIssue = body => ({
  number: 17, title: 'The first journey', state: 'open', created_at: '2026-09-01T00:00:00Z',
  labels: [{ name: 'history' }], body
});

test('history articles accept a kids summary and safely fall back to the regular summary', () => {
  const explicit = parseHistoryIssue(historyIssue('### Summary\n\nFor adults.\n\n### Kids summary\n\nA clear version for children.\n\n### Article\n\nBody.\n\n### Year\n\n1897'));
  assert.equal(explicit.kidsDek, 'A clear version for children.');
  assert.equal(explicit.chapter.n, 1);
  const fallback = parseHistoryIssue(historyIssue('### Summary\n\nThe regular summary.\n\n### Article\n\nBody.'));
  assert.equal(fallback.kidsDek, 'The regular summary.');
});

test('the main history page is a plain article list and keeps the kids comic as a small link below it', async () => {
  const html = await readFile(new URL('../public/history.html', import.meta.url), 'utf8');
  assert.match(html, /href="\/history\/kids"/);
  assert.match(html, /optional kids’ picture story/);
  assert.match(html, /id="storyGrid"/);
  assert.doesNotMatch(html, /data-comic-page/);
  assert.doesNotMatch(html, /kids-chapter/);
  assert.doesNotMatch(html, /kids-comic-invite|The story so far|Newest first/);
  assert.ok(html.indexOf('id="storyGrid"') < html.indexOf('href="/history/kids"'));
});

test('article pages link to the separate kids comic', () => {
  const article = parseHistoryIssue(historyIssue('### Summary\n\nS.\n\n### Article\n\nBody.\n\n### Sources\n\n- https://example.org/source'));
  assert.match(articlePage(article, { origin: 'https://site.test' }), /href="\/history\/kids">Kids’ history/);
  assert.match(articlePage(article, { origin: 'https://site.test', comicAvailable: true }), /href="\/history\/17-the-first-journey\/kids">Kids’ comic/);
});

test('weekly drafts request and preserve a child-friendly sourced summary', () => {
  const topic = { id: 'arrival-1897', title: 'First arrivals', angle: 'The documented arrival', region: 'bc', year: 1897 };
  const { user } = buildPrompt(topic, { today: new Date('2026-09-25T00:00:00Z') });
  assert.match(user, /### Kids summary/);
  assert.match(user, /ages 8 to 13/);
  const draft = parseDraft('### Summary\n\nAdult summary.\n\n### Kids summary\n\nKids summary.\n\n### Article\n\n' + 'word '.repeat(500) + '\n\n### Sources\n\n- https://example.org/a\n\n### Year\n\n1897');
  const issue = buildIssue({ topic, draft, results: new Map() });
  assert.match(issue.body, /### Kids summary\n\nKids summary\./);
});
