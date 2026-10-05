import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, mkdir, readFile, rm, stat, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { parseHistoryIssue, articlePage } from '../src/articles.js';
import { assertComicIssue, imagePrompt, parseStoryboard, renderComicHtml, runComic } from '../scripts/comic-lib.mjs';
import worker from '../src/worker.js';

const sixPages = Array.from({ length: 6 }, (_, index) => ({
  title: `Page ${index + 1}`,
  caption: `This is a sourced child-friendly caption for historical page ${index + 1}.`,
  scene: `A respectful historical scene for page ${index + 1}, with the recurring child observing.`
}));
const storyboardText = JSON.stringify({ subtitle: 'A journey through one carefully sourced chapter', intro: 'Let us explore this history together.', pages: sixPages });
const historyIssue = (labels = ['history', 'make-comic']) => ({
  number: 42, title: 'The first documented journey', state: 'open', created_at: '2026-10-01T00:00:00Z', labels: labels.map(name => ({ name })),
  body: `### Summary\n\nA carefully sourced arrival story.\n\n### Kids summary\n\nA family looked across the Pacific.\n\n### Article\n\nThe documented journey began in 1897. ${'History needs careful context. '.repeat(30)}\n\n### Sources\n\n- https://archive.example/story\n\n### Year\n\n1897`
});

test('comic generation requires both publication and an explicit make-comic request', () => {
  assert.equal(assertComicIssue(historyIssue()).number, 42);
  assert.throws(() => assertComicIssue(historyIssue(['history'])), /make-comic/);
  assert.throws(() => assertComicIssue(historyIssue(['make-comic'])), /history label/);
});

test('storyboard validation requires exactly six complete pages and rejects URLs', () => {
  assert.equal(parseStoryboard(storyboardText).pages.length, 6);
  assert.throws(() => parseStoryboard(JSON.stringify({ subtitle: 'A subtitle', intro: 'An introduction', pages: sixPages.slice(0, 5) })), /exactly 6/);
  const unsafe = structuredClone(JSON.parse(storyboardText));
  unsafe.pages[2].caption = 'Read all about this historical claim at https://example.com now.';
  assert.throws(() => parseStoryboard(JSON.stringify(unsafe)), /contains a URL/);
});

test('art prompts lock the recurring child and forbid generated lettering', () => {
  const article = parseHistoryIssue(historyIssue());
  const prompt = imagePrompt(parseStoryboard(storyboardText).pages[0], article);
  assert.match(prompt, /orange turban/);
  assert.match(prompt, /navy-blue vest over a white kurta/);
  assert.match(prompt, /same friendly face/);
  assert.match(prompt, /Do not render any words, letters, numbers/);
  assert.match(prompt, /No photorealism and no anime/);
});

test('generated comic HTML is a six-page crawlable flipbook and escapes model text', () => {
  const article = parseHistoryIssue(historyIssue());
  const storyboard = parseStoryboard(storyboardText);
  storyboard.pages[0].title = '<img src=x onerror=alert(1)>';
  const html = renderComicHtml(article, storyboard);
  assert.equal((html.match(/data-comic-page/g) || []).length, 6);
  assert.match(html, new RegExp(`/history/${article.slug}`));
  assert.match(html, /About AI assistance/);
  assert.ok(!html.includes('<img src=x onerror'));
  assert.match(html, /&lt;img src=x onerror=alert\(1\)&gt;/);
});

