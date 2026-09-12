import { isRegularProgram } from './regular-programs.js';
import { EVENT_SOURCES, NEWS_SOURCES, HISTORY_SOURCES, SEATGEEK_SEARCHES, MUSIC_TERMS, relevant, categoryFor } from './config.js';
import { cleanText, discoverEventLinks, discoverLinks, extractJsonLdEvents, extractJsonLdArticles, parseFeed, safeDate, stableId } from './parsers.js';

const UA='PanjabiAaGayeOyeBot/3.0 (+https://panjabiaagayeoye.com/about-crawlers)';

async function getText(url) {
  const res=await fetch(url,{headers:{'User-Agent':UA,'Accept':'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.5'},redirect:'follow'});
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  return {text:await res.text(),url:res.url};
}

async function setSourceStatus(db, source, count, error=null) {
  const now=new Date().toISOString();
  await db.prepare(`INSERT INTO source_status
    (source_key,source_name,source_url,source_type,last_run_at,last_success_at,last_count,last_error)
    VALUES(?,?,?,?,?,?,?,?)
    ON CONFLICT(source_key) DO UPDATE SET
      source_name=excluded.source_name, source_url=excluded.source_url,
      source_type=excluded.source_type, last_run_at=excluded.last_run_at,
      last_success_at=CASE WHEN excluded.last_error IS NULL THEN excluded.last_success_at ELSE source_status.last_success_at END,
      last_count=excluded.last_count, last_error=excluded.last_error`)
    .bind(source.key,source.name,source.url,source.type||'feed',now,error?null:now,count,error?String(error).slice(0,500):null).run();
}

function normalizeEvent(raw, source) {
  if(isRegularProgram(raw.title)) return null;
  const startsAt=safeDate(raw.startsAt);
  const combined=`${raw.title} ${raw.description} ${raw.venue} ${raw.city}`;
  if (!startsAt || new Date(startsAt).getTime() < Date.now()-86400000 || (source.type!=='venue' && !relevant(combined))) return null;
  const url=raw.url || source.url;
  return {
    id:stableId('evt',`${source.key}|${raw.sourceEventId||url}|${startsAt}`),
    title:cleanText(raw.title), description:cleanText(raw.description).slice(0,700),
    category:categoryFor(combined,source.type), region:source.region,
    city:cleanText(raw.city)||source.city||'', venue:cleanText(raw.venue)||source.name,
    startsAt, endsAt:safeDate(raw.endsAt)||null, url, imageUrl:raw.imageUrl||null,
    sourceName:source.name, sourceKind:source.type||'web',
    sourceEventId:String(raw.sourceEventId||url)
  };
}

async function upsertEvents(db, events) {
  if (!events.length) return 0;
  const stmt=db.prepare(`INSERT INTO hub_events
    (id,title,description,category,region,city,venue,starts_at,ends_at,url,image_url,source_name,source_kind,source_event_id,last_seen_at,is_active)
    VALUES(?,?,?,?,?,?,?,?,?,?,?,?,?,?,CURRENT_TIMESTAMP,1)
    ON CONFLICT(id) DO UPDATE SET title=excluded.title,description=excluded.description,
      category=excluded.category,region=excluded.region,city=excluded.city,venue=excluded.venue,
      starts_at=excluded.starts_at,ends_at=excluded.ends_at,url=excluded.url,image_url=excluded.image_url,
      source_name=excluded.source_name,source_kind=excluded.source_kind,source_event_id=excluded.source_event_id,
      last_seen_at=CURRENT_TIMESTAMP,is_active=1`);
  const batches=[];
  for (const e of events) batches.push(stmt.bind(e.id,e.title,e.description,e.category,e.region,e.city,e.venue,e.startsAt,e.endsAt,e.url,e.imageUrl,e.sourceName,e.sourceKind,e.sourceEventId));
  for (let i=0;i<batches.length;i+=50) await db.batch(batches.slice(i,i+50));
  return events.length;
}

