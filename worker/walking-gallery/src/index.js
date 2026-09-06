const TELEGRAM_API = 'https://api.telegram.org';
const GITHUB_API = 'https://api.github.com';
const MAX_PHOTO_BYTES = 3 * 1024 * 1024;

export default {
  async fetch(request, env) {
    const url = new URL(request.url);

    if (request.method === 'OPTIONS' && url.pathname === '/submit') {
      return withCors(new Response(null, { status: 204 }), request, env);
    }

    if (url.pathname === '/health' && request.method === 'GET') {
      return json({ ok: true, service: 'sonya-walking-gallery' });
    }

    if (url.pathname === '/submit' && request.method === 'POST') {
      return submitStop(request, env);
    }

    if (url.pathname === '/telegram' && request.method === 'POST') {
      return telegramWebhook(request, env);
    }

    if (url.pathname === '/setup' && request.method === 'POST') {
      return setupWebhook(request, env);
    }

    return new Response('Not found', { status: 404 });
  }
};

async function submitStop(request, env) {
  if (!isAllowedOrigin(request, env)) return withCors(json({ ok: false, error: 'Origin not allowed' }, 403), request, env);
  if (!env.TELEGRAM_BOT_TOKEN || !env.TELEGRAM_ADMIN_ID) return withCors(json({ ok: false, error: 'Submission service is not configured' }, 503), request, env);

  const contentLength = Number(request.headers.get('content-length') || 0);
  if (contentLength && contentLength > MAX_PHOTO_BYTES + 256 * 1024) {
    return withCors(json({ ok: false, error: 'Upload is too large' }, 413), request, env);
  }

  try {
    const form = await request.formData();
    if (cleanText(form.get('website'), 200)) return withCors(json({ ok: true, pending: true }), request, env);

    const started = Number(form.get('formStartedAt') || 0);
    if (!started || Date.now() - started < 2500) {
      return withCors(json({ ok: false, error: 'Form submitted too quickly' }, 400), request, env);
    }

    const artworkId = cleanText(form.get('artworkId'), 20).toUpperCase();
    if (!/^SWG-\d{3,5}$/.test(artworkId)) return withCors(json({ ok: false, error: 'Invalid artwork ID' }, 400), request, env);

    const allowedArtworks = String(env.ALLOWED_ARTWORKS || '').split(',').map(x => x.trim()).filter(Boolean);
    if (allowedArtworks.length && !allowedArtworks.includes(artworkId)) {
      return withCors(json({ ok: false, error: 'Artwork is not active' }, 400), request, env);
    }

    const locationLabel = cleanText(form.get('locationLabel'), 160);
    const mapUrl = cleanText(form.get('mapUrl'), 500);
    const note = cleanText(form.get('note'), 500);
    if (!locationLabel) return withCors(json({ ok: false, error: 'Name the public place' }, 400), request, env);
    if (mapUrl && !/^https:\/\/(?:www\.)?(?:yandex\.(?:ru|com)|ya\.cc)\//i.test(mapUrl)) {
      return withCors(json({ ok: false, error: 'Use a Yandex Maps link' }, 400), request, env);
    }

    const photo = form.get('photo');
    if (!(photo instanceof File) || !photo.size) return withCors(json({ ok: false, error: 'Photo is required' }, 400), request, env);
    if (photo.type !== 'image/jpeg') return withCors(json({ ok: false, error: 'JPEG image required' }, 415), request, env);
    if (photo.size > MAX_PHOTO_BYTES) return withCors(json({ ok: false, error: 'Photo is too large' }, 413), request, env);

    const submissionId = crypto.randomUUID();
    const createdAt = new Date().toISOString();
    const photoMessage = await telegramPhoto(env, photo, `${artworkId} · ${locationLabel}`);
    const photoFileId = photoMessage.photo?.at(-1)?.file_id;
    if (!photoFileId) throw new Error('Telegram did not return a photo file ID');

    const record = {
      id: submissionId,
      artworkId,
      locationLabel,
      mapUrl,
      note,
      createdAt,
      photoFileId,
      photoMessageId: photoMessage.message_id
    };

    const human = [
      'НОВАЯ ЭКСПОЗИЦИЯ',
      artworkId,
      '',
      `Место: ${locationLabel}`,
      mapUrl ? `Яндекс: ${mapUrl}` : 'Яндекс: —',
      note ? `Комментарий: ${note}` : 'Комментарий: —',
      `Отправлено: ${createdAt}`
    ].join('\n');

    await tg(env, 'sendMessage', {
      chat_id: env.TELEGRAM_ADMIN_ID,
      reply_to_message_id: photoMessage.message_id,
      text: `${human}\n\n#SWG:${base64UrlEncode(JSON.stringify(record))}`,
      reply_markup: {
        inline_keyboard: [[
          { text: '✅ Одобрить', callback_data: 'swg:approve' },
          { text: '✕ Отклонить', callback_data: 'swg:reject' }
        ]]
      }
    });

    return withCors(json({ ok: true, pending: true, id: submissionId }, 201), request, env);
  } catch (error) {
    console.error(error);
    return withCors(json({ ok: false, error: 'Could not send submission' }, 500), request, env);
  }
}

