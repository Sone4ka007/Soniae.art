import { getStore } from '@netlify/blobs';

export const submissionsStore = () => getStore({ name: 'wg-submissions', consistency: 'strong' });
export const publicStore = () => getStore({ name: 'wg-public', consistency: 'strong' });
export const photosStore = () => getStore({ name: 'wg-photos', consistency: 'strong' });

export function env(name) {
  return globalThis.Netlify?.env?.get?.(name) ?? process.env[name];
}

export function getAdminSecret() {
  return env('WG_ADMIN_SECRET') || env('TELEGRAM_SETUP_SECRET') || '';
}

export function json(data, status = 200, extraHeaders = {}) {
  return new Response(JSON.stringify(data), {
    status,
    headers: {
      'content-type': 'application/json; charset=utf-8',
      'cache-control': 'no-store',
      ...extraHeaders
    }
  });
}

export function cleanText(value, max = 300) {
  if (typeof value !== 'string') return '';
  return value.replace(/[<>]/g, '').trim().slice(0, max);
}

export function cleanNumber(value, min, max) {
  const n = Number(value);
  if (!Number.isFinite(n) || n < min || n > max) return null;
  return n;
}

export function isArtworkId(value) {
  return /^SWG-\d{3,5}$/.test(String(value || ''));
}

export function isPhotoKey(value) {
  return /^SWG-\d{3,5}\/[a-f0-9-]{20,}\.jpg$/i.test(String(value || ''));
}
