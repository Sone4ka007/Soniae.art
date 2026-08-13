import { publicStore, json } from '../lib/wg.mjs';

export default async (request) => {
  if (request.method !== 'GET') return json({ ok: false, error: 'GET only' }, 405);
  try {
    const store = publicStore();
    const { blobs } = await store.list({ prefix: 'stop/' });
    const stops = (await Promise.all(
      blobs.map(({ key }) => store.get(key, { type: 'json', consistency: 'strong' }))
    )).filter(Boolean).sort((a, b) => String(a.createdAt).localeCompare(String(b.createdAt)));
    return json({ ok: true, stops }, 200, { 'cache-control': 'public, max-age=30' });
  } catch (error) {
    return json({ ok: false, error: error.message }, 500);
  }
};
