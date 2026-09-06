import { submissionsStore, json, getAdminSecret } from '../lib/wg.mjs';

function authorized(request) {
  const secret = getAdminSecret();
  const supplied = request.headers.get('x-wg-admin') || '';
  return secret && supplied && supplied === secret;
}

export default async (request) => {
  if (request.method !== 'GET') return json({ ok: false, error: 'GET only' }, 405);
  if (!getAdminSecret()) return json({ ok: false, error: 'WG_ADMIN_SECRET is not configured' }, 503);
  if (!authorized(request)) return json({ ok: false, error: 'Unauthorized' }, 401);

  try {
    const store = submissionsStore();
    const { blobs } = await store.list({ prefix: 'submission/' });
    const submissions = (await Promise.all(
      blobs.map(({ key }) => store.get(key, { type: 'json', consistency: 'strong' }))
    )).filter(Boolean).sort((a, b) => String(a.createdAt).localeCompare(String(b.createdAt)));

    return json({ ok: true, submissions });
  } catch (error) {
    return json({ ok: false, error: error.message }, 500);
  }
};
