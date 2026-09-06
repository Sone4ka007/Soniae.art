const app = document.getElementById('app');
const langButton = document.getElementById('lang-toggle');

let lang = localStorage.getItem('wg_lang') || 'ru';
let cfg = { artworks: [] };
let stops = [];

if (!document.querySelector('link[data-wg-mobile]')) {
  const link = document.createElement('link');
  link.rel = 'stylesheet';
  link.href = '/wg/mobile.css';
  link.dataset.wgMobile = '1';
  document.head.appendChild(link);
}
if (!document.querySelector('link[data-wg-launch]')) {
  const link = document.createElement('link');
  link.rel = 'stylesheet';
  link.href = '/wg/launch.css';
  link.dataset.wgLaunch = '1';
  document.head.appendChild(link);
}

const L = {
  ru: {
    tag: 'Выставка, которую перемещают зрители.',
    map: 'КАРТА, КОТОРУЮ РИСУЕТ ВЫСТАВКА',
    works: 'РАБОТЫ В ПУТИ',
    back: '← Все работы',
    history: 'ИСТОРИЯ ПЕРЕМЕЩЕНИЙ',
    move: 'ПЕРЕМЕСТИЛИ РАБОТУ?',
    intro: 'Сфотографируйте работу в новом месте, затем добавьте место из Яндекс Карт. Новая остановка появится на карте только после модерации.',
    place: 'Название места',
    share: 'Скопированное из Яндекс Карт',
    paste: 'ВСТАВИТЬ ИЗ БУФЕРА',
    pasteHint: 'Можно вставить весь текст целиком. Ничего удалять вручную не нужно.',
    linkFound: 'Ссылка на Яндекс Карты найдена ✓',
    noLink: 'Ссылка не найдена. Название места всё равно можно сохранить.',
    clipFail: 'Браузер не дал доступ к буферу. Нажмите на поле и выберите «Вставить».',
    openY: 'Открыть Яндекс Карты ↗',
    send: 'ОТПРАВИТЬ НА МОДЕРАЦИЮ',
    sending: 'ОТПРАВЛЯЕМ…',
    empty: 'Работа ещё не начала путь.',
    ok: 'Спасибо. Новая остановка отправлена на модерацию и появится после одобрения.',
    walking: 'работ в пути',
    stops: 'экспозиций',
    comment: 'Комментарий',
    schematic: 'Это не обычная карта города. Она возникает только из мест, где побывали работы.',
    openPlace: 'Открыть место в Яндекс Картах ↗',
    imagePending: 'ИЗОБРАЖЕНИЕ РАБОТЫ',
    photo: 'Фото новой экспозиции',
    photoHint: 'Сфотографируйте работу там, где вы её оставили. Фото обязательно.',
    choosePhoto: 'СФОТОГРАФИРОВАТЬ / ВЫБРАТЬ ФОТО',
    photoRequired: 'Добавьте фотографию работы в новом месте.',
    photoReady: 'Фото готово к отправке ✓',
    badPhoto: 'Не удалось подготовить фото.',
    pendingNote: 'Все новые остановки проходят ручную модерацию.',
    missing: 'Эта работа пока не запущена.',
    home: 'На главную галереи'
  },
  en: {
    tag: 'An exhibition moved by its viewers.',
    map: 'THE MAP DRAWN BY THE EXHIBITION',
    works: 'ARTWORKS WALKING',
    back: '← All artworks',
    history: 'MOVEMENT HISTORY',
    move: 'DID YOU MOVE IT?',
    intro: 'Photograph the artwork in its new place, then add the location from Yandex Maps. A new stop appears on the public map only after moderation.',
    place: 'Place name',
    share: 'Copied from Yandex Maps',
    paste: 'PASTE FROM CLIPBOARD',
    pasteHint: 'Paste the whole copied text. You do not need to clean it up.',
    linkFound: 'Yandex Maps link found ✓',
    noLink: 'No link found. You can still save the place name.',
    clipFail: 'The browser could not read the clipboard. Tap the field and choose Paste.',
    openY: 'Open Yandex Maps ↗',
    send: 'SEND FOR MODERATION',
    sending: 'SENDING…',
    empty: 'This artwork has not started walking yet.',
    ok: 'Thank you. The new stop was sent for moderation and will appear after approval.',
    walking: 'artworks walking',
    stops: 'exhibitions',
    comment: 'Comment',
    schematic: 'This is not a normal city map. It appears only from places visited by the artworks.',
    openPlace: 'Open in Yandex Maps ↗',
    imagePending: 'ARTWORK IMAGE',
    photo: 'Photo of the new exhibition',
    photoHint: 'Photograph the artwork where you left it. A photo is required.',
    choosePhoto: 'TAKE / CHOOSE PHOTO',
    photoRequired: 'Add a photo of the artwork in its new place.',
    photoReady: 'Photo ready to upload ✓',
    badPhoto: 'Could not prepare the photo.',
    pendingNote: 'Every new stop is manually moderated.',
    missing: 'This artwork has not launched yet.',
    home: 'Back to gallery'
  }
};

