const TELEGRAM_API = 'https://api.telegram.org';

export default async (request) => {
  if (request.method !== 'POST') return new Response('OK');

  const update = await request.json();
  const message = update.message;
  if (!message) return new Response('OK');

  if (message.text === '/id' || message.text === '/start') {
    await reply(
      message.chat.id,
      `Твой Telegram ID: ${message.from?.id}\n\nПосле того как этот номер будет добавлен в TELEGRAM_ADMIN_ID, отправляй фотографию с подписью, начинающейся с #work.`
    );
    return new Response('OK');
  }

  const adminId = String(Netlify.env.get('TELEGRAM_ADMIN_ID') || '');
  if (!adminId || adminId === '0' || String(message.from?.id) !== adminId) {
    await reply(message.chat.id, 'Этот бот принимает работы только от владельца сайта. Сначала отправь /id.');
    return new Response('OK');
  }

  if (!message.photo?.length || !message.caption?.startsWith('#work')) {
    await reply(message.chat.id, 'Пришли фотографию с подписью, начинающейся с #work.');
    return new Response('OK');
  }

  try {
    const fields = parseCaption(message.caption);
    if (!fields.title || !fields.series) throw new Error('Нужны поля «Название» и «Серия».');

    const photo = message.photo.at(-1);
    const fileInfo = await tg('getFile', { file_id: photo.file_id });
    if (!fileInfo.ok) throw new Error('Telegram не отдал файл изображения.');

    const fileResponse = await fetch(`${TELEGRAM_API}/file/bot${token()}/${fileInfo.result.file_path}`);
    if (!fileResponse.ok) throw new Error('Не удалось скачать изображение из Telegram.');
    const bytes = await fileResponse.arrayBuffer();

    const slug = `${Date.now()}-${slugify(fields.title)}`;
    const imagePath = `assets/images/uploads/${slug}.jpg`;
    const series = await githubGetJson('content/series.json');
    const targetSeries = series.find(s => s.title.trim().toLowerCase() === fields.series.trim().toLowerCase());
    if (!targetSeries) throw new Error(`Серия «${fields.series}» не найдена на сайте.`);

    targetSeries.works ||= [];
    targetSeries.works.push({
      id: slug,
      title: fields.title,
      year: fields.year || new Date().getFullYear().toString(),
      materials: fields.materials || '',
      size: fields.size || '',
      image: imagePath,
      status: fields.status || 'not_for_sale',
      price: fields.price || '',
      description: fields.description || ''
    });

    await githubCommit(
      [
        { path: imagePath, content: Buffer.from(bytes).toString('base64'), encoding: 'base64' },
        { path: 'content/series.json', content: JSON.stringify(series, null, 2) + '\n', encoding: 'utf-8' }
      ],
      `Add artwork: ${fields.title}`
    );

    await reply(message.chat.id, `Работа «${fields.title}» добавлена. Netlify обновит сайт после сборки.`);
  } catch (error) {
    await reply(message.chat.id, `Не получилось добавить работу: ${error.message}`);
  }

  return new Response('OK');
};

function token() {
  return Netlify.env.get('TELEGRAM_BOT_TOKEN');
}

async function tg(method, body) {
  const response = await fetch(`${TELEGRAM_API}/bot${token()}/${method}`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify(body)
  });
  return response.json();
}

async function reply(chat_id, text) {
  return tg('sendMessage', { chat_id, text });
}

function parseCaption(text) {
  const map = {};
  const keys = {
    'название': 'title',
    'серия': 'series',
    'год': 'year',
    'материалы': 'materials',
    'размер': 'size',
    'описание': 'description',
    'статус': 'status',
    'цена': 'price'
  };

  for (const line of text.split('\n').slice(1)) {
    const index = line.indexOf(':');
    if (index < 0) continue;
    const key = line.slice(0, index).trim().toLowerCase();
    const value = line.slice(index + 1).trim();
    if (keys[key]) map[keys[key]] = value;
  }

  return map;
}

function slugify(value) {
  return value
    .toLowerCase()
    .replace(/ё/g, 'е')
    .replace(/[^a-zа-я0-9]+/gi, '-')
    .replace(/^-|-$/g, '');
}

function ghHeaders() {
  return {
    authorization: `Bearer ${Netlify.env.get('GITHUB_TOKEN')}`,
    accept: 'application/vnd.github+json',
    'x-github-api-version': '2022-11-28',
    'content-type': 'application/json'
  };
}

function repo() {
  const repository = Netlify.env.get('GITHUB_REPOSITORY');
  if (!repository?.includes('/')) throw new Error('Не задан GITHUB_REPOSITORY.');
  const [owner, name] = repository.split('/');
  return { owner, name, branch: Netlify.env.get('GITHUB_BRANCH') || 'main' };
}

async function githubGetJson(path) {
  const { owner, name, branch } = repo();
  const response = await fetch(`https://api.github.com/repos/${owner}/${name}/contents/${path}?ref=${branch}`, {
    headers: ghHeaders()
  });
  if (!response.ok) throw new Error('Не удалось прочитать каталог работ из GitHub.');
  const json = await response.json();
  return JSON.parse(Buffer.from(json.content, 'base64').toString('utf-8'));
}

async function githubCommit(files, message) {
  const { owner, name, branch } = repo();

  let response = await fetch(`https://api.github.com/repos/${owner}/${name}/git/ref/heads/${branch}`, { headers: ghHeaders() });
  if (!response.ok) throw new Error('Не удалось прочитать ветку GitHub.');
  const ref = await response.json();
  const parent = ref.object.sha;

  response = await fetch(`https://api.github.com/repos/${owner}/${name}/git/commits/${parent}`, { headers: ghHeaders() });
  if (!response.ok) throw new Error('Не удалось прочитать последний commit GitHub.');
  const base = await response.json();

  const treeItems = [];
  for (const file of files) {
    if (file.encoding === 'base64') {
      const blobResponse = await fetch(`https://api.github.com/repos/${owner}/${name}/git/blobs`, {
        method: 'POST',
        headers: ghHeaders(),
        body: JSON.stringify({ content: file.content, encoding: 'base64' })
      });
      if (!blobResponse.ok) throw new Error('Не удалось загрузить изображение в GitHub.');
      const blob = await blobResponse.json();
      treeItems.push({ path: file.path, mode: '100644', type: 'blob', sha: blob.sha });
    } else {
      treeItems.push({ path: file.path, mode: '100644', type: 'blob', content: file.content });
    }
  }

  response = await fetch(`https://api.github.com/repos/${owner}/${name}/git/trees`, {
    method: 'POST',
    headers: ghHeaders(),
    body: JSON.stringify({ base_tree: base.tree.sha, tree: treeItems })
  });
  if (!response.ok) throw new Error('Не удалось подготовить изменения GitHub.');
  const tree = await response.json();

  response = await fetch(`https://api.github.com/repos/${owner}/${name}/git/commits`, {
    method: 'POST',
    headers: ghHeaders(),
    body: JSON.stringify({ message, tree: tree.sha, parents: [parent] })
  });
  if (!response.ok) throw new Error('Не удалось создать commit GitHub.');
  const commit = await response.json();

  response = await fetch(`https://api.github.com/repos/${owner}/${name}/git/refs/heads/${branch}`, {
    method: 'PATCH',
    headers: ghHeaders(),
    body: JSON.stringify({ sha: commit.sha, force: false })
  });
  if (!response.ok) throw new Error('Не удалось обновить ветку GitHub.');
}