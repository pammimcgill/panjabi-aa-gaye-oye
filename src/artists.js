import { esc, slugify } from './articles.js';
import { eventCard } from './list-pages.js';
import { knownArtistsInTitle, isSpotifyArtist } from './spotify-artists.js';

export const artistSlug = name => slugify(name);
export const artistPath = name => `/artists/${artistSlug(name)}`;

// Credited performers plus playlist artists named in the title, one entry per artist.
// Names that cannot make a Latin-letter address (for example Gurmukhi-only names) get no page.
export function eventArtists(event) {
  const seen = new Set(); const out = [];
  for (const raw of [...(event?.performers || []), ...knownArtistsInTitle(event?.title)]) {
    const name = String(raw || '').trim(); const slug = artistSlug(name);
    if (!name || !slug || seen.has(slug)) continue;
    seen.add(slug); out.push(name);
  }
  return out;
}

const isUpcoming = (event, now) => event.active && new Date(event.startsAt).getTime() >= now - 86400000;

// Splits one artist's events into upcoming (soonest first) and past (latest first). Returns null if there are none.
export function artistEvents(events, slug, now = Date.now()) {
  let name = ''; const upcoming = []; const past = [];
  for (const event of events) {
    const match = eventArtists(event).find(n => artistSlug(n) === slug);
    if (!match) continue;
    name = name || match;
    (isUpcoming(event, now) ? upcoming : past).push(event);
  }
  if (!name) return null;
  const time = e => new Date(e.startsAt).getTime();
  upcoming.sort((a, b) => time(a) - time(b)); past.sort((a, b) => time(b) - time(a));
  return { name, slug, upcoming, past };
}

// Artists with at least one upcoming event; only these go in the sitemap.
export function upcomingArtistPaths(events, now = Date.now()) {
  return [...new Set(events.filter(e => isUpcoming(e, now)).flatMap(e => eventArtists(e).map(artistPath)))];
}

export function artistPage({ name, slug, upcoming, past }, { origin = '' } = {}) {
  const url = `${origin}/artists/${slug}`;
  const title = `${name} — Seattle & Vancouver events | Panjabi Aa Gaye Oye`;
  const description = upcoming.length
    ? `${upcoming.length} upcoming ${upcoming.length === 1 ? 'event' : 'events'} with ${name} in Greater Seattle and Metro Vancouver.`
    : `${name} has no upcoming events listed in Greater Seattle or Metro Vancouver right now.`;
  const ld = JSON.stringify({ '@context': 'https://schema.org', '@type': 'CollectionPage', name: `${name} events`, url,
    about: { '@type': 'Thing', name },
    mainEntity: { '@type': 'ItemList', itemListElement: upcoming.slice(0, 20).map((e, i) => ({ '@type': 'ListItem', position: i + 1, url: `${origin}${e.pageUrl}`, name: e.title })) }
  }).replace(/</g, '\\u003c');
  const spotify = isSpotifyArtist(name) ? `<a class="button ghost" href="https://open.spotify.com/search/${encodeURIComponent(name)}" target="_blank" rel="noopener noreferrer">Listen on Spotify ↗</a>` : '';
  const when = e => new Intl.DateTimeFormat('en-US', { month: 'short', day: 'numeric', year: 'numeric', timeZone: 'America/Los_Angeles' }).format(new Date(e.startsAt));
  const upcomingBlock = upcoming.length
    ? `<section class="section"><div class="section-head"><div><div class="eyebrow small">Coming up</div><h2>Upcoming events</h2></div><div class="count">${upcoming.length} ${upcoming.length === 1 ? 'event' : 'events'}</div></div><div class="cards">${upcoming.map(eventCard).join('')}</div></section>`
    : `<section class="section"><div class="empty">No upcoming events right now. Check back soon, or browse <a href="/">all events</a>.</div></section>`;
  const pastBlock = past.length
    ? `<section class="section"><div class="section-head"><div><div class="eyebrow small">Memory</div><h2>Past events</h2></div></div><div class="more-grid">${past.slice(0, 6).map(e => `<a class="history-teaser more-card" href="${esc(e.pageUrl)}"><div class="teaser-meta">${esc(when(e))} · ${esc(e.city || e.region)}</div><h3>${esc(e.title)}</h3></a>`).join('')}</div></section>`
    : '';
  return `<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><meta name="theme-color" content="#fff6df"><title>${esc(title)}</title><meta name="description" content="${esc(description)}"><link rel="canonical" href="${esc(url)}">${upcoming.length ? '' : '<meta name="robots" content="noindex">'}<meta property="og:type" content="website"><meta property="og:site_name" content="Panjabi Aa Gaye Oye"><meta property="og:title" content="${esc(name)} — events"><meta property="og:description" content="${esc(description)}"><meta property="og:url" content="${esc(url)}"><meta name="twitter:card" content="summary"><link rel="stylesheet" href="/styles.css"><script type="application/ld+json">${ld}</script></head><body>
<header class="site-header"><a class="brand-wrap" href="/"><div class="logo-mark">ਪੰ</div><div class="brand">PANJABI <span>AA GAYE OYE</span></div></a><a class="kids-adventure-link" href="/kids/index.html#journeys" aria-label="Panjabi Kids — Start an adventure!"><svg viewBox="0 0 24 24" width="24" height="24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M12 5v15M12 5C9 3 5 3 2 4v15c3-1 7-1 10 1 3-2 7-2 10-1V4c-3-1-7-1-10 1Z"/></svg><span><strong>Panjabi Kids</strong><small>Start an adventure!</small></span></a><nav class="nav" aria-label="Main navigation"><a href="/">Events</a><a href="/weekend">Weekend</a><a href="/history">History</a><a href="/news">Music News</a></nav></header>
<main class="shell"><a class="back-link" href="/">← All events</a><header class="event-hero"><div class="event-copy"><div class="eyebrow small">Artist</div><h1>${esc(name)}</h1><p class="article-dek">${esc(description)}</p>${spotify ? `<div class="event-actions">${spotify}</div>` : ''}</div></header>
${upcomingBlock}${pastBlock}
<p class="source-line">Events come from public listings. Always confirm time and ticket availability with the organizer.</p></main><footer class="shell"><a class="brand-wrap" href="/"><div class="logo-mark">ਪੰ</div><div class="brand">PANJABI <span>AA GAYE OYE</span></div></a><p>Seattle · Surrey · Vancouver · the wider Pacific Northwest</p></footer></body></html>`;
}

export function artistNotFoundPage() {
  return '<!doctype html><html lang="en"><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Artist not found</title><body style="font-family:Georgia,serif;max-width:560px;margin:12vh auto;padding:0 22px;line-height:1.6"><h1>We could not find that artist</h1><p>There are no events listed for this name.</p><p><a href="/">← Back to events</a></p></body></html>';
}
