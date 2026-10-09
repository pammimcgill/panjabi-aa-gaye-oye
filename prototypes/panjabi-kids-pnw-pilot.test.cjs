// Run: node --test prototypes/panjabi-kids-pnw-pilot.test.cjs
// Static smoke tests; browser interaction and historical accuracy require separate review.
const {test}=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const html=fs.readFileSync(path.join(__dirname,'panjabi-kids-pnw-pilot.html'),'utf8');
test('five chapters and story-first reading surface',()=>{
 assert.equal((html.match(/title:"/g)||[]).length,5);
 assert.match(html,/<article class="panel"/);
 assert.match(html,/id="story"/);
 assert.match(html,/id="question"/);
});
test('two modes and browser-only progress',()=>{
 assert.match(html,/<option value="young">Young Readers<\/option>/);
 assert.match(html,/<option value="grown">Grown-Ups<\/option>/);
 assert.match(html,/panjabi-kids-reading-mode/);
 assert.match(html,/panjabi-kids-pnw-seen/);
 assert.match(html,/localStorage/);
});
test('narration honestly disabled pending review',()=>{
 assert.match(html,/Audio awaiting review/);
 assert.match(html,/<button disabled aria-disabled="true">/);
});
test('no live AI calls, tracking, or destructive production config',()=>{
 assert.doesNotMatch(html,/<script[^>]+src=/);
 assert.doesNotMatch(html,/\bfetch\s*\(/);
 assert.doesNotMatch(html,/\bXMLHttpRequest\b/);
 assert.doesNotMatch(html,/\bwrangler\b|\bD1\b|adsbygoogle|google-analytics/);
});
test('history is presented as editorial material',()=>{
 assert.match(html,/Editorial demonstration only/);
 assert.match(html,/not historical evidence/);
 assert.match(html,/Bellingham in 1907/);
 assert.match(html,/Komagata Maru/);
});
