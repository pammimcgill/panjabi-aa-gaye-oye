import {isRegularProgram} from './regular-programs.js';
import {cleanText,stableId} from './parsers.js';
export function parseManualEvent(issue,repo,now=Date.now()){
  if(issue.pull_request||issue.state!=='open'||!issue.labels?.some(x=>(x.name||x)==='approved-event'))return null;
  const fields=Object.fromEntries([...String(issue.body||'').matchAll(/^### ([^\n]+)\n+([\s\S]*?)(?=^### |$(?![\s\S]))/gm)].map(m=>[m[1].trim(),m[2].trim().replace(/^_No response_$/,'')]));
  const title=cleanText(fields['Event title']||'');
  const start=fields['Start date and time']||'';
  if(!title||isRegularProgram(title)||!/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}(?::\d{2})?(?:Z|[+-]\d{2}:\d{2})$/.test(start)||!Number.isFinite(Date.parse(start))||Date.parse(start)<=now)throw Error('Missing/invalid title or future start time');
  const region=fields.Region, category=fields.Category;
  if(!['Seattle','Vancouver'].includes(region)||!['market','festival','religious','concert','theatre','nightlife','community'].includes(category)||!fields.City||!fields.Venue)throw Error('Missing/invalid location or category');
  const safeUrl=value=>{try{const u=new URL(value);return ['https:','http:'].includes(u.protocol)&&!u.username&&!u.password?u.href:null;}catch{return null;}};
  const url=safeUrl(fields['Event link']);if(!url)throw Error('Invalid event link');
  const image=fields['Image URL']?safeUrl(fields['Image URL']):null;
  if(fields['Image URL']&&!image)throw Error('Invalid image URL');
  return {id:stableId('manual',repo+'#'+issue.number),title,description:cleanText(fields.Description||'').slice(0,700),category,region,city:cleanText(fields.City),venue:cleanText(fields.Venue),startsAt:new Date(start).toISOString(),endsAt:null,url,imageUrl:image,sourceName:'GitHub manual events',sourceKind:'manual',sourceEventId:repo+'#'+issue.number};
}
export async function fetchManualEvents(env){
 const repo=env.GITHUB_EVENTS_REPO||'pammimcgill/panjabi-aa-gaye-oye';
 if(!/^[\w.-]+\/[\w.-]+$/.test(repo))throw Error('Invalid GITHUB_EVENTS_REPO');
 const headers={Accept:'application/vnd.github+json','User-Agent':'panjabi-events'};
 if(env.GITHUB_TOKEN)headers.Authorization='Bearer '+env.GITHUB_TOKEN;
 const events=[],invalid=[];
 for(let page=1;page<=10;page++){
  const r=await fetch(`https://api.github.com/repos/${repo}/issues?state=open&labels=approved-event&per_page=100&page=${page}`,{headers,signal:AbortSignal.timeout(8000)});
  if(!r.ok)throw Error('GitHub events HTTP '+r.status);
  const issues=await r.json();if(!Array.isArray(issues))throw Error('Invalid GitHub response');
  for(const issue of issues){try{const e=parseManualEvent(issue,repo);if(e)events.push(e);}catch{invalid.push(issue.number);}}
  if(!r.headers.get('link')?.includes('rel="next"'))return {events,invalid};
 }
 throw Error('GitHub events exceed 1000 issues; previous events retained');
}
