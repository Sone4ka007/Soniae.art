import { submissionsStore, publicStore, photosStore, json, getAdminSecret, isPhotoKey } from '../lib/wg.mjs';

function authorized(request) {
  const secret = getAdminSecret();
  const supplied = request.headers.get('x-wg-admin') || '';
  return secret && supplied && supplied === secret;
}

export default async (request) => {
  if (request.method !== 'POST') return json({ ok: false, error: 'POST only' }, 405);
  if (!getAdminSecret()) return json({ ok: false, error: 'WG_ADMIN_SECRET is not configured' }, 503);
  if (!authorized(request)) return json({ ok: false, error: 'Unauthorized' }, 401);

  try {
    const body = await request.json();
    const id = String(body.id || '');
    const action = String(body.action || '');
    if (!/^[a-f0-9-]{20,}$/i.test(id)) return json({ ok: false, error: 'Invalid submission ID' }, 400);
    if (!['approve', 'reject'].includes(action)) return json({ ok: false, error: 'Invalid action' }, 400);

    const pending = submissionsStore();
    const key = `submission/${id}`;
    const submission = await pending.get(key, { type: 'json', consistency: 'strong' });
    if (!submission) return json({ ok: false, error: 'Submission not found' }, 404);

    if (action === 'approve') {
      const approved = {
        ...submission,
        status: 'approved',
        approvedAt: new Date().toISOString()
      };
      await publicStore().setJSON(`stop/${id}`, approved, { onlyIfNew: true });
      await pending.delete(key);
      return json({ ok: true, action: 'approved', id });
    }

    if (isPhotoKey(submission.photoKey)) {
      await photosStore().delete(submission.photoKey).catch(() => {});
    }
    await pending.delete(key);
    return json({ ok: true, action: 'rejected', id });
  } catch (error) {
    return json({ ok: false, error: error.message }, 500);
  }
};
