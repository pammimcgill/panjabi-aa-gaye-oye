import { esc, slugify, renderMarkdown } from './articles.js';

const FORM_LABELS = ['Event page URL or ID', 'Source event URL', 'Preferred event page URL', 'Reason', 'Artist', 'Video URL', 'Caption', 'Recorded date', 'Rights confirmation', 'Summary', 'Story', 'Byline', 'Cover image URL'];
const reEscape = text => text.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

export function issueSection(body, label) {
  const plain = String(body || '').replace(/\r\n?/g, '\n');
  const stop = FORM_LABELS.map(reEscape).join('|');
  const match = plain.match(new RegExp(`(?:^|\\n)###[ \\t]+${reEscape(label)}[ \\t]*\\n([\\s\\S]*?)(?=\\n###[ \\t]+(?:${stop})[ \\t]*(?:\\n|$)|$)`, 'i'));
  const value = (match?.[1] || '').trim();
  return /^_?no response_?$/i.test(value) ? '' : value;
}

export function eventPath(event) {
  return `/events/${event.id}-${slugify(event.title) || 'event'}`;
}

export function eventIdFromSlug(slug = '') {
  return String(slug).match(/^(evt-[a-z0-9]+)(?:-|$)/i)?.[1] || '';
}

export function rowToEvent(row) {
  const safeHttp = value => /^https?:\/\//i.test(String(value || '')) ? String(value) : '';
  const performers = String(row.performers || '').split('|').map(x => x.trim()).filter(Boolean);
  if (!performers.length) {
    const match = /^Featuring (.+?)(?: — |$)/.exec(String(row.description || ''));
    if (match) performers.push(...match[1].split(',').map(x => x.trim()).filter(Boolean));
  }
  const event = {
    id: row.id, title: row.title, description: row.description || '', category: row.category,
    region: row.region, city: row.city || '', venue: row.venue || '', venueAddress: row.venue_address || '',
    startsAt: row.starts_at, endsAt: row.ends_at || null, ticketUrl: safeHttp(row.url), imageUrl: /^https:\/\//i.test(row.image_url || '') ? row.image_url : null,
    source: row.source_name, sourceKind: row.source_kind, sourceEventId: row.source_event_id,
    performers, active: Boolean(row.is_active), videoUrl: row.video_url || '', videoCaption: row.video_caption || ''
  };
  event.pageUrl = eventPath(event);
  return event;
}

const fingerprint = value => String(value || '').toLowerCase().normalize('NFKD').replace(/[\u0300-\u036f]/g, '').replace(/&/g, ' and ').replace(/[^a-z0-9]+/g, ' ').trim().replace(/\s+/g, ' ');
const TITLE_NOISE = new Set([
  'a','an','and','at','by','event','events','for','in','live','official','on','presents','present','presented','the',
  'ticket','tickets','tour','show','shows','world','2025','2026','2027','2028',
  'seattle','bellevue','kent','renton','tacoma','auburn','everett','vancouver','surrey','richmond','burnaby','delta','abbotsford','langley','coquitlam','bc','wa'
]);
const DISTINCTIVE_NOISE = new Set(['punjabi','panjabi','night','concert','comedy','festival','party','program','celebration','special']);
const TRACKING_QUERY = /^(?:utm_.+|fbclid|gclid|mc_cid|mc_eid|ref|source)$/i;

function titleTokens(value, distinctive = false) {
  const tokens = fingerprint(value).split(' ').filter(Boolean).filter(token => !TITLE_NOISE.has(token) && !/^\d{1,2}(?::\d{2})?(?:am|pm)?$/.test(token));
  return distinctive ? tokens.filter(token => !DISTINCTIVE_NOISE.has(token)) : tokens;
}

function canonicalEventUrl(value = '') {
  try {
    const url = new URL(String(value));
    url.hash = '';
    url.hostname = url.hostname.toLowerCase().replace(/^www\./, '');
    for (const key of [...url.searchParams.keys()]) if (TRACKING_QUERY.test(key)) url.searchParams.delete(key);
    url.searchParams.sort();
    url.pathname = url.pathname.replace(/\/+$/, '') || '/';
    return url.toString();
  } catch { return ''; }
}

