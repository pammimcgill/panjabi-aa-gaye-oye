// On-site history articles: written as GitHub issues, rendered here as real pages.
// Everything that ends up in HTML is escaped first; only http(s) links and https images are allowed.

const ESC = { '&':'&amp;', '<':'&lt;', '>':'&gt;', '"':'&quot;', "'":'&#39;' };
export const esc = value => String(value ?? '').replace(/[&<>"']/g, c => ESC[c]);

export function slugify(text = '') {
  return String(text).toLowerCase().normalize('NFKD').replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '').slice(0, 70).replace(/-+$/g, '');
}

export function readingMinutes(text = '') {
  const words = String(text).trim().split(/\s+/).filter(Boolean).length;
  return Math.max(1, Math.round(words / 200));
}

const isHttp = url => /^https?:\/\//i.test(url);

// ---------------------------------------------------------------- markdown
function inline(text) {
  const codes = [];
  let out = esc(text).replace(/`([^`]+)`/g, (_, code) => { codes.push(code); return `\u0000${codes.length - 1}\u0000`; });
  out = out.replace(/!\[([^\]]*)\]\((https:\/\/[^\s)]+)\)/g, (_, alt, url) => `<img src="${url}" alt="${alt}" loading="lazy" referrerpolicy="no-referrer">`);
  out = out.replace(/\[([^\]]+)\]\((https?:\/\/[^\s)]+)\)/g, (_, label, url) => `<a href="${url}" target="_blank" rel="noopener noreferrer nofollow">${label}</a>`);
  out = out.replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>').replace(/(^|[\s(])_([^_]+)_(?=[\s).,;:!?]|$)/g, '$1<em>$2</em>').replace(/\*([^*\s][^*]*)\*/g, '<em>$1</em>');
  return out.replace(/\u0000(\d+)\u0000/g, (_, i) => `<code>${codes[Number(i)]}</code>`);
}

export function renderMarkdown(markdown = '') {
  const blocks = String(markdown).replace(/\r\n?/g, '\n').replace(/<!--[\s\S]*?-->/g, '').trim().split(/\n{2,}/);
  const html = [];
  for (const block of blocks) {
    const lines = block.split('\n');
    const first = lines[0];
    let m;
    if ((m = first.match(/^(#{1,6})\s+(.*)$/)) && lines.length === 1) {
      const level = Math.min(m[1].length + 1, 4);
      html.push(`<h${level}>${inline(m[2])}</h${level}>`);
    } else if (/^(-{3,}|\*{3,})$/.test(block.trim())) {
      html.push('<hr>');
    } else if (lines.every(l => /^\s*[-*]\s+/.test(l))) {
      html.push(`<ul>${lines.map(l => `<li>${inline(l.replace(/^\s*[-*]\s+/, ''))}</li>`).join('')}</ul>`);
    } else if (lines.every(l => /^\s*\d+[.)]\s+/.test(l))) {
      html.push(`<ol>${lines.map(l => `<li>${inline(l.replace(/^\s*\d+[.)]\s+/, ''))}</li>`).join('')}</ol>`);
    } else if (lines.every(l => /^\s*>/.test(l))) {
      html.push(`<blockquote>${inline(lines.map(l => l.replace(/^\s*>\s?/, '')).join(' '))}</blockquote>`);
    } else if (block.trim()) {
      html.push(`<p>${lines.map(l => inline(l)).join('<br>')}</p>`);
    }
  }
  return html.join('\n');
}

// ---------------------------------------------------------------- GitHub issue -> article
// The issue form's own section headings. A section ends only at one of these, so an article may
// use "###" subheadings of its own without being cut short.
export const FORM_LABELS = ['Summary', 'Article', 'Sources', 'Topics', 'Year', 'Byline', 'Cover image URL', 'AI assistance', 'Editorial check', 'Verification notes'];

// "Panjabi aa gaye oye" means "the Punjabis have arrived". The archive tells that story in order:
// each article is placed in a chapter by the year it is about.
export const ARRIVAL_CHAPTERS = [
  { n: 0, name: 'Before the journey', span: 'Panjab, up to 1896', from: -Infinity, to: 1896 },
  { n: 1, name: 'The first arrivals', span: '1897 to 1907', from: 1897, to: 1907 },
  { n: 2, name: 'Putting down roots', span: '1908 to 1914', from: 1908, to: 1914 },
  { n: 3, name: 'The exclusion years', span: '1915 to 1946', from: 1915, to: 1946 },
  { n: 4, name: 'The doors reopen', span: '1947 to 1967', from: 1947, to: 1967 },
  { n: 5, name: 'Building a home', span: '1968 to 1999', from: 1968, to: 1999 },
  { n: 6, name: 'Punjabis here today', span: '2000 onward', from: 2000, to: Infinity }
];
export const UNDATED_CHAPTER = { n: 99, name: 'Culture and heritage', span: 'Music, food, language and festivals' };

export function chapterFor(year) {
  const y = Number(year);
  if (!Number.isFinite(y) || !y) return UNDATED_CHAPTER;
  return ARRIVAL_CHAPTERS.find(c => y >= c.from && y <= c.to) || UNDATED_CHAPTER;
}
const reEscape = text => text.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

export function sectionOf(body, label) {
  const plain = String(body || '').replace(/\r\n?/g, '\n');
  const stop = FORM_LABELS.map(reEscape).join('|');
  const match = plain.match(new RegExp(`(?:^|\\n)###[ \\t]+${reEscape(label)}[ \\t]*\\n([\\s\\S]*?)(?=\\n###[ \\t]+(?:${stop})[ \\t]*(?:\\n|$)|$)`, 'i'));
  const value = (match?.[1] || '').trim();
  return /^_?no response_?$/i.test(value) ? '' : value;
}

