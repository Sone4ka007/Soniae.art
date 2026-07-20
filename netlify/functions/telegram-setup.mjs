const TELEGRAM_API = 'https://api.telegram.org';

export default async (request) => {
  const url = new URL(request.url);
  const suppliedSecret = url.searchParams.get('secret');
  const setupSecret = Netlify.env.get('TELEGRAM_SETUP_SECRET');
  const botToken = Netlify.env.get('TELEGRAM_BOT_TOKEN');

  if (!setupSecret) {
    return json({ ok: false, error: 'TELEGRAM_SETUP_SECRET не задан в Netlify.' }, 500);
  }

  if (suppliedSecret !== setupSecret) {
    return json({ ok: false, error: 'Неверный setup secret.' }, 403);
  }

  if (!botToken) {
    return json({ ok: false, error: 'TELEGRAM_BOT_TOKEN не задан в Netlify.' }, 500);
  }

  const webhookUrl = `${url.origin}/.netlify/functions/telegram-bot`;
  const response = await fetch(`${TELEGRAM_API}/bot${botToken}/setWebhook`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ url: webhookUrl, drop_pending_updates: true })
  });

  const result = await response.json();
  return json({ ...result, webhook_url: webhookUrl }, result.ok ? 200 : 500);
};

function json(data, status = 200) {
  return new Response(JSON.stringify(data, null, 2), {
    status,
    headers: { 'content-type': 'application/json; charset=utf-8' }
  });
}
