import {
  EVENT_SOURCES, NEWS_SOURCES, HISTORY_SOURCES, SEATGEEK_SEARCHES, TICKETMASTER_AREAS, TICKETMASTER_KEYWORDS,
  EVENTBRITE_SEARCH_URLS, EVENT_TERMS, NEWS_TERMS, NEWS_MAX_AGE_DAYS, REFRESH_GROUPS, groupForTime,
  matchText, hasTerm, relevant, categoryFor, screenEventIdentity
} from './config.js';
import {
  cleanText, discoverEventLinks, discoverLinks, extractJsonLdEvents, extractJsonLdArticles,
  parseFeed, extractOpenGraph, safeDate, stableId
} from './parsers.js';

const UA='PanjabiAaGayeOyeBot/3.9 (+https://panjabiaagayeoye.com/about-crawlers)';

// Cloudflare limits how many outbound requests one Worker run may make (50 on the free plan).
// Every run only collects one group of sources and stops at this budget. Raise FETCH_BUDGET
// (a plain variable in wrangler.toml) only if you are on a paid Workers plan.
export const DEFAULT_FETCH_BUDGET=36;
export const DETAIL_LINKS_PER_SOURCE=5;
export const HISTORY_PAGES_PER_RUN=6;
export const NEWS_MAX_PER_FEED=40;

export function newRun(env={}) {
  const limit=Number(env?.FETCH_BUDGET);
  return {fetches:0,limit:Number.isFinite(limit)&&limit>0?limit:DEFAULT_FETCH_BUDGET,delayMs:220};
}

function spend(run){
  if(!run) return;
  if(run.fetches>=run.limit) throw new Error('Request budget reached for this run');
  run.fetches++;
}

const sleep=ms=>ms>0?new Promise(resolve=>setTimeout(resolve,ms)):Promise.resolve();

async function getText(url,run) {
  spend(run);
  const res=await fetch(url,{headers:{'User-Agent':UA,'Accept':'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.5'},redirect:'follow'});
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  return {text:await res.text(),url:res.url||url};
}

async function getJson(url,run) {
  spend(run);
  const res=await fetch(url,{headers:{Accept:'application/json','User-Agent':UA}});
  if (!res.ok) throw new Error(`API HTTP ${res.status}`);
  return res.json();
}

// ---------------------------------------------------------------------------
// Source health
// ---------------------------------------------------------------------------
function newDiag(){ return {raw:0,rejected:0,duplicates:0,linksFound:0,linksFollowed:0,samples:[],reasons:{},note:null}; }

const STATUS_LEGACY_SQL=`INSERT INTO source_status
  (source_key,source_name,source_url,source_type,last_run_at,last_success_at,last_count,last_error)
  VALUES(?,?,?,?,?,?,?,?)
  ON CONFLICT(source_key) DO UPDATE SET
    source_name=excluded.source_name, source_url=excluded.source_url,
    source_type=excluded.source_type, last_run_at=excluded.last_run_at,
    last_success_at=CASE WHEN excluded.last_error IS NULL THEN excluded.last_success_at ELSE source_status.last_success_at END,
    last_count=excluded.last_count, last_error=excluded.last_error`;

const STATUS_FULL_SQL=`INSERT INTO source_status
  (source_key,source_name,source_url,source_type,last_run_at,last_success_at,last_count,last_error,
   raw_count,rejected_count,links_followed,sample_rejected,note)
  VALUES(?,?,?,?,?,?,?,?,?,?,?,?,?)
  ON CONFLICT(source_key) DO UPDATE SET
    source_name=excluded.source_name, source_url=excluded.source_url,
    source_type=excluded.source_type, last_run_at=excluded.last_run_at,
    last_success_at=CASE WHEN excluded.last_error IS NULL THEN excluded.last_success_at ELSE source_status.last_success_at END,
    last_count=excluded.last_count, last_error=excluded.last_error,
    raw_count=excluded.raw_count, rejected_count=excluded.rejected_count,
    links_followed=excluded.links_followed, sample_rejected=excluded.sample_rejected, note=excluded.note`;

export async function setSourceStatus(db, source, count, error=null, diag=null) {
  const now=new Date().toISOString();
  const base=[source.key,source.name,source.url,source.type||'feed',now,error?null:now,count,error?String(error).slice(0,500):null];
  try {
    await db.prepare(STATUS_FULL_SQL).bind(...base,
      diag?diag.raw:null, diag?diag.rejected:null, diag?diag.linksFollowed:null,
      diag&&diag.samples.length?JSON.stringify(diag.samples):null, diag?.note||null).run();
  } catch {
    // The diagnostics columns arrive with migration 0004. Until it is applied, keep working.
    await db.prepare(STATUS_LEGACY_SQL).bind(...base).run();
  }
}

// ---------------------------------------------------------------------------
// Event normalization
// ---------------------------------------------------------------------------
const ALLOWED_CATEGORIES=new Set(['religious','concert','comedy','theatre','nightlife','festival','community']);

function withPerformers(description,performers,title){
  const names=performers.filter(name=>!hasTerm(title,name)).slice(0,4);
  if(!names.length) return description;
  return description?`Featuring ${names.join(', ')} — ${description}`:`Featuring ${names.join(', ')}`;
}

export function splitFeaturing(description=''){
  const match=/^Featuring (.+?)(?: — |$)/.exec(String(description));
  return match?match[1].split(', ').filter(Boolean):[];
}

export function evaluateEvent(raw, source) {
  const startsAt=safeDate(raw.startsAt);
  if (!startsAt) return {event:null,reason:'invalid_or_missing_date'};
  if (new Date(startsAt).getTime() < Date.now()-86400000 && !source.allowPast) return {event:null,reason:'past_event'};
  const screening=screenEventIdentity(raw,source);
  if (!screening.keep) return {event:null,reason:screening.reason};
  const url=raw.url || source.url;
  const performers=[].concat(raw.performers||[]).map(x=>cleanText(x)).filter(Boolean);
  const combined=`${raw.title} ${raw.description} ${raw.venue} ${raw.city}`;
  const suppliedCategory=String(raw.category||'').toLowerCase().trim();
  // Sources that give every occurrence its own stable ID (Ticketmaster, SeatGeek, GitHub issues)
  // are updated in place if the time changes. Page scrapers reuse one ID for many dates, so the
  // start time is part of the key for them.
  const baseId=String(raw.sourceEventId||url);
  const sourceEventId=raw.idIsUnique?baseId:`${baseId}|${startsAt}`;
  return {reason:screening.reason,event:{
    id:stableId('evt',`${source.key}|${sourceEventId}`),
    title:cleanText(raw.title),
    description:withPerformers(cleanText(raw.description),performers,raw.title).slice(0,700),
    category:ALLOWED_CATEGORIES.has(suppliedCategory)?suppliedCategory:categoryFor(combined,source.type),
    region:source.region,
    city:cleanText(raw.city)||source.city||'', venue:cleanText(raw.venue)||source.name,
    venueAddress:cleanText(raw.venueAddress)||'', performers:performers.join('|'),
    startsAt, endsAt:safeDate(raw.endsAt)||null, url, imageUrl:raw.imageUrl||null,
    videoUrl:/^https:\/\//i.test(raw.videoUrl||'')?String(raw.videoUrl).trim():'', videoCaption:cleanText(raw.videoCaption||''),
    sourceName:source.name, sourceKind:source.type||'web', sourceEventId
  }};
}

export function normalizeEvent(raw, source) {
  return evaluateEvent(raw,source).event;
}

// Screens raw events, records why events were rejected, and removes duplicates.
export function screenAll(items, diag) {
  const events=[];
  for (const {raw,source} of items) {
    diag.raw++;
    const result=evaluateEvent(raw,source);
    if (result.event) { events.push(result.event); continue; }
    diag.rejected++;
    diag.reasons[result.reason]=(diag.reasons[result.reason]||0)+1;
    if (result.reason!=='past_event' && diag.samples.length<5) diag.samples.push({title:String(raw.title||'').slice(0,80),reason:result.reason});
  }
  const seen=new Set(); const unique=[];
  for (const e of events) {
    const keys=[e.id,`${e.title.toLowerCase()}|${e.startsAt}`];
    if (keys.some(k=>seen.has(k))) continue;
    keys.forEach(k=>seen.add(k)); unique.push(e);
  }
  diag.duplicates=events.length-unique.length;
  return unique;
}

