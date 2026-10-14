// One bounded design request for the user's older, raspy Punjabi grandfather voice.
import {readFile,writeFile,stat} from 'node:fs/promises';
const dir=new URL('../prototypes/audio/',import.meta.url);
try{if((await stat(new URL('grandfather-pa-v2-1.mp3',dir))).size>1000){console.log('Using saved grandfather voice previews.');process.exit(0)}}catch(e){if(e.code!=='ENOENT')throw e}
const sample=JSON.parse(await readFile(new URL('welcome-pa-v1.json',dir),'utf8'));
const description='An elderly Punjabi man in his late seventies or eighties, a warm grandfather telling stories to young grandchildren. Native Punjabi pronunciation and natural Punjabi cadence. A low, weathered, distinctly raspy and gently gravelly voice with audible age, but clear intelligible words. Speak slowly and unhurriedly, with generous natural pauses between sentences and a gentle affectionate smile. Intimate conversational storytelling, not an announcer. Clean studio recording, no music or background noise.';
const key=process.env.ELEVENLABS_API_KEY;if(!key)throw new Error('Missing ELEVENLABS_API_KEY');
try{
const response=await fetch('https://api.elevenlabs.io/v1/text-to-voice/design?output_format=mp3_44100_128',{method:'POST',headers:{'xi-api-key':key,'Content-Type':'application/json'},body:JSON.stringify({voice_description:description,model_id:'eleven_ttv_v3',text:sample.text,auto_generate_text:false,seed:14026}),signal:AbortSignal.timeout(120000)});
if(!response.ok){let code='';try{const b=await response.json();if(/^[a-z_]+$/.test(b.detail?.status))code=b.detail.status}catch{}console.error(`Voice Design failed: HTTP ${response.status} ${code}. No retry made. Check Voice Design permission on the saved key.`);process.exit(1)}
const result=await response.json();if(!result.previews?.length||result.previews.length>3)throw Error('Unexpected previews');
const metadata=[];for(const [i,p] of result.previews.entries()){const bytes=Buffer.from(p.audio_base_64,'base64');if(bytes.length<1000||bytes.length>5000000)throw Error('Unexpected audio size');await writeFile(new URL(`grandfather-pa-v2-${i+1}.mp3`,dir),bytes,{flag:'wx'});metadata.push({file:`grandfather-pa-v2-${i+1}.mp3`,generated_voice_id:p.generated_voice_id,duration_secs:p.duration_secs,language:p.language});}
await writeFile(new URL('grandfather-pa-v2.json',dir),JSON.stringify({description,model:'eleven_ttv_v3',text:sample.text,english:sample.english,review_status:'User listening review pending; synthetic voice, no real person cloned',previews:metadata},null,2));console.log(`Saved ${metadata.length} grandfather voice candidates from one design request.`);
}catch{console.error('Voice design failed; no retry made. Credentials and provider response withheld.');process.exit(1)}
