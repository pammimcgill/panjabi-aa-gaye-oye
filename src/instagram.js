const HOST = 'graph.facebook.com';
const VERSION = 'v24.0';
const USERNAME = '5abiaagayeoye';

function json(data, status = 200) {
  return Response.json(data, { status, headers: { 'cache-control': 'no-store' } });
}

function failure(stage, details = {}) {
  return { connected: false, host: HOST, stage, ...details };
}

async function readMeta(url, token) {
  let response;
  try {
    response = await fetch(url, {
      headers: { authorization: `Bearer ${token}` },
      redirect: 'manual'
    });
  } catch {
    return { error: failure('fetch') };
  }

  const httpStatus = response.status;
  if (httpStatus >= 300 && httpStatus < 400)
    return { error: failure('redirect', { httpStatus }) };

  let data;
  try {
    data = await response.json();
  } catch {
    return { error: failure('parse-response', { httpStatus }) };
  }

  if (!response.ok) {
    const details = { httpStatus };
    if (Number.isSafeInteger(data?.error?.code)) details.errorCode = data.error.code;
    if (Number.isSafeInteger(data?.error?.error_subcode)) details.errorSubcode = data.error.error_subcode;
    return { error: failure('meta-response', details) };
  }

  return { data, httpStatus };
}

export async function instagramStatus(request, env) {
  if (request.method !== 'GET') return json({ error: 'Method not allowed' }, 405);
  if (!env.ADMIN_KEY || request.headers.get('authorization') !== `Bearer ${env.ADMIN_KEY}`)
    return json({ error: 'Access denied' }, 403);
  if (!env.INSTAGRAM_ACCESS_TOKEN || !env.INSTAGRAM_ACCOUNT_ID)
    return json({ error: 'Instagram credentials not configured' }, 503);

  const accountId = String(env.INSTAGRAM_ACCOUNT_ID).trim();
  if (!/^\d+$/.test(accountId)) return json({ error: 'Invalid Instagram account ID' }, 400);

  const accountUrl = new URL(`https://${HOST}/${VERSION}/${accountId}`);
  accountUrl.searchParams.set('fields', 'id,username');
  const account = await readMeta(accountUrl, env.INSTAGRAM_ACCESS_TOKEN);
  if (account.error) return json(account.error, 502);
  if (account.data?.id !== accountId || account.data?.username?.toLowerCase?.() !== USERNAME)
    return json(failure('account-mismatch', { httpStatus: account.httpStatus }), 502);

  const limitUrl = new URL(`https://${HOST}/${VERSION}/${accountId}/content_publishing_limit`);
  limitUrl.searchParams.set('fields', 'quota_usage,config');
  const limit = await readMeta(limitUrl, env.INSTAGRAM_ACCESS_TOKEN);
  const quota = limit.data?.data?.[0];
  const publishingLimit = Number.isSafeInteger(quota?.quota_usage)
    ? { readable: true, usage: quota.quota_usage }
    : { readable: false, ...(limit.error && { diagnostic: limit.error }) };
  if (publishingLimit.readable && Number.isSafeInteger(quota?.config?.quota_total))
    publishingLimit.total = quota.config.quota_total;

  return json({ connected: true, accountId, username: USERNAME, publishingLimit });
}