async function telegramWebhook(request, env) {
  const suppliedSecret = request.headers.get('x-telegram-bot-api-secret-token') || '';
  if (!env.TELEGRAM_WEBHOOK_SECRET || suppliedSecret !== env.TELEGRAM_WEBHOOK_SECRET) {
    return new Response('Forbidden', { status: 403 });
  }

  const update = await request.json();
  if (update.message?.text === '/id' || update.message?.text === '/start') {
    await tg(env, 'sendMessage', {
      chat_id: update.message.chat.id,
      text: `Telegram ID: ${update.message.from?.id || 'unknown'}`
    });
    return new Response('OK');
  }

  const callback = update.callback_query;
  if (!callback) return new Response('OK');

  if (!env.TELEGRAM_ADMIN_ID || String(callback.from?.id) !== String(env.TELEGRAM_ADMIN_ID)) {
    await tg(env, 'answerCallbackQuery', { callback_query_id: callback.id, text: 'Нет доступа', show_alert: true });
    return new Response('OK');
  }

  const action = callback.data;
  if (action !== 'swg:approve' && action !== 'swg:reject') {
    await tg(env, 'answerCallbackQuery', { callback_query_id: callback.id });
    return new Response('OK');
  }

  let record;
  try {
    record = parseRecord(callback.message?.text || '');
  } catch {
    await tg(env, 'answerCallbackQuery', { callback_query_id: callback.id, text: 'Не удалось прочитать заявку', show_alert: true });
    return new Response('OK');
  }

  if (action === 'swg:reject') {
    await tg(env, 'answerCallbackQuery', { callback_query_id: callback.id, text: 'Отклонено' });
    await markModerationMessage(env, callback.message, '❌ ОТКЛОНЕНО');
    return new Response('OK');
  }

  await tg(env, 'answerCallbackQuery', { callback_query_id: callback.id, text: 'Публикую…' });

  try {
    const result = await approveSubmission(env, record);
    const status = result.alreadyPublished ? '✅ УЖЕ ОПУБЛИКОВАНО' : `✅ ОДОБРЕНО · ${result.commitSha.slice(0, 7)}`;
    await markModerationMessage(env, callback.message, status);
  } catch (error) {
    console.error(error);
    await tg(env, 'sendMessage', {
      chat_id: callback.message.chat.id,
      reply_to_message_id: callback.message.message_id,
      text: `Не удалось опубликовать. Кнопка оставлена для повторной попытки.\n${cleanText(error.message, 300)}`
    });
  }

  return new Response('OK');
}

