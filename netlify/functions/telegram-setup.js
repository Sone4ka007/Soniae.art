exports.handler = async (event) => {
  const params = event.queryStringParameters || {};
  if (!process.env.TELEGRAM_SETUP_SECRET || params.secret !== process.env.TELEGRAM_SETUP_SECRET) {
    return { statusCode: 401, body: 'Unauthorized' };
  }

  const token = process.env.TELEGRAM_BOT_TOKEN;
  const webhookSecret = process.env.TELEGRAM_WEBHOOK_SECRET;
  const siteUrl = process.env.URL || process.env.DEPLOY_PRIME_URL;
  if (!token || !webhookSecret || !siteUrl) {
    return {
      statusCode: 500,
      headers: { 'content-type': 'application/json; charset=utf-8' },
      body: JSON.stringify({
        ok: false,
        error: 'Missing TELEGRAM_BOT_TOKEN, TELEGRAM_WEBHOOK_SECRET or Netlify URL',
      }),
    };
  }

  const webhookUrl = `${siteUrl.replace(/\/$/, '')}/.netlify/functions/telegram-bot`;
  const response = await fetch(`https://api.telegram.org/bot${token}/setWebhook`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({
      url: webhookUrl,
      secret_token: webhookSecret,
      allowed_updates: ['message'],
      drop_pending_updates: true,
    }),
  });
  const result = await response.json();
  return {
    statusCode: response.ok ? 200 : 500,
    headers: { 'content-type': 'application/json; charset=utf-8' },
    body: JSON.stringify({ ...result, webhookUrl }, null, 2),
  };
};