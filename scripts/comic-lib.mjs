// Automated, human-reviewed kids' comic generation for published history issues.
// Claude turns the reviewed article into a six-page storyboard. OpenAI creates
// only the artwork; exact titles and captions remain ordinary editable HTML.

import { mkdir, mkdtemp, readFile, rename, rm, stat, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { esc, isHistoryIssue, parseHistoryIssue } from '../src/articles.js';

export const COMIC_LABEL = 'make-comic';
export const COMIC_PAGES = 6;
export const DEFAULT_STORY_MODEL = 'claude-sonnet-5';
export const DEFAULT_IMAGE_MODEL = 'gpt-image-2.5-sunburst';
export const REFERENCE_IMAGE = 'public/history-comics/why-they-left/page-1.webp';

const labelsOf = issue => (issue?.labels || []).map(label => typeof label === 'string' ? label : label?.name).filter(Boolean);
const clean = (value, max) => String(value ?? '').replace(/[\u0000-\u001f\u007f]/g, ' ').replace(/\s+/g, ' ').trim().slice(0, max);
const hasUrl = value => /(?:https?:\/\/|www\.)/i.test(String(value));

export function assertComicIssue(issue) {
  if (!isHistoryIssue(issue)) throw new Error('The issue must be open and have the history label before a comic can be made.');
  if (!labelsOf(issue).includes(COMIC_LABEL)) throw new Error(`Add the ${COMIC_LABEL} label before running the comic workflow.`);
  return parseHistoryIssue(issue);
}

export function storyboardPrompt(article) {
  const system = `You are a careful children's history editor for Panjabi Aa Gaye Oye. Turn one already-reviewed article into a six-page picture-story plan for ages 8–13.

Accuracy rules:
- Use ONLY facts stated in the supplied article and its supplied kids summary. Do not research, guess, or add dates, numbers, quotations, motives, dialogue, clothing details, or named people.
- If the article expresses uncertainty or disagreement, preserve it plainly.
- Keep difficult history honest, gentle, and specific. Do not turn suffering into entertainment.
- Each page must move the chronological story forward. Do not repeat a claim.
- The recurring child narrator may observe the scene but must not claim to be a historical witness.
- Do not put words into a historical person's mouth.
- Output valid JSON only. No markdown fences and no comments.`;
  const user = `ARTICLE TITLE: ${article.title}
YEAR: ${article.year || 'not stated'}
KIDS SUMMARY: ${article.kidsDek}

ARTICLE:
${String(article.body).slice(0, 24000)}

Return exactly this shape:
{"subtitle":"8-13 words","intro":"1-2 short sentences inviting a child into this sourced story","pages":[{"title":"2-7 words","caption":"1-3 child-friendly sentences based only on the article","scene":"A precise illustration direction based only on the caption; no lettering or speech bubbles"}]}

There must be exactly six pages. Each caption must be understandable without the picture. Do not include URLs.`;
  return { system, user };
}

function jsonFromText(text) {
  const raw = String(text || '').trim().replace(/^```(?:json)?\s*/i, '').replace(/\s*```$/, '');
  const start = raw.indexOf('{');
  const end = raw.lastIndexOf('}');
  if (start < 0 || end <= start) throw new Error('The storyboard response did not contain a JSON object.');
  try { return JSON.parse(raw.slice(start, end + 1)); }
  catch { throw new Error('The storyboard response was not valid JSON.'); }
}

export function parseStoryboard(text) {
  const value = jsonFromText(text);
  if (!Array.isArray(value.pages) || value.pages.length !== COMIC_PAGES) throw new Error(`The storyboard must contain exactly ${COMIC_PAGES} pages.`);
  const storyboard = {
    subtitle: clean(value.subtitle, 120),
    intro: clean(value.intro, 360),
    pages: value.pages.map((page, index) => ({
      title: clean(page?.title, 80),
      caption: clean(page?.caption, 520),
      scene: clean(page?.scene, 900),
      number: index + 1
    }))
  };
  if (!storyboard.subtitle || !storyboard.intro) throw new Error('The storyboard needs a subtitle and introduction.');
  for (const page of storyboard.pages) {
    if (page.title.length < 2 || page.caption.length < 20 || page.scene.length < 20) throw new Error(`Comic page ${page.number} is missing a useful title, caption, or scene.`);
    if ([page.title, page.caption, page.scene].some(hasUrl)) throw new Error(`Comic page ${page.number} contains a URL.`);
  }
  if (hasUrl(storyboard.subtitle) || hasUrl(storyboard.intro)) throw new Error('The storyboard contains a URL.');
  return storyboard;
}

export function imagePrompt(page, article) {
  return `Create one landscape illustration for page ${page.number} of a children's history picture book about: ${article.title}.

SCENE (use only these historical details): ${page.scene}

Recurring character reference: preserve the exact child shown in the supplied reference image — a cheerful Punjabi boy about 10 years old, orange turban, navy-blue vest over a white kurta, warm brown skin, and the same friendly face. He may observe or guide the scene, but he is not a historical witness. Keep his face, age, outfit, proportions, and turban colour consistent on all pages.

Style: warm painterly cartoon illustration for ages 8–13, soft lighting, amber and gold palette, textured brushstroke shading, expressive but respectful faces, and a subtle storybook border. No photorealism and no anime.

Critical constraints: landscape 3:2 composition. Do not render any words, letters, numbers, labels, signs, captions, speech bubbles, logos, watermarks, or page badges. The website adds all exact text separately. Do not add historical facts, people, uniforms, flags, buildings, objects, or symbols not requested by the scene.`;
}

export async function callStoryboard(fetchImpl, { apiKey, model = DEFAULT_STORY_MODEL, article }) {
  const { system, user } = storyboardPrompt(article);
  const response = await fetchImpl('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: { 'content-type': 'application/json', 'x-api-key': apiKey, 'anthropic-version': '2023-06-01' },
    body: JSON.stringify({ model, max_tokens: 3500, system, messages: [{ role: 'user', content: user }] })
  });
  if (!response.ok) throw new Error(`Anthropic storyboard HTTP ${response.status}: ${String(await response.text().catch(() => '')).slice(0, 240)}`);
  const data = await response.json();
  const text = (data.content || []).filter(block => block.type === 'text').map(block => block.text).join('\n');
  if (!text.trim()) throw new Error('Anthropic returned no storyboard text.');
  return parseStoryboard(text);
}

