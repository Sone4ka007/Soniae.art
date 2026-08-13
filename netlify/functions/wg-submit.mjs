import { publicStore, json, cleanText, isArtworkId } from '../lib/wg.mjs';

export default async (request) => {
  if (request.method !== 'POST') return json({ ok: false, error: 'POST only' }, 405);
  try {
    const body = await request.json();
    if (body.website) return json({ ok: true });
    const started = Number(body.formStartedAt || 0);
    if (!started || Date.now() - started < 2500) return json({ ok: false, error: 'Form submitted too quickly' }, 400);

    const artworkId = String(body.artworkId || '').toUpperCase();
    if (!isArtworkId(artworkId)) return json({ ok: false, error: 'Invalid artwork ID' }, 400);

    const locationLabel = cleanText(body.locationLabel, 160);
    const osmRef = cleanText(body.osmRef, 40).toUpperCase();
    if (!locationLabel || !/^[NWR]\d+$/.test(osmRef)) return json({ ok: false, error: 'Choose a mapped public place' }, 400);

    const id = crypto.randomUUID();
    const stop = {
      id,
      artworkId,
      locationLabel,
      osmRef,
      note: cleanText(body.note, 500),
      photoLink: cleanText(body.photoLink, 300),
      createdAt: new Date().toISOString(),
      status: 'approved'
    };
    await publicStore().setJSON(`stop/${id}`, stop);
    return json({ ok: true, id }, 201);
  } catch (error) {
    return json({ ok: false, error: error.message }, 500);
  }
};