const t = key => L[lang][key] || key;
const esc = value => String(value || '').replace(/[&<>"']/g, char => ({
  '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;'
}[char]));

const artVisual = (artwork, card = false) => {
  const cls = card ? 'wg-art-card__image' : 'wg-artwork-visual';
  if (artwork.image) {
    return `<div class="${cls}"><img src="${esc(artwork.image)}" alt="${esc(lang === 'ru' ? artwork.titleRu : artwork.titleEn)}" loading="lazy"></div>`;
  }
  return `<div class="${cls} wg-artwork-image--pending"><span>${esc(artwork.id)}</span><small>${t('imagePending')}</small></div>`;
};

langButton.onclick = () => {
  lang = lang === 'ru' ? 'en' : 'ru';
  localStorage.setItem('wg_lang', lang);
  render();
};

boot();

async function boot() {
  const [artworkConfig, routeData] = await Promise.all([
    fetch('/content/walking-gallery.json').then(r => r.json()),
    fetch('/.netlify/functions/wg-data').then(r => r.ok ? r.json() : { stops: [] }).catch(() => ({ stops: [] }))
  ]);
  cfg = artworkConfig;
  stops = routeData.stops || [];
  render();
}

function slug() {
  const parts = location.pathname.split('/').filter(Boolean);
  return parts[0] === 'wg' && parts[1] ? parts[1] : '';
}

function artStops(id) {
  return stops.filter(stop => stop.artworkId === id).sort((a, b) => a.createdAt.localeCompare(b.createdAt));
}

function parseYandex(raw) {
  const text = String(raw || '').trim();
  const match = text.match(/https?:\/\/(?:www\.)?(?:(?:yandex\.(?:ru|com)(?:\/maps)?)|ya\.cc)\/[^\s]+/i);
  const url = match ? match[0].replace(/[\]\[),.;!?]+$/, '') : '';
  const rest = (match ? text.replace(match[0], ' ') : text)
    .replace(/\s*[—-]\s*(?:Яндекс\s*Карты|Yandex\s*Maps)\s*$/i, '')
    .trim();
  const lines = rest.split(/\n+/).map(x => x.trim()).filter(Boolean)
    .filter(x => !/^(?:Яндекс\s*Карты|Yandex\s*Maps|Поделиться|Share)$/i.test(x));
  return { url, name: (lines[0] || '').slice(0, 160) };
}

function render() {
  document.documentElement.lang = lang;
  langButton.textContent = lang === 'ru' ? 'EN' : 'RU';
  const currentSlug = slug();
  if (!currentSlug) return home();
  const artwork = cfg.artworks.find(item => item.slug === currentSlug);
  return artwork ? detail(artwork) : missing(currentSlug);
}

function home() {
  const active = new Set(stops.map(stop => stop.artworkId)).size;
  app.innerHTML = `<section class="wg-hero"><div class="wg-shell"><div class="wg-kicker"><span>SONYAE_WG</span><span>2026</span></div><h1>SONYA'S<br>WALKING<br>GALLERY</h1><div class="wg-lede"><p>${t('tag')}</p><p>${t('schematic')}</p></div></div></section><div class="wg-shell"><section class="wg-stats"><div class="wg-stat"><strong>${active}</strong><span>${t('walking')}</span></div><div class="wg-stat"><strong>${stops.length}</strong><span>${t('stops')}</span></div></section></div><section class="wg-section"><div class="wg-shell"><div class="wg-section__head"><h2>${t('map')}</h2></div><div id="wg-map"></div></div></section><section class="wg-section"><div class="wg-shell"><div class="wg-section__head"><h2>${t('works')}</h2></div><div class="wg-artworks">${cfg.artworks.map(card).join('')}</div></div></section>`;
  requestAnimationFrame(mapAll);
}