// ---------------------------------------------------------------------------
// Storage
// ---------------------------------------------------------------------------
const UPSERT_SQL=`INSERT INTO hub_events
  (id,title,description,category,region,city,venue,venue_address,performers,starts_at,ends_at,url,image_url,video_url,video_caption,source_name,source_kind,source_event_id,last_seen_at,is_active)
  VALUES(?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,CURRENT_TIMESTAMP,1)
  ON CONFLICT(source_name, source_event_id) DO UPDATE SET title=excluded.title,description=excluded.description,
    category=excluded.category,region=excluded.region,city=excluded.city,venue=excluded.venue,venue_address=excluded.venue_address,performers=excluded.performers,
    starts_at=excluded.starts_at,ends_at=excluded.ends_at,url=excluded.url,image_url=excluded.image_url,
    video_url=excluded.video_url,video_caption=excluded.video_caption,source_kind=excluded.source_kind,last_seen_at=CURRENT_TIMESTAMP,is_active=1`;

// The table is unique on (source_name, source_event_id). Conflicts on that key used to abort the
// whole batch (and every event in it). Now they update the existing row, and if a batch still
// fails each row is retried alone so one bad row cannot hide the rest.
export async function upsertEvents(db, events) {
  if (!events.length) return {stored:0,failed:0};
  const statements=events.map(e=>db.prepare(UPSERT_SQL).bind(e.id,e.title,e.description,e.category,e.region,e.city,e.venue,e.venueAddress,e.performers,e.startsAt,e.endsAt,e.url,e.imageUrl,e.videoUrl,e.videoCaption,e.sourceName,e.sourceKind,e.sourceEventId));
  let stored=0, failed=0;
  for (let i=0;i<statements.length;i+=50) {
    const chunk=statements.slice(i,i+50);
    try { await db.batch(chunk); stored+=chunk.length; }
    catch {
      for (const statement of chunk) { try { await statement.run(); stored++; } catch { failed++; } }
    }
  }
  return {stored,failed};
}

async function finishSource(db, source, events, diag) {
  const written=await upsertEvents(db,events);
  if (written.failed) diag.note=[diag.note,`${written.failed} event(s) could not be saved`].filter(Boolean).join('; ');
  await setSourceStatus(db,source,written.stored,null,diag);
  return {source:source.key,count:written.stored,found:diag.raw,rejected:diag.rejected,linksFollowed:diag.linksFollowed,reasons:diag.reasons,note:diag.note};
}

async function failSource(db, source, error) {
  await setSourceStatus(db,source,0,error.message);
  return {source:source.key,count:0,error:error.message};
}

// ---------------------------------------------------------------------------
// Venue, Gurdwara and community pages
// ---------------------------------------------------------------------------
// Picks which event pages on a listing are worth opening. Venue calendars list everything, so only
// links that look South Asian are opened. Small Gurdwara or community sites have few links, so any
// event-looking link is a candidate, with the South Asian-looking ones first.
export function pickDetailLinks(links, source, pageUrl='', max=DETAIL_LINKS_PER_SOURCE) {
  const self=String(pageUrl).split('#')[0];
  const candidates=links.filter(link=>link.href!==self);
  const decode=value=>{ try { return decodeURIComponent(value); } catch { return value; } };
  const looksRelevant=link=>relevant(`${link.label} ${decode(link.href)}`,EVENT_TERMS);
  const matching=candidates.filter(looksRelevant);
  if (source.type==='venue' && !source.trusted) return matching.slice(0,max);
  return [...matching,...candidates.filter(link=>!matching.includes(link))].slice(0,max);
}

async function collectWebSource(db, source, run) {
  const diag=newDiag();
  try {
    const first=await getText(source.url,run);
    const items=extractJsonLdEvents(first.text,first.url).map(raw=>({raw,source}));
    const allLinks=discoverEventLinks(first.text,first.url,80);
    const links=pickDetailLinks(allLinks,source,first.url);
    diag.linksFound=allLinks.length; diag.linksFollowed=links.length;
    const settled=await Promise.allSettled(links.map(async link=>{
      const page=await getText(link.href,run); return extractJsonLdEvents(page.text,page.url);
    }));
    let unreadable=0;
    for (const item of settled) {
      if (item.status==='fulfilled') items.push(...item.value.map(raw=>({raw,source}))); else unreadable++;
    }
    if (unreadable) diag.note=`${unreadable} event page(s) could not be read`;
    return await finishSource(db,source,screenAll(items,diag),diag);
  } catch(error) { return failSource(db,source,error); }
}

