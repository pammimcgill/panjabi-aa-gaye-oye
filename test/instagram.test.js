import assert from 'node:assert/strict';
import { test } from 'node:test';
import { instagramStatus } from '../src/instagram.js';

const id = '17841452446234060';
const env = { ADMIN_KEY: 'admin-secret', INSTAGRAM_ACCESS_TOKEN: 'meta-secret', INSTAGRAM_ACCOUNT_ID: id };
function request(method = 'GET', authorization = 'Bearer admin-secret') {
  return new Request('https://example.com/api/admin/instagram/status', {
    method, headers: authorization ? { authorization } : {}
  });
}

test('validates method, authorization and configuration before fetching', async t => {
  const fetch = t.mock.method(globalThis, 'fetch');
  for (const [input, bindings, status] of [
    [request('POST'), env, 405],
    [request('GET', ''), env, 403],
    [request('GET', 'Bearer wrong'), env, 403],
    [request(), { ...env, INSTAGRAM_ACCESS_TOKEN: '' }, 503],
    [request(), { ...env, INSTAGRAM_ACCOUNT_ID: 'not-an-id' }, 400]
  ]) assert.equal((await instagramStatus(input, bindings)).status, status);
  assert.equal(fetch.mock.callCount(), 0);
});

test('confirms the configured account and reads its quota without a write', async t => {
  const fetch = t.mock.method(globalThis, 'fetch', async (url, options) => {
    assert.equal(url.origin, 'https://graph.facebook.com');
    assert.equal(options.redirect, 'manual');
    assert.equal(options.method ?? 'GET', 'GET');
    assert.equal(options.headers.authorization, 'Bearer meta-secret');
    assert.equal(url.searchParams.has('access_token'), false);
    return url.pathname.endsWith('/content_publishing_limit')
      ? Response.json({ data: [{ quota_usage: 2, config: { quota_total: 100 } }] })
      : Response.json({ id, username: '5abiaagayeoye' });
  });
  const response = await instagramStatus(request(), env);
  assert.equal(response.headers.get('cache-control'), 'no-store');
  assert.deepEqual(await response.json(), {
    connected: true, accountId: id, username: '5abiaagayeoye',
    publishingLimit: { readable: true, usage: 2, total: 100 }
  });
  assert.equal(fetch.mock.callCount(), 2);
});

test('returns only sanitized diagnostics for Meta failures', async t => {
  for (const [reply, stage, code] of [
    [() => { throw new Error('meta-secret'); }, 'fetch'],
    [() => Response.redirect('https://example.com/meta-secret'), 'redirect'],
    [() => new Response('meta-secret'), 'parse-response'],
    [() => Response.json({ error: { code: 190, message: 'meta-secret' } }, { status: 400 }), 'meta-response', 190],
    [() => Response.json({ error: { code: 200, error_subcode: 'meta-secret' } }, { status: 403 }), 'meta-response', 200],
    [() => Response.json({ id: '123', username: '5abiaagayeoye' }), 'account-mismatch'],
    [() => Response.json({ id, username: 'meta-secret' }), 'account-mismatch']
  ]) {
    const fetch = t.mock.method(globalThis, 'fetch', reply);
    const response = await instagramStatus(request(), env);
    assert.equal(response.status, 502);
    const body = await response.text();
    assert.doesNotMatch(body, /meta-secret|admin-secret/);
    assert.equal(JSON.parse(body).stage, stage);
    assert.equal(JSON.parse(body).errorCode, code);
    assert.equal(fetch.mock.callCount(), 1);
    fetch.mock.restore();
  }
});

test('reports permission failure separately from successful account lookup', async t => {
  t.mock.method(globalThis, 'fetch', async url => url.pathname.endsWith('/content_publishing_limit')
    ? Response.json({ error: { code: 200 } }, { status: 403 })
    : Response.json({ id, username: '5abiaagayeoye' }));
  const result = await (await instagramStatus(request(), env)).json();
  assert.equal(result.connected, true);
  assert.equal(result.publishingLimit.readable, false);
  assert.equal(result.publishingLimit.diagnostic.errorCode, 200);
});
