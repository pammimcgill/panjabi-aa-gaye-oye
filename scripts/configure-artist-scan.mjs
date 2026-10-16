// Creates or reuses ONLY the dedicated artist-preview namespace, never production resources.
import {readFile,writeFile} from 'node:fs/promises';
const config=JSON.parse(await readFile('wrangler.artist-preview.json','utf8'));
if(config.name!=='panjabi-artists-review-202610'||config.routes.length||config.d1_databases)throw Error('Unsafe preview config');
if(!process.env.TICKETMASTER_API_KEY){console.log('SCAN_CONNECTION_MISSING: save TICKETMASTER_API_KEY as a repository Actions secret. Preview remains in waiting state.');process.exit(0)}
const account=process.env.CLOUDFLARE_ACCOUNT_ID,token=process.env.CLOUDFLARE_API_TOKEN;
const endpoint=`https://api.cloudflare.com/client/v4/accounts/${account}/storage/kv/namespaces`;
const headers={Authorization:`Bearer ${token}`,'Content-Type':'application/json'};
async function api(url,options={}){const r=await fetch(url,{...options,headers});const d=await r.json();if(!r.ok||!d.success)throw Error(`Dedicated preview KV setup failed (HTTP ${r.status}); check KV permission`);return d;}
const title='panjabi-artists-review-202610-scan';let namespace=null;
for(let page=1;page<=100;page++){const d=await api(endpoint+`?per_page=100&page=${page}`);namespace=d.result.find(n=>n.title===title);if(namespace||d.result.length<100)break;}
if(!namespace)namespace=(await api(endpoint,{method:'POST',body:JSON.stringify({title})})).result;
config.kv_namespaces=[{binding:'ARTIST_SCAN',id:namespace.id}];config.triggers={crons:['7,27,47 * * * *']};await writeFile('wrangler.artist-preview.json',JSON.stringify(config,null,2));
console.log('Dedicated preview scan storage and schedule configured.');