async function collectWebSource(db, source) {
  try {
    const first=await getText(source.url);
    let raw=extractJsonLdEvents(first.text,first.url);
    const links=discoverEventLinks(first.text,first.url,14);
    if (links.length) {
      const settled=await Promise.allSettled(links.map(async link=>{
        const page=await getText(link.href); return extractJsonLdEvents(page.text,page.url);
      }));
      for(const item of settled) if(item.status==='fulfilled') raw.push(...item.value);
    }
    const events=[...new Map(raw.map(x=>[`${x.sourceEventId}|${x.startsAt}`,normalizeEvent(x,source)]).filter(x=>x[1])).values()];
    const count=await upsertEvents(db,events);
    await setSourceStatus(db,source,count);
    return {source:source.key,count};
  } catch(error) {
    await setSourceStatus(db,source,0,error.message);
    return {source:source.key,count:0,error:error.message};
  }
}

function seatGeekEvent(raw) {
  const venue=raw.venue||{};
  return {
    sourceEventId:String(raw.id),title:raw.title||raw.short_title||'',description:raw.description||'Event and ticket details available through SeatGeek.',
    startsAt:raw.datetime_utc||raw.datetime_local, endsAt:null, venue:venue.name||'',
    city:venue.city||'',url:raw.url||'',imageUrl:(raw.performers||[]).find(x=>x.image)?.image||''
  };
}

export async function collectSeatGeek(env) {
  const source={key:'seatgeek',name:'SeatGeek',url:'https://api.seatgeek.com/2/events',type:'ticketing',region:'Seattle'};
  if(!env.SEATGEEK_CLIENT_ID){
    await setSourceStatus(env.DB,source,0,'Waiting for SEATGEEK_CLIENT_ID');
    return {source:'seatgeek',count:0,disabled:true};
  }
  try{
    const all=[];
    for(const search of SEATGEEK_SEARCHES){
      const p=new URLSearchParams({client_id:env.SEATGEEK_CLIENT_ID,q:search.q,lat:String(search.lat),lon:String(search.lon),range:'100mi',per_page:'100','datetime_utc.gte':new Date().toISOString().slice(0,19)});
      const res=await fetch(`https://api.seatgeek.com/2/events?${p}`,{headers:{Accept:'application/json','User-Agent':UA}});
      if(!res.ok) throw new Error(`API HTTP ${res.status}`);
      const data=await res.json(); const rows=data.events||[];
      const s={...source,region:search.region};
      all.push(...rows.map(x=>normalizeEvent(seatGeekEvent(x),s)).filter(Boolean));
    }
    const unique=[...new Map(all.map(x=>[x.id,x])).values()];
    await upsertEvents(env.DB,unique); await setSourceStatus(env.DB,source,unique.length);
    return {source:'seatgeek',count:unique.length};
  }catch(error){ await setSourceStatus(env.DB,source,0,error.message); return {source:'seatgeek',count:0,error:error.message}; }
}

export async function collectTicketmaster(env) {
  const source={key:'ticketmaster',name:'Ticketmaster',url:'https://app.ticketmaster.com/discovery/v2/events.json',type:'ticketing'};
  if(!env.TICKETMASTER_API_KEY){
    await setSourceStatus(env.DB,source,0,'Waiting for TICKETMASTER_API_KEY');
    return {source:source.key,count:0,disabled:true};
  }
  const found=new Map();
  try{
    for(const area of [{countryCode:'US',stateCode:'WA',region:'Seattle'},{countryCode:'CA',stateCode:'BC',region:'Vancouver'}]){
      for(const keyword of ['punjabi','panjabi','bhangra','bollywood','diljit','karan aujla','satinder sartaaj','gurdas maan','shreya ghoshal','sonu nigam','mehfil']){
        for(let page=0;page<5;page++){
          const params=new URLSearchParams({apikey:env.TICKETMASTER_API_KEY,countryCode:area.countryCode,stateCode:area.stateCode,keyword,size:'100',page:String(page),sort:'date,asc',startDateTime:new Date().toISOString().replace(/\.\d{3}Z$/,'Z')});
          const response=await fetch(source.url+'?'+params,{headers:{Accept:'application/json'},signal:AbortSignal.timeout(10000)});
          if(!response.ok)throw new Error('Ticketmaster HTTP '+response.status);
          const data=await response.json();
          for(const raw of data._embedded?.events||[]){
            if(raw.dates?.status?.code==='cancelled')continue;
            const venue=raw._embedded?.venues?.[0]||{};
            const event=normalizeEvent({sourceEventId:raw.id,title:raw.name,description:[raw.info,raw.pleaseNote].filter(Boolean).join(' '),startsAt:raw.dates?.start?.dateTime,url:raw.url,venue:venue.name,city:venue.city?.name,imageUrl:raw.images?.[0]?.url},{...source,region:area.region});
            if(event)found.set(event.id,event);
          }
          if(page+1 >= (data.page?.totalPages||0))break;
        }
      }
    }
    await upsertEvents(env.DB,[...found.values()]);
    await setSourceStatus(env.DB,source,found.size);
    return {source:source.key,count:found.size};
  }catch(error){
    await upsertEvents(env.DB,[...found.values()]);
    const message=error.name==='TimeoutError'?'Ticketmaster request timed out':(error.message.startsWith('Ticketmaster HTTP')?error.message:'Ticketmaster collection failed');
    await setSourceStatus(env.DB,source,found.size,message);
    return {source:source.key,count:found.size,error:message};
  }
}