function overlapScore(left, right) {
  const a = new Set(left), b = new Set(right);
  if (!a.size || !b.size) return 0;
  let shared = 0;
  for (const token of a) if (b.has(token)) shared++;
  return shared / Math.min(a.size, b.size);
}

function performerTokens(event) {
  const names = Array.isArray(event.performers) ? event.performers : String(event.performers || '').split('|');
  return titleTokens(names.join(' '), true);
}

function locationsCompatible(a, b) {
  const cityA = fingerprint(a.city), cityB = fingerprint(b.city);
  const venueA = fingerprint(a.venue), venueB = fingerprint(b.venue);
  if (cityA && cityB && cityA !== cityB) return Boolean(venueA && venueB && venueA === venueB);
  if (cityA && cityB) return true;
  const regionA = fingerprint(a.region), regionB = fingerprint(b.region);
  return Boolean((regionA && regionB && regionA === regionB) || (venueA && venueB && venueA === venueB));
}

function titlesCompatible(a, b) {
  const titleA = titleTokens(a.title), titleB = titleTokens(b.title);
  if (titleA.join(' ') && titleA.join(' ') === titleB.join(' ')) return true;
  const distinctA = titleTokens(a.title, true), distinctB = titleTokens(b.title, true);
  const titleOverlap = overlapScore(distinctA.length ? distinctA : titleA, distinctB.length ? distinctB : titleB);
  if (titleOverlap >= .75 && Math.min((distinctA.length ? distinctA : titleA).length, (distinctB.length ? distinctB : titleB).length) >= 2) return true;
  const performersA = performerTokens(a), performersB = performerTokens(b);
  return performersA.length >= 2 && performersB.length >= 2 && overlapScore(performersA, performersB) >= .8;
}

export function eventsAreDuplicates(a, b) {
  if (localDate(a.startsAt) !== localDate(b.startsAt)) return false;
  const urlA = canonicalEventUrl(a.ticketUrl || a.url), urlB = canonicalEventUrl(b.ticketUrl || b.url);
  if (urlA && urlB && urlA === urlB && locationsCompatible(a, b)) return true;
  return locationsCompatible(a, b) && titlesCompatible(a, b);
}
const localDate = value => {
  try { return new Intl.DateTimeFormat('en-CA', { timeZone: 'America/Los_Angeles', year: 'numeric', month: '2-digit', day: '2-digit' }).format(new Date(value)); }
  catch { return String(value || '').slice(0, 10); }
};

const pacificParts = date => Object.fromEntries(new Intl.DateTimeFormat('en-US', { timeZone: 'America/Los_Angeles', year: 'numeric', month: 'numeric', day: 'numeric', weekday: 'short', hour: 'numeric', hourCycle: 'h23' }).formatToParts(date).filter(x => x.type !== 'literal').map(x => [x.type, x.value]));
const weekdayNumber = { Sun: 0, Mon: 1, Tue: 2, Wed: 3, Thu: 4, Fri: 5, Sat: 6 };
function pacificMidnight(year, month, day) {
  const target = Date.UTC(year, month - 1, day, 0, 0, 0); let guess = target;
  for (let i = 0; i < 3; i++) { const p = pacificParts(new Date(guess)); const represented = Date.UTC(Number(p.year), Number(p.month) - 1, Number(p.day), Number(p.hour) % 24); guess += target - represented; }
  return new Date(guess);
}

export function pacificWeekendBounds(now = new Date()) {
  const p = pacificParts(now), weekday = weekdayNumber[p.weekday];
  const deltaToFriday = weekday === 0 ? -2 : weekday === 6 ? -1 : 5 - weekday;
  const base = new Date(Date.UTC(Number(p.year), Number(p.month) - 1, Number(p.day)));
  const friday = new Date(base); friday.setUTCDate(friday.getUTCDate() + deltaToFriday);
  const monday = new Date(friday); monday.setUTCDate(monday.getUTCDate() + 3);
  const start = pacificMidnight(friday.getUTCFullYear(), friday.getUTCMonth() + 1, friday.getUTCDate());
  const end = pacificMidnight(monday.getUTCFullYear(), monday.getUTCMonth() + 1, monday.getUTCDate());
  const range = `${fmt(start, { month: 'long', day: 'numeric' })}–${fmt(new Date(end.getTime() - 1), { month: 'long', day: 'numeric', year: 'numeric' })}`;
  return { start: start.toISOString(), end: end.toISOString(), range };
}

