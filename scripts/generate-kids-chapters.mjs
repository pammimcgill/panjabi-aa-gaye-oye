import {readFile,writeFile,stat} from 'node:fs/promises';
import {createHash} from 'node:crypto';
const base=new URL('../public/kids/',import.meta.url);
const manifest=JSON.parse(await readFile(new URL('audio/chapters-pa.json',base),'utf8'));
const key=process.env.ELEVENLABS_API_KEY;
if(!key)throw new Error('Missing ELEVENLABS_API_KEY');
if(manifest.voice_id!=='hTSJyWl3f0iFc4PF12Mk'||manifest.speed!==1||manifest.chapters.length!==20||manifest.chapters.reduce((n,c)=>n+c.text.length,0)>16000)throw new Error('Unexpected narration scope');
let failed=false,index=0;
async function worker(){while(index<manifest.chapters.length){const c=manifest.chapters[index++];
if(!/^(pnw|england|east-africa|asia)-[1-5]$/.test(c.id)||c.audio!==`audio/${c.id}-pa-babaji-v1.mp3`)throw new Error('Invalid chapter filename');
const out=new URL(c.audio,base),hash=createHash('sha256').update(c.text).digest('hex');
try{if((await stat(out)).size>1000){console.log(`${c.id}: using saved recording`);continue}}catch(e){if(e.code!=='ENOENT')throw e}
try{const r=await fetch(`https://api.elevenlabs.io/v1/text-to-speech/${manifest.voice_id}?output_format=mp3_44100_128`,{method:'POST',headers:{'xi-api-key':key,'Content-Type':'application/json'},body:JSON.stringify({text:c.text,model_id:manifest.model_id,language_code:'pa',voice_settings:{stability:0.5,similarity_boost:0.75,speed:1}}),signal:AbortSignal.timeout(180000)});
if(!r.ok){console.error(`${c.id}: provider HTTP ${r.status}; no retry`);failed=true;continue}
if(!r.headers.get('content-type')?.includes('audio/'))throw new Error('Expected audio');const bytes=Buffer.from(await r.arrayBuffer());if(bytes.length<1000||bytes.length>10000000)throw new Error('Unexpected size');
await writeFile(out,bytes,{flag:'wx'});await writeFile(new URL(c.audio+'.json',base),JSON.stringify({id:c.id,text_sha256:hash,voice_id:manifest.voice_id,speed:1,bytes:bytes.length,review_status:manifest.review_status},null,2)+'\n');console.log(`${c.id}: recorded ${bytes.length} bytes`);
}catch{failed=true;console.error(`${c.id}: recording failed; no automatic retry; provider response withheld`)}
}}
await Promise.all([worker(),worker()]);if(failed)process.exitCode=1;
