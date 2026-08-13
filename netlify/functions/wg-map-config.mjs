export default async () => {
  const key = globalThis.Netlify?.env?.get?.('YANDEX_TILES_API_KEY') || process.env.YANDEX_TILES_API_KEY || '';
  return new Response(JSON.stringify({ ok: true, configured: Boolean(key), apiKey: key }), {
    status: 200,
    headers: {
      'content-type': 'application/json; charset=utf-8',
      'cache-control': 'private, max-age=300'
    }
  });
};