export async function callImage(fetchImpl, { apiKey, model = DEFAULT_IMAGE_MODEL, prompt, referenceBytes }) {
  const form = new FormData();
  form.append('model', model);
  form.append('image[]', new Blob([referenceBytes], { type: 'image/webp' }), 'recurring-character.webp');
  form.append('prompt', prompt);
  form.append('size', '1536x1024');
  form.append('quality', 'medium');
  form.append('output_format', 'webp');
  form.append('output_compression', '82');
  form.append('moderation', 'auto');
  const response = await fetchImpl('https://api.openai.com/v1/images/edits', { method: 'POST', headers: { authorization: `Bearer ${apiKey}` }, body: form });
  if (!response.ok) throw new Error(`OpenAI image HTTP ${response.status}: ${String(await response.text().catch(() => '')).slice(0, 240)}`);
  const data = await response.json();
  const encoded = data?.data?.[0]?.b64_json;
  if (!encoded) throw new Error('OpenAI returned no image data.');
  const bytes = Buffer.from(encoded, 'base64');
  if (!bytes.length) throw new Error('OpenAI returned an empty image.');
  return bytes;
}

export function renderComicHtml(article, storyboard) {
  const base = `/history-comics/generated/${article.slug}`;
  const canonical = `https://panjabiaagayeoye.com/history/${article.slug}/kids`;
  const pages = storyboard.pages.map((page, index) => `<article class="comic-page${index === 0 ? ' is-current' : ''}" data-comic-page aria-label="Page ${page.number} of ${COMIC_PAGES}"><div class="comic-art"><img src="${base}/page-${page.number}.webp" alt="${esc(page.scene)}" width="1536" height="1024"${index ? ' loading="lazy"' : ''}><span class="comic-number" aria-hidden="true">${page.number}</span></div><div class="comic-caption"><h3>${esc(page.title)}</h3><p>${esc(page.caption)}</p></div></article>`).join('\n');
  return `<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><meta name="theme-color" content="#fff6df">
<title>${esc(article.title)} — Kids’ Comic</title><meta name="description" content="${esc(storyboard.intro)}"><link rel="canonical" href="${canonical}">
<meta property="og:type" content="article"><meta property="og:site_name" content="Panjabi Aa Gaye Oye"><meta property="og:title" content="${esc(article.title)} — Kids’ Comic"><meta property="og:description" content="${esc(storyboard.intro)}"><meta property="og:url" content="${canonical}"><meta property="og:image" content="https://panjabiaagayeoye.com${base}/page-1.webp"><meta name="twitter:card" content="summary_large_image"><link rel="stylesheet" href="/styles.css"></head><body>
<header class="site-header"><a class="brand-wrap" href="/"><div class="logo-mark">ਪੰ</div><div class="brand">PANJABI <span>AA GAYE OYE</span></div></a><nav class="nav" aria-label="Main navigation"><a href="/">Events</a><a href="/weekend">Weekend</a><a href="/travel">Travel</a><a class="active" href="/history">History</a><a href="/news">Music News</a></nav></header>
<main class="shell kids-comic-shell"><div class="article-backlinks"><a class="back-link" href="/history/${article.slug}">← Read the full article</a><a class="back-link" href="/history">All history</a></div>
<section class="hero compact kids-comic-hero"><div class="eyebrow">For ages 8–13 · Picture story</div><h1>${esc(article.title)}</h1><p class="subhead">${esc(storyboard.subtitle)}</p></section>
<section class="comic-book" data-comic-book aria-labelledby="comicTitle" tabindex="0"><header class="comic-book-head"><div><div class="eyebrow small">Picture story · six pages</div><h2 id="comicTitle">${esc(article.title)}</h2><p class="comic-subtitle">${esc(storyboard.subtitle)}</p></div><p class="comic-intro">${esc(storyboard.intro)}</p></header><div class="comic-stage" aria-live="polite">${pages}</div>
<div class="comic-controls"><button class="comic-arrow" type="button" data-comic-prev aria-label="Previous comic page">← Previous</button><div class="comic-dots" data-comic-dots aria-label="Choose a comic page"></div><button class="comic-arrow" type="button" data-comic-next aria-label="Next comic page">Next →</button></div>
<div class="comic-footer"><span data-comic-status>Page 1 of ${COMIC_PAGES}</span><span>Swipe, use the arrows, or press ← →</span><a href="/history/${article.slug}">Read the sourced article →</a></div></section>
<aside class="kids-care-note"><strong>For grown-ups:</strong> This picture story is based on the reviewed article above. Read the full article to examine its sources and context.</aside>
<details class="ai-disclosure"><summary>About AI assistance</summary><p>The six-page storyboard was adapted from the published article with Claude. The illustrations were generated with OpenAI using a recurring-character reference. A person reviewed this comic before it was published.</p></details></main>
<footer class="shell"><a class="brand-wrap" href="/"><div class="logo-mark">ਪੰ</div><div class="brand">PANJABI <span>AA GAYE OYE</span></div></a><p>Read widely. Check sources. Preserve memory.</p></footer><script type="module">import{mountHistoryComics}from'/history-comic.js';mountHistoryComics();</script></body></html>`;
}

