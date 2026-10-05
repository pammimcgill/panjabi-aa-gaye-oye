import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile, stat } from 'node:fs/promises';
import { parseHistoryIssue, articlePage } from '../src/articles.js';

const issue = body => ({
  number: 31, title: 'Kesur Singh and the 1897 journey', state: 'open',
  created_at: '2026-09-25T00:00:00Z', labels: [{ name: 'history' }], body
});

test('kids comic has six crawlable, separate pages and local optimized artwork', async () => {
  const html = await readFile(new URL('../public/history-kids.html', import.meta.url), 'utf8');
  assert.equal((html.match(/data-comic-page/g) || []).length, 6);
  const comicAssets = new Set(html.match(/history-comics\/why-they-left\/page-\d\.webp/g) || []);
  assert.equal(comicAssets.size, 6);
  assert.match(html, /Swipe, use the arrows/);
  assert.match(html, /Land and debt/);
  assert.match(html, /The journey ahead/);
  assert.match(html, /When harvests failed/);
  assert.match(html, /By the early 1900s/);
  for (let page = 1; page <= 6; page++) {
    const info = await stat(new URL(`../public/history-comics/why-they-left/page-${page}.webp`, import.meta.url));
    assert.ok(info.size > 50_000 && info.size < 500_000, `page ${page} should be an optimized real illustration`);
  }
  const script = await readFile(new URL('../public/history-comic.js', import.meta.url), 'utf8');
  assert.match(script, /ArrowLeft/);
  assert.match(script, /ArrowRight/);
  assert.match(script, /pointerdown/);
  assert.match(script, /pointerup/);
});

test('the redesign removes the decorative symbol and keeps the event map compact', async () => {
  const [history, kids, styles] = await Promise.all([
    readFile(new URL('../public/history.html', import.meta.url), 'utf8'),
    readFile(new URL('../public/history-kids.html', import.meta.url), 'utf8'),
    readFile(new URL('../public/styles.css', import.meta.url), 'utf8')
  ]);
  assert.ok(!`${history}${kids}${styles}`.includes('ੴ'));
  assert.match(styles, /\.event-map\{[^}]*height:300px/);
  assert.match(styles, /@media\(max-width:610px\)\{\.event-map\{height:240px/);
});

test('history issues render a credited public-domain photograph with provenance', () => {
  const article = parseHistoryIssue(issue(`### Summary

A sourced article.

### Article

Body.

### Historical image URL

https://upload.wikimedia.org/example/kesur-singh.jpg

### Historical image caption

Kesur Singh, published 10 December 1897.

### Historical image credit

Unknown photographer

### Historical image source URL

https://commons.wikimedia.org/wiki/File:Kesur_Singh.jpg

### Historical image license

Public domain

### Historical image license URL

https://creativecommons.org/publicdomain/mark/1.0/`));

  assert.equal(article.historicalImage.credit, 'Unknown photographer');
  const html = articlePage(article, { origin: 'https://site.test' });
  assert.match(html, /class="historic-photo"/);
  assert.match(html, /Kesur Singh, published 10 December 1897/);
  assert.match(html, /Original file and provenance/);
  assert.match(html, />Public domain<\/a>/);
});

test('historical-photo fields escape captions and reject unsafe image and credit links', () => {
  const unsafe = parseHistoryIssue(issue(`### Summary

S.

### Article

Body.

### Historical image URL

javascript:alert(1)

### Historical image caption

<script>alert(2)</script>

### Historical image source URL

javascript:alert(3)`));
  assert.equal(unsafe.historicalImage, null);
  assert.ok(!articlePage(unsafe, { origin: '' }).includes('javascript:'));

  const escaped = parseHistoryIssue(issue(`### Summary

S.

### Article

Body.

### Historical image URL

https://images.example/photo.jpg

### Historical image caption

<img src=x onerror=alert(1)>

### Historical image source URL

https://archive.example/record`));
  const html = articlePage(escaped, { origin: '' });
  assert.ok(!html.includes('<img src=x'));
  assert.match(html, /&lt;img src=x onerror=alert\(1\)/);
});