export function extractSources(text = '') {
  const found = []; const seen = new Set();
  for (const line of String(text).split('\n')) {
    const md = line.match(/\[([^\]]+)\]\((https?:\/\/[^\s)]+)\)/);
    const bare = line.match(/https?:\/\/[^\s)<>]+/);
    const url = (md ? md[2] : bare?.[0] || '').replace(/[.,;]+$/, '');
    if (!url || seen.has(url)) continue;
    seen.add(url);
    const label = md ? md[1] : line.replace(url, '').replace(/^\s*[-*\d.)]+\s*/, '').replace(/[:\-–—\s]+$/, '').trim();
    let host = url; try { host = new URL(url).hostname.replace(/^www\./, ''); } catch {}
    found.push({ url, label: label || host });
  }
  return found;
}

function plainExcerpt(markdown, max = 300) {
  return String(markdown).replace(/!\[[^\]]*\]\([^)]*\)/g, '').replace(/\[([^\]]+)\]\([^)]*\)/g, '$1')
    .replace(/^#{1,6}\s+/gm, '').replace(/[*_>`~]/g, '').replace(/^\s*-\s+/gm, '').replace(/\s+/g, ' ').trim().slice(0, max);
}

const labelNames = issue => (issue.labels || []).map(l => typeof l === 'string' ? l : l.name);

export function parseHistoryIssue(issue) {
  const body = String(issue.body || '');
  const formArticle = sectionOf(body, 'Article');
  const article = formArticle || body;
  const summary = sectionOf(body, 'Summary') || plainExcerpt(article, 300);
  const cover = sectionOf(body, 'Cover image URL').split(/\s+/)[0];
  const topics = sectionOf(body, 'Topics').split(/[,;\n]/).map(t => t.trim()).filter(Boolean).slice(0, 4);
  const number = Number(issue.number);
  const year = Number((sectionOf(body, 'Year').match(/\b(1[0-9]{3}|20[0-9]{2})\b/) || [])[1]) || null;
  return {
    id: `github-${number}`, number,
    slug: `${number}-${slugify(issue.title) || 'article'}`,
    title: String(issue.title || '').trim(),
    dek: plainExcerpt(summary, 420),
    body: article,
    sources: extractSources(sectionOf(body, 'Sources')),
    topics,
    byline: sectionOf(body, 'Byline').split('\n')[0].trim() || 'Editorial desk',
    imageUrl: /^https:\/\//i.test(cover) ? cover : null,
    publishedAt: issue.created_at, updatedAt: issue.updated_at || issue.created_at,
    year, chapter: chapterFor(year),
    featured: labelNames(issue).includes('featured'),
    aiAssisted: /drafted with ai/i.test(sectionOf(body, 'AI assistance')),
    minutes: readingMinutes(article)
  };
}

export function articleNumber(slug = '') {
  const m = String(slug).match(/^(\d{1,9})(?:-|$)/);
  return m ? Number(m[1]) : null;
}

export function isHistoryIssue(issue) {
  return Boolean(issue) && !issue.pull_request && issue.state !== 'closed' && labelNames(issue).includes('history');
}

// ---------------------------------------------------------------- pages
const fmtLong = value => { try { return new Intl.DateTimeFormat('en-US', { month: 'long', day: 'numeric', year: 'numeric', timeZone: 'America/Los_Angeles' }).format(new Date(value)); } catch { return ''; } };

