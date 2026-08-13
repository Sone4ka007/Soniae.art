import { photosStore, isPhotoKey } from '../lib/wg.mjs';

export default async (request) => {
  const key = new URL(request.url).searchParams.get('key') || '';
  if (!isPhotoKey(key)) return new Response('Not found', { status: 404 });
  const entry = await photosStore().getWithMetadata(key, { type: 'blob', consistency: 'strong' });
  if (!entry) return new Response('Not found', { status: 404 });
  return new Response(entry.data, {
    headers: {
      'content-type': 'image/jpeg',
      'cache-control': 'public, max-age=31536000, immutable'
    }
  });
};
