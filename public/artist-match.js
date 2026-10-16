export const normalize=s=>String(s||'').normalize('NFKC').toLocaleLowerCase().replace(/[^\p{L}\p{N}]+/gu,' ').trim();
export function matchArtist(event,name){const n=normalize(name);if(!n)return false;const performers=Array.isArray(event.performers)?event.performers:[];if(performers.some(x=>normalize(x)===n))return true;
// Single-word credits are ambiguous: require explicit performer attribution.
if(!n.includes(' '))return false;
return (' '+normalize(event.title)+' ').includes(' '+n+' ');}
export function localUpcoming(events,region='all',now=Date.now()){return events.filter(e=>Number.isFinite(Date.parse(e.startsAt))&&Date.parse(e.startsAt)>=now&&['Seattle','Vancouver'].includes(e.region)&&(region==='all'||(region==='Tacoma'?/\btacoma\b/i.test(e.city||''):e.region===region)));}
