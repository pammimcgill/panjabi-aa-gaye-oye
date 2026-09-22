import { collectAll, collectGroup, collectScheduled } from './collectors.js';
import { CONFIGURED_SOURCE_KEYS, REFRESH_GROUPS, NEWS_MAX_AGE_DAYS, matchText } from './config.js';
import { articlePage, notFoundPage, sitemapXml, parseHistoryIssue, isHistoryIssue, articleNumber } from './articles.js';
import { describeSource } from './health.js';
import { eventPath, eventIdFromSlug, rowToEvent, dedupeEvents, moderationRulesFromIssues, applyModeration, mediaFromIssues, storyFromIssues, safeComments, eventPage, eventNotFoundPage, pacificWeekendBounds } from './events.js';
import { fetchTravel, travelPageShell } from './travel.js';

const VERSION='3.9.0';
const JSON_HEADERS={'content-type':'application/json; charset=utf-8','cache-control':'public, max-age=60, s-maxage=300'};

function json(data,status=200,headers={}){return new Response(JSON.stringify(data),{status,headers:{...JSON_HEADERS,...headers}})}

function intParam(url,name,fallback,max){const n=Number(url.searchParams.get(name)||fallback);return Number.isFinite(n)?Math.min(Math.max(Math.trunc(n),1),max):fallback}

async function eventsApi(request,env){
  const url=new URL(request.url); const limit=intParam(url,'limit',100,250);const past=url.searchParams.get('past')==='1';
  const where=past?["datetime(starts_at)<datetime('now','-1 day')"]:["is_active=1","datetime(starts_at)>=datetime('now','-1 day')"]; const bind=[];
  for(const [param,column] of [['region','region'],['category','category']]){const v=url.searchParams.get(param);if(v&&v!=='all'){where.push(`${column}=?`);bind.push(v)}}
  const q=(url.searchParams.get('q')||'').trim(); if(q){where.push('(title LIKE ? OR description LIKE ? OR city LIKE ? OR venue LIKE ?)');for(let i=0;i<4;i++)bind.push(`%${q}%`)}
  const order=past?'DESC':'ASC';
  const result=await env.DB.prepare(`SELECT id,title,description,category,region,city,venue,venue_address,performers,starts_at,ends_at,url,image_url,video_url,video_caption,source_name,source_kind,source_event_id,is_active
    FROM hub_events WHERE ${where.join(' AND ')} ORDER BY datetime(starts_at) ${order} LIMIT ?`).bind(...bind,Math.min(limit*4,1000)).all();
  let events=dedupeEvents((result.results||[]).map(rowToEvent));
  if(past)events.reverse();
  const rules=moderationRulesFromIssues(await githubIssuesByLabel(env,'event-hide'));
  events=applyModeration(events,rules).visible;
  let range='';
  if(url.searchParams.get('when')==='weekend'){
    const bounds=pacificWeekendBounds();range=bounds.range;
    events=events.filter(x=>x.startsAt>=bounds.start&&x.startsAt<bounds.end);
  }
  return json({events:events.slice(0,limit),range,archive:past,generatedAt:new Date().toISOString()});
}