async function exists(path) { try { await stat(path); return true; } catch { return false; } }

export async function runComic({ fetchImpl = fetch, env = process.env, cwd = process.cwd() } = {}) {
  const issueNumber = Number(env.ISSUE_NUMBER);
  const repo = String(env.GITHUB_REPOSITORY || env.GITHUB_REPO || '').trim();
  if (!Number.isInteger(issueNumber) || issueNumber < 1) throw new Error('ISSUE_NUMBER must be a positive issue number.');
  if (!/^[\w.-]+\/[\w.-]+$/.test(repo)) throw new Error('GITHUB_REPOSITORY must look like owner/repository.');
  if (!env.GITHUB_TOKEN) throw new Error('GITHUB_TOKEN is missing.');
  if (!env.ANTHROPIC_API_KEY) throw new Error('ANTHROPIC_API_KEY is missing.');
  if (!env.OPENAI_API_KEY) throw new Error('OPENAI_API_KEY is missing.');

  const issueResponse = await fetchImpl(`https://api.github.com/repos/${repo}/issues/${issueNumber}`, {
    headers: { accept: 'application/vnd.github+json', authorization: `Bearer ${env.GITHUB_TOKEN}`, 'user-agent': 'panjabi-aa-gaye-oye-comic', 'x-github-api-version': '2022-11-28' }
  });
  if (!issueResponse.ok) throw new Error(`GitHub issue HTTP ${issueResponse.status}.`);
  const issue = await issueResponse.json();
  const article = assertComicIssue(issue);
  const outputDir = join(cwd, 'public', 'history-comics', 'generated', article.slug);
  const force = String(env.FORCE_COMIC || '') === '1';
  if (!force && await exists(outputDir)) throw new Error(`A comic already exists for issue #${issueNumber}. Use the manual force option only when you intend to replace it.`);

  const referenceBytes = await readFile(join(cwd, REFERENCE_IMAGE));
  const storyboard = await callStoryboard(fetchImpl, { apiKey: env.ANTHROPIC_API_KEY, model: env.ANTHROPIC_MODEL || DEFAULT_STORY_MODEL, article });
  const temp = await mkdtemp(join(tmpdir(), `panjabi-comic-${issueNumber}-`));
  try {
    for (const page of storyboard.pages) {
      const bytes = await callImage(fetchImpl, { apiKey: env.OPENAI_API_KEY, model: env.OPENAI_IMAGE_MODEL || DEFAULT_IMAGE_MODEL, prompt: imagePrompt(page, article), referenceBytes });
      await writeFile(join(temp, `page-${page.number}.webp`), bytes);
    }
    const manifest = { version: 1, issueNumber, articleSlug: article.slug, articleTitle: article.title, generatedAt: new Date().toISOString(), storyModel: env.ANTHROPIC_MODEL || DEFAULT_STORY_MODEL, imageModel: env.OPENAI_IMAGE_MODEL || DEFAULT_IMAGE_MODEL, ...storyboard };
    await writeFile(join(temp, 'comic.json'), `${JSON.stringify(manifest, null, 2)}\n`, 'utf8');
    await writeFile(join(temp, 'index.html'), renderComicHtml(article, storyboard), 'utf8');
    await mkdir(join(cwd, 'public', 'history-comics', 'generated'), { recursive: true });
    if (force) await rm(outputDir, { recursive: true, force: true });
    await rename(temp, outputDir);
  } catch (error) {
    await rm(temp, { recursive: true, force: true });
    throw error;
  }
  return { issueNumber, article, storyboard, outputDir };
}
