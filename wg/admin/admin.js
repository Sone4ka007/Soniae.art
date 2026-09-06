const login = document.getElementById('login');
const queue = document.getElementById('queue');
const loginForm = document.getElementById('login-form');
const secretInput = document.getElementById('secret');
const loginStatus = document.getElementById('login-status');
const queueStatus = document.getElementById('queue-status');
const items = document.getElementById('items');
const count = document.getElementById('count');
const refresh = document.getElementById('refresh');
const logout = document.getElementById('logout');
let secret = sessionStorage.getItem('wg_admin_secret') || '';

const esc = value => String(value || '').replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const date = value => value ? new Date(value).toLocaleString('ru-RU') : '';

async function api(path, options = {}) {
  const response = await fetch(path, {
    ...options,
    headers: {
      ...(options.headers || {}),
      'x-wg-admin': secret
    }
  });
  const data = await response.json().catch(() => ({}));
  if (!response.ok || !data.ok) throw new Error(data.error || `HTTP ${response.status}`);
  return data;
}

async function load() {
  queueStatus.textContent = 'Загрузка…';
  try {
    const data = await api('/.netlify/functions/wg-admin-list');
    login.classList.add('is-hidden');
    queue.classList.remove('is-hidden');
    count.textContent = data.submissions.length;
    queueStatus.textContent = data.submissions.length ? '' : 'Очередь пуста.';
    items.innerHTML = data.submissions.map(card).join('');
    items.querySelectorAll('[data-action]').forEach(button => button.addEventListener('click', act));
  } catch (error) {
    sessionStorage.removeItem('wg_admin_secret');
    secret = '';
    login.classList.remove('is-hidden');
    queue.classList.add('is-hidden');
    loginStatus.textContent = error.message;
  }
}

function card(item) {
  const note = item.note ? `<p>${esc(item.note)}</p>` : '';
  const map = item.mapUrl ? `<p><a href="${esc(item.mapUrl)}" target="_blank" rel="noopener">Открыть место в Яндекс Картах ↗</a></p>` : '<p><small>Ссылка на карту не приложена</small></p>';
  return `<article class="item" data-id="${esc(item.id)}"><a class="item-photo" href="${esc(item.photoUrl)}" target="_blank" rel="noopener"><img src="${esc(item.photoUrl)}" alt=""></a><div class="item-meta"><small>${esc(item.artworkId)} · ${date(item.createdAt)}</small><h2>${esc(item.locationLabel)}</h2>${note}${map}<div class="item-actions"><button type="button" data-action="approve" data-id="${esc(item.id)}">ОДОБРИТЬ</button><button class="reject" type="button" data-action="reject" data-id="${esc(item.id)}">ОТКЛОНИТЬ</button></div></div></article>`;
}

async function act(event) {
  const button = event.currentTarget;
  const id = button.dataset.id;
  const action = button.dataset.action;
  const item = document.querySelector(`.item[data-id="${CSS.escape(id)}"]`);
  if (action === 'reject' && !confirm('Отклонить эту остановку и удалить её фото?')) return;
  item?.classList.add('is-busy');
  try {
    await api('/.netlify/functions/wg-admin-action', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ id, action })
    });
    await load();
  } catch (error) {
    item?.classList.remove('is-busy');
    queueStatus.textContent = error.message;
  }
}

loginForm.addEventListener('submit', event => {
  event.preventDefault();
  secret = secretInput.value.trim();
  sessionStorage.setItem('wg_admin_secret', secret);
  loginStatus.textContent = '';
  load();
});
refresh.addEventListener('click', load);
logout.addEventListener('click', () => {
  sessionStorage.removeItem('wg_admin_secret');
  secret = '';
  queue.classList.add('is-hidden');
  login.classList.remove('is-hidden');
  secretInput.value = '';
});

if (secret) load();
