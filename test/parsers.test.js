import test from 'node:test';
import assert from 'node:assert/strict';
import { extractJsonLdEvents, parseFeed, stableId } from '../src/parsers.js';

test('extracts an Event from JSON-LD',()=>{
  const html=`<script type="application/ld+json">{"@type":"Event","name":"Punjabi Night","startDate":"2027-01-03T19:00:00-08:00","url":"/show","location":{"@type":"Place","name":"The Hall","address":{"addressLocality":"Seattle"}}}</script>`;
  const rows=extractJsonLdEvents(html,'https://example.com/calendar');
  assert.equal(rows.length,1);assert.equal(rows[0].title,'Punjabi Night');assert.equal(rows[0].url,'https://example.com/show');
});

test('parses RSS items without copying markup',()=>{
  const xml=`<rss><channel><item><title><![CDATA[New Punjabi release]]></title><description><![CDATA[<b>Short</b> description]]></description><link>https://example.com/story</link><pubDate>Wed, 09 Sep 2026 10:00:00 GMT</pubDate></item></channel></rss>`;
  const rows=parseFeed(xml,'https://example.com/feed');
  assert.equal(rows[0].dek,'Short description');assert.equal(rows[0].url,'https://example.com/story');
});

test('stable ids are deterministic',()=>assert.equal(stableId('x','same'),stableId('x','same')));
