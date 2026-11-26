function json(data, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: {
      'content-type': 'application/json; charset=utf-8',
      'cache-control': 'no-store'
    }
  });
}

export async function instagramStatus(request, env) {
  if (request.method !== 'GET')
    return json({ error: 'Method not allowed' }, 405);

  if (!env.ADMIN_KEY ||
      request.headers.get('authorization') !== `Bearer ${env.ADMIN_KEY}`)
    return json({ error: 'Access denied' }, 403);

  if (!env.INSTAGRAM_ACCESS_TOKEN || !env.INSTAGRAM_ACCOUNT_ID)
    return json({ error: 'Instagram credentials not configured' }, 503);

  const accountId = String(env.INSTAGRAM_ACCOUNT_ID).trim();

  if (!/^\d+$/.test(accountId))
    return json({ error: 'Invalid Instagram account ID' }, 400);

  try {
    const url = new URL(
      `https://graph.facebook.com/v24.0/${accountId}`
    );

    url.searchParams.set('fields', 'id,username');

    const response = await fetch(url, {
      headers: {
        authorization: `Bearer ${env.INSTAGRAM_ACCESS_TOKEN}`
      },
      redirect: 'error'
    });

    const data = await response.json();

    if (!response.ok) {
      return json({
        connected: false,
        httpStatus: response.status,
        errorCode: data.error?.code,
        errorSubcode: data.error?.error_subcode
      }, 502);
    }

    return json({
      connected: true,
      accountId: data.id,
      username: data.username
    });

  } catch {
    return json({
      connected: false,
      error: 'Instagram connection failed'
    }, 502);
  }
}
