import { collectAll, collectTicketmaster } from './collectors.js';

const JSON_HEADERS={'content-type':'application/json; charset=utf-8','cache-control':'public, max-age=60, s-maxage=300'};

function json(data,status=200,headers={}){return new Response(JSON.stringify(data),{status,headers:{...JSON_HEADERS,...headers}})}

function intParam(url,name,fallback,max){const n=Number(url.searchParams.get(name)||fallback);return Number.isFinite(n)?Math.min(Math.max(Math.trunc(n),1),max):fallback}

async function eventsApi(request,env){
  const url=new URL(request.url); const limit=intParam(url,'limit',100,250);
  const where=["is_active=1","datetime(starts_at)>=datetime('now','-1 day')"]; const bind=[];
  for(const [param,column] of [['region','region'],['category','category']]){const v=url.searchParams.get(param);if(v&&v!=='all'){where.push(`${column}=?`);bind.push(v)}}
  const q=(url.searchParams.get('q')||'').trim(); if(q){where.push('(title LIKE ? OR description LIKE ? OR city LIKE ? OR venue LIKE ?)');for(let i=0;i<4;i++)bind.push(`%${q}%`)}
  const result=await env.DB.prepare(`SELECT id,title,description,category,region,city,venue,starts_at,ends_at,url,image_url,source_name,source_kind
    FROM hub_events WHERE ${where.join(' AND ')} ORDER BY datetime(starts_at) ASC LIMIT ?`).bind(...bind,limit).all();
  return json({events:(result.results||[]).map(r=>({id:r.id,title:r.title,description:r.description,category:r.category,region:r.region,city:r.city,venue:r.venue,startsAt:r.starts_at,endsAt:r.ends_at,url:r.url,imageUrl:r.image_url,source:r.source_name,sourceKind:r.source_kind})),generatedAt:new Date().toISOString()});
}

function githubExcerpt(body=''){
  const summary=body.match(/### Summary\s+([\s\S]*?)(?=\n###|$)/i)?.[1]||body;
  return summary.replace(/!\[[^\]]*\]\([^)]*\)/g,'').replace(/\[([^\]]+)\]\([^)]*\)/g,'$1').replace(/^#{1,6}\s+/gm,'').replace(/[*_>`~-]/g,'').replace(/\s+/g,' ').trim().slice(0,420);
}

async function githubHistory(env,limit){
  if(!env.GITHUB_REPO)return [];
  const repo=String(env.GITHUB_REPO).trim().replace(/^https?:\/\/github\.com\//,'').replace(/\/$/,'');
  if(!/^[\w.-]+\/[\w.-]+$/.test(repo))return [];
  const headers={'accept':'application/vnd.github+json','user-agent':'panjabi-aa-gaye-oye-worker','x-github-api-version':'2022-11-28'};
  if(env.GITHUB_TOKEN)headers.authorization=`Bearer ${env.GITHUB_TOKEN}`;
  try{
    const response=await fetch(`https://api.github.com/repos/${repo}/issues?state=open&labels=history&sort=created&direction=desc&per_page=${Math.min(limit,30)}`,{headers,cf:{cacheEverything:true,cacheTtl:300}});
    if(!response.ok)return [];
    const issues=await response.json();
    return issues.filter(x=>!x.pull_request).map(x=>({id:`github-${x.number}`,title:x.title,dek:githubExcerpt(x.body),body:x.body||'',url:x.html_url,imageUrl:null,source:'Panjabi Aa Gaye Oye',author:x.user?.login||'Editorial desk',publishedAt:x.created_at,featured:(x.labels||[]).some(label=>(typeof label==='string'?label:label.name)==='featured')})).sort((a,b)=>Number(b.featured)-Number(a.featured));
  }catch{return []}
}

async function contentApi(request,env,section){
  const url=new URL(request.url);const limit=intParam(url,'limit',40,100);
  const rows=await env.DB.prepare(`SELECT id,title,dek,body,canonical_url,image_url,source_name,author,published_at
    FROM content_items WHERE section=? AND status='published' ORDER BY datetime(published_at) DESC LIMIT ?`).bind(section,limit).all();
  const stored=(rows.results||[]).map(r=>({id:r.id,title:r.title,dek:r.dek,body:r.body,url:r.canonical_url,imageUrl:r.image_url,source:r.source_name,author:r.author,publishedAt:r.published_at,featured:false}));
  const github=section==='history'?await githubHistory(env,limit):[];
  const items=[...github,...stored].filter((item,index,all)=>all.findIndex(x=>x.url===item.url)===index).sort((a,b)=>Number(b.featured)-Number(a.featured)||new Date(b.publishedAt)-new Date(a.publishedAt)).slice(0,limit);
  return json({items,githubEnabled:Boolean(env.GITHUB_REPO),generatedAt:new Date().toISOString()});
}

async function statusApi(env){
  const rows=await env.DB.prepare('SELECT source_key,source_name,source_type,last_run_at,last_success_at,last_count,last_error FROM source_status ORDER BY source_type,source_name').all();
  return json({sources:rows.results||[],ticketmasterConfigured:Boolean(env.TICKETMASTER_API_KEY),seatGeekConfigured:Boolean(env.SEATGEEK_CLIENT_ID),generatedAt:new Date().toISOString()});
}

async function refreshApi(request,env,ctx){
  if(request.method!=='POST')return json({error:'Method not allowed'},405,{'allow':'POST'});
  if(!env.ADMIN_KEY)return json({error:'ADMIN_KEY is not configured'},503);
  if(request.headers.get('authorization')!==`Bearer ${env.ADMIN_KEY}`)return json({error:'Access denied'},403);
  const promise=new URL(request.url).searchParams.get('source')==='ticketmaster'?collectTicketmaster(env):collectAll(env); ctx.waitUntil(promise); return json({accepted:true,message:'Refresh started'},202);
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
      if(url.pathname==='/api/news')return contentApi(request,env,'music');
      if(url.pathname==='/api/history')return contentApi(request,env,'history');
      if(url.pathname==='/api/sources')return statusApi(env);
      if(url.pathname==='/api/admin/refresh')return refreshApi(request,env,ctx);
      if(url.pathname==='/health')return json({ok:true,service:'panjabi-aa-gaye-oye',version:'3.0.0'});
      if(url.pathname==='/news'||url.pathname==='/news/')return asset(env,request,'/news.html');
      if(url.pathname==='/history'||url.pathname==='/history/')return asset(env,request,'/history.html');
      if(url.pathname==='/about-crawlers')return asset(env,request,'/about-crawlers.html');
      return env.ASSETS.fetch(request);
    }catch(error){return json({error:'Request failed',detail:error.message},500,{'cache-control':'no-store'})}
  },
  async scheduled(controller,env,ctx){ctx.waitUntil(collectAll(env));}
};