// ---------------------------------------------------------------------------
// Ticketmaster
// ---------------------------------------------------------------------------
const TICKETMASTER_STATUS={
  core:{key:'ticketmaster',name:'Ticketmaster'},
  artistsA:{key:'ticketmaster-artists-a',name:'Ticketmaster (artist search 1)'},
  artistsB:{key:'ticketmaster-artists-b',name:'Ticketmaster (artist search 2)'},
  comedyA:{key:'ticketmaster-comedy-a',name:'Ticketmaster (comedy search 1)'},
  comedyB:{key:'ticketmaster-comedy-b',name:'Ticketmaster (comedy search 2)'}
};
export const TICKETMASTER_STATUS_KEYS=Object.values(TICKETMASTER_STATUS).map(x=>x.key);

export function ticketmasterEvent(item={}){
  if (String(item.dates?.status?.code||'').toLowerCase()==='cancelled') return null;
  const venue=item?._embedded?.venues?.[0]||{};
  const performers=(item?._embedded?.attractions||[]).map(a=>a.name).filter(Boolean);
  const image=[...(item.images||[])].sort((a,b)=>(b.width||0)-(a.width||0))[0]?.url||'';
  const kind=item.classifications?.[0]||{};
  const category=/comedy/i.test(`${kind.genre?.name||''} ${kind.subGenre?.name||''}`)?'comedy':'';
  return {sourceEventId:String(item.id||item.url),idIsUnique:true,title:item.name||'',performers,
    description:cleanText(`${item.info||''} ${item.pleaseNote||''}`),
    startsAt:item.dates?.start?.dateTime||item.dates?.start?.localDate,endsAt:null,
    venue:venue.name||'',city:venue.city?.name||'',url:item.url||'',imageUrl:image,category};
}

export async function collectTicketmaster(env, run=newRun(env), set='core'){
  const eventSource={key:'ticketmaster',name:'Ticketmaster',url:'https://app.ticketmaster.com/discovery/v2/events.json',type:'ticketing'};
  const statusSource={...eventSource,...(TICKETMASTER_STATUS[set]||TICKETMASTER_STATUS.core)};
  if(!env.TICKETMASTER_API_KEY){await setSourceStatus(env.DB,statusSource,0,'Waiting for TICKETMASTER_API_KEY');return {source:statusSource.key,count:0,disabled:true};}
  const diag=newDiag(); const items=[]; const errors=[]; let requests=0;
  for(const area of TICKETMASTER_AREAS){
    for(const keyword of TICKETMASTER_KEYWORDS[set]||[]){
      const p=new URLSearchParams({apikey:env.TICKETMASTER_API_KEY,keyword,latlong:area.latlong,radius:'100',unit:'miles',countryCode:area.countryCode,
        startDateTime:new Date().toISOString().replace(/\.\d{3}Z$/,'Z'),size:'50',sort:'date,asc'});
      try{
        requests++;
        const data=await getJson(`${eventSource.url}?${p}`,run);
        const source={...eventSource,region:area.region};
        for(const row of data?._embedded?.events||[]){ const raw=ticketmasterEvent(row); if(raw) items.push({raw,source}); }
      }catch(error){ errors.push(error.message); }
      await sleep(run.delayMs); // Ticketmaster allows about 5 requests per second
    }
  }
  if(requests&&errors.length===requests){ await setSourceStatus(env.DB,statusSource,0,errors[0]); return {source:statusSource.key,count:0,error:errors[0]}; }
  if(errors.length) diag.note=`${errors.length} of ${requests} searches failed (${errors[0]})`;
  const events=screenAll(items,diag);
  return finishSource(env.DB,statusSource,events,diag);
}

