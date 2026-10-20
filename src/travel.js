import { esc } from './articles.js';

export const TRAVEL_SOURCES = [
  { name: 'WSDOT real-time map', url: 'https://wsdot.com/travel/real-time/' },
  { name: 'Canada-bound border waits', url: 'https://wsdot.wa.gov/travel/roads-bridges/border-crossings' },
  { name: 'U.S. border wait times', url: 'https://bwt.cbp.gov/' }
];

const decode = value => String(value || '').replace(/<!\[CDATA\[([\s\S]*?)\]\]>/g, '$1').replace(/<[^>]+>/g, ' ').replace(/&amp;/g, '&').replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&quot;/g, '"').replace(/&#39;/g, "'").replace(/\s+/g, ' ').trim();
const tag = (xml, name) => decode(xml.match(new RegExp(`<${name}(?:\\s[^>]*)?>([\\s\\S]*?)<\\/${name}>`, 'i'))?.[1] || '');

export function parseWsdotRss(xml = '', source = 'WSDOT') {
  const corridor = /\b(?:I-?5|SR\s?(?:539|543)|Seattle|Everett|Marysville|Mount Vernon|Burlington|Bellingham|Blaine|Peace Arch|Pacific Highway|border)\b/i;
  return [...String(xml).matchAll(/<item\b[^>]*>([\s\S]*?)<\/item>/gi)].map(match => {
    const item = match[1], title = tag(item, 'title'), description = tag(item, 'description');
    return { id: `${source}-${tag(item, 'guid') || tag(item, 'link') || title}`, title, description, url: tag(item, 'link'), updatedAt: tag(item, 'pubDate'), source, severity: /clos(?:ed|ure)|blocked|major/i.test(`${title} ${description}`) ? 'major' : 'notice' };
  }).filter(x => x.title && corridor.test(`${x.title} ${x.description}`)).slice(0, 25);
}

export function parseDriveBc(data = {}) {
  return (data.events || []).map(x => ({
    id: x.id, title: x.headline || x.event_type || 'Road advisory', description: x.description || '',
    url: x.url ? new URL(x.url, 'https://api.open511.gov.bc.ca/').href : 'https://www.drivebc.ca/',
    updatedAt: x.updated || x.created, source: 'DriveBC', severity: String(x.severity || 'UNKNOWN').toLowerCase(),
    road: (x.roads || []).map(r => [r.name, r.direction, r.from, r.to].filter(Boolean).join(' · ')).join('; ')
  })).filter(x => x.title).slice(0, 30);
}


export function isMajorI5Closure(item) {
  const text = item.title + ' ' + item.description;
  return /\b(?:I[- ]?5|Interstate 5)\b/i.test(text)
    && /(?:all (?:northbound |southbound )?lanes (?:are )?(?:closed|blocked)|(?:northbound|southbound|both directions|freeway|highway) (?:is |are )?(?:closed|blocked)|full closure)/i.test(text);
}
export function parseBorderWaits(data, now = Date.now()) {
  if (!Array.isArray(data.features)) throw new Error('Border feed unavailable');
  return data.features.map(({attributes:a}) => {
    const time = Number(a.BorderReadingTime);
    const fresh = time > now - 30 * 60000 && time <= now + 5 * 60000;
    return {id:'border-'+a.OBJECTID, title:a.BorderCrossingDescription+' — Canada-bound',
      description:fresh ? a.WaitTimeText : 'Current wait unavailable. Check the official border wait page.',
      updatedAt:time ? new Date(time).toISOString() : '', source:'WSDOT border waits', severity:'notice',
      url:'https://wsdot.wa.gov/travel/roads-bridges/border-crossings'};
  });
}

export async function fetchTravel(fetchImpl = fetch) {
  const sources = [
    ['Canada-bound border waits', 'https://data.wsdot.wa.gov/arcgis/rest/services/TravelInformation/TravelInfoBorderCrossingTimes/FeatureServer/0/query?where=1%3D1&outFields=*&f=json', 'border'],
    ['WSDOT major I-5 closures', 'https://wsdot.wa.gov/traffic/api/HighwayAlerts/rss.aspx', 'rss']
  ];
  const settled = await Promise.allSettled(sources.map(async ([name, url, type]) => {
    const response = await fetchImpl(url, { headers: { accept: type === 'border' ? 'application/json' : 'application/rss+xml, application/xml;q=0.9', 'user-agent': 'PanjabiAaGayeOyeBot/3.9.6 (+https://panjabiaagayeoye.com/about-crawlers)' }, cf: { cacheEverything: true, cacheTtl: 300 } });
    if (!response.ok) throw new Error(`${name} HTTP ${response.status}`);
    return type === 'border' ? parseBorderWaits(await response.json()) : parseWsdotRss(await response.text(), name).filter(isMajorI5Closure);
  }));
  const items = settled.flatMap(x => x.status === 'fulfilled' ? x.value : []).sort((a, b) => Number(b.severity === 'major') - Number(a.severity === 'major') || new Date(b.updatedAt || 0) - new Date(a.updatedAt || 0));
  const errors = settled.map((x, i) => x.status === 'rejected' ? `${sources[i][0]} is temporarily unavailable` : '').filter(Boolean);
  return { items, errors, sources: TRAVEL_SOURCES, generatedAt: new Date().toISOString() };
}

const safeHttps = value => {
  try {
    const url = new URL(String(value || ''));
    return url.protocol === 'https:' ? url.href : '';
  } catch { return ''; }
};

const formatUpdated = value => {
  try {
    return new Intl.DateTimeFormat('en-US', {
      month: 'short', day: 'numeric', year: 'numeric', hour: 'numeric', minute: '2-digit', timeZone: 'America/Los_Angeles', timeZoneName: 'short'
    }).format(new Date(value));
  } catch { return ''; }
};

export function travelCardHtml(item = {}) {
  const href = safeHttps(item.url);
  return `<article class="travel-card ${item.severity === 'major' ? 'major' : ''}"><div class="eyebrow small">${esc(item.source || 'Official feed')} · ${esc(item.severity || 'notice')}</div><h2>${esc(item.title || 'Travel advisory')}</h2>${item.road ? `<strong>${esc(item.road)}</strong>` : ''}<p>${esc(item.description || 'Open the official advisory for current details.')}</p>${item.updatedAt ? `<p class="source-line">Source reading: ${esc(formatUpdated(item.updatedAt))}</p>` : ''}${href ? `<a class="card-link" href="${esc(href)}" target="_blank" rel="noopener noreferrer">Open official advisory ↗</a>` : ''}</article>`;
}

export function travelPageShell(data = null, { origin = 'https://panjabiaagayeoye.com' } = {}) {
  const canonical = `${String(origin).replace(/\/$/, '')}/travel`;
  const items = Array.isArray(data?.items) ? data.items : [];
  const sources = Array.isArray(data?.sources) ? data.sources : TRAVEL_SOURCES;
  const errors = Array.isArray(data?.errors) ? data.errors : [];
  const majorCount = items.filter(item => item.severity === 'major').length;
  const sourceHtml = sources.map(source => {
    const href = safeHttps(source.url);
    return href ? `<a href="${esc(href)}" target="_blank" rel="noopener noreferrer">${esc(source.name)} ↗</a>` : '';
  }).join('');
  const cardsHtml = data
    ? (items.map(travelCardHtml).join('') || '<div class="empty">No border waits or major I-5 closures were returned. Check the official links; missing data does not mean no delays.</div>')
    : '';
  const updated = formatUpdated(data?.generatedAt);
  const summary = 'Canada-bound border wait estimates and major I-5 closures only. Use the U.S. border wait link for southbound crossings. Unavailable readings are not zero-minute waits.';
  const structured = JSON.stringify({
    '@context': 'https://schema.org', '@type': 'WebPage', name: 'Seattle–Vancouver Event Travel and Border Advisories',
    description: summary, url: canonical, ...(data?.generatedAt ? { dateModified: data.generatedAt } : {})
  }).replace(/</g, '\\u003c');
  return `<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><meta name="theme-color" content="#fff6df"><title>Seattle–Vancouver Event Travel &amp; Border Advisories — Panjabi Aa Gaye Oye</title><meta name="description" content="Border waits and major I-5 closures for Punjabi and South Asian event trips between Seattle and Vancouver."><link rel="canonical" href="${esc(canonical)}"><meta property="og:title" content="Seattle–Vancouver Event Travel &amp; Border Advisories"><meta property="og:description" content="Border wait estimates and major I-5 closures from WSDOT."><meta property="og:url" content="${esc(canonical)}"><meta property="og:type" content="website"><link rel="stylesheet" href="/styles.css"><script type="application/ld+json">${structured}</script></head><body><header class="site-header"><a class="brand-wrap" href="/"><div class="logo-mark">ਪੰ</div><div class="brand">PANJABI <span>AA GAYE OYE</span></div></a><a class="kids-adventure-link" href="/kids/index.html#journeys" aria-label="Panjabi Kids — Start an adventure!"><svg viewBox="0 0 24 24" width="24" height="24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M12 5v15M12 5C9 3 5 3 2 4v15c3-1 7-1 10 1 3-2 7-2 10-1V4c-3-1-7-1-10 1Z"/></svg><span><strong>Panjabi Kids</strong><small>Start an adventure!</small></span></a><nav class="nav" aria-label="Main navigation"><a href="/">Events</a><a href="/weekend">Weekend</a><a href="/history">History</a><a href="/news">Music News</a></nav></header><main class="shell"><section class="hero compact"><div class="eyebrow">✈ Seattle to Vancouver</div><h1>Know before<br><em>you go.</em></h1><p class="subhead">Border crossing waits and major I-5 closures only.</p></section><section class="travel-briefing"><div class="eyebrow small">Panjabi Aa Gaye Oye event-trip briefing</div><h2>What may affect the drive</h2><p>${esc(summary)}</p></section><div class="editorial-note"><strong>Check again before leaving.</strong> Conditions can change quickly. This page organizes official feeds for event travellers; use the linked agency notice for final routing and safety decisions.</div><section class="section"><div class="section-head"><div><div class="eyebrow small">Live travel board</div><h2>Current advisories</h2></div><div id="travelUpdated" class="count">${updated ? `Updated ${esc(updated)}` : ''}</div></div><div id="travelSources" class="travel-sources">${sourceHtml}</div><div id="loadingState" class="loading${data ? ' hidden' : ''}">Checking border waits and major I-5 closures…</div><div id="errorState" class="error${errors.length ? '' : ' hidden'}">${esc(errors.join(' · '))}</div><div id="travelGrid" class="travel-grid">${cardsHtml}</div></section></main><footer class="shell"><a class="brand-wrap" href="/"><div class="logo-mark">ਪੰ</div><div class="brand">PANJABI <span>AA GAYE OYE</span></div></a><p>Current corridor briefing · official source links · safer event travel</p></footer><script type="module">import{mountTravel}from'/app.js';mountTravel();</script></body></html>`;
}