function missing(currentSlug) {
  app.innerHTML = `<section class="wg-section"><div class="wg-shell"><p class="wg-kicker">SWG-${esc(currentSlug)}</p><h1 class="wg-missing-title">${t('missing')}</h1><p><a class="wg-yandex-link" href="/wg/">${t('home')}</a></p></div></section>`;
}

function card(artwork) {
  const routeStops = artStops(artwork.id);
  const last = routeStops.at(-1);
  return `<a class="wg-art-card" href="/wg/${artwork.slug}/">${artVisual(artwork, true)}<span>${esc(artwork.id)}</span><h3>${esc(lang === 'ru' ? artwork.titleRu : artwork.titleEn)}</h3><div class="wg-art-card__meta"><span>${esc(last ? last.locationLabel : t('empty'))}</span><span>→</span></div></a>`;
}

function mapAll() {
  const el = document.getElementById('wg-map');
  const map = new SchematicMap(el);
  const routes = [];
  cfg.artworks.forEach(artwork => {
    const points = artStops(artwork.id);
    if (points.length) routes.push({
      title: artwork.id,
      href: '/wg/' + artwork.slug + '/',
      points: points.map((x, i) => ({ ...x, markerLabel: String(i + 1) }))
    });
  });
  map.setRoutes(routes);
}

function detail(artwork) {
  const routeStops = artStops(artwork.id);
  const last = routeStops.at(-1);
  const history = routeStops.length ? routeStops.map(stopCard).join('') : `<p>${t('empty')}</p>`;

  app.innerHTML = `<section class="wg-detail-hero"><div class="wg-shell"><a class="wg-back" href="/wg/">${t('back')}</a><div class="wg-detail-title"><h1>${esc(artwork.id)}</h1></div>${artVisual(artwork)}<div class="wg-current"><div><small>${t('stops')}</small><strong>${routeStops.length}</strong></div><div><small>NOW</small><strong>${esc(last ? last.locationLabel : t('empty'))}</strong></div></div></div></section><section class="wg-section"><div class="wg-shell"><div class="wg-section__head"><h2>${t('map')}</h2></div><div id="wg-map"></div></div></section><section class="wg-section"><div class="wg-shell"><div class="wg-section__head"><h2>${t('history')}</h2></div><div class="wg-history">${history}</div></div></section><section class="wg-section"><div class="wg-shell wg-form-wrap"><div><h2>${t('move')}</h2><p>${t('intro')}</p><a class="wg-yandex-link" href="https://yandex.ru/maps/" target="_blank" rel="noopener">${t('openY')}</a><p class="wg-hint">${t('pendingNote')}</p></div><form class="wg-form" id="move"><input class="wg-honeypot" id="website" name="website" autocomplete="off" tabindex="-1" aria-hidden="true"><div class="wg-field"><label>${t('photo')}</label><p class="wg-field-note">${t('photoHint')}</p><label class="wg-photo-picker" for="photo"><span>${t('choosePhoto')}</span><input id="photo" type="file" accept="image/*" capture="environment" required></label><div id="photo-preview" class="wg-photo-preview"></div><div id="photo-state" class="wg-paste-state"></div></div><div class="wg-field"><label for="share">${t('share')}</label><div class="wg-paste-row"><textarea id="share" maxlength="1000" placeholder="${t('pasteHint')}"></textarea><button class="wg-btn wg-btn--secondary" type="button" id="paste">${t('paste')}</button></div><div class="wg-paste-state" id="paste-state"></div></div><div class="wg-field"><label for="place">${t('place')}</label><input id="place" maxlength="160" required placeholder="${lang === 'ru' ? 'например: Ховрино, Москва' : 'e.g. Khovrino, Moscow'}"></div><div class="wg-field"><label for="note">${t('comment')}</label><textarea id="note" maxlength="500"></textarea></div><button class="wg-btn" id="submit-stop" type="submit">${t('send')}</button><div class="wg-message" id="msg"></div></form></div></section>`;

  requestAnimationFrame(() => {
    mapOne(routeStops);
    wire(artwork);
  });
}

