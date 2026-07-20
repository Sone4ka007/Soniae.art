const OWNER = 'Sone4ka007';
const REPO = 'Soniae.art';
const BRANCH = 'main';
const CATALOG_PATH = 'content/series.json';

const json = (statusCode, body) => ({
  statusCode,
  headers: { 'content-type': 'application/json; charset=utf-8' },
  body: JSON.stringify(body),
});

async function telegram(method, payload = {}) {
  const token = process.env.TELEGRAM_BOT_TOKEN;
  const response = await fetch(`https://api.telegram.org/bot${token}/${method}`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify(payload),
  });
  const data = await response.json();
  if (!data.ok) throw new Error(`Telegram ${method}: ${data.description || 'unknown error'}`);
  return data.result;
}

async function reply(chatId, text) {
  return telegram('sendMessage', { chat_id: chatId, text });
}

async function github(path, options = {}) {
  const response = await fetch(`https://api.github.com/repos/${OWNER}/${REPO}${path}`, {
    ...options,
    headers: {
      accept: 'application/vnd.github+json',
      authorization: `Bearer ${process.env.GITHUB_TOKEN}`,
      'x-github-api-version': '2022-11-28',
      'content-type': 'application/json',
      ...(options.headers || {}),
    },
  });
  if (!response.ok) {
    const text = await response.text();
    throw new Error(`GitHub ${response.status}: ${text}`);
  }
  return response.json();
}

function parseCaption(caption = '') {
  const aliases = {
    'название': 'title',
    'серия': 'series',
    'год': 'year',
    'материалы': 'materials',
    'техника': 'materials',
    'размер': 'size',
    'описание': 'description',
    'статус': 'status',
    'цена': 'price',
    'главная': 'featured',
  };
  const result = {};
  for (const rawLine of caption.split('\n')) {
    const line = rawLine.trim();
    const separator = line.indexOf(':');
    if (separator < 1) continue;
    const key = aliases[line.slice(0, separator).trim().toLowerCase()];
    if (!key) continue;
    result[key] = line.slice(separator + 1).trim();
  }
  return result;
}

function slugify(value) {
  const table = {
    а:'a',б:'b',в:'v',г:'g',д:'d',е:'e',ё:'e',ж:'zh',з:'z',и:'i',й:'y',к:'k',л:'l',м:'m',н:'n',о:'o',п:'p',р:'r',с:'s',т:'t',у:'u',ф:'f',х:'h',ц:'ts',ч:'ch',ш:'sh',щ:'sch',ы:'y',э:'e',ю:'yu',я:'ya',ь:'',ъ:''
  };
  return value.toLowerCase().split('').map(ch => table[ch] ?? ch).join('')
    .replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '').slice(0, 55) || 'work';
}

function normalizeStatus(value = '') {
  const v = value.toLowerCase();
  if (['доступна', 'available', 'продаётся', 'продается'].includes(v)) return 'available';
  if (['продана', 'sold'].includes(v)) return 'sold';
  return 'not_for_sale';
}

function isYes(value = '') {
  return ['да', 'yes', 'true', '1'].includes(value.toLowerCase());
}

