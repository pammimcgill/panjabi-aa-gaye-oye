import test from 'node:test';
import assert from 'node:assert/strict';
import { categoryFor, screenEventIdentity } from '../src/config.js';
import { issueField, normalizeEvent } from '../src/collectors.js';

const venue={key:'stg',name:'Seattle Theatre Group',type:'venue',region:'Seattle',city:'Seattle',url:'https://example.com/events'};
const religious={key:'gsswa',name:'Gurdwara Singh Sabha of Washington',type:'religious',region:'Seattle',city:'Renton',url:'https://example.com'};

test('keeps clearly relevant event titles',()=>{
  for(const title of ['Punjabi Bhangra Night','Diljit Dosanjh Live','Diwali: Lights of India','Qawwali Night','Bollywood DJ Night','Desi Nights','Zakir Khan Live','Hasan Minhaj: New Tour']){
    assert.equal(screenEventIdentity({title},venue).keep,true,title);
  }
});

test('rejects add-ons, known noise and generic venue listings',()=>{
  for(const title of ['Amplified Access - Diljit Dosanjh','Reserved Parking - Punjabi Night','School of Rock','Seattle Comedy Showcase','Generic DJ Dance Party','test2']){
    assert.equal(screenEventIdentity({title},venue).keep,false,title);
  }
});

test('categorizes South Asian comedy and DJ events separately',()=>{
  assert.equal(categoryFor('Zakir Khan stand-up comedy live'),'comedy');
  assert.equal(categoryFor('Bollywood DJ Night'),'nightlife');
});

test('does not confuse non-South-Asian uses of Indian with relevant events',()=>{
  assert.equal(screenEventIdentity({title:'Native Indian Art Fair'},venue).keep,false);
  assert.equal(screenEventIdentity({title:'Indian Motorcycle Expo'},venue).keep,false);
});

test('routine Gurdwara programs are rejected while special programs remain',()=>{
  const routine={title:'Regular Sunday Program',description:'Weekly Kirtan, Divan and Langar.',startsAt:'2027-01-03T17:00:00Z',url:'https://example.com/sunday'};
  const youth={...routine,title:'Family Youth Kirtan Darbar'};
  const special={...routine,title:'Special Gurpurab Program'};
  assert.equal(screenEventIdentity(routine,religious).reason,'routine_gurdwara_program');
  assert.equal(screenEventIdentity(youth,religious).reason,'routine_gurdwara_program');
  assert.equal(normalizeEvent(routine,religious),null);
  assert.equal(screenEventIdentity(special,religious).keep,true);
  assert.ok(normalizeEvent(special,religious));
});

test('reads event fields from a GitHub issue form',()=>{
  const body='### Event link\n\nhttps://example.com/show\n\n### Event title\n\nPunjabi Comedy Night\n\n### Start date and time\n\n2027-02-03T19:00:00-08:00';
  assert.equal(issueField(body,'Event link'),'https://example.com/show');
  assert.equal(issueField(body,'Event title'),'Punjabi Comedy Night');
});
