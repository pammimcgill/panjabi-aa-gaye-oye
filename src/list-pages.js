const esc = value => String(value ?? '').replace(/[&<>"']/g, char => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[char]));

const safeHref = (value, internal = false) => {
  const text = String(value || '');
  if (internal && /^\/(?!\/)[^\s]*$/.test(text)) return text;
  if (!internal && /^https?:\/\/[^\s]+$/i.test(text)) return text;
  return '';
};

const safeImage = value => /^https:\/\/[^\s]+$/i.test(String(value || '')) ? String(value) : '';

const fmtDate = value => {
  try {
    return new Intl.DateTimeFormat('en-US', { month: 'short', day: 'numeric', year: 'numeric', timeZone: 'America/Los_Angeles' }).format(new Date(value));
  } catch { return String(value || ''); }
};

const timeAgo = value => {
  const ms = Date.now() - new Date(value).getTime();
  if (!(ms >= 0)) return fmtDate(value);
  const hours = Math.floor(ms / 3600000);
  if (hours < 1) return 'Just now';
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  return days < 7 ? `${days}d ago` : fmtDate(value);
};

function replaceContents(html, id, contents) {
  const pattern = new RegExp(`(<[^>]+id=["']${id}["'][^>]*>)[\\s\\S]*?(<\\/[^>]+>)`);
  return html.replace(pattern, `$1${contents}$2`);
}

function hide(html, id) {
  const pattern = new RegExp(`(<[^>]+id=["']${id}["'][^>]*class=["'])([^"']*)(["'][^>]*>)`);
  return html.replace(pattern, (_, start, classes, end) => `${start}${classes.includes('hidden') ? classes : `${classes} hidden`}${end}`);
}

function countLabel(count, singular, plural = `${singular}s`) {
  return `${count} ${count === 1 ? singular : plural}`;
}

export function eventCard(event) {
  const image = safeImage(event.imageUrl);
  const href = safeHref(event.pageUrl, true);
  const performers = Array.isArray(event.performers) ? event.performers : [];
  const details = [event.venue, event.city || event.region].filter(Boolean).map(esc).join(' · ');
  return `<article class="card${image ? ' has-image' : ''}">${image ? `<img class="card-img" src="${esc(image)}" alt="" loading="lazy" referrerpolicy="no-referrer">` : ''}<div class="${image ? 'card-body' : ''}"><div class="card-top"><span class="badge ${esc(event.category)}">${esc(event.category)}</span><span class="datebox">${esc(fmtDate(event.startsAt))}</span></div><h3>${esc(event.title)}</h3><div class="meta">${details ? `<strong>${details}</strong>` : ''}${performers.length ? `<br>Featuring ${esc(performers.join(', '))}` : ''}${event.description ? `<br>${esc(event.description)}` : ''}</div><div class="spacer"></div><div class="source-line">Source: ${esc(event.source)}</div>${href ? `<div class="card-actions"><a class="card-link" href="${esc(href)}">View event →</a></div>` : ''}</div></article>`;
}

export function storyCard(story, { news = false, lead = false } = {}) {
  const own = Boolean(story.internal);
  const image = safeImage(story.imageUrl);
  const href = safeHref(story.url, own);
  const meta = news ? `${esc(story.source)} · ${esc(timeAgo(story.publishedAt))}` : own ? `${story.year ? `<strong class="year">${esc(story.year)}</strong> · ` : ''}Our article · ${esc(story.minutes || 1)} min read` : `${esc(story.source)} · Reading link`;
  const pills = (story.topics || []).map(topic => `<span class="pill">${esc(topic)}</span>`).join('');
  const link = href ? (own ? `<a class="card-link" href="${esc(href)}">Read the article →</a>` : `<a class="card-link" href="${esc(href)}" target="_blank" rel="noopener noreferrer">Read at ${esc(story.source)} →</a>`) : '';
  return `<article class="story-card${lead ? ' lead' : ''}${own ? ' own' : ''}">${image ? `<img src="${esc(image)}" alt="" loading="lazy" referrerpolicy="no-referrer">` : ''}<div class="story-copy"><div class="eyebrow small">${meta}</div><h2>${esc(story.title)}</h2>${pills ? `<div class="pills">${pills}</div>` : ''}<p>${esc(story.dek || 'Open the original source to read more.')}</p>${link}</div></article>`;
}

function timelineStories(items) {
  const chapterOf = story => story.chapterNumber ?? (story.internal ? 99 : 100);
  return [...items].sort((a, b) => chapterOf(a) - chapterOf(b) || (a.year || 9999) - (b.year || 9999) || new Date(b.publishedAt) - new Date(a.publishedAt));
}

export function renderEventSnapshot(html, events = [], { range = '' } = {}) {
  const visible = events.slice(0, 16);
  let page = replaceContents(html, 'eventsGrid', visible.map(eventCard).join(''));
  page = replaceContents(page, 'eventCount', countLabel(events.length, 'event'));
  if (range) page = replaceContents(page, 'weekendRange', esc(range));
  if (visible.length) page = hide(page, 'loadingState');
  return page;
}

export function renderStorySnapshot(html, items = [], { news = false } = {}) {
  const dated = items.filter(item => item.year).length;
  const timeline = !news && dated >= 2;
  const ordered = timeline ? timelineStories(items) : items;
  const visible = ordered.slice(0, 12);
  let lastChapter = null;
  const cards = visible.map((story, index) => {
    let heading = '';
    if (timeline && story.chapterNumber !== lastChapter) {
      lastChapter = story.chapterNumber;
      heading = `<div class="chapter-head"><span>${lastChapter < 99 ? `Chapter ${esc(lastChapter)}` : 'Beyond the timeline'}</span><h3>${esc(story.chapter || (story.internal ? 'Culture and heritage' : 'Further reading'))}</h3><small>${esc(story.chapterSpan || '')}</small></div>`;
    }
    return heading + storyCard(story, { news, lead: !timeline && index === 0 && items.length >= 4 });
  }).join('');
  let page = replaceContents(html, 'storyGrid', cards);
  page = replaceContents(page, 'storyCount', countLabel(items.length, 'story', 'stories'));
  if (visible.length) page = hide(page, 'loadingState');
  return page;
}

export function renderHomeHistorySnapshot(html, items = []) {
  const teasers = items.slice(0, 3).map(story => {
    const href = safeHref(story.internal ? story.url : '/history', true) || '/history';
    return `<a class="history-teaser" href="${esc(href)}"><div class="teaser-meta">${story.year ? `${esc(story.year)} · ` : ''}${esc(story.source)}</div><h3>${esc(story.title)}</h3>${story.dek ? `<p>${esc(story.dek)}</p>` : ''}</a>`;
  }).join('');
  let page = replaceContents(html, 'historyFrontGrid', teasers);
  if (items.length) page = hide(page, 'historyFrontLoading');
  return page;
}
