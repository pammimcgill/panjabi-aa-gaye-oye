import { esc } from './articles.js';

export const TRAVEL_SOURCES = [
  { name: 'WSDOT real-time map', url: 'https://wsdot.com/travel/real-time/' },
  { name: 'DriveBC map', url: 'https://www.drivebc.ca/' },
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

export async function fetchTravel(fetchImpl = fetch) {
  const driveUrl = 'https://api.open511.gov.bc.ca/events?status=ACTIVE&bbox=-123.45,48.98,-122.40,49.50&limit=100';
  const sources = [
    ['DriveBC', driveUrl, 'json'],
    ['WSDOT highway alerts', 'https://wsdot.wa.gov/traffic/api/HighwayAlerts/rss.aspx', 'rss'],
    ['WSDOT border crossings', 'https://wsdot.wa.gov/traffic/api/BorderCrossings/rss.aspx', 'rss']
  ];
  const settled = await Promise.allSettled(sources.map(async ([name, url, type]) => {
    const response = await fetchImpl(url, { headers: { accept: type === 'json' ? 'application/json' : 'application/rss+xml, application/xml;q=0.9', 'user-agent': 'PanjabiAaGayeOyeBot/3.9 (+https://panjabiaagayeoye.com/about-crawlers)' }, cf: { cacheEverything: true, cacheTtl: 300 } });
    if (!response.ok) throw new Error(`${name} HTTP ${response.status}`);
    return type === 'json' ? parseDriveBc(await response.json()) : parseWsdotRss(await response.text(), name);
  }));
  const items = settled.flatMap(x => x.status === 'fulfilled' ? x.value : []).sort((a, b) => Number(b.severity === 'major') - Number(a.severity === 'major') || new Date(b.updatedAt || 0) - new Date(a.updatedAt || 0));
  const errors = settled.map((x, i) => x.status === 'rejected' ? `${sources[i][0]} is temporarily unavailable` : '').filter(Boolean);
  return { items, errors, sources: TRAVEL_SOURCES, generatedAt: new Date().toISOString() };
}

export function travelPageShell() {
  return `<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><meta name="theme-color" content="#fff6df"><title>Seattle–Vancouver Travel — Panjabi Aa Gaye Oye</title><meta name="description" content="Official road closures, highway alerts and border travel links for trips between Seattle and Vancouver."><link rel="stylesheet" href="/styles.css"></head><body><header class="site-header"><a class="brand-wrap" href="/"><div class="logo-mark">ਪੰ</div><div class="brand">PANJABI <span>AA GAYE OYE</span></div></a><nav class="nav" aria-label="Main navigation"><a href="/">Events</a><a href="/weekend">Weekend</a><a class="active" href="/travel">Travel</a><a href="/history">History</a><a href="/news">Music News</a></nav></header><main class="shell"><section class="hero compact"><div class="eyebrow">✈ Seattle to Vancouver</div><h1>Know before<br><em>you go.</em></h1><p class="subhead">Official road closures, incidents and border resources for event trips along the I-5 and Lower Mainland corridor.</p></section><div class="editorial-note"><strong>Check again before leaving.</strong> Conditions can change quickly. This page summarizes official feeds; the agency links remain the authoritative source.</div><section class="section"><div class="section-head"><div><div class="eyebrow small">Live travel board</div><h2>Current advisories</h2></div><div id="travelUpdated" class="count"></div></div><div id="travelSources" class="travel-sources"></div><div id="loadingState" class="loading">Checking WSDOT and DriveBC…</div><div id="errorState" class="error hidden"></div><div id="travelGrid" class="travel-grid"></div></section></main><footer class="shell"><a class="brand-wrap" href="/"><div class="logo-mark">ਪੰ</div><div class="brand">PANJABI <span>AA GAYE OYE</span></div></a><p>Official links · current conditions · safer event travel</p></footer><script type="module">import{mountTravel}from'/app.js';mountTravel();</script></body></html>`;
}
