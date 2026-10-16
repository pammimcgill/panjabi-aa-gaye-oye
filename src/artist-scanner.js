import playlist from '../public/data/punjabi-artists.json' with {type:'json'};
import {normalize} from '../public/artist-match.js';
export const AREAS=[{region:'Seattle',geoPoint:'c23nb',countryCode:'US',radius:100},{region:'Vancouver',geoPoint:'c2b2q',countryCode:'CA',radius:60}];
export function matchedEvent(item,artist,area,now=Date.now()){
 const venue=item._embedded?.venues?.[0],names=(item._embedded?.attractions||[]).map(x=>x.name);
 // Explicit artist credit only: tribute nights and loose keyword mentions do not qualify.
 if(!names.some(n=>normalize(n)===normalize(artist))||!venue)return null;
 if(['cancelled','postponed'].includes(item.dates?.status?.code))return null;
 const date=item.dates?.start?.dateTime;if(!date||Date.parse(date)<=now)return null;
 if(venue.country?.countryCode!==area.countryCode)return null;
 let url;try{url=new URL(item.url);if(url.protocol!=='https:')return null}catch{return null}
 return {id:item.id,title:item.name,performers:names,matchedArtist:artist,startsAt:date,region:area.region,city:venue.city?.name||'',venue:venue.name||'',url:url.href,source:'Ticketmaster',checkedAt:new Date(now).toISOString()};
}
export async function scanBatch(env,{fetcher=fetch,now=Date.now(),batchSize=8,pause=ms=>new Promise(r=>setTimeout(r,ms))}={}){
 if(!env.ARTIST_SCAN||!env.TICKETMASTER_API_KEY)return {state:'not_configured'};
 const state=await env.ARTIST_SCAN.get('state','json')||{cursor:0,artists:{}};
 const names=playlist.artists.map(a=>a.name),start=state.cursor%names.length;
 for(let n=0;n<Math.min(batchSize,names.length);n++){
 const artist=names[(start+n)%names.length],events=[];let complete=true,error='';
 for(const area of AREAS){
 const params=new URLSearchParams({apikey:env.TICKETMASTER_API_KEY,keyword:artist,geoPoint:area.geoPoint,radius:String(area.radius),unit:'miles',countryCode:area.countryCode,segmentName:'Music',startDateTime:new Date(now).toISOString().replace(/\.\d{3}Z$/,'Z'),size:'200',sort:'date,asc',includeTBA:'no',includeTBD:'no'});
 try{const r=await fetcher('https://app.ticketmaster.com/discovery/v2/events.json?'+params,{signal:AbortSignal.timeout(15000)});if(!r.ok){complete=false;error='provider_http_'+r.status;}else{const data=await r.json();if((data.page?.totalPages||0)>1){complete=false;error='results_truncated';}for(const item of data._embedded?.events||[]){const e=matchedEvent(item,artist,area,now);if(e)events.push(e);}}}catch{complete=false;error='provider_unavailable'}
 await pause(250);
 }
 if(complete)state.artists[artist]={events,checkedAt:new Date(now).toISOString(),error:null};
 else state.artists[artist]={...(state.artists[artist]||{events:[]}),lastAttemptAt:new Date(now).toISOString(),error};
 }
 state.cursor=(start+Math.min(batchSize,names.length))%names.length;state.lastRunAt=new Date(now).toISOString();
 await env.ARTIST_SCAN.put('state',JSON.stringify(state));return {state:'scanned',cursor:state.cursor};
}
export function scanView(state,now=Date.now()){
 const rows=Object.values(state?.artists||{}),fresh=rows.filter(x=>!x.error&&Date.parse(x.checkedAt)>now-48*3600000),unique=new Map();
 for(const row of fresh)for(const e of row.events||[])if(Date.parse(e.startsAt)>now)unique.set(e.id,e);
 return {events:[...unique.values()].sort((a,b)=>Date.parse(a.startsAt)-Date.parse(b.startsAt)),scan:{state:state?'active':'starting',totalArtists:playlist.artists.length,checkedArtists:fresh.length,failedArtists:rows.filter(x=>x.error).length,lastRunAt:state?.lastRunAt||null,source:'Ticketmaster',coverage:'Seattle/Tacoma within 100 miles of Seattle; Vancouver within 60 miles. Ticketmaster listings only. Full list cycles approximately every 8 hours.'}};
}
