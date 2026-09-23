const TELEGRAM_API = 'https://api.telegram.org';
const GITHUB_API = 'https://api.github.com';

export default {
  async fetch(request, env) {
    const url = new URL(request.url);
    if (url.pathname === '/health') return json({ ok: true, service: 'events-recap' });
    if (url.pathname === '/telegram' && request.method === 'POST') return telegramWebhook(request, env);
    if (url.pathname === '/setup' && request.method === 'POST') return setupWebhook(request, env);
    return new Response('Not found', { status: 404 });
  }
};

async function telegramWebhook(request, env) {
  const secret = request.headers.get('x-telegram-bot-api-secret-token') || '';
  if (!env.TELEGRAM_WEBHOOK_SECRET || secret !== env.TELEGRAM_WEBHOOK_SECRET) {
    return new Response('Forbidden', { status: 403 });
  }

  const update = await request.json();
  const post = update.channel_post || update.message;
  if (!post) return new Response('OK');

  const chatId = String(post.chat?.id || '');
  if (!env.TELEGRAM_RECAP_CHAT_ID || chatId !== String(env.TELEGRAM_RECAP_CHAT_ID)) {
    return new Response('OK');
  }

  const text = String(post.text || post.caption || '').trim();

  if (text.startsWith('/event ')) {
    const query = text.slice(7).trim();
    await startEvent(env, chatId, query);
    return new Response('OK');
  }
  if (text === '/status') {
    await showStatus(env, chatId);
    return new Response('OK');
  }
  if (text === '/reset') {
    await env.RECAP_KV.delete(sessionKey(chatId));
    await tg(env, 'sendMessage', { chat_id: chatId, text: 'Черновик сброшен.' });
    return new Response('OK');
  }
  if (text === '/save' || text === '/publish') {
    await finalize(env, chatId, text === '/publish');
    return new Response('OK');
  }

  await appendMaterial(env, chatId, post);
  return new Response('OK');
}

async function startEvent(env, chatId, query) {
  if (!query) {
    await tg(env, 'sendMessage', { chat_id: chatId, text: 'После /event укажи название события или его event_id.' });
    return;
  }

  const db = await githubGetJson(env, 'content/events.json');
  const events = Array.isArray(db) ? db : (db.events || []);
  const q = normalize(query);

  let matches = events.filter(e => String(e.id || '').toLowerCase() === query.toLowerCase());
  if (!matches.length) {
    matches = events.filter(e => normalize(e.title || '').includes(q));
  }

  if (matches.length !== 1) {
    const lines = matches.slice(0, 8).map(e => `• ${e.date || e.start_date || '—'} · ${e.title} · ${e.id}`);
    const msg = matches.length
      ? `Нашла несколько событий:\n\n${lines.join('\n')}\n\nПовтори /event с event_id.`
      : 'Не нашла событие. Используй название точнее или event_id из таблицы.';
    await tg(env, 'sendMessage', { chat_id: chatId, text: msg });
    return;
  }

  const event = matches[0];
  const session = {
    eventId: event.id,
    title: event.title || '',
    startedAt: new Date().toISOString(),
    notes: [],
    links: [],
    files: []
  };
  await env.RECAP_KV.put(sessionKey(chatId), JSON.stringify(session), { expirationTtl: 60 * 60 * 24 * 14 });
  await tg(env, 'sendMessage', {
    chat_id: chatId,
    text: `Собираю материалы для:\n${event.title}\n${event.date || event.start_date || ''}\n\nТеперь можно отправлять текст, фото, PDF и ссылки.\n/save — сохранить черновик\n/publish — опубликовать на сайте\n/status — проверить, что собрано`
  });
}

async function appendMaterial(env, chatId, post) {
  const session = await getSession(env, chatId);
  if (!session) return;

  const text = String(post.text || post.caption || '').trim();
  if (text && !text.startsWith('/')) {
    const urls = extractUrls(text);
    session.links.push(...urls);
    session.notes.push(text);
  }

  const photo = post.photo?.at(-1);
  if (photo?.file_id) {
    session.files.push({ type: 'photo', fileId: photo.file_id, messageId: post.message_id });
  }

  const doc = post.document;
  if (doc?.file_id) {
    session.files.push({
      type: 'document',
      fileId: doc.file_id,
      fileName: cleanFileName(doc.file_name || 'document'),
      mimeType: doc.mime_type || '',
      messageId: post.message_id
    });
  }

  session.links = [...new Set(session.links)];
  await env.RECAP_KV.put(sessionKey(chatId), JSON.stringify(session), { expirationTtl: 60 * 60 * 24 * 14 });
}