function stopCard(stop, i) {
  const photo = stop.photoUrl ? `<a class="wg-stop__photo" href="${esc(stop.photoUrl)}" target="_blank" rel="noopener"><img src="${esc(stop.photoUrl)}" alt="${esc(stop.locationLabel)}" loading="lazy"></a>` : '';
  const mapLink = stop.mapUrl ? `<p><a href="${esc(stop.mapUrl)}" target="_blank" rel="noopener">${t('openPlace')}</a></p>` : '';
  return `<article class="wg-stop"><div class="wg-stop__number">${String(i + 1).padStart(2, '0')}</div><div>${photo}<strong>${esc(stop.locationLabel)}</strong><p>${new Date(stop.createdAt).toLocaleDateString(lang === 'ru' ? 'ru-RU' : 'en-GB')}</p>${stop.note ? `<p>${esc(stop.note)}</p>` : ''}${mapLink}</div></article>`;
}

function mapOne(routeStops) {
  const el = document.getElementById('wg-map');
  const map = new SchematicMap(el);
  const points = routeStops.map((x, i) => ({ ...x, markerLabel: String(i + 1) }));
  map.setRoutes(points.length ? [{ title: 'ROUTE', points }] : []);
}

function wire(artwork) {
  const form = document.getElementById('move');
  const msg = document.getElementById('msg');
  const share = document.getElementById('share');
  const place = document.getElementById('place');
  const state = document.getElementById('paste-state');
  const paste = document.getElementById('paste');
  const photo = document.getElementById('photo');
  const photoPreview = document.getElementById('photo-preview');
  const photoState = document.getElementById('photo-state');
  const submit = document.getElementById('submit-stop');
  const startedAt = Date.now();
  let placeEdited = false;
  let previewUrl = '';

  place.addEventListener('input', () => { placeEdited = true; });

  const processYandex = () => {
    const parsed = parseYandex(share.value);
    if (parsed.name && !placeEdited) place.value = parsed.name;
    state.textContent = parsed.url ? t('linkFound') : (share.value.trim() ? t('noLink') : '');
    state.className = 'wg-paste-state' + (parsed.url ? ' is-ok' : '');
    return parsed;
  };

  share.addEventListener('input', processYandex);

  paste.onclick = async () => {
    try {
      share.value = await navigator.clipboard.readText();
      processYandex();
    } catch {
      state.textContent = t('clipFail');
      state.className = 'wg-paste-state';
    }
  };

  place.addEventListener('paste', event => {
    const text = event.clipboardData?.getData('text') || '';
    if (/https?:\/\//i.test(text)) {
      event.preventDefault();
      share.value = text;
      placeEdited = false;
      processYandex();
    }
  });

  photo.addEventListener('change', () => {
    const file = photo.files?.[0];
    if (!file) return;
    if (previewUrl) URL.revokeObjectURL(previewUrl);
    previewUrl = URL.createObjectURL(file);
    photoPreview.innerHTML = `<img src="${previewUrl}" alt="">`;
    photoState.textContent = t('photoReady');
    photoState.className = 'wg-paste-state is-ok';
  });

  form.onsubmit = async event => {
    event.preventDefault();
    msg.className = 'wg-message';
    msg.textContent = '';

    const file = photo.files?.[0];
    if (!file) {
      msg.textContent = t('photoRequired');
      msg.className = 'wg-message is-visible';
      return;
    }

    const parsed = processYandex();
    const locationLabel = place.value.trim() || parsed.name;
    if (!locationLabel) return;

    submit.disabled = true;
    submit.textContent = t('sending');

    try {
      const uploaded = await window.WGPhotos.upload(file, artwork.id);
      const payload = {
        artworkId: artwork.id,
        locationLabel,
        mapUrl: parsed.url,
        note: document.getElementById('note').value,
        photoKey: uploaded.photoKey,
        website: document.getElementById('website').value,
        formStartedAt: startedAt
      };

      const response = await fetch('/.netlify/functions/wg-submit', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify(payload)
      });
      const data = await response.json();
      if (!response.ok || !data.ok) throw new Error(data.error || 'Error');

      msg.textContent = t('ok');
      msg.className = 'wg-message is-visible is-success';
      form.reset();
      photoPreview.innerHTML = '';
      photoState.textContent = '';
      state.textContent = '';
      placeEdited = false;
      if (previewUrl) URL.revokeObjectURL(previewUrl);
      previewUrl = '';
    } catch (error) {
      msg.textContent = error.message || t('badPhoto');
      msg.className = 'wg-message is-visible';
    } finally {
      submit.disabled = false;
      submit.textContent = t('send');
    }
  };
}
