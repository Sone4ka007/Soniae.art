import { submissionsStore, json, cleanText, isArtworkId } from '../lib/wg.mjs';

export default async (request) => {
  if (request.method !== 'POST') return json({ ok: false, error: 'POST only' }, 405);
  const body = await request.json();
  const artworkId = String(body.artworkId || '').toUpperCase();
  if (!isArtworkId(artworkId)) return json({ ok: false, error: 'Invalid artwork ID' }, 400);

  const locationLabel = cleanText(body.locationLabel, 160);
  const osmRef = cleanText(body.osmRef, 40).toUpperCase();
  if (!locationLabel || !/^[NWR]\d+$/.test(osmRef)) return json({ ok: false, error: 'Choose a mapped public place' }, 400);

  const id = crypto.randomUUID();
  await submissionsStore().setJSON(`submission/${id}`, {
    id,
    artworkId,
    locationLabel,
    osmRef,
    note: cleanText(body.note, 500),
    createdAt: new Date().toISOString(),
    status: 'pending'
  });
  return json({ ok: true, id, status: 'pending' }, 201);
};