function richness(event) {
  return Number(Boolean(event.imageUrl)) * 8 + Number(Boolean(event.description)) * 4 + event.performers.length * 2 + Number(Boolean(event.venueAddress)) + Number(event.sourceKind === 'manual') * 3;
}

// Different collectors often describe the same show differently. Group conservative title/performer
// matches on the same local date and location, then keep the richest source. Different dates and
// different cities remain separate events.
export function dedupeEvents(events = []) {
  const chosen = [];
  for (const event of events) {
    const index = chosen.findIndex(current => eventsAreDuplicates(current, event));
    if (index < 0) chosen.push(event);
    else if (richness(event) > richness(chosen[index])) chosen[index] = event;
  }
  return chosen.sort((a, b) => new Date(a.startsAt) - new Date(b.startsAt));
}

function idOrUrl(value = '') {
  const text = String(value).trim();
  return { id: text.match(/(?:\/events\/)?(evt-[a-z0-9]+)/i)?.[1] || (/^evt-[a-z0-9]+$/i.test(text) ? text : ''), url: /^https?:\/\//i.test(text) ? text.replace(/[#?].*$/, '').replace(/\/$/, '') : '' };
}

export function moderationRulesFromIssues(issues = []) {
  return issues.filter(x => !x.pull_request).map(issue => {
    const target = idOrUrl(issueSection(issue.body, 'Event page URL or ID') || issueSection(issue.body, 'Source event URL'));
    const preferred = idOrUrl(issueSection(issue.body, 'Preferred event page URL'));
    return { ...target, preferredId: preferred.id, preferredUrl: preferred.url, reason: issueSection(issue.body, 'Reason') };
  }).filter(x => x.id || x.url);
}

export function applyModeration(events, rules = []) {
  const redirects = new Map();
  const visible = events.filter(event => {
    const url = String(event.ticketUrl || '').replace(/[#?].*$/, '').replace(/\/$/, '');
    const rule = rules.find(x => (x.id && x.id === event.id) || (x.url && x.url === url));
    if (!rule) return true;
    if (rule.preferredId || rule.preferredUrl) redirects.set(event.id, rule.preferredId || rule.preferredUrl);
    return false;
  });
  return { visible, redirects };
}

export function mediaFromIssues(issues = [], event) {
  const wantedId = event.id;
  const wantedTicket = String(event.ticketUrl || '').replace(/[#?].*$/, '').replace(/\/$/, '');
  const items = [];
  for (const issue of issues) {
    if (issue.pull_request) continue;
    const target = idOrUrl(issueSection(issue.body, 'Event page URL or ID'));
    if (target.id !== wantedId && target.url !== wantedTicket) continue;
    const videoUrl = issueSection(issue.body, 'Video URL').split(/\s+/)[0];
    if (!/^https:\/\//i.test(videoUrl)) continue;
    const rights = issueSection(issue.body, 'Rights confirmation');
    if (!/own|recorded|permission|right/i.test(rights)) continue;
    items.push({ artist: issueSection(issue.body, 'Artist'), videoUrl, caption: issueSection(issue.body, 'Caption'), recordedDate: issueSection(issue.body, 'Recorded date') });
  }
  if (event.videoUrl) items.unshift({ artist: event.performers.join(', '), videoUrl: event.videoUrl, caption: event.videoCaption, recordedDate: '' });
  return items.slice(0, 6);
}

export function storyFromIssues(issues = [], event) {
  const wantedTicket = String(event.ticketUrl || '').replace(/[#?].*$/, '').replace(/\/$/, '');
  const matches = issues.filter(issue => {
    if (issue.pull_request) return false;
    const target = idOrUrl(issueSection(issue.body, 'Event page URL or ID'));
    return target.id === event.id || target.url === wantedTicket;
  }).sort((a, b) => new Date(b.updated_at || b.created_at) - new Date(a.updated_at || a.created_at));
  const issue = matches[0];
  if (!issue) return null;
  const cover = issueSection(issue.body, 'Cover image URL').split(/\s+/)[0];
  return {
    title: String(issue.title || '').replace(/^\[Event story\]\s*/i, '').trim() || event.title,
    summary: issueSection(issue.body, 'Summary'), story: issueSection(issue.body, 'Story'),
    byline: issueSection(issue.body, 'Byline').split('\n')[0].trim() || 'Community contributor',
    coverImage: /^https:\/\//i.test(cover) ? cover : '', issueUrl: issue.html_url || '', commentsUrl: issue.comments_url || '',
    issueNumber: Number(issue.number), publishedAt: issue.created_at, updatedAt: issue.updated_at || issue.created_at
  };
}

export function safeComments(comments = []) {
  return comments.filter(x => x && x.user?.type !== 'Bot' && String(x.body || '').trim()).slice(0, 30).map(x => ({
    author: String(x.user?.login || 'Community member'), authorUrl: /^https:\/\//.test(x.user?.html_url || '') ? x.user.html_url : '',
    body: String(x.body || '').slice(0, 4000), createdAt: x.created_at, url: /^https:\/\//.test(x.html_url || '') ? x.html_url : ''
  }));
}

const fmt = (value, options) => { try { return new Intl.DateTimeFormat('en-US', { timeZone: 'America/Los_Angeles', ...options }).format(new Date(value)); } catch { return ''; } };
const isPast = event => new Date(event.endsAt || event.startsAt).getTime() < Date.now();

function videoEmbed(item) {
  let parsed; try { parsed = new URL(item.videoUrl); } catch { return ''; }
  const host = parsed.hostname.replace(/^www\./, '');
  let id = '';
  if (host === 'youtu.be') id = parsed.pathname.split('/').filter(Boolean)[0] || '';
  if (host === 'youtube.com' || host === 'm.youtube.com') id = parsed.searchParams.get('v') || parsed.pathname.match(/^\/shorts\/([^/]+)/)?.[1] || '';
  const caption = [item.caption, item.artist, item.recordedDate].filter(Boolean).join(' · ');
  if (/^[A-Za-z0-9_-]{6,20}$/.test(id)) return `<figure class="community-video"><div class="video-frame"><iframe src="https://www.youtube-nocookie.com/embed/${esc(id)}" title="${esc(caption || 'Community concert video')}" loading="lazy" allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share" allowfullscreen></iframe></div>${caption ? `<figcaption>${esc(caption)}</figcaption>` : ''}</figure>`;
  if (/\.(?:mp4|webm)(?:$|\?)/i.test(item.videoUrl)) return `<figure class="community-video"><video controls preload="metadata" src="${esc(item.videoUrl)}"></video>${caption ? `<figcaption>${esc(caption)}</figcaption>` : ''}</figure>`;
  return `<p><a class="button ghost" href="${esc(item.videoUrl)}" target="_blank" rel="noopener noreferrer">Watch community video ↗</a>${caption ? `<br><small>${esc(caption)}</small>` : ''}</p>`;
}

export function eventPage(event, { origin = '', media = [], similar = [], mediaForm = '', story = null, comments = [], storyForm = '' } = {}) {
  const path = eventPath(event), url = `${origin}${path}`;
  const title = `${event.title} — Panjabi Aa Gaye Oye`;
  const description = event.description || `${event.title} at ${event.venue || event.city || event.region}.`;
  const image = event.imageUrl ? `<meta property="og:image" content="${esc(event.imageUrl)}"><meta name="twitter:image" content="${esc(event.imageUrl)}">` : '';
  const performer = event.performers.length ? { '@type': event.performers.length > 1 ? 'PerformingGroup' : 'Person', name: event.performers.join(', ') } : undefined;
  const ld = JSON.stringify({ '@context': 'https://schema.org', '@type': 'Event', name: event.title, description, startDate: event.startsAt,
    ...(event.endsAt ? { endDate: event.endsAt } : {}), eventStatus: 'https://schema.org/EventScheduled', url,
    location: { '@type': 'Place', name: event.venue || event.city, address: { '@type': 'PostalAddress', streetAddress: event.venueAddress || undefined, addressLocality: event.city || undefined, addressRegion: event.region === 'Vancouver' ? 'BC' : 'WA' } },
    ...(event.imageUrl ? { image: [event.imageUrl] } : {}), ...(performer ? { performer } : {}), offers: { '@type': 'Offer', url: event.ticketUrl }
  }).replace(/</g, '\\u003c');
  const mapQuery = encodeURIComponent([event.venueAddress, event.venue, event.city].filter(Boolean).join(', '));
  const shareText = encodeURIComponent(`${event.title} — ${fmt(event.startsAt, { month: 'short', day: 'numeric' })}`);
  const encodedUrl = encodeURIComponent(url);
  const videos = media.length ? `<section class="event-section"><div class="eyebrow small">From the community</div><h2>Videos from this event</h2><p class="muted-copy">Recordings shared by community members who confirmed they own them or have permission to share.</p><div class="video-grid">${media.map(videoEmbed).join('')}</div></section>` : '';
  const storyBlock = story ? `<section class="event-section event-story">${story.coverImage ? `<img class="article-cover" src="${esc(story.coverImage)}" alt="" referrerpolicy="no-referrer">` : ''}<div class="eyebrow small">Community story</div><h2>${esc(story.title)}</h2>${story.summary ? `<p class="article-dek">${esc(story.summary)}</p>` : ''}<p class="story-byline">By ${esc(story.byline)} · ${esc(fmt(story.publishedAt, { month: 'long', day: 'numeric', year: 'numeric' }))}</p><div class="article-body">${renderMarkdown(story.story)}</div></section>` : '';
  const commentsBlock = story ? `<section class="event-section comments"><h2>People who were there</h2>${comments.length ? comments.map(c => `<article class="comment"><div class="comment-meta">${c.authorUrl ? `<a href="${esc(c.authorUrl)}" target="_blank" rel="noopener noreferrer">${esc(c.author)}</a>` : esc(c.author)} · ${esc(fmt(c.createdAt, { month: 'short', day: 'numeric', year: 'numeric' }))}</div><div class="comment-body">${renderMarkdown(c.body)}</div></article>`).join('') : '<p>No community memories have been added yet.</p>'}${story.issueUrl ? `<a class="button ghost" href="${esc(story.issueUrl)}#new_comment_field" target="_blank" rel="noopener noreferrer">Leave a comment on GitHub ↗</a>` : ''}<p class="source-line">A free GitHub account is required. Comments are public and can be moderated by the site editor.</p></section>` : '';
  const related = similar.length ? `<section class="event-section"><h2>More events you may like</h2><div class="more-grid">${similar.map(x => `<a class="history-teaser more-card" href="${esc(eventPath(x))}"><div class="teaser-meta">${esc(fmt(x.startsAt, { month: 'short', day: 'numeric' }))} · ${esc(x.city || x.region)}</div><h3>${esc(x.title)}</h3></a>`).join('')}</div></section>` : '';
  return `<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><meta name="theme-color" content="#fff6df"><title>${esc(title)}</title><meta name="description" content="${esc(description)}"><link rel="canonical" href="${esc(url)}"><meta property="og:type" content="website"><meta property="og:site_name" content="Panjabi Aa Gaye Oye"><meta property="og:title" content="${esc(event.title)}"><meta property="og:description" content="${esc(description)}"><meta property="og:url" content="${esc(url)}">${image}<meta name="twitter:card" content="${event.imageUrl ? 'summary_large_image' : 'summary'}"><link rel="stylesheet" href="/styles.css"><script type="application/ld+json">${ld}</script></head><body>
<header class="site-header"><a class="brand-wrap" href="/"><div class="logo-mark">ਪੰ</div><div class="brand">PANJABI <span>AA GAYE OYE</span></div></a><nav class="nav" aria-label="Main navigation"><a href="/">Events</a><a href="/weekend">Weekend</a><a href="/travel">Travel</a><a href="/history">History</a><a href="/news">Music News</a></nav></header>
<main class="shell"><article class="event-detail"><a class="back-link" href="${isPast(event) ? '/' : '/'}">← All events</a><header class="event-hero"><div class="event-copy"><div class="eyebrow small">${isPast(event) ? 'Event memory' : esc(event.category)} · ${esc(event.region)}</div><h1>${esc(event.title)}</h1><p class="event-date">${esc(fmt(event.startsAt, { weekday: 'long', month: 'long', day: 'numeric', year: 'numeric', hour: 'numeric', minute: '2-digit', timeZoneName: 'short' }))}</p><p class="article-dek">${esc(description)}</p></div>${event.imageUrl ? `<img class="event-cover" src="${esc(event.imageUrl)}" alt="" referrerpolicy="no-referrer">` : ''}</header>
<div class="event-facts"><section><div class="eyebrow small">Artist</div><h2>${esc(event.performers.join(', ') || event.title)}</h2><p>${event.performers.length ? 'Featured performer information supplied by the event source.' : 'The event title is shown because a separate performer was not supplied.'}</p></section><section><div class="eyebrow small">Venue</div><h2>${esc(event.venue || event.city || event.region)}</h2><p>${esc([event.venueAddress, event.city, event.region].filter(Boolean).join(', '))}</p>${mapQuery ? `<a class="card-link" href="https://www.google.com/maps/search/?api=1&query=${mapQuery}" target="_blank" rel="noopener noreferrer">Directions and venue information ↗</a>` : ''}</section></div>
<div class="event-actions">${!isPast(event) ? `<a class="button" href="${esc(event.ticketUrl)}" target="_blank" rel="noopener noreferrer sponsored">Tickets / official details ↗</a>` : `<a class="button" href="${esc(event.ticketUrl)}" target="_blank" rel="noopener noreferrer">Original event page ↗</a>`}<button id="nativeShare" class="button ghost" type="button">Share</button></div>
<section id="share" class="share-panel"><strong>Share this event</strong><div class="share-links"><a href="https://wa.me/?text=${shareText}%20${encodedUrl}" target="_blank" rel="noopener noreferrer">WhatsApp</a><a href="https://www.facebook.com/sharer/sharer.php?u=${encodedUrl}" target="_blank" rel="noopener noreferrer">Facebook</a><a href="mailto:?subject=${shareText}&body=${encodedUrl}">Email</a><button id="copyLink" type="button">Copy link</button></div><span id="copyStatus" aria-live="polite"></span></section>
${storyBlock}${videos}${storyForm && !story ? `<section class="event-section add-memory"><h2>Write about this event</h2><p>Add a description, review or memory from your phone. It appears here without a new deployment.</p><a class="button ghost" href="${esc(storyForm)}">Write an event story</a></section>` : ''}${mediaForm ? `<section class="event-section add-memory"><h2>Were you there?</h2><p>Add your own concert video. You must own the recording or have permission to share it.</p><a class="button ghost" href="${esc(mediaForm)}">Add a community video</a></section>` : ''}${commentsBlock}${related}
<p class="source-line">Event information: ${esc(event.source)}. Always confirm time and ticket availability with the organizer.</p></article></main><footer class="shell"><a class="brand-wrap" href="/"><div class="logo-mark">ਪੰ</div><div class="brand">PANJABI <span>AA GAYE OYE</span></div></a><p>Seattle · Surrey · Vancouver · the wider Pacific Northwest</p></footer>
<script>const share={title:${JSON.stringify(event.title).replace(/</g,'\\u003c')},text:${JSON.stringify(description).replace(/</g,'\\u003c')},url:location.href};document.getElementById('nativeShare').addEventListener('click',async()=>{if(navigator.share){try{await navigator.share(share);return}catch(e){if(e.name==='AbortError')return}}location.hash='share'});document.getElementById('copyLink').addEventListener('click',async()=>{try{await navigator.clipboard.writeText(location.href);document.getElementById('copyStatus').textContent='Link copied.'}catch{document.getElementById('copyStatus').textContent='Copy the address from your browser.'}});</script></body></html>`;
}

export function eventNotFoundPage() {
  return '<!doctype html><html lang="en"><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Event not found</title><body style="font-family:Georgia,serif;max-width:560px;margin:12vh auto;padding:0 22px;line-height:1.6"><h1>We could not find that event</h1><p>It may have been removed as a duplicate or corrected by an editor.</p><p><a href="/">← Back to events</a></p></body></html>';
}