function githubRepoOf(env){
  const repo=String(env.GITHUB_REPO||'').trim().replace(/^https?:\/\/github\.com\//,'').replace(/\/$/,'');
  return /^[\w.-]+\/[\w.-]+$/.test(repo)?repo:'';
}

function githubHeaders(env){
  const headers={'accept':'application/vnd.github+json','user-agent':'panjabi-aa-gaye-oye-worker','x-github-api-version':'2022-11-28'};
  if(env.GITHUB_TOKEN)headers.authorization=`Bearer ${env.GITHUB_TOKEN}`;
  return headers;
}

async function githubIssuesByLabel(env,label,limit=100){
  const repo=githubRepoOf(env);if(!repo)return [];
  try{const response=await fetch(`https://api.github.com/repos/${repo}/issues?state=open&labels=${encodeURIComponent(label)}&sort=updated&direction=desc&per_page=${Math.min(limit,100)}`,{headers:githubHeaders(env),cf:{cacheEverything:true,cacheTtl:120}});return response.ok?(await response.json()):[];}catch{return []}
}

function githubTemplate(env,template,title=''){
  const repo=githubRepoOf(env);if(!repo)return '';
  return `https://github.com/${repo}/issues/new?template=${encodeURIComponent(template)}${title?`&title=${encodeURIComponent(title)}`:''}`;
}

async function eventResponse(request,env,slug){
  const html=(body,status=200,extra={})=>new Response(body,{status,headers:{'content-type':'text/html; charset=utf-8','cache-control':status===200?'public, max-age=120':'no-store',...extra}});
  const id=eventIdFromSlug(slug);if(!id)return html(eventNotFoundPage(),404);
  const found=await env.DB.prepare('SELECT * FROM hub_events WHERE id=? LIMIT 1').bind(id).all();
  const row=(found.results||[])[0];if(!row)return html(eventNotFoundPage(),404);
  let event=rowToEvent(row);const origin=String(env.SITE_ORIGIN||new URL(request.url).origin).replace(/\/$/,'');
  const correct=eventPath(event);if(`/events/${slug}`!==correct)return Response.redirect(`${origin}${correct}`,301);
  const [hideIssues,mediaIssues,storyIssues]=await Promise.all([githubIssuesByLabel(env,'event-hide'),githubIssuesByLabel(env,'event-media'),githubIssuesByLabel(env,'event-story')]);
  const moderated=applyModeration([event],moderationRulesFromIssues(hideIssues));
  if(!moderated.visible.length){const preferred=moderated.redirects.get(event.id);if(preferred){if(/^evt-/.test(preferred)){const target=await env.DB.prepare('SELECT * FROM hub_events WHERE id=? LIMIT 1').bind(preferred).all();const targetRow=(target.results||[])[0];if(targetRow)return Response.redirect(`${origin}${eventPath(rowToEvent(targetRow))}`,301);}if(/^https?:\/\//.test(preferred))return Response.redirect(preferred,302);}return html(eventNotFoundPage(),404);}
  const story=storyFromIssues(storyIssues,event);let comments=[];
  if(story?.commentsUrl){try{const response=await fetch(`${story.commentsUrl}?per_page=30`,{headers:githubHeaders(env),cf:{cacheEverything:true,cacheTtl:120}});if(response.ok)comments=safeComments(await response.json());}catch{}}
  const nearby=await env.DB.prepare("SELECT * FROM hub_events WHERE is_active=1 AND id<>? AND category=? AND datetime(starts_at)>=datetime('now','-1 day') ORDER BY datetime(starts_at) ASC LIMIT 6").bind(event.id,event.category).all();
  const similar=dedupeEvents((nearby.results||[]).map(rowToEvent)).slice(0,3);
  return html(eventPage(event,{origin,media:mediaFromIssues(mediaIssues,event),story,comments,similar,
    mediaForm:githubTemplate(env,'event-media.yml',`[Event video] ${event.title}`),storyForm:githubTemplate(env,'event-story.yml',`[Event story] ${event.title}`)}));
}

// History articles written as GitHub issues (label: history).
async function githubHistoryArticles(env,limit=30){
  const repo=githubRepoOf(env); if(!repo)return [];
  try{
    const response=await fetch(`https://api.github.com/repos/${repo}/issues?state=open&labels=history&sort=created&direction=desc&per_page=${Math.min(limit,50)}`,{headers:githubHeaders(env),cf:{cacheEverything:true,cacheTtl:300}});
    if(!response.ok)return [];
    return (await response.json()).filter(isHistoryIssue).map(parseHistoryIssue);
  }catch{return []}
}

function historyListItem(a){
  return {id:a.id,title:a.title,dek:a.dek,url:`/history/${a.slug}`,internal:true,imageUrl:a.imageUrl,source:'Panjabi Aa Gaye Oye',author:a.byline,publishedAt:a.publishedAt,featured:a.featured,topics:a.topics,minutes:a.minutes,year:a.year,chapter:a.chapter.name,chapterNumber:a.chapter.n,chapterSpan:a.chapter.span};
}

function tally(items,pick){
  const counts=new Map();
  for(const item of items)for(const name of pick(item))counts.set(name,(counts.get(name)||0)+1);
  return [...counts].map(([name,count])=>({name,count})).sort((x,y)=>y.count-x.count||x.name.localeCompare(y.name));
}

async function contentApi(request,env,section){
  const url=new URL(request.url);const limit=intParam(url,'limit',40,100);
  // Music news only shows recent stories; history is a lasting archive.
  const recent=section==='music'?` AND datetime(published_at)>=datetime('now','-${NEWS_MAX_AGE_DAYS} days')`:'';
  const rows=await env.DB.prepare(`SELECT id,title,dek,canonical_url,image_url,source_name,author,published_at
    FROM content_items WHERE section=? AND status='published'${recent} ORDER BY datetime(published_at) DESC LIMIT ?`).bind(section,limit*2).all();
  const stored=(rows.results||[]).map(r=>({id:r.id,title:r.title,dek:r.dek,url:r.canonical_url,internal:false,imageUrl:r.image_url,source:r.source_name,author:r.author,publishedAt:r.published_at,featured:false,topics:[],year:null,chapter:null,chapterNumber:null,chapterSpan:null}));
  const own=section==='history'?(await githubHistoryArticles(env,limit)).map(historyListItem):[];
  const seenUrl=new Set(),seenTitle=new Set();
  const items=[...own,...stored].filter(item=>{
    const title=matchText(item.title);
    if(seenUrl.has(item.url)||seenTitle.has(title))return false;
    seenUrl.add(item.url);seenTitle.add(title);return true;
  }).sort((a,b)=>Number(b.featured)-Number(a.featured)||new Date(b.publishedAt)-new Date(a.publishedAt)).slice(0,limit);
  return json({items,
    sources:tally(items,x=>[x.source]),topics:tally(items,x=>x.topics||[]),chapters:tally(items.filter(x=>x.chapter),x=>[x.chapter]),
    githubEnabled:Boolean(env.GITHUB_REPO),generatedAt:new Date().toISOString()});
}

async function articleResponse(request,env,ctx,slug){
  const html=(body,status=200,extra={})=>new Response(body,{status,headers:{'content-type':'text/html; charset=utf-8','cache-control':status===200?'public, max-age=300':'no-store',...extra}});
  const number=articleNumber(slug),repo=githubRepoOf(env);
  if(!number||!repo)return html(notFoundPage(),404);
  const cache=typeof caches!=='undefined'?caches.default:null;
  if(cache){const hit=await cache.match(request);if(hit)return hit;}
  let response;
  try{response=await fetch(`https://api.github.com/repos/${repo}/issues/${number}`,{headers:githubHeaders(env),cf:{cacheEverything:true,cacheTtl:300}});}
  catch{return html('<!doctype html><meta charset="utf-8"><title>Try again</title><p style="font-family:Georgia,serif;margin:12vh auto;max-width:520px">This article is temporarily unavailable. Please try again in a minute.</p>',503);}
  if(response.status===404||response.status===410)return html(notFoundPage(),404);
  if(!response.ok)return html('<!doctype html><meta charset="utf-8"><title>Try again</title><p style="font-family:Georgia,serif;margin:12vh auto;max-width:520px">This article is temporarily unavailable. Please try again in a minute.</p>',503);
  const issue=await response.json();
  if(!isHistoryIssue(issue))return html(notFoundPage(),404);
  const article=parseHistoryIssue(issue);
  const origin=String(env.SITE_ORIGIN||new URL(request.url).origin).replace(/\/$/,'');
  if(slug!==article.slug)return Response.redirect(`${origin}/history/${article.slug}`,301);
  // Neighbours in the story: the articles closest in time come first.
  const others=(await githubHistoryArticles(env,50)).filter(x=>x.number!==number);
  const distance=x=>article.year&&x.year?Math.abs(x.year-article.year):Infinity;
  const more=others.sort((a,b)=>distance(a)-distance(b)||new Date(b.publishedAt)-new Date(a.publishedAt)).slice(0,3).map(historyListItem);
  const page=html(articlePage(article,{origin,more}));
  if(cache)ctx.waitUntil(cache.put(request,page.clone()));
  return page;
}

async function sitemapResponse(request,env){
  const origin=String(env.SITE_ORIGIN||new URL(request.url).origin).replace(/\/$/,'');
  const articles=await githubHistoryArticles(env,50);
  let eventPaths=[];
  if(env.DB){const rows=await env.DB.prepare("SELECT * FROM hub_events ORDER BY datetime(starts_at) DESC LIMIT 1000").all();
    const events=dedupeEvents((rows.results||[]).map(rowToEvent));
    const rules=moderationRulesFromIssues(await githubIssuesByLabel(env,'event-hide'));
    eventPaths=applyModeration(events,rules).visible.map(eventPath);}
  return new Response(sitemapXml(origin,articles,eventPaths),{headers:{'content-type':'application/xml; charset=utf-8','cache-control':'public, max-age=3600'}});
}

async function statusApi(env){
  let rows;
  try{
    rows=await env.DB.prepare('SELECT source_key,source_name,source_type,last_run_at,last_success_at,last_count,last_error,raw_count,rejected_count,links_followed,sample_rejected,note FROM source_status ORDER BY source_type,source_name').all();
  }catch{
    // Migration 0004 has not been applied yet.
    rows=await env.DB.prepare('SELECT source_key,source_name,source_type,last_run_at,last_success_at,last_count,last_error FROM source_status ORDER BY source_type,source_name').all();
  }
  const all=(rows.results||[]).map(row=>({...row,...describeSource(row),retired:!CONFIGURED_SOURCE_KEYS.has(row.source_key)}));
  return json({
    sources:all.filter(x=>!x.retired),
    retired:all.filter(x=>x.retired).map(x=>({source_key:x.source_key,source_name:x.source_name})),
    seatGeekConfigured:Boolean(env.SEATGEEK_CLIENT_ID),ticketmasterConfigured:Boolean(env.TICKETMASTER_API_KEY),
    githubEventsConfigured:Boolean(env.GITHUB_REPO),generatedAt:new Date().toISOString()
  },200,{'cache-control':'public, max-age=30'});
}

function githubEventForm(env){
  const repo=String(env.GITHUB_REPO||'').trim().replace(/^https?:\/\/github\.com\//,'').replace(/\/$/,'');
  if(!/^[\w.-]+\/[\w.-]+$/.test(repo))return null;
  return `https://github.com/${repo}/issues/new?template=event.yml`;
}

function submitUnavailable(){
  const html='<!doctype html><html lang="en"><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Add an event</title><body style="font-family:Georgia,serif;max-width:560px;margin:12vh auto;padding:0 22px;line-height:1.6"><h1>Event submissions are not open yet</h1><p>Please check back soon, or email <a href="mailto:events@panjabiaagayeoye.com">events@panjabiaagayeoye.com</a> with the event link.</p><p><a href="/">← Back to events</a></p></body></html>';
  return new Response(html,{status:503,headers:{'content-type':'text/html; charset=utf-8','cache-control':'no-store'}});
}

async function refreshApi(request,env,ctx){
  if(request.method!=='POST')return json({error:'Method not allowed'},405,{'allow':'POST'});
  if(!env.ADMIN_KEY)return json({error:'ADMIN_KEY is not configured'},503);
  if(request.headers.get('authorization')!==`Bearer ${env.ADMIN_KEY}`)return json({error:'Access denied'},403);
  const group=new URL(request.url).searchParams.get('group');
  if(!group)return json({usage:'POST /api/admin/refresh?group=<name>  (or group=all on a paid Workers plan)',groups:REFRESH_GROUPS},200,{'cache-control':'no-store'});
  if(group==='all'){ctx.waitUntil(collectAll(env));return json({accepted:true,message:'Refresh started for every group'},202,{'cache-control':'no-store'});}
  if(!REFRESH_GROUPS.includes(group))return json({error:'Unknown group',groups:REFRESH_GROUPS},400,{'cache-control':'no-store'});
  ctx.waitUntil(collectGroup(env,group));return json({accepted:true,message:`Refresh started for ${group}`},202,{'cache-control':'no-store'});
}

async function asset(env,request,file){
  const url=new URL(request.url);url.pathname=file;
  return env.ASSETS.fetch(new Request(url,request));
}

export default {
  async fetch(request,env,ctx){
    const url=new URL(request.url);
    try{
      if(url.pathname==='/api/events')return eventsApi(request,env);
      if(url.pathname==='/api/travel')return json(await fetchTravel(),200,{'cache-control':'public, max-age=180, s-maxage=300'});
      if(url.pathname==='/api/news')return contentApi(request,env,'music');
      if(url.pathname==='/api/history')return contentApi(request,env,'history');
      if(url.pathname==='/api/sources')return statusApi(env);
      if(url.pathname==='/api/admin/refresh')return refreshApi(request,env,ctx);
      if(url.pathname==='/health')return json({ok:true,service:'panjabi-aa-gaye-oye',version:VERSION});
      if(url.pathname==='/submit-event'){
        const form=githubEventForm(env);return form?Response.redirect(form,302):submitUnavailable();
      }
      if(url.pathname==='/sitemap.xml')return sitemapResponse(request,env);
      if(url.pathname.startsWith('/events/')&&url.pathname.length>'/events/'.length)return eventResponse(request,env,decodeURIComponent(url.pathname.slice('/events/'.length)).replace(/\/$/,''));
      if(url.pathname.startsWith('/history/')&&url.pathname.length>'/history/'.length)return articleResponse(request,env,ctx,decodeURIComponent(url.pathname.slice('/history/'.length)).replace(/\/$/,''));
      if(url.pathname==='/weekend'||url.pathname==='/weekend/')return asset(env,request,'/weekend.html');
      if(url.pathname==='/archive'||url.pathname==='/archive/')return asset(env,request,'/archive.html');
      if(url.pathname==='/travel'||url.pathname==='/travel/')return new Response(travelPageShell(),{headers:{'content-type':'text/html; charset=utf-8','cache-control':'public, max-age=3600'}});
      if(url.pathname==='/news'||url.pathname==='/news/')return asset(env,request,'/news.html');
      if(url.pathname==='/history'||url.pathname==='/history/')return asset(env,request,'/history.html');
      if(url.pathname==='/about-crawlers')return asset(env,request,'/about-crawlers.html');
      return env.ASSETS.fetch(request);
    }catch(error){return json({error:'Request failed',detail:error.message},500,{'cache-control':'no-store'})}
  },
  async scheduled(controller,env,ctx){ctx.waitUntil(collectScheduled(env,controller.scheduledTime));}
};
