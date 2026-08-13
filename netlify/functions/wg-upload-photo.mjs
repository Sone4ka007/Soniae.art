import { photosStore, json, isArtworkId } from '../lib/wg.mjs';

const MAX_BYTES = 3 * 1024 * 1024;

export default async (request) => {
  if (request.method !== 'POST') return json({ ok: false, error: 'POST only' }, 405);
  try {
    const url = new URL(request.url);
    const artworkId = String(url.searchParams.get('artworkId') || '').toUpperCase();
    if (!isArtworkId(artworkId)) return json({ ok: false, error: 'Invalid artwork ID' }, 400);

    const type = String(request.headers.get('content-type') || '').split(';')[0].trim().toLowerCase();
    if (type !== 'image/jpeg') return json({ ok: false, error: 'JPEG image required' }, 415);

    const blob = await request.blob();
    if (!blob.size) return json({ ok: false, error: 'Empty image' }, 400);
    if (blob.size > MAX_BYTES) return json({ ok: false, error: 'Image is too large' }, 413);

    const key = `${artworkId}/${crypto.randomUUID()}.jpg`;
    await photosStore().set(key, blob, {
      metadata: {
        artworkId,
        contentType: 'image/jpeg',
        createdAt: new Date().toISOString()
      },
      onlyIfNew: true
    });

    return json({ ok: true, photoKey: key, photoUrl: `/.netlify/functions/wg-photo?key=${encodeURIComponent(key)}` }, 201);
  } catch (error) {
    return json({ ok: false, error: error.message }, 500);
  }
};
