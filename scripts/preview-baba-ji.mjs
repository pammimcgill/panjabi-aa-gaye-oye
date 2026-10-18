import {readFile,writeFile,stat} from 'node:fs/promises';
const base=new URL('../prototypes/audio/',import.meta.url);
try { if ((await stat(new URL('welcome-baba-ji.mp3',base))).size>1000) process.exit(0); } catch(e) { if(e.code!=='ENOENT')throw e; }
const key=process.env.ELEVENLABS_API_KEY;
if(!key)throw new Error('ELEVENLABS_API_KEY secret is missing');
const normalize=s=>String(s).toLowerCase().replace(/[^a-z0-9]/g,'');
try {
 const voices=[];let next;
 do {
  const url=new URL('https://api.elevenlabs.io/v2/voices');url.searchParams.set('search','baba ji');url.searchParams.set('page_size','100');if(next)url.searchParams.set('next_page_token',next);
  const r=await fetch(url,{headers:{'xi-api-key':key},signal:AbortSignal.timeout(30000)});
  if(!r.ok)throw new Error(`Voice lookup HTTP ${r.status}`);
  const data=await r.json();voices.push(...data.voices);next=data.has_more?data.next_page_token:null;
 }while(next);
 const matches=voices.filter(v=>[v.name,...Object.values(v.labels||{})].some(s=>normalize(s)==='babaji'));
 if(matches.length!==1)throw new Error(`Expected exactly one Baba Ji voice; found ${matches.length}. No audio generated.`);
 const voice=matches[0];
 const sample=JSON.parse(await readFile(new URL('welcome-pa-v2.json',base),'utf8'));
 sample.id='welcome-baba-ji';sample.voice_id=voice.voice_id;sample.voice_name=voice.name;sample.voice_direction='User-selected Baba Ji voice; slow, warm Punjabi grandfather delivery';delete sample.post_processing;
 const r=await fetch(`https://api.elevenlabs.io/v1/text-to-speech/${encodeURIComponent(voice.voice_id)}?output_format=mp3_44100_128`,{method:'POST',headers:{'xi-api-key':key,'Content-Type':'application/json'},body:JSON.stringify({text:'[slowly] '+sample.text,model_id:'eleven_v3',language_code:'pa',voice_settings:{stability:0.5,similarity_boost:0.75,speed:0.8}}),signal:AbortSignal.timeout(120000)});
 if(!r.ok)throw new Error(`Narration HTTP ${r.status}; no automatic retry`);
 if(!r.headers.get('content-type')?.includes('audio/'))throw new Error('Expected audio response');
 const bytes=Buffer.from(await r.arrayBuffer());if(bytes.length<1000||bytes.length>5000000)throw new Error('Unexpected audio size');
 await writeFile(new URL('welcome-baba-ji.mp3',base),bytes,{flag:'wx'});
 await writeFile(new URL('welcome-baba-ji.json',base),JSON.stringify(sample,null,2)+'\n');
 console.log('Baba Ji welcome sample saved. Punjabi pronunciation and voice review pending.');
}catch(e){console.error(e.message?.startsWith('Voice lookup HTTP')||e.message?.startsWith('Narration HTTP')||e.message?.startsWith('Expected exactly')?e.message:'Voice preview failed; provider details withheld.');process.exit(1);}