// ---------------------------------------------------------------------------
// Eventbrite
// ---------------------------------------------------------------------------
function eventbriteLinks(html,base,region){
  const rows=[];
  for(const match of String(html).matchAll(/href=["']([^"']*eventbrite\.(?:com|ca)\/e\/[^"'#?]+(?:\?[^"'#]*)?)["']/gi)){
    try{const url=new URL(match[1].replace(/&amp;/g,'&'),base);url.hash='';for(const key of [...url.searchParams.keys()])if(/^(aff|utm_|ref|discount)/i.test(key))url.searchParams.delete(key);rows.push({url:url.toString(),region});}catch{}
  }
  return [...new Map(rows.map(x=>[x.url,x])).values()];
}

export async function collectEventbrite(env, run=newRun(env)){
  const baseSource={key:'eventbrite',name:'Eventbrite',url:'https://www.eventbrite.com/',type:'ticketing'};
  const diag=newDiag();
  try{
    const items=[]; const rotation=Math.floor(Date.now()/(20*60*1000)); const pages=[];
    for(const search of EVENTBRITE_SEARCH_URLS){
      const source={...baseSource,region:search.region};
      const page=await getText(search.url,run);
      // Some search pages list their events in structured data; use those directly.
      items.push(...extractJsonLdEvents(page.text,page.url).map(raw=>({raw,source})));
      const found=eventbriteLinks(page.text,page.url,search.region);
      diag.linksFound+=found.length;
      for(let i=0;i<Math.min(2,found.length);i++) pages.push(found[(rotation+i)%found.length]);
    }
    const uniquePages=[...new Map(pages.map(x=>[x.url,x])).values()].slice(0,8);
    diag.linksFollowed=uniquePages.length;
    for(const link of uniquePages){
      try{const page=await getText(link.url,run);const source={...baseSource,region:link.region};items.push(...extractJsonLdEvents(page.text,page.url).map(raw=>({raw,source})));}catch{}
    }
    return await finishSource(env.DB,baseSource,screenAll(items,diag),diag);
  }catch(error){return failSource(env.DB,baseSource,error);}
}

// ---------------------------------------------------------------------------
// GitHub manual events
// ---------------------------------------------------------------------------
function githubHeaders(env){const headers={accept:'application/vnd.github+json','user-agent':UA,'x-github-api-version':'2022-11-28'};if(env.GITHUB_TOKEN)headers.authorization=`Bearer ${env.GITHUB_TOKEN}`;return headers;}

function githubRepo(env){return String(env.GITHUB_REPO||'').trim().replace(/^https?:\/\/github\.com\//,'').replace(/\/$/,'');}

export function issueField(body,label){
  const plain=String(body||'').replace(/```[a-z]*\s*/gi,'').replace(/```/g,'');
  const escaped=label.replace(/[.*+?^${}()|[\]\\]/g,'\\$&');
  const match=plain.match(new RegExp(`###\\s+${escaped}\\s*\\n([\\s\\S]*?)(?=\\n###\\s|$)`,'i'));
  const value=cleanText(match?.[1]||'');return /^_?no response_?$/i.test(value)?'':value;
}

export async function collectGithubEvents(env, run=newRun(env)){
  // Manual entries may describe an earlier show so the site can preserve it as an event memory.
  const source={key:'github-events',name:'GitHub manual events',url:'https://github.com/',type:'manual',region:'Seattle',allowPast:true};
  const repo=githubRepo(env);
  if(!/^[\w.-]+\/[\w.-]+$/.test(repo)){await setSourceStatus(env.DB,source,0,'Waiting for GITHUB_REPO');return {source:source.key,count:0,disabled:true};}
  const diag=newDiag();
  try{
    spend(run);
    const response=await fetch(`https://api.github.com/repos/${repo}/issues?state=open&labels=approved&sort=updated&direction=desc&per_page=50`,{headers:githubHeaders(env)});
    if(!response.ok)throw new Error(`GitHub API HTTP ${response.status}`);
    const issues=await response.json();const candidates=issues.filter(x=>!x.pull_request&&((x.labels||[]).some(label=>(typeof label==='string'?label:label.name)==='event')||/###\s+Event (?:title|link)/i.test(x.body||'')));
    const items=[];let linkFetches=0;
    for(const issue of candidates){
      const body=issue.body||'';const eventLink=issueField(body,'Event link');let parsed={};
      const suppliedTitle=issueField(body,'Event title');const suppliedStart=issueField(body,'Start date and time');
      if(eventLink&&(!suppliedTitle||!suppliedStart)&&linkFetches<3){
        try{linkFetches++;const page=await getText(eventLink,run);parsed=extractJsonLdEvents(page.text,page.url)[0]||{};}catch{}
      }
      const regionText=issueField(body,'Region');const region=/vancouver|british columbia|\bbc\b/i.test(regionText)?'Vancouver':'Seattle';
      const suppliedPerformers=issueField(body,'Artist or performers').split(/[,;\n]/).map(x=>x.trim()).filter(Boolean);
      const raw={sourceEventId:String(issue.number),idIsUnique:true,title:suppliedTitle||parsed.title||String(issue.title||'').replace(/^\[event\]\s*/i,''),description:issueField(body,'Description')||parsed.description||'',startsAt:suppliedStart||parsed.startsAt||'',endsAt:parsed.endsAt||null,venue:issueField(body,'Venue')||parsed.venue||'',venueAddress:issueField(body,'Venue address')||parsed.venueAddress||'',performers:suppliedPerformers.length?suppliedPerformers:parsed.performers||[],city:issueField(body,'City')||parsed.city||'',url:eventLink||parsed.url||issue.html_url,imageUrl:issueField(body,'Image URL')||parsed.imageUrl||'',videoUrl:issueField(body,'Video URL'),videoCaption:issueField(body,'Video caption'),category:issueField(body,'Category')};
      items.push({raw,source:{...source,region}});
    }
    const events=screenAll(items,diag);
    // Closing an issue (or removing its `approved` label) takes the event off the site.
    try{
      const keep=events.map(e=>e.sourceEventId);
      await env.DB.prepare(`UPDATE hub_events SET is_active=0 WHERE source_name=? AND is_active=1${keep.length?` AND source_event_id NOT IN (${keep.map(()=>'?').join(',')})`:''}`).bind(source.name,...keep).run();
    }catch{}
    return await finishSource(env.DB,source,events,diag);
  }catch(error){return failSource(env.DB,source,error);}
}

// ---------------------------------------------------------------------------
// SeatGeek
// ---------------------------------------------------------------------------
export function seatGeekEvent(raw) {
  const venue=raw.venue||{};
  return {
    sourceEventId:String(raw.id),idIsUnique:true,title:raw.title||raw.short_title||'',
    performers:(raw.performers||[]).map(x=>x.name).filter(Boolean),
    description:raw.description||'Event and ticket details available through SeatGeek.',
    startsAt:raw.datetime_utc?`${raw.datetime_utc}${/[zZ]|[+-]\d\d:?\d\d$/.test(raw.datetime_utc)?'':'Z'}`:raw.datetime_local, endsAt:null, venue:venue.name||'',
    city:venue.city||'',url:raw.url||'',imageUrl:(raw.performers||[]).find(x=>x.image)?.image||''
  };
}

export async function collectSeatGeek(env, run=newRun(env)) {
  const source={key:'seatgeek',name:'SeatGeek',url:'https://api.seatgeek.com/2/events',type:'ticketing',region:'Seattle'};
  if(!env.SEATGEEK_CLIENT_ID){
    await setSourceStatus(env.DB,source,0,'Waiting for SEATGEEK_CLIENT_ID');
    return {source:'seatgeek',count:0,disabled:true};
  }
  const diag=newDiag();
  try{
    const items=[];
    for(const search of SEATGEEK_SEARCHES){
      const p=new URLSearchParams({client_id:env.SEATGEEK_CLIENT_ID,q:search.q,lat:String(search.lat),lon:String(search.lon),range:'100mi',per_page:'100','datetime_utc.gte':new Date().toISOString().slice(0,19)});
      const data=await getJson(`https://api.seatgeek.com/2/events?${p}`,run);
      const s={...source,region:search.region};
      for(const row of data.events||[]) items.push({raw:seatGeekEvent(row),source:s});
    }
    return await finishSource(env.DB,source,screenAll(items,diag),diag);
  }catch(error){ return failSource(env.DB,source,error); }
}

// ---------------------------------------------------------------------------
// News and history
// ---------------------------------------------------------------------------
// published_at is only ever set when a story is first stored. Feeds without dates used to be stamped
// "now" on every refresh, which kept old stories at the top of the page.
const CONTENT_INSERT_SQL=section=>`INSERT INTO content_items
  (id,section,title,dek,body,canonical_url,image_url,source_name,author,published_at,status)
  VALUES(?,'${section}',?,?,?,?,?,?,?,?, 'published')
  ON CONFLICT(canonical_url) DO UPDATE SET title=excluded.title,dek=excluded.dek,
    image_url=COALESCE(excluded.image_url,content_items.image_url),source_name=excluded.source_name,
    author=COALESCE(excluded.author,content_items.author)`;

async function storeContent(db, section, rows, source, dekMax) {
  if (!rows.length) return 0;
  const stmt=db.prepare(CONTENT_INSERT_SQL(section));
  const statements=rows.map(x=>stmt.bind(stableId(section==='music'?'news':'history',x.url),x.title,cleanText(x.dek).slice(0,dekMax),'',x.url,x.imageUrl||null,source.name,x.author||null,safeDate(x.publishedAt)||new Date().toISOString()));
  for (let i=0;i<statements.length;i+=50) await db.batch(statements.slice(i,i+50));
  return rows.length;
}

export async function collectNewsSource(db,source,run){
  const diag=newDiag(); const status={...source,type:'news'};
  try {
    const feed=await getText(source.url,run);
    const rows=parseFeed(feed.text,feed.url);
    diag.raw=rows.length;
    const cutoff=Date.now()-NEWS_MAX_AGE_DAYS*86400000; const seen=new Set(); const keep=[];
    for (const row of rows) {
      const published=safeDate(row.publishedAt);
      let reason=null;
      if (published && new Date(published).getTime()<cutoff) reason='too_old';
      else if (!source.trusted && !relevant(`${row.title} ${row.dek}`,NEWS_TERMS)) reason='no_music_keyword';
      else if (seen.has(matchText(row.title))) reason='duplicate';
      if (reason) {
        diag.rejected++;
        if (reason==='no_music_keyword' && diag.samples.length<5) diag.samples.push({title:row.title.slice(0,80),reason});
        continue;
      }
      seen.add(matchText(row.title)); keep.push({...row,publishedAt:published});
    }
    const stored=await storeContent(db,'music',keep.slice(0,NEWS_MAX_PER_FEED),source,360);
    await setSourceStatus(db,status,stored,null,diag);
    return {source:source.key,count:stored,found:diag.raw,rejected:diag.rejected};
  }
  catch(error){ await setSourceStatus(db,status,0,error.message); return {source:source.key,count:0,error:error.message}; }
}

function cleanArticleTitle(title, siteName) {
  const t=String(title||'').trim();
  if (!siteName) return t;
  const m=t.match(/^(.*\S)\s*[|–—-]\s*(.+)$/);
  return m && matchText(m[2])===matchText(siteName) ? m[1] : t;
}

async function knownUrls(db, urls) {
  const known=new Set();
  for (let i=0;i<urls.length;i+=50) {
    const chunk=urls.slice(i,i+50);
    const found=await db.prepare(`SELECT canonical_url FROM content_items WHERE canonical_url IN (${chunk.map(()=>'?').join(',')})`).bind(...chunk).all();
    for (const row of found.results||[]) known.add(row.canonical_url);
  }
  return known;
}

// Scans a listing page for article links, opens the ones not stored yet (a few per run, so the
// archive fills in over several runs) and reads each article's title, summary, picture and date.
export async function collectHistorySource(db,source,run){
  const diag=newDiag();
  try {
    const page=await getText(source.url,run);
    const self=page.url.split('#')[0];
    const articles=new Map();
    for (const a of extractJsonLdArticles(page.text,page.url)) if (a.url.split('#')[0]!==self) articles.set(a.url,a);
    const pattern=new RegExp(source.pathPattern||'^/.+');
    const links=discoverLinks(page.text,page.url,/./,300).filter(link=>{
      try { const u=new URL(link.href); return link.href!==self && pattern.test(u.pathname); } catch { return false; }
    });
    diag.linksFound=links.length; diag.raw=links.length+[...articles.keys()].filter(u=>!links.some(l=>l.href===u)).length;
    const known=await knownUrls(db,links.map(l=>l.href).filter(u=>!articles.has(u)));
    const fresh=links.filter(l=>!known.has(l.href)&&!articles.has(l.href)).slice(0,HISTORY_PAGES_PER_RUN);
    diag.linksFollowed=fresh.length;
    const settled=await Promise.allSettled(fresh.map(async link=>{
      const detail=await getText(link.href,run);
      const ld=extractJsonLdArticles(detail.text,detail.url).find(a=>a.title);
      const og=extractOpenGraph(detail.text,detail.url);
      const title=cleanArticleTitle(ld?.title||og.title||link.label,og.siteName);
      return {title,dek:ld?.dek||og.dek,url:link.href,imageUrl:ld?.imageUrl||og.imageUrl||null,publishedAt:ld?.publishedAt||og.publishedAt,author:ld?.author||og.author||null};
    }));
    let unreadable=0;
    for (const item of settled) { if (item.status==='fulfilled'&&item.value.title) articles.set(item.value.url,item.value); else unreadable++; }
    if (unreadable) diag.note=`${unreadable} article page(s) could not be read`;
    const rows=[...articles.values()].filter(x=>source.trusted||/panjab|punjab|sikh|partition|khalsa|guru|heritage|history/i.test(`${x.title} ${x.dek}`)).slice(0,40);
    await storeContent(db,'history',rows,source,420);
    const total=new Set([...known,...rows.map(r=>r.url)]).size;
    diag.rejected=Math.max(0,articles.size-rows.length);
    await setSourceStatus(db,source,total,null,diag);
    return {source:source.key,count:total,newlyStored:rows.length,linksFound:links.length};
  } catch(error){ await setSourceStatus(db,source,0,error.message); return {source:source.key,count:0,error:error.message}; }
}

// ---------------------------------------------------------------------------
// Maintenance
// ---------------------------------------------------------------------------
export async function rescreenStoredEvents(db){
  const rows=await db.prepare(`SELECT id,title,description,region,city,venue,starts_at,url,source_name,source_kind
    FROM hub_events WHERE is_active=1 AND datetime(starts_at)>=datetime('now','-1 day') LIMIT 5000`).all();
  const rejected={}; const updates=[]; let kept=0;
  for(const row of rows.results||[]){
    const configured=EVENT_SOURCES.find(s=>s.name===row.source_name);
    const decision=screenEventIdentity({title:row.title,description:row.description,performers:splitFeaturing(row.description)},{type:row.source_kind,trusted:configured?.trusted});
    if(decision.keep){kept++;continue;}
    rejected[decision.reason]=(rejected[decision.reason]||0)+1;
    updates.push(db.prepare('UPDATE hub_events SET is_active=0 WHERE id=?').bind(row.id));
  }
  for(let i=0;i<updates.length;i+=50) await db.batch(updates.slice(i,i+50));
  const scanned=(rows.results||[]).length;
  return {scanned,kept,removed:scanned-kept,rejected};
}

// ---------------------------------------------------------------------------
// Scheduling
// ---------------------------------------------------------------------------
export async function collectGroup(env, group){
  if(!REFRESH_GROUPS.includes(group)) throw new Error(`Unknown group "${group}"`);
  const run=newRun(env); const results=[];
  if(group==='tickets-core'){ results.push(await collectTicketmaster(env,run,'core')); results.push(await collectGithubEvents(env,run)); }
  if(group==='tickets-artists-a') results.push(await collectTicketmaster(env,run,'artistsA'));
  if(group==='tickets-artists-b') results.push(await collectTicketmaster(env,run,'artistsB'));
  if(group==='tickets-comedy-a') results.push(await collectTicketmaster(env,run,'comedyA'));
  if(group==='tickets-comedy-b') results.push(await collectTicketmaster(env,run,'comedyB'));
  if(group==='marketplaces'){ results.push(await collectEventbrite(env,run)); results.push(await collectSeatGeek(env,run)); }
  for(const source of EVENT_SOURCES.filter(s=>s.group===group)) results.push(await collectWebSource(env.DB,source,run));
  if(group==='editorial'){
    for(const source of NEWS_SOURCES) results.push(await collectNewsSource(env.DB,source,run));
    for(const source of HISTORY_SOURCES) results.push(await collectHistorySource(env.DB,source,run));
    await env.DB.prepare("UPDATE hub_events SET is_active=0 WHERE starts_at < datetime('now','-1 day')").run();
    results.push({source:'event-screening',...(await rescreenStoredEvents(env.DB))});
  }
  return {group,requests:run.fetches,limit:run.limit,results};
}

export async function collectScheduled(env, scheduledTime=Date.now()){
  return collectGroup(env,groupForTime(scheduledTime));
}

// Runs every group one after another. Fine on a paid Workers plan; on the free plan run groups one
// at a time (see the README).
export async function collectAll(env){
  const out=[];
  for(const group of REFRESH_GROUPS) out.push(await collectGroup(env,group));
  return out;
}
