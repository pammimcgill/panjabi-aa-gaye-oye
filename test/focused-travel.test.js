import test from 'node:test';
import assert from 'node:assert/strict';
import {isMajorI5Closure,parseBorderWaits} from '../src/travel.js';
import {githubRead} from '../src/worker.js';
test('only major I-5 closures, not routine traffic or other highways',()=>{
 for(const title of ['I-5 northbound closed','I-5 all lanes blocked']) assert.ok(isMajorI5Closure({title,description:''}));
 for(const title of ['I-405 northbound closed','I-5 right lane closed','I-5 traffic delays']) assert.equal(isMajorI5Closure({title,description:''}),false);
});
test('border data never represents stale readings as current waits',()=>{
 const d={features:[{attributes:{OBJECTID:1,BorderReadingTime:1000,BorderCrossingDescription:'I-5 General Purpose',WaitTimeText:'5 Min'}}]};
 assert.match(parseBorderWaits(d,2000)[0].description,/5 Min/);
 assert.match(parseBorderWaits(d,3600000)[0].description,/unavailable/);
});
test('public GitHub reads recover from revoked token without leaking authorization',async t=>{
 const calls=[];t.mock.method(globalThis,'fetch',async (url,options)=>{calls.push(options.headers);return new Response('[]',{status:calls.length===1?401:200})});
 assert.equal((await githubRead('https://api.github.com/repos/pammimcgill/panjabi-aa-gaye-oye/issues',{GITHUB_TOKEN:'expired'})).status,200);
 assert.equal(calls.length,2);assert.equal(calls[1].authorization,undefined);
});