export function articlePage(article, { origin = '', more = [] } = {}) {
  const url = `${origin}/history/${article.slug}`;
  const description = article.dek;
  const image = article.imageUrl ? `<meta property="og:image" content="${esc(article.imageUrl)}"><meta name="twitter:image" content="${esc(article.imageUrl)}">` : '';
  const ld = JSON.stringify({ '@context': 'https://schema.org', '@type': 'Article', headline: article.title, description,
    datePublished: article.publishedAt, dateModified: article.updatedAt, author: { '@type': 'Person', name: article.byline },
    mainEntityOfPage: url, ...(article.imageUrl ? { image: article.imageUrl } : {}) }).replace(/</g, '\\u003c');
  const sources = article.sources.length
    ? `<section class="article-sources"><h2>Sources &amp; further reading</h2><ul>${article.sources.map(s => `<li><a href="${esc(s.url)}" target="_blank" rel="noopener noreferrer nofollow">${esc(s.label)}</a></li>`).join('')}</ul></section>` : '';
  const others = more.length
    ? `<section class="article-more"><h2>Keep following the story</h2><div class="more-grid">${more.map(x => `<a class="history-teaser more-card" href="${esc(x.internal ? x.url : '/history')}"><div class="teaser-meta">${x.year ? esc(x.year) : esc(x.source)}</div><h3>${esc(x.title)}</h3></a>`).join('')}</div></section>` : '';
  const topics = article.topics.map(t => `<span class="pill">${esc(t)}</span>`).join('');
  return `<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><meta name="theme-color" content="#fff6df">
<title>${esc(article.title)} — Panjabi Aa Gaye Oye</title><meta name="description" content="${esc(description)}"><link rel="canonical" href="${esc(url)}">
<meta property="og:type" content="article"><meta property="og:site_name" content="Panjabi Aa Gaye Oye"><meta property="og:title" content="${esc(article.title)}"><meta property="og:description" content="${esc(description)}"><meta property="og:url" content="${esc(url)}">${image}<meta name="twitter:card" content="${article.imageUrl ? 'summary_large_image' : 'summary'}">
<link rel="stylesheet" href="/styles.css"><script type="application/ld+json">${ld}</script></head><body>
<header class="site-header"><a class="brand-wrap" href="/"><div class="logo-mark">ਪੰ</div><div class="brand">PANJABI <span>AA GAYE OYE</span></div></a><nav class="nav" aria-label="Main navigation"><a href="/">Events</a><a href="/weekend">Weekend</a><a href="/travel">Travel</a><a class="active" href="/history">History</a><a href="/news">Music News</a></nav></header>
<main class="shell"><article class="article"><a class="back-link" href="/history">← All history</a>
<header class="article-head"><div class="eyebrow small">The arrival${article.chapter && article.chapter.n !== 99 ? ` · Chapter ${article.chapter.n}, ${esc(article.chapter.name)}` : ''}${article.year ? ` · ${article.year}` : ''}</div><h1>${esc(article.title)}</h1><p class="article-dek">${esc(article.dek)}</p>
<div class="article-meta"><span>${esc(article.byline)}</span><span>${esc(fmtLong(article.publishedAt))}</span><span>${article.minutes} min read</span>${topics}</div></header>
${article.imageUrl ? `<img class="article-cover" src="${esc(article.imageUrl)}" alt="" referrerpolicy="no-referrer">` : ''}
<div class="article-body">${renderMarkdown(article.body)}</div>${sources}
<div class="editorial-note"><strong>Found a mistake?</strong> History needs care. Write to <a href="mailto:events@panjabiaagayeoye.com">events@panjabiaagayeoye.com</a> with the correction and a source.</div>${article.aiAssisted ? '<details class="ai-disclosure"><summary>About AI assistance</summary><p>This article was drafted with AI assistance using Claude web search, then reviewed by a person before publication. Please check the listed sources for yourself.</p></details>' : ''}</article>${others}</main>
<footer class="shell"><a class="brand-wrap" href="/"><div class="logo-mark">ਪੰ</div><div class="brand">PANJABI <span>AA GAYE OYE</span></div></a><p>Read widely. Check sources. Preserve memory.</p></footer></body></html>`;
}

export function notFoundPage() {
  return '<!doctype html><html lang="en"><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Article not found</title><body style="font-family:Georgia,serif;max-width:560px;margin:12vh auto;padding:0 22px;line-height:1.6"><h1>We could not find that article</h1><p>It may have been unpublished or moved.</p><p><a href="/history">← Back to the history archive</a></p></body></html>';
}

export function sitemapXml(origin, articles = [], extraPaths = []) {
  const urls = ['/', '/weekend', '/travel', '/archive', '/news', '/history', '/about-crawlers', ...articles.map(a => `/history/${a.slug}`), ...extraPaths];
  return `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${urls.map(u => `  <url><loc>${esc(origin + u)}</loc></url>`).join('\n')}\n</urlset>\n`;
}