async function showStatus(env, chatId) {
  const s = await getSession(env, chatId);
  if (!s) {
    await tg(env, 'sendMessage', { chat_id: chatId, text: 'Сейчас активного события нет. Начни с /event название.' });
    return;
  }
  const photos = s.files.filter(f => f.type === 'photo').length;
  const docs = s.files.filter(f => f.type === 'document').length;
  await tg(env, 'sendMessage', {
    chat_id: chatId,
    text: `${s.title}\n\nТекстовых фрагментов: ${s.notes.length}\nФото: ${photos}\nДокументов: ${docs}\nСсылок: ${s.links.length}`
  });
}

async function finalize(env, chatId, publish) {
  const session = await getSession(env, chatId);
  if (!session) {
    await tg(env, 'sendMessage', { chat_id: chatId, text: 'Нет активного черновика. Начни с /event название.' });
    return;
  }

  const dbInfo = await githubGetFile(env, 'content/events.json');
  const db = JSON.parse(base64ToUtf8(dbInfo.content));
  const events = Array.isArray(db) ? db : (db.events || []);
  const event = events.find(e => e.id === session.eventId);
  if (!event) throw new Error('Event no longer exists in events.json');

  const assets = [];
  const photoUrls = [];
  const documentUrls = [];
  let pdfUrl = '';

  for (let i = 0; i < session.files.length; i++) {
    const item = session.files[i];
    const file = await telegramDownload(env, item.fileId);
    const ext = item.type === 'photo' ? '.jpg' : extensionFor(item.fileName, item.mimeType);
    const base = `assets/events/recaps/${safeSegment(session.eventId)}`;
    const name = item.type === 'photo'
      ? `photo-${String(i + 1).padStart(2, '0')}${ext}`
      : `doc-${String(i + 1).padStart(2, '0')}-${cleanFileName(item.fileName || 'file')}`;
    const path = `${base}/${name}`;
    assets.push({ path, binary: file.bytes });
    const publicUrl = '/' + path;
    if (item.type === 'photo') photoUrls.push(publicUrl);
    else {
      documentUrls.push(publicUrl);
      if (!pdfUrl && (item.mimeType === 'application/pdf' || ext === '.pdf')) pdfUrl = publicUrl;
    }
  }

  event.attended = true;
  event.recap_status = publish ? 'published' : 'draft';
  event.recap_title = event.recap_title || event.title;
  event.recap_notes = session.notes.join('\n\n').trim();
  event.recap_links = [...new Set([...(session.links || []), ...documentUrls])].join('\n');
  event.recap_photo_urls = photoUrls.join('\n');
  if (pdfUrl) event.recap_press_release_url = pdfUrl;
  event.recap_updated_at = new Date().toISOString().slice(0, 10);

  const updated = Array.isArray(db) ? events : { ...db, events };
  assets.push({ path: 'content/events.json', text: JSON.stringify(updated, null, 2) + '\n' });

  const sha = await githubCommit(env, assets, `${publish ? 'Publish' : 'Save'} event recap: ${event.title}`);
  await env.RECAP_KV.delete(sessionKey(chatId));

  await tg(env, 'sendMessage', {
    chat_id: chatId,
    text: `${publish ? 'Опубликовано' : 'Черновик сохранён'}: ${event.title}\nGitHub: ${sha.slice(0, 7)}`
  });
}

async function getSession(env, chatId) {
  const raw = await env.RECAP_KV.get(sessionKey(chatId));
  return raw ? JSON.parse(raw) : null;
}

const sessionKey = chatId => `recap:${chatId}`;
const normalize = value => String(value || '').toLowerCase().replace(/ё/g, 'е').replace(/[^a-zа-я0-9]+/gi, ' ').trim();

