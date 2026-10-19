import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
import {createHash} from 'node:crypto';
const root=new URL('../public/kids/',import.meta.url);
const html=fs.readFileSync(new URL('index.html',root),'utf8');
const manifest=JSON.parse(fs.readFileSync(new URL('audio/chapters-pa.json',root),'utf8'));
test('twenty unique recordings match visible chapters and script hashes',()=>{
 const library=vm.runInNewContext(html.split('<script>')[1].split('const $=')[0]+';library');
 assert.equal(manifest.chapters.length,20);assert.equal(new Set(manifest.chapters.map(c=>c.id)).size,20);
 assert.equal(manifest.speed,1);assert.equal(manifest.voice_id,'hTSJyWl3f0iFc4PF12Mk');
 for(const [region,r]of Object.entries(library))for(const [index,c]of r.chapters.entries()){
  const recording=manifest.chapters.find(x=>x.id===`${region}-${index+1}`);assert.ok(recording);assert.equal(recording.english,c.young);
  const bytes=fs.readFileSync(new URL(recording.audio,root));assert.ok(bytes.length>1000);
  const meta=JSON.parse(fs.readFileSync(new URL(recording.audio+'.json',root),'utf8'));
  assert.equal(meta.text_sha256,createHash('sha256').update(recording.text).digest('hex'));assert.equal(meta.voice_id,manifest.voice_id);assert.equal(meta.speed,1);assert.equal(meta.bytes,bytes.length);
 }
});
