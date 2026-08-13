(() => {
  const parseYandex = raw => {
    const text = String(raw || '').trim();
    const match = text.match(/https?:\/\/(?:www\.)?(?:(?:yandex\.(?:ru|com)(?:\/maps)?)|ya\.cc)\/[^\s]+/i);
    const url = match ? match[0].replace(/[\]\[),.;!?]+$/, '') : '';
    const rest = (match ? text.replace(match[0], ' ') : text).trim();
    const name = rest.split(/\n+/).map(x => x.trim()).filter(Boolean)[0] || '';
    return { url, name: name.slice(0, 160) };
  };

  async function enhance() {
    const form = document.getElementById('move');
    if (!form || form.dataset.photoEnhanced) return;
    form.dataset.photoEnhanced = '1';

    const first = form.querySelector('.wg-field');
    const field = document.createElement('div');
    field.className = 'wg-field wg-photo-field';
    field.innerHTML = '<label for="visitor-photo">ФОТО РАБОТЫ В НОВОМ МЕСТЕ</label><label class="wg-photo-picker" for="visitor-photo">СФОТОГРАФИРОВАТЬ ИЛИ ВЫБРАТЬ ФОТО</label><input id="visitor-photo" class="wg-photo-input" type="file" accept="image/*" required><div class="wg-photo-preview" id="visitor-photo-preview"></div>';
    first.before(field);

    const input = field.querySelector('input');
    const preview = field.querySelector('.wg-photo-preview');
    let objectUrl = '';
    input.addEventListener('change', () => {
      if (objectUrl) URL.revokeObjectURL(objectUrl);
      const file = input.files && input.files[0];
      if (!file) { preview.innerHTML = ''; return; }
      objectUrl = URL.createObjectURL(file);
      preview.innerHTML = '<img src="' + objectUrl + '" alt="">';
    });

    form.addEventListener('submit', async event => {
      event.preventDefault();
      event.stopImmediatePropagation();
      const file = input.files && input.files[0];
      const msg = document.getElementById('msg');
      const submit = form.querySelector('button[type="submit"]');
      if (!file) { msg.textContent = 'Добавьте фотографию работы в новом месте.'; msg.className = 'wg-message is-visible'; return; }
      submit.disabled = true;
      msg.textContent = 'Загружаем фото…';
      msg.className = 'wg-message is-visible';
      try {
        const artworkId = document.querySelector('.wg-detail-title h1')?.textContent?.trim() || '';
        const uploaded = await window.WGPhotos.upload(file, artworkId);
        const share = document.getElementById('share')?.value || '';
        const parsed = parseYandex(share);
        const payload = {
          artworkId,
          locationLabel: document.getElementById('place')?.value.trim() || parsed.name,
          mapUrl: parsed.url,
          photoLink: uploaded.photoUrl,
          note: document.getElementById('note')?.value || '',
          formStartedAt: Date.now() - 5000
        };
        const response = await fetch('/.netlify/functions/wg-submit', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(payload) });
        const data = await response.json();
        if (!response.ok || !data.ok) throw new Error(data.error || 'Не удалось добавить остановку');
        msg.textContent = 'Новая остановка и фотография добавлены.';
        setTimeout(() => location.reload(), 700);
      } catch (error) {
        msg.textContent = error.message || 'Ошибка загрузки';
      } finally {
        submit.disabled = false;
      }
    }, true);
  }

  async function attachHistoryPhotos() {
    const rows = [...document.querySelectorAll('.wg-stop')];
    if (!rows.length || rows.some(x => x.dataset.photosChecked)) return;
    rows.forEach(x => x.dataset.photosChecked = '1');
    try {
      const pageId = document.querySelector('.wg-detail-title h1')?.textContent?.trim();
      const data = await fetch('/.netlify/functions/wg-data').then(r => r.json());
      const stops = (data.stops || []).filter(x => x.artworkId === pageId).sort((a,b) => String(a.createdAt).localeCompare(String(b.createdAt)));
      rows.forEach((row, i) => {
        const photo = stops[i]?.photoLink;
        if (!photo) return;
        const img = document.createElement('img');
        img.className = 'wg-stop-photo';
        img.src = photo;
        img.alt = stops[i].locationLabel || '';
        img.loading = 'lazy';
        row.children[1]?.appendChild(img);
      });
    } catch {}
  }

  const run = () => { enhance(); attachHistoryPhotos(); };
  new MutationObserver(run).observe(document.getElementById('app'), { childList: true, subtree: true });
  run();
})();