function extractUrls(text) {
  return String(text || '').match(/https?:\/\/[^\s<>"']+/g) || [];
}

function cleanFileName(name) {
  return String(name || 'file').replace(/[^a-zA-Z0-9а-яА-ЯёЁ._-]+/g, '-').slice(0, 100);
}
function safeSegment(value) {
  return String(value || '').replace(/[^a-zA-Z0-9._-]+/g, '-').slice(0, 120);
}
function extensionFor(name, mime) {
  const m = String(name || '').match(/\.[a-zA-Z0-9]{1,8}$/);
  if (m) return m[0].toLowerCase();
  if (mime === 'application/pdf') return '.pdf';
  if (mime?.startsWith('image/')) return '.jpg';
  return '.bin';
}

async function telegramDownload(env, fileId) {
  const info = await tg(env, 'getFile', { file_id: fileId });
  const response = await fetch(`${TELEGRAM_API}/file/bot${env.TELEGRAM_BOT_TOKEN}/${info.file_path}`);
  if (!response.ok) throw new Error('Could not download Telegram file');
  return { bytes: await response.arrayBuffer(), filePath: info.file_path };
}

async function setupWebhook(request, env) {
  if (!env.SETUP_SECRET || request.headers.get('x-setup-secret') !== env.SETUP_SECRET) {
    return json({ ok: false, error: 'Forbidden' }, 403);
  }
  const origin = new URL(request.url).origin;
  const result = await tg(env, 'setWebhook', {
    url: `${origin}/telegram`,
    secret_token: env.TELEGRAM_WEBHOOK_SECRET,
    allowed_updates: ['channel_post', 'message']
  });
  return json({ ok: true, webhook: `${origin}/telegram`, telegram: result });
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
  return { owner, name, branch: env.GITHUB_BRANCH || 'events-v2' };
}
async function githubGetFile(env, path) {
  const { owner, name, branch } = githubRepo(env);
  const response = await fetch(`${GITHUB_API}/repos/${owner}/${name}/contents/${path}?ref=${encodeURIComponent(branch)}`, { headers: githubHeaders(env) });
  if (!response.ok) throw new Error(`Could not read ${path}`);
  return response.json();
}
async function githubGetJson(env, path) {
  const f = await githubGetFile(env, path);
  return JSON.parse(base64ToUtf8(f.content));
}

async function githubCommit(env, files, message) {
  const { owner, name, branch } = githubRepo(env);
  const headers = githubHeaders(env);

  let response = await fetch(`${GITHUB_API}/repos/${owner}/${name}/git/ref/heads/${encodeURIComponent(branch)}`, { headers });
  if (!response.ok) throw new Error('Could not read GitHub branch');
  const ref = await response.json();
  const parent = ref.object.sha;

  response = await fetch(`${GITHUB_API}/repos/${owner}/${name}/git/commits/${parent}`, { headers });
  if (!response.ok) throw new Error('Could not read parent commit');
  const base = await response.json();

  const tree = [];
  for (const file of files) {
    if (file.binary) {
      const blobResponse = await fetch(`${GITHUB_API}/repos/${owner}/${name}/git/blobs`, {
        method: 'POST',
        headers,
        body: JSON.stringify({ content: bytesToBase64(file.binary), encoding: 'base64' })
      });
      if (!blobResponse.ok) throw new Error(`Could not upload ${file.path}`);
      const blob = await blobResponse.json();
      tree.push({ path: file.path, mode: '100644', type: 'blob', sha: blob.sha });
    } else {
      tree.push({ path: file.path, mode: '100644', type: 'blob', content: file.text });
    }
  }

  response = await fetch(`${GITHUB_API}/repos/${owner}/${name}/git/trees`, {
    method: 'POST', headers, body: JSON.stringify({ base_tree: base.tree.sha, tree })
  });
  if (!response.ok) throw new Error('Could not create tree');
  const treeResult = await response.json();

  response = await fetch(`${GITHUB_API}/repos/${owner}/${name}/git/commits`, {
    method: 'POST', headers, body: JSON.stringify({ message, tree: treeResult.sha, parents: [parent] })
  });
  if (!response.ok) throw new Error('Could not create commit');
  const commit = await response.json();

  response = await fetch(`${GITHUB_API}/repos/${owner}/${name}/git/refs/heads/${encodeURIComponent(branch)}`, {
    method: 'PATCH', headers, body: JSON.stringify({ sha: commit.sha, force: false })
  });
  if (!response.ok) throw new Error('Could not update branch');
  return commit.sha;
}

function bytesToBase64(buffer) {
  const bytes = new Uint8Array(buffer);
  let binary = '';
  for (let i = 0; i < bytes.length; i += 0x8000) binary += String.fromCharCode(...bytes.subarray(i, i + 0x8000));
  return btoa(binary);
}
function base64ToUtf8(value) {
  const binary = atob(String(value).replace(/\s/g, ''));
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
  return new TextDecoder().decode(bytes);
}
function json(data, status = 200) {
  return new Response(JSON.stringify(data), { status, headers: { 'content-type': 'application/json; charset=utf-8' } });
}
