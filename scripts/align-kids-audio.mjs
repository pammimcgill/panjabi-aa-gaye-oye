import {readFile,writeFile,mkdir} from 'node:fs/promises';
const root=new URL('../public/kids/',import.meta.url),m=JSON.parse(await readFile(new URL('audio/chapters-pa.json',root),'utf8'));
await mkdir(new URL('audio/alignment/',root),{recursive:true});
for(const c of m.chapters){
 const form=new FormData();form.set('file',new Blob([await readFile(new URL(c.audio,root))],{type:'audio/mpeg'}),c.id+'.mp3');form.set('text',c.text);
 const r=await fetch('https://api.elevenlabs.io/v1/forced-alignment',{method:'POST',headers:{'xi-api-key':process.env.ELEVENLABS_API_KEY},body:form,signal:AbortSignal.timeout(120000)});
 if(!r.ok){console.error('Alignment HTTP '+r.status+' for '+c.id+'; stopped without retry');process.exit(1)}
 const data=await r.json();if(!data.characters?.length)throw new Error('No character timings');
 await writeFile(new URL('audio/alignment/'+c.id+'.json',root),JSON.stringify(data));console.log(c.id+' aligned');
}