async function approveSubmission(env, record) {
  if (!env.GITHUB_TOKEN || !env.GITHUB_REPOSITORY) throw new Error('GitHub is not configured');

  const current = await githubGetJson(env, 'content/walking-gallery-stops.json');
  const stops = Array.isArray(current) ? current : (current.stops || []);
  const existing = stops.find(stop => stop.submissionId === record.id || stop.id === record.id);
  if (existing) return { alreadyPublished: true, commitSha: '' };

  const fileInfo = await tg(env, 'getFile', { file_id: record.photoFileId });
  if (!fileInfo.file_path) throw new Error('Telegram photo is unavailable');
  const photoResponse = await fetch(`${TELEGRAM_API}/file/bot${env.TELEGRAM_BOT_TOKEN}/${fileInfo.file_path}`);
  if (!photoResponse.ok) throw new Error('Could not download Telegram photo');
  const photoBytes = await photoResponse.arrayBuffer();

  const stamp = String(record.createdAt || new Date().toISOString()).replace(/[^0-9]/g, '').slice(0, 14);
  const shortId = String(record.id).split('-')[0];
  const photoPath = `assets/wg/stops/${record.artworkId}/${stamp}-${shortId}.jpg`;
  const approvedAt = new Date().toISOString();
  const stop = {
    id: record.id,
    submissionId: record.id,
    artworkId: record.artworkId,
    locationLabel: cleanText(record.locationLabel, 160),
    mapUrl: cleanText(record.mapUrl, 500),
    note: cleanText(record.note, 500),
    photo: `/${photoPath}`,
    createdAt: record.createdAt,
    approvedAt
  };
  stops.push(stop);
  stops.sort((a, b) => String(a.createdAt).localeCompare(String(b.createdAt)));

  const commitSha = await githubCommit(env, [
    { path: photoPath, binary: photoBytes },
    { path: 'content/walking-gallery-stops.json', text: JSON.stringify({ stops }, null, 2) + '\n' }
  ], `Approve ${record.artworkId} stop: ${record.locationLabel}`);

  return { commitSha, stop, alreadyPublished: false };
}

async function markModerationMessage(env, message, status) {
  const body = stripRecord(message.text || '');
  await tg(env, 'editMessageText', {
    chat_id: message.chat.id,
    message_id: message.message_id,
    text: `${status}\n\n${body}`,
    reply_markup: { inline_keyboard: [] }
  });
}

async function setupWebhook(request, env) {
  if (!env.SETUP_SECRET || request.headers.get('x-setup-secret') !== env.SETUP_SECRET) {
    return json({ ok: false, error: 'Forbidden' }, 403);
  }
  if (!env.TELEGRAM_WEBHOOK_SECRET) return json({ ok: false, error: 'TELEGRAM_WEBHOOK_SECRET is missing' }, 503);
  const origin = new URL(request.url).origin;
  const result = await tg(env, 'setWebhook', {
    url: `${origin}/telegram`,
    secret_token: env.TELEGRAM_WEBHOOK_SECRET,
    allowed_updates: ['message', 'callback_query']
  });
  return json({ ok: true, webhook: `${origin}/telegram`, telegram: result });
}

async function telegramPhoto(env, photo, caption) {
  const body = new FormData();
  body.set('chat_id', String(env.TELEGRAM_ADMIN_ID));
  body.set('caption', caption.slice(0, 900));
  body.set('photo', photo, 'exhibition.jpg');
  const response = await fetch(`${TELEGRAM_API}/bot${env.TELEGRAM_BOT_TOKEN}/sendPhoto`, { method: 'POST', body });
  const result = await response.json();
  if (!response.ok || !result.ok) throw new Error(result.description || 'Telegram sendPhoto failed');
  return result.result;
}

async function tg(env, method, payload = {}) {
  const response = await fetch(`${TELEGRAM_API}/bot${env.TELEGRAM_BOT_TOKEN}/${method}`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify(payload)
  });
  const result = await response.json();
  if (!response.ok || !result.ok) throw new Error(result.description || `Telegram ${method} failed`);
  return result.result;
}