test('the full comic run uses one storyboard call, exactly six image calls, and writes review files', async () => {
  const cwd = await mkdtemp(join(tmpdir(), 'comic-test-'));
  try {
    const referenceDir = join(cwd, 'public', 'history-comics', 'why-they-left');
    await mkdir(referenceDir, { recursive: true });
    await writeFile(join(referenceDir, 'page-1.webp'), Buffer.from('reference-image'));
    let storyboardCalls = 0;
    let imageCalls = 0;
    const fetchImpl = async (url, options = {}) => {
      if (String(url).includes('api.github.com')) return Response.json(historyIssue());
      if (String(url).includes('api.anthropic.com')) {
        storyboardCalls++;
        return Response.json({ content: [{ type: 'text', text: storyboardText }] });
      }
      if (String(url).includes('api.openai.com')) {
        imageCalls++;
        assert.equal(options.body.get('model'), 'gpt-image-2.5-sunburst');
        assert.equal(options.body.get('size'), '1536x1024');
        assert.match(options.body.get('prompt'), /Do not render any words/);
        return Response.json({ data: [{ b64_json: Buffer.from(`fake-webp-${imageCalls}`).toString('base64') }] });
      }
      throw new Error(`Unexpected URL ${url}`);
    };
    const result = await runComic({ fetchImpl, cwd, env: { ISSUE_NUMBER: '42', GITHUB_REPOSITORY: 'owner/repo', GITHUB_TOKEN: 'github', ANTHROPIC_API_KEY: 'claude', OPENAI_API_KEY: 'openai' } });
    assert.equal(storyboardCalls, 1);
    assert.equal(imageCalls, 6);
    for (let page = 1; page <= 6; page++) assert.ok((await stat(join(result.outputDir, `page-${page}.webp`))).size > 0);
    assert.match(await readFile(join(result.outputDir, 'index.html'), 'utf8'), /data-comic-book/);
    assert.equal(JSON.parse(await readFile(join(result.outputDir, 'comic.json'), 'utf8')).pages.length, 6);
    const callsBeforeDuplicate = storyboardCalls + imageCalls;
    await assert.rejects(() => runComic({ fetchImpl, cwd, env: { ISSUE_NUMBER: '42', GITHUB_REPOSITORY: 'owner/repo', GITHUB_TOKEN: 'github', ANTHROPIC_API_KEY: 'claude', OPENAI_API_KEY: 'openai' } }), /already exists/);
    assert.equal(storyboardCalls + imageCalls, callsBeforeDuplicate);
  } finally { await rm(cwd, { recursive: true, force: true }); }
});

test('workflow triggers on make-comic and opens a review pull request rather than publishing directly', async () => {
  const workflow = await readFile(new URL('../.github/workflows/history-comic.yml', import.meta.url), 'utf8');
  assert.match(workflow, /types: \[labeled\]/);
  assert.match(workflow, /github\.event\.label\.name == 'make-comic'/);
  assert.match(workflow, /OPENAI_API_KEY/);
  assert.match(workflow, /gh pr create/);
  assert.match(workflow, /The comic was not published automatically/);
  assert.doesNotMatch(workflow, /wrangler deploy/);
});

test('article pages point to their own comic only after it exists', () => {
  const article = parseHistoryIssue(historyIssue());
  assert.match(articlePage(article, { origin: 'https://site.test' }), /href="\/history\/kids">Kids’ history/);
  assert.match(articlePage(article, { origin: 'https://site.test', comicAvailable: true }), new RegExp(`href="/history/${article.slug}/kids">Kids’ comic`));
});

test('article-specific comic route verifies publication and serves the generated static page', async t => {
  t.mock.method(globalThis, 'fetch', async url => String(url).includes('/issues/42') ? Response.json(historyIssue()) : new Response('not found', { status: 404 }));
  const env = {
    GITHUB_REPO: 'owner/repo', SITE_ORIGIN: 'https://site.test',
    ASSETS: { fetch: async request => new URL(request.url).pathname.endsWith('/index.html') ? new Response('<h1>Generated comic</h1>', { headers: { 'content-type': 'text/html' } }) : new Response('not found', { status: 404 }) }
  };
  const response = await worker.fetch(new Request('https://site.test/history/42-the-first-documented-journey/kids'), env, { waitUntil() {} });
  assert.equal(response.status, 200);
  assert.match(await response.text(), /Generated comic/);
});
