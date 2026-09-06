import { submissionsStore, photosStore, json, cleanText, isArtworkId, isPhotoKey } from '../lib/wg.mjs';

export default async (request) => {
  if (request.method !== 'POST') return json({ ok: false, error: 'POST only' }, 405);

  try {
    const body = await request.json();
    if (body.website) return json({ ok: true, status: 'ignored' }, 202);

    const started = Number(body.formStartedAt || 0);
    if (!started || Date.now() - started < 2500) {
      return json({ ok: false, error: 'Form submitted too quickly' }, 400);
    }

    const artworkId = String(body.artworkId || '').toUpperCase();
    if (!isArtworkId(artworkId)) return json({ ok: false, error: 'Invalid artwork ID' }, 400);

    const locationLabel = cleanText(body.locationLabel, 160);
    const mapUrl = cleanText(body.mapUrl, 500);
    const photoKey = cleanText(body.photoKey, 240);

    if (!locationLabel) return json({ ok: false, error: 'Name the public place' }, 400);
    if (mapUrl && !/^https:\/\/(?:www\.)?(?:yandex\.(?:ru|com)(?:\/maps)?|ya\.cc)\//i.test(mapUrl)) {
      return json({ ok: false, error: 'Use a Yandex Maps link' }, 400);
    }
    if (!isPhotoKey(photoKey) || !photoKey.startsWith(`${artworkId}/`)) {
      return json({ ok: false, error: 'A photo of this artwork is required' }, 400);
    }

    const photo = await photosStore().getWithMetadata(photoKey, { type: 'blob', consistency: 'strong' });
    if (!photo || photo.metadata?.artworkId !== artworkId) {
      return json({ ok: false, error: 'Uploaded photo was not found' }, 400);
    }

    const id = crypto.randomUUID();
    const submission = {
      id,
      artworkId,
      locationLabel,
      mapUrl,
      note: cleanText(body.note, 500),
      photoKey,
      photoUrl: `/.netlify/functions/wg-photo?key=${encodeURIComponent(photoKey)}`,
      createdAt: new Date().toISOString(),
      status: 'pending'
    };

    await submissionsStore().setJSON(`submission/${id}`, submission, { onlyIfNew: true });
    return json({ ok: true, id, status: 'pending' }, 202);
  } catch (error) {
    return json({ ok: false, error: error.message }, 500);
  }
};
