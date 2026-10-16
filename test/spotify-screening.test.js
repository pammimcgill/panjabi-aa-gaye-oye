import test from 'node:test';
import assert from 'node:assert/strict';
import { screenEventIdentity } from '../src/config.js';
test('Spotify adds identities without bypassing existing exclusions', () => {
  assert.equal(screenEventIdentity({title:'Aman Hothi Live'}).reason,'spotify_artist');
  assert.equal(screenEventIdentity({title:'Aniket Live'}).keep,false);
  assert.equal(screenEventIdentity({title:'Live show',performers:['Aniket']}).reason,'spotify_artist');
  assert.equal(screenEventIdentity({title:'Reserved Parking - Aman Hothi'}).keep,false);
  assert.equal(screenEventIdentity({title:'Indian Motorcycle Expo',performers:['Aman Hothi']}).keep,false);
  assert.equal(screenEventIdentity({title:'Regular Sunday Program',performers:['Aman Hothi']},{type:'religious'}).keep,false);
  assert.equal(screenEventIdentity({title:'Generic show',description:'Aman Hothi'}).keep,false);
});