function parseRecord(text) {
  const match = String(text).match(/#SWG:([A-Za-z0-9_-]+)/);
  if (!match) throw new Error('Missing moderation record');
  return JSON.parse(base64UrlDecode(match[1]));
}

function stripRecord(text) {
  return String(text).replace(/\n*#SWG:[A-Za-z0-9_-]+\s*$/, '').trim();
}

function base64UrlEncode(text) {
  const bytes = new TextEncoder().encode(text);
  let binary = '';
  for (let i = 0; i < bytes.length; i += 0x8000) {
    binary += String.fromCharCode(...bytes.subarray(i, i + 0x8000));
  }
  return btoa(binary).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/g, '');
}

function base64UrlDecode(value) {
  const padded = value.replace(/-/g, '+').replace(/_/g, '/') + '='.repeat((4 - value.length % 4) % 4);
  const binary = atob(padded);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
  return new TextDecoder().decode(bytes);
}

function bytesToBase64(buffer) {
  const bytes = new Uint8Array(buffer);
  let binary = '';
  for (let i = 0; i < bytes.length; i += 0x8000) {
    binary += String.fromCharCode(...bytes.subarray(i, i + 0x8000));
  }
  return btoa(binary);
}

function base64ToUtf8(value) {
  const binary = atob(String(value).replace(/\s/g, ''));
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
  return new TextDecoder().decode(bytes);
}

function githubHeaders(env) {
  return {
    authorization: `Bearer ${env.GITHUB_TOKEN}`,
    accept: 'application/vnd.github+json',
    'x-github-api-version': '2022-11-28',
    'content-type': 'application/json'
  };
}

function githubRepo(env) {
  const [owner, name] = String(env.GITHUB_REPOSITORY || '').split('/');
  if (!owner || !name) throw new Error('Invalid GITHUB_REPOSITORY');
  return { owner, name, branch: env.GITHUB_BRANCH || 'main' };
}

async function githubGetJson(env, path) {
  const { owner, name, branch } = githubRepo(env);
  const response = await fetch(`${GITHUB_API}/repos/${owner}/${name}/contents/${path}?ref=${encodeURIComponent(branch)}`, { headers: githubHeaders(env) });
  if (!response.ok) throw new Error(`Could not read ${path} from GitHub`);
  const data = await response.json();
  return JSON.parse(base64ToUtf8(data.content));
}

async function githubCommit(env, files, message) {
  const { owner, name, branch } = githubRepo(env);
  const headers = githubHeaders(env);

  let response = await fetch(`${GITHUB_API}/repos/${owner}/${name}/git/ref/heads/${encodeURIComponent(branch)}`, { headers });
  if (!response.ok) throw new Error('Could not read GitHub branch');
  const ref = await response.json();
  const parent = ref.object.sha;

  response = await fetch(`${GITHUB_API}/repos/${owner}/${name}/git/commits/${parent}`, { headers });
  if (!response.ok) throw new Error('Could not read GitHub parent commit');
  const base = await response.json();

  const treeItems = [];
  for (const file of files) {
    if (file.binary) {
      const blobResponse = await fetch(`${GITHUB_API}/repos/${owner}/${name}/git/blobs`, {
        method: 'POST', headers, body: JSON.stringify({ content: bytesToBase64(file.binary), encoding: 'base64' })
      });
      if (!blobResponse.ok) throw new Error(`Could not upload ${file.path}`);
      const blob = await blobResponse.json();
      treeItems.push({ path: file.path, mode: '100644', type: 'blob', sha: blob.sha });
    } else {
      treeItems.push({ path: file.path, mode: '100644', type: 'blob', content: file.text });
    }
  }

  response = await fetch(`${GITHUB_API}/repos/${owner}/${name}/git/trees`, {
    method: 'POST', headers, body: JSON.stringify({ base_tree: base.tree.sha, tree: treeItems })
  });
  if (!response.ok) throw new Error('Could not prepare GitHub tree');
  const tree = await response.json();

  response = await fetch(`${GITHUB_API}/repos/${owner}/${name}/git/commits`, {
    method: 'POST', headers, body: JSON.stringify({ message, tree: tree.sha, parents: [parent] })
  });
  if (!response.ok) throw new Error('Could not create GitHub commit');
  const commit = await response.json();

  response = await fetch(`${GITHUB_API}/repos/${owner}/${name}/git/refs/heads/${encodeURIComponent(branch)}`, {
    method: 'PATCH', headers, body: JSON.stringify({ sha: commit.sha, force: false })
  });
  if (!response.ok) throw new Error('Could not update GitHub branch; retry approval');
  return commit.sha;
}

function cleanText(value, max = 300) {
  if (typeof value !== 'string') return '';
  return value.replace(/[<>]/g, '').trim().slice(0, max);
}

function isAllowedOrigin(request, env) {
  const origin = request.headers.get('origin') || '';
  const allowed = String(env.ALLOWED_ORIGINS || 'https://sonyae.art').split(',').map(x => x.trim()).filter(Boolean);
  return Boolean(origin) && allowed.includes(origin);
}

function withCors(response, request, env) {
  const origin = request.headers.get('origin') || '';
  if (!origin || !isAllowedOrigin(request, env)) return response;
  const headers = new Headers(response.headers);
  headers.set('access-control-allow-origin', origin);
  headers.set('access-control-allow-methods', 'POST, OPTIONS');
  headers.set('access-control-allow-headers', 'content-type');
  headers.set('vary', 'Origin');
  return new Response(response.body, { status: response.status, statusText: response.statusText, headers });
}

function json(data, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { 'content-type': 'application/json; charset=utf-8', 'cache-control': 'no-store' }
  });
}