async function upsertNews(db, rows, source) {
  const stmt=db.prepare(`INSERT INTO content_items
    (id,section,title,dek,body,canonical_url,image_url,source_name,author,published_at,status)
    VALUES(?,'music',?,?,?,?,?,?,?,?, 'published')
    ON CONFLICT(canonical_url) DO UPDATE SET title=excluded.title,dek=excluded.dek,
      image_url=excluded.image_url,source_name=excluded.source_name,author=excluded.author,published_at=excluded.published_at`);
  const valid=rows.filter(x=>relevant(`${x.title} ${x.dek}`,MUSIC_TERMS)).slice(0,30);
  if(valid.length) await db.batch(valid.map(x=>stmt.bind(stableId('news',x.url),x.title,cleanText(x.dek).slice(0,360),'',x.url,x.imageUrl||null,source.name,x.author||null,safeDate(x.publishedAt)||new Date().toISOString())));
  return valid.length;
}

async function collectNewsSource(db,source){
  try { const feed=await getText(source.url); const count=await upsertNews(db,parseFeed(feed.text,feed.url),source); await setSourceStatus(db,{...source,type:'news'},count); return {source:source.key,count}; }
  catch(error){ await setSourceStatus(db,{...source,type:'news'},0,error.message); return {source:source.key,count:0,error:error.message}; }
}

async function collectHistorySource(db,source){
  try {
    const page=await getText(source.url); let rows=extractJsonLdArticles(page.text,page.url);
    if(!rows.length){
      const links=discoverLinks(page.text,page.url,/article|history|panjab|punjab|partition|heritage|sikh/i,24);
      const settled=await Promise.allSettled(links.slice(0,12).map(async x=>{const p=await getText(x.href);return extractJsonLdArticles(p.text,p.url)}));
      for(const x of settled) if(x.status==='fulfilled') rows.push(...x.value);
    }
    rows=[...new Map(rows.map(x=>[x.url,x])).values()].filter(x=>/panjab|punjab|sikh|partition|khalsa|guru|heritage|history/i.test(`${x.title} ${x.dek}`)).slice(0,25);
    const stmt=db.prepare(`INSERT INTO content_items
      (id,section,title,dek,body,canonical_url,image_url,source_name,author,published_at,status)
      VALUES(?,'history',?,?,?,?,?,?,?,?, 'published')
      ON CONFLICT(canonical_url) DO UPDATE SET title=excluded.title,dek=excluded.dek,
        image_url=excluded.image_url,source_name=excluded.source_name,author=excluded.author,published_at=excluded.published_at`);
    if(rows.length) await db.batch(rows.map(x=>stmt.bind(stableId('history',x.url),x.title,cleanText(x.dek).slice(0,420),'',x.url,x.imageUrl||null,source.name,x.author||null,safeDate(x.publishedAt)||new Date().toISOString())));
    await setSourceStatus(db,source,rows.length); return {source:source.key,count:rows.length};
  } catch(error){ await setSourceStatus(db,source,0,error.message); return {source:source.key,count:0,error:error.message}; }
}

export async function collectAll(env){
  const results=[await collectTicketmaster(env)];
  for(const source of EVENT_SOURCES) results.push(await collectWebSource(env.DB,source));
  results.push(await collectSeatGeek(env));
  for(const source of NEWS_SOURCES) results.push(await collectNewsSource(env.DB,source));
  for(const source of HISTORY_SOURCES) results.push(await collectHistorySource(env.DB,source));
  await env.DB.prepare("UPDATE hub_events SET is_active=0 WHERE starts_at < datetime('now','-1 day')").run();
  return results;
}
