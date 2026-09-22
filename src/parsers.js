const ENTITY_MAP = {amp:'&',lt:'<',gt:'>',quot:'"',apos:"'",nbsp:' '};

export function decodeEntities(value='') {
  return String(value)
    .replace(/&#(x?[0-9a-f]+);/gi, (_, n) => String.fromCodePoint(n[0].toLowerCase()==='x' ? parseInt(n.slice(1),16) : parseInt(n,10)))
    .replace(/&([a-z]+);/gi, (m, n) => ENTITY_MAP[n.toLowerCase()] ?? m);
}

export function cleanText(value='') {
  return decodeEntities(String(value).replace(/<script[\s\S]*?<\/script>/gi,' ').replace(/<style[\s\S]*?<\/style>/gi,' ').replace(/<[^>]+>/g,' ').replace(/\s+/g,' ').trim());
}

export function absoluteUrl(value, base) {
  try { return new URL(value, base).href; } catch { return ''; }
}

function flattenJsonLd(node, out=[]) {
  if (Array.isArray(node)) node.forEach(x => flattenJsonLd(x,out));
  else if (node && typeof node === 'object') {
    if (node['@graph']) flattenJsonLd(node['@graph'],out);
    // Listing pages often wrap events in an ItemList: {itemListElement:[{item:{@type:'Event'}}]}
    if (node.itemListElement) flattenJsonLd(node.itemListElement,out);
    if (node.item && typeof node.item === 'object') flattenJsonLd(node.item,out);
    out.push(node);
  }
  return out;
}

export function jsonLdObjects(html) {
  const out=[];
  for (const match of String(html).matchAll(/<script[^>]+type=["']application\/ld\+json["'][^>]*>([\s\S]*?)<\/script>/gi)) {
    try { flattenJsonLd(JSON.parse(match[1].trim()),out); } catch {}
  }
  return out;
}

function typesOf(obj) {
  const types = Array.isArray(obj?.['@type']) ? obj['@type'] : [obj?.['@type']];
  return types.map(x => String(x||'').split('/').pop().toLowerCase()).filter(Boolean);
}

function typeIncludes(obj, wanted) {
  return typesOf(obj).includes(wanted.toLowerCase());
}

// schema.org has many kinds of Event (MusicEvent, TheaterEvent, ComedyEvent, SocialEvent,
// DanceEvent, Festival ...). Ticketing sites almost always use these subtypes, not plain Event.
export function isEventType(obj) {
  return typesOf(obj).some(t => t === 'festival' || t.endsWith('event'));
}

function namesOf(value) {
  return [].concat(value || []).map(x => typeof x === 'string' ? x : x?.name).map(x => cleanText(x || '')).filter(Boolean);
}

function imageOf(obj) {
  const image = Array.isArray(obj?.image) ? obj.image[0] : obj?.image;
  return typeof image === 'string' ? image : image?.url || image?.contentUrl || '';
}

export function extractJsonLdEvents(html, pageUrl) {
  return jsonLdObjects(html).filter(isEventType).map((x,index) => {
    const place = (Array.isArray(x.location) ? x.location[0] : x.location) || {};
    const address = typeof place.address === 'object' && place.address ? place.address : {};
    const offer = Array.isArray(x.offers) ? x.offers[0] : x.offers;
    return {
      sourceEventId: String((typeof x.identifier === 'object' && x.identifier ? x.identifier.value : x.identifier) || x['@id'] || `${pageUrl}#${index}`),
      title: cleanText(x.name),
      description: cleanText(x.description),
      startsAt: x.startDate || '', endsAt: x.endDate || null,
      venue: cleanText(place.name),
      venueAddress: cleanText([address.streetAddress, address.addressLocality, address.addressRegion, address.postalCode].filter(Boolean).join(', ')),
      city: cleanText(address.addressLocality),
      regionCode: cleanText(address.addressRegion),
      performers: [...namesOf(x.performer), ...namesOf(x.performers)],
      status: String(x.eventStatus || ''),
      url: absoluteUrl(x.url || offer?.url || pageUrl, pageUrl),
      imageUrl: absoluteUrl(imageOf(x), pageUrl)
    };
  }).filter(x => x.title && x.startsAt && x.url && !/cancel/i.test(x.status));
}

export function extractJsonLdArticles(html, pageUrl) {
  return jsonLdObjects(html).filter(x => ['Article','NewsArticle','BlogPosting'].some(t=>typeIncludes(x,t))).map((x,index)=>({
    title:cleanText(x.headline||x.name),
    dek:cleanText(x.description),
    url:absoluteUrl(x.url||x.mainEntityOfPage?.['@id']||x['@id']||pageUrl,pageUrl),
    publishedAt:x.datePublished||x.dateModified||new Date().toISOString(),
    author:cleanText(Array.isArray(x.author)?x.author.map(a=>a.name).join(', '):x.author?.name||x.author),
    imageUrl:absoluteUrl(imageOf(x),pageUrl),
    sourceItemId:String(x.identifier||x['@id']||`${pageUrl}#${index}`)
  })).filter(x=>x.title&&x.url);
}

export function discoverEventLinks(html, pageUrl, limit=36) {
  const origin = new URL(pageUrl).origin;
  const links=[];
  for (const m of String(html).matchAll(/<a\b[^>]*href=["']([^"']+)["'][^>]*>([\s\S]*?)<\/a>/gi)) {
    const href=absoluteUrl(m[1],pageUrl).split('#')[0]; const label=cleanText(m[2]);
    if (!href || !href.startsWith(origin) || !label || /privacy|contact|about|login|calendar view/i.test(label)) continue;
    if (/event|show|concert|program|kirtan|vaisakhi|baisakhi|mela|tour|theatre|theater/i.test(`${href} ${label}`)) links.push({href,label});
  }
  return [...new Map(links.map(x=>[x.href,x])).values()].slice(0,limit);
}

export function discoverLinks(html,pageUrl,pattern=/.*/,limit=36){
  const origin=new URL(pageUrl).origin; const links=[];
  for(const m of String(html).matchAll(/<a\b[^>]*href=["']([^"']+)["'][^>]*>([\s\S]*?)<\/a>/gi)){
    const href=absoluteUrl(m[1],pageUrl).split('#')[0]; const label=cleanText(m[2]);
    if(!href||!href.startsWith(origin)||!label||!pattern.test(`${href} ${label}`)) continue;
    links.push({href,label});
  }
  return [...new Map(links.map(x=>[x.href,x])).values()].slice(0,limit);
}

function tagValue(xml, tag) {
  const m=String(xml).match(new RegExp(`<${tag}(?:\\s[^>]*)?>([\\s\\S]*?)<\\/${tag}>`,'i'));
  return m ? cleanText(m[1].replace(/<!\[CDATA\[([\s\S]*?)\]\]>/g,'$1')) : '';
}

function atomLink(xml) {
  const m=String(xml).match(/<link\b[^>]*href=["']([^"']+)["'][^>]*>/i);
  return m?.[1] || tagValue(xml,'link');
}

function firstImageInHtml(item) {
  // Feeds often embed the picture inside the (escaped or CDATA) description HTML.
  const html=decodeEntities(String(item).replace(/<!\[CDATA\[([\s\S]*?)\]\]>/g,'$1'));
  const m=html.match(/<img\b[^>]*?\bsrc=["']([^"']+)["']/i);
  return m?m[1]:'';
}

export function parseFeed(xml, sourceUrl) {
  const blocks=[...String(xml).matchAll(/<(item|entry)\b[^>]*>([\s\S]*?)<\/\1>/gi)].map(m=>m[2]);
  return blocks.map((item,index)=>({
    title:tagValue(item,'title'),
    dek:tagValue(item,'description') || tagValue(item,'summary') || tagValue(item,'content'),
    url:absoluteUrl(atomLink(item),sourceUrl),
    // Left empty when the feed gives no date, so the collector can keep the first-seen date
    // instead of making an undated story look brand new on every refresh.
    publishedAt:tagValue(item,'pubDate') || tagValue(item,'published') || tagValue(item,'updated') || tagValue(item,'dc:date') || '',
    author:tagValue(item,'dc:creator') || tagValue(item,'author'),
    imageUrl:absoluteUrl((item.match(/<(?:media:content|media:thumbnail|enclosure)\b[^>]*(?:url|href)=["']([^"']+)["']/i)||[])[1]||firstImageInHtml(item),sourceUrl),
    sourceItemId:tagValue(item,'guid') || `${sourceUrl}#${index}`
  })).filter(x=>x.title && x.url);
}

// Reads Open Graph / article meta tags. Most news and blog pages have these even when they have
// no schema.org data.
export function extractOpenGraph(html, pageUrl) {
  const meta={};
  for (const tag of String(html).matchAll(/<meta\b[^>]*>/gi)) {
    const attrs={};
    for (const a of tag[0].matchAll(/([a-zA-Z:_-]+)\s*=\s*("([^"]*)"|'([^']*)')/g)) attrs[a[1].toLowerCase()]=a[3]??a[4]??'';
    const key=(attrs.property||attrs.name||'').toLowerCase();
    if (key && attrs.content && !(key in meta)) meta[key]=decodeEntities(attrs.content).trim();
  }
  const titleTag=String(html).match(/<title[^>]*>([\s\S]*?)<\/title>/i);
  return {
    title:cleanText(meta['og:title']||meta['twitter:title']||(titleTag?titleTag[1]:'')),
    dek:cleanText(meta['og:description']||meta['description']||meta['twitter:description']||''),
    imageUrl:absoluteUrl(meta['og:image']||meta['twitter:image']||'',pageUrl),
    publishedAt:meta['article:published_time']||meta['og:published_time']||meta['date']||'',
    author:cleanText(meta['author']||meta['article:author']||''),
    siteName:cleanText(meta['og:site_name']||'')
  };
}

export function stableId(prefix, value) {
  let h=2166136261;
  for (const c of String(value)) { h ^= c.charCodeAt(0); h = Math.imul(h,16777619); }
  return `${prefix}-${(h>>>0).toString(36)}`;
}

export function safeDate(value) {
  const d=new Date(value); return Number.isFinite(d.getTime()) ? d.toISOString() : '';
}