async function addArtwork(message) {
  const chatId = message.chat.id;
  const data = parseCaption(message.caption || '');
  if (!data.title || !data.series) {
    await reply(chatId, 'Не хватает названия или серии. Отправь фото с подписью по шаблону из /help.');
    return;
  }

  const photos = message.photo || [];
  const bestPhoto = photos[photos.length - 1];
  const file = await telegram('getFile', { file_id: bestPhoto.file_id });
  const imageResponse = await fetch(`https://api.telegram.org/file/bot${process.env.TELEGRAM_BOT_TOKEN}/${file.file_path}`);
  if (!imageResponse.ok) throw new Error('Не удалось скачать изображение из Telegram');
  const imageBase64 = Buffer.from(await imageResponse.arrayBuffer()).toString('base64');

  const ref = await github(`/git/ref/heads/${BRANCH}`);
  const headSha = ref.object.sha;
  const headCommit = await github(`/git/commits/${headSha}`);
  const catalogFile = await github(`/contents/${CATALOG_PATH}?ref=${BRANCH}`);
  const series = JSON.parse(Buffer.from(catalogFile.content.replace(/\n/g, ''), 'base64').toString('utf8'));

  const requested = data.series.toLowerCase();
  const targetSeries = series.find(item =>
    item.id.toLowerCase() === requested || item.title.toLowerCase() === requested
  );
  if (!targetSeries) {
    const names = series.map(item => `• ${item.title}`).join('\n');
    await reply(chatId, `Серия не найдена. Используй одно из названий:\n${names}`);
    return;
  }

  const stamp = Date.now();
  const imagePath = `assets/images/${targetSeries.id}-${stamp}-${slugify(data.title)}.jpg`;
  const work = {
    id: `${targetSeries.id}-${stamp}`,
    title: data.title,
    series: targetSeries.title,
    seriesId: targetSeries.id,
    year: data.year || String(new Date().getFullYear()),
    materials: data.materials || '',
    size: data.size || '',
    image: imagePath,
    featured: isYes(data.featured),
    status: normalizeStatus(data.status),
    price: data.price || '',
    description: data.description || '',
  };
  targetSeries.works.push(work);

  const imageBlob = await github('/git/blobs', {
    method: 'POST',
    body: JSON.stringify({ content: imageBase64, encoding: 'base64' }),
  });
  const catalogBlob = await github('/git/blobs', {
    method: 'POST',
    body: JSON.stringify({ content: JSON.stringify(series, null, 2), encoding: 'utf-8' }),
  });
  const tree = await github('/git/trees', {
    method: 'POST',
    body: JSON.stringify({
      base_tree: headCommit.tree.sha,
      tree: [
        { path: imagePath, mode: '100644', type: 'blob', sha: imageBlob.sha },
        { path: CATALOG_PATH, mode: '100644', type: 'blob', sha: catalogBlob.sha },
      ],
    }),
  });
  const commit = await github('/git/commits', {
    method: 'POST',
    body: JSON.stringify({
      message: `Add artwork: ${data.title}`,
      tree: tree.sha,
      parents: [headSha],
    }),
  });
  await github(`/git/refs/heads/${BRANCH}`, {
    method: 'PATCH',
    body: JSON.stringify({ sha: commit.sha, force: false }),
  });

  await reply(chatId, `Готово: «${data.title}» добавлена в серию «${targetSeries.title}». Сайт обновится после deploy Netlify.`);
}

exports.handler = async (event) => {
  try {
    if (event.httpMethod !== 'POST') return json(405, { error: 'Method not allowed' });
    const expectedSecret = process.env.TELEGRAM_WEBHOOK_SECRET;
    const receivedSecret = event.headers['x-telegram-bot-api-secret-token'];
    if (!expectedSecret || receivedSecret !== expectedSecret) return json(401, { error: 'Unauthorized' });

    const update = JSON.parse(event.body || '{}');
    const message = update.message;
    if (!message) return json(200, { ok: true });
    const chatId = message.chat.id;
    const userId = String(message.from?.id || '');
    const text = message.text || '';

    if (text === '/id') {
      await reply(chatId, `Твой Telegram ID: ${userId}`);
      return json(200, { ok: true });
    }

    const adminId = String(process.env.TELEGRAM_ADMIN_ID || '');
    if (!adminId) {
      await reply(chatId, 'Бот ещё не настроен: в Netlify отсутствует TELEGRAM_ADMIN_ID.');
      return json(200, { ok: true });
    }
    if (userId !== adminId) {
      await reply(chatId, 'У тебя нет доступа к публикации работ.');
      return json(200, { ok: true });
    }

    if (text === '/start' || text === '/help') {
      await reply(chatId,
`Отправь одну фотографию работы и добавь подпись:\n\nНазвание: Утренний кофе\nСерия: Городские зарисовки\nГод: 2026\nМатериалы: смешанная техника\nРазмер: А3\nОписание: короткое описание\nСтатус: доступна\nЦена: по запросу\nГлавная: нет\n\nОбязательны только Название и Серия.`);
      return json(200, { ok: true });
    }

    if (message.photo?.length) {
      await addArtwork(message);
      return json(200, { ok: true });
    }

    await reply(chatId, 'Отправь /help, чтобы увидеть шаблон публикации.');
    return json(200, { ok: true });
  } catch (error) {
    console.error(error);
    try {
      const update = JSON.parse(event.body || '{}');
      if (update.message?.chat?.id) await reply(update.message.chat.id, `Ошибка: ${error.message}`);
    } catch (_) {}
    return json(200, { ok: false });
  }
};