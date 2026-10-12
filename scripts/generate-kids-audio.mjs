// One short, explicitly requested sample. Never log credentials or provider response bodies.
import {readFile,writeFile,stat} from 'node:fs/promises';
const output=new URL('../prototypes/audio/welcome-pa-v1.mp3',import.meta.url);
try {if((await stat(output)).size>1000){console.log('Using saved Punjabi sample; no API request.');process.exit(0)}}catch(e){if(e.code!=='ENOENT')throw e}
const sample=JSON.parse(await readFile(new URL('../prototypes/audio/welcome-pa-v1.json',import.meta.url),'utf8'));
if(sample.id!=='welcome-pa-v1'||sample.text.length>700||!sample.text.length)throw new Error('Sample exceeds approved scope');
const key=process.env.ELEVENLABS_API_KEY;
if(!key){console.error('Missing ELEVENLABS_API_KEY repository secret.');process.exit(1)}
try {
 const response=await fetch(`https://api.elevenlabs.io/v1/text-to-speech/${sample.voice_id}?output_format=mp3_44100_128`,{method:'POST',headers:{'xi-api-key':key,'Content-Type':'application/json'},body:JSON.stringify({text:sample.text,model_id:sample.model_id,language_code:sample.language_code,voice_settings:{stability:0.5,similarity_boost:0.75}}),signal:AbortSignal.timeout(120000)});
 if(!response.ok){console.error(`ElevenLabs rejected the sample (HTTP ${response.status}). Check key permissions, credits and model access. No retry made.`);process.exit(1)}
 if(!response.headers.get('content-type')?.includes('audio/'))throw new Error('Expected audio response');
 const bytes=Buffer.from(await response.arrayBuffer());
 if(bytes.length<1000||bytes.length>5000000)throw new Error('Unexpected sample size');
 await writeFile(output,bytes,{flag:'wx'});
 console.log(`Saved Punjabi welcome sample (${bytes.length} bytes); pronunciation review pending.`);
}catch{console.error('Sample generation did not complete. No automatic retry made; credentials and response body withheld.');process.exit(1)}
