(() => {
  const list = document.getElementById('events-list');
  const empty = document.getElementById('events-empty');
  const count = document.getElementById('events-count');
  const cityButtons = [...document.querySelectorAll('[data-city]')];
  const priceButtons = [...document.querySelectorAll('[data-price]')];
  const categorySelect = document.getElementById('category-filter');
  const registrationButtons = [...document.querySelectorAll('[data-registration]')];
  const availabilityButtons = [...document.querySelectorAll('[data-availability]')];
  const kindButtons = [...document.querySelectorAll('[data-kind]')];
  const kindReset = document.getElementById('kind-reset');
  const allKinds = ['event', 'exhibition', 'open_call', 'sketch'];
  const sketchSection = document.getElementById('sketch-section');
  const sketchPlacesList = document.getElementById('sketch-places-list');
  const sketchCount = document.getElementById('sketch-count');
  const datePresetButtons = [...document.querySelectorAll('[data-date-preset]')];
  const dateDay = document.getElementById('date-day');
  const dateFrom = document.getElementById('date-from');
  const dateTo = document.getElementById('date-to');
  const dateReset = document.getElementById('date-reset');
  const state = {
    kinds: new Set(allKinds), city: 'all', price: 'all', category: 'all',
    registration: 'all', availability: 'all',
    dateFrom: '', dateTo: '', datePreset: ''
  };
  const cityNames = { moscow: 'МОСКВА', spb: 'ПЕТЕРБУРГ', russia: 'РОССИЯ', international: 'МЕЖДУНАРОДНЫЙ', unknown: 'ГОРОД УТОЧНЯЕТСЯ' };
  const categoryNames = {
    lecture:'ЛЕКЦИЯ', exhibition:'ВЫСТАВКА', tour:'ЭКСКУРСИЯ',
    workshop:'ВОРКШОП', 'artist-talk':'ARTIST TALK', photo:'ФОТОГРАФИЯ',
    architecture:'АРХИТЕКТУРА', market:'АРТ-РЫНОК',
    'лекция':'ЛЕКЦИЯ','выставка':'ВЫСТАВКА','экскурсия':'ЭКСКУРСИЯ',
    'воркшоп':'ВОРКШОП','кинопоказ':'КИНОПОКАЗ','презентация':'ПРЕЗЕНТАЦИЯ',
    'встреча':'ВСТРЕЧА','диалог':'ДИАЛОГ','лаборатория':'ЛАБОРАТОРИЯ',
    'концерт':'КОНЦЕРТ','фестиваль':'ФЕСТИВАЛЬ','дизайн':'ДИЗАЙН',
    'медиаискусство':'МЕДИАИСКУССТВО','реставрация':'РЕСТАВРАЦИЯ','интерьер':'ИНТЕРЬЕР',
    'событие':'СОБЫТИЕ','open-call':'OPEN CALL'
  };
  const months = ['ЯНВАРЯ','ФЕВРАЛЯ','МАРТА','АПРЕЛЯ','МАЯ','ИЮНЯ','ИЮЛЯ','АВГУСТА','СЕНТЯБРЯ','ОКТЯБРЯ','НОЯБРЯ','ДЕКАБРЯ'];
  const weekdays = ['ВОСКРЕСЕНЬЕ','ПОНЕДЕЛЬНИК','ВТОРНИК','СРЕДА','ЧЕТВЕРГ','ПЯТНИЦА','СУББОТА'];

  let events = [];
  let sketchPlaces = [];
  let sketchError = false;

  const esc = value => String(value ?? '').replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  const localDate = iso => new Date(iso + 'T00:00:00');
  function formatDateRu(iso) {
    if (!iso) return '';
    const d = localDate(iso);
    const names = ['января','февраля','марта','апреля','мая','июня','июля','августа','сентября','октября','ноября','декабря'];
    return `${d.getDate()} ${names[d.getMonth()]} ${d.getFullYear()}`;
  }
  const isoFromDate = d => {
    const y = d.getFullYear(), m = String(d.getMonth()+1).padStart(2,'0'), day = String(d.getDate()).padStart(2,'0');
    return `${y}-${m}-${day}`;
  };
  const todayIso = () => isoFromDate(new Date());

  function kindOf(e) {
    const cats = Array.isArray(e.categories) ? e.categories : [];
    if (e.kind === 'open_call') return 'open_call';
    if (e.kind === 'exhibition' || cats.includes('выставка')) return 'exhibition';
    const source = String(e.source || '') + ' ' + String(e.venue || '');
    const sketchSource = /простая школа|pick.?me|наброски на покровке|sketching biro|олеси федоренко|nabroski/i.test(source);
    const sketchCategory = cats.some(c => /наброс|скетч|рисовани[ея] с натуры|короткий рисунок|портрет с темой/i.test(String(c)));
    const sketchTitle = sketchSource && /наброс|скетч|портрет|короткий рисунок/i.test(String(e.title || ''));
    return e.kind === 'sketch' || sketchCategory || sketchTitle ? 'sketch' : 'event';
  }

  function mondayOfWeek(d) {
    const out = new Date(d.getFullYear(), d.getMonth(), d.getDate());
    const day = out.getDay() || 7;
    out.setDate(out.getDate() - day + 1);
    return out;
  }

  function setDateRange(from, to, preset = '', mode = 'range') {
    state.dateFrom = from || '';
    state.dateTo = to || from || '';
    state.datePreset = preset;
    if (mode === 'day') {
      if (dateDay) dateDay.value = from || '';
      if (dateFrom) dateFrom.value = '';
      if (dateTo) dateTo.value = '';
    } else {
      if (dateDay) dateDay.value = '';
      if (dateFrom) dateFrom.value = from || '';
      if (dateTo) dateTo.value = to || '';
    }
    datePresetButtons.forEach(btn => btn.classList.toggle('active', btn.dataset.datePreset === preset));
  }

  function customDateRange() {
    if (!state.dateFrom) return null;
    return { from: state.dateFrom, to: state.dateTo || state.dateFrom };
  }

  function dateRangeLabel() {
    const range = customDateRange();
    if (!range) return state.kinds.size === 1 && state.kinds.has('exhibition') ? 'ТЕКУЩИЕ ВЫСТАВКИ · 90 ДНЕЙ' : (state.kinds.size === 1 && state.kinds.has('open_call') ? 'ДЕДЛАЙНЫ · 90 ДНЕЙ' : '30 ДНЕЙ ВПЕРЁД');
    if (range.from === range.to) return formatDateRu(range.from).toUpperCase();
    return `${formatDateRu(range.from).toUpperCase()} — ${formatDateRu(range.to).toUpperCase()}`;
  }

  function isVisible(e) {
    if (e.status !== 'approved') return false;
    const normalizedKind = kindOf(e);
    if (!state.kinds.has(normalizedKind)) return false;
    const custom = customDateRange();
    const today = todayIso();
    const max = new Date(); max.setDate(max.getDate() + (!custom && state.kinds.size === 1 && (normalizedKind === 'exhibition' || normalizedKind === 'open_call') ? 90 : 30));
    const defaultTo = isoFromDate(max);
    const rangeFrom = custom ? custom.from : today;
    const rangeTo = custom ? custom.to : defaultTo;
    if (normalizedKind === 'exhibition') {
      const start = e.start_date || e.date;
      const end = e.end_date || '9999-12-31';
      if (!start || end < rangeFrom || start > rangeTo) return false;
    } else if (normalizedKind === 'event' || normalizedKind === 'sketch') {
      const start = e.start_date || e.date;
      const end = e.end_date || e.date;
      if (!start || !end || end < rangeFrom || start > rangeTo) return false;
    } else {
      if (!e.date || e.date < rangeFrom || e.date > rangeTo) return false;
    }
    if (state.city !== 'all' && e.city !== state.city) return false;
    const ptype = e.price_type || (Number(e.price) === 0 ? 'free' : (e.price ? 'paid' : 'unknown'));
    if (state.price === 'free' && ptype !== 'free') return false;
    if (state.price === 'paid' && ptype !== 'paid') return false;
    if (state.registration === 'yes' && e.registration !== true) return false;
    if (state.registration === 'no' && e.registration !== false) return false;
    if (state.availability !== 'all' && e.availability !== state.availability) return false;
    if (state.category !== 'all' && !(e.categories || []).includes(state.category)) return false;
    return true;
  }

  function formatEventRange(e) {
    const start = e.start_date || e.date;
    const end = e.end_date || '';
    if (!start || !end || start === end) return '';
    const a = localDate(start);
    const b = localDate(end);
    if (a.getFullYear() === b.getFullYear() && a.getMonth() === b.getMonth()) {
      return `${a.getDate()}–${b.getDate()} ${months[a.getMonth()].toLowerCase()} ${a.getFullYear()}`;
    }
    if (a.getFullYear() === b.getFullYear()) {
      return `${a.getDate()} ${months[a.getMonth()].toLowerCase()} — ${b.getDate()} ${months[b.getMonth()].toLowerCase()} ${a.getFullYear()}`;
    }
    return `${formatDateRu(start)} — ${formatDateRu(end)}`;
  }

  function priceLabel(e) {
    if (e.price_type === 'free' || (e.price !== null && e.price !== undefined && e.price !== '' && Number(e.price) === 0)) return 'БЕСПЛАТНО';
    if (e.price_text) return esc(e.price_text);
    if (e.price !== null && e.price !== undefined && e.price !== '') return `${esc(e.price)} ₽`;
    return 'ЦЕНА НЕ УКАЗАНА';
  }

  function shortDescription(value, max = 420) {
    const text = String(value || '').replace(/\s+/g, ' ').trim();
    if (text.length <= max) return text;
    const cut = text.slice(0, max);
    const sentence = Math.max(cut.lastIndexOf('. '), cut.lastIndexOf('! '), cut.lastIndexOf('? '));
    const word = cut.lastIndexOf(' ');
    const end = sentence > max * 0.55 ? sentence + 1 : word;
    return cut.slice(0, end > 0 ? end : max).trim() + '…';
  }

  // Repair legacy records immediately, including dates copied from related cards.
  function normalizeLegacyEvent(e) {
    const path = String(e.url || '').split('?')[0].replace(/\/$/, '');
    if (path.endsWith('/lektsiya-pavel-tretyakov-i-viktor-vasnetsov')) {
      e = {...e, date: '2026-10-24', time: '14:00', price: 850,
        price_text: '850 ₽; льготный — 650 ₽', ticket_required: true,
        registration: null, availability: 'unknown', availability_checked_at: ''};
    } else if (path.endsWith('/lektsiya-orest-kiprenskiy-10-2026')) {
      e = {...e, date: '2026-10-22', time: '19:00', ticket_required: true,
        registration: null, availability: 'unknown', availability_checked_at: ''};
    }
    if (e.availability === 'available' && !e.availability_evidence) {
      e = {...e, availability: 'unknown', availability_checked_at: ''};
    }
    if (e.price_type === 'paid' && e.registration === false) e = {...e, registration: null};
    return e;
  }

  function admissionLabel(e) {
    if (e.ticket_required) return '<p>НУЖЕН БИЛЕТ</p>';
    if (e.registration === true) return '<p>НУЖНА РЕГИСТРАЦИЯ</p>';
    if (e.registration === false) return '<p>БЕЗ РЕГИСТРАЦИИ</p>';
    return '';
  }

  function availabilityLabel(e) {
    if (e.availability === 'available') return 'ЕСТЬ МЕСТА / БИЛЕТЫ';
    if (e.availability === 'sold_out') return 'МЕСТ НЕТ / ЗАПИСЬ ЗАКРЫТА';
    return 'ДОСТУПНОСТЬ НЕ ПРОВЕРЕНА';
  }

  function renderSketchPlaces() {
    const show = state.kinds.has('sketch');
    sketchSection.hidden = !show;
    if (!show) return;
    const places = sketchPlaces.filter(e => e.status === 'approved'
      && (state.city === 'all' || e.city === state.city)
      && (state.price === 'all' || e.price_type === state.price));
    const n = places.length;
    sketchCount.textContent = n + ' ' + (n === 1 ? 'МЕСТО' : n >= 2 && n <= 4 ? 'МЕСТА' : 'МЕСТ');
    sketchPlacesList.innerHTML = places.map(e => `
      <article class="event-card sketch-place-card">
        <div class="event-main"><h3>${esc(e.title)}</h3>
          ${e.schedule ? `<p class="event-period">${esc(e.schedule)}</p>` : ''}
          <p>${esc(shortDescription(e.description))}</p></div>
        <div class="event-meta">
          <p><strong>${esc(e.venue || '')}</strong></p>
          <p>${esc(e.address || '')}</p>
          <p>${esc(cityNames[e.city] || e.city || '')}</p>
          <div class="event-price ${e.price_type === 'free' ? 'free' : ''}">${priceLabel(e)}</div>
        </div>
        <a class="event-link" href="${esc(e.url)}" target="_blank" rel="noopener">К ОРГАНИЗАТОРУ ↗</a>
      </article>`).join('');
    if (!places.length) {
      sketchPlacesList.innerHTML = `<p class="sketch-places-empty">${sketchError ? 'Не удалось загрузить каталог мест.' : 'По выбранным фильтрам площадок нет.'}</p>`;
    }
  }

  // Collapse duplicate records from repeat collector passes, regardless of their
  // generated ids. Keep genuinely separate sessions on different dates or times.
  function dedupeVisibleEvents(list) {
    const norm = value => String(value || '').normalize('NFKC').toLowerCase()
      .replace(/ё/g, 'е').replace(/[«»„“”]/g, '')
      .replace(/[^\p{L}\p{N}]+/gu, ' ').trim();
    const same = (a, b) => {
      if (kindOf(a) !== kindOf(b) || norm(a.title) !== norm(b.title) ||
          norm(a.city) !== norm(b.city)) return false;
      const aDate = a.start_date || a.date || '';
      const bDate = b.start_date || b.date || '';
      if (!aDate || aDate !== bDate) return false;
      const aVenue = norm(a.venue || a.address);
      const bVenue = norm(b.venue || b.address);
      if (aVenue && bVenue && aVenue !== bVenue) return false;
      // Without a shared location, require a matching primary source.
      if (!aVenue || !bVenue) {
        const url = e => { const v = String(e.url || '').split('?')[0]; return v.endsWith('/') ? v.slice(0,-1) : v; };
        if (!url(a) || url(a) !== url(b)) return false;
      }
      // Two separately ticketed sessions on one day are not duplicates.
      if (a.time && b.time && a.time !== b.time) return false;
      return true;
    };
    const quality = e => (String(e.id || '').startsWith('manual-') ? 10 : 0)
      + (e.time ? 2 : 0) + (e.address ? 1 : 0)
      + (e.availability_evidence ? 2 : 0)
      + Math.min(String(e.description || '').length, 400) / 200;
    const unique = [];
    for (const event of list) {
      const index = unique.findIndex(other => same(other, event));
      if (index === -1) unique.push(event);
      else if (quality(event) > quality(unique[index])) unique[index] = event;
    }
    return unique;
  }

  function render() {
    const hasSketches = state.kinds.has('sketch');
    document.getElementById('sketch-intro').hidden = !hasSketches;
    empty.querySelector('p').textContent = 'По выбранным фильтрам событий нет.';

    let visible = dedupeVisibleEvents(events.filter(isVisible));
    const custom = customDateRange();
    const referenceDay = custom ? custom.from : todayIso();
    const groupDate = e => kindOf(e) === 'exhibition' &&
      (e.start_date || e.date) < referenceDay ? referenceDay : (e.start_date || e.date);

    visible.sort((a,b) => groupDate(a).localeCompare(groupDate(b))
      || String(a.time || '').localeCompare(String(b.time || ''))
      || String(a.title || '').localeCompare(String(b.title || '')));

    const totalPlaces = hasSketches ? sketchPlaces.filter(e =>
      e.status === 'approved'
      && (state.city === 'all' || e.city === state.city)
      && (state.price === 'all' || e.price_type === state.price)).length : 0;
    count.textContent = `${visible.length} ${visible.length === 1 ? 'СОБЫТИЕ' : 'СОБЫТИЙ'}` +
      (hasSketches ? ` · ${totalPlaces} МЕСТ ДЛЯ НАБРОСКОВ` : '');
    document.getElementById('events-range').textContent = dateRangeLabel();
    empty.hidden = visible.length !== 0 || totalPlaces > 0;
    list.innerHTML = '';

    const groups = visible.reduce((acc,e) => {
      (acc[groupDate(e)] ||= []).push(e);
      return acc;
    }, {});

    Object.entries(groups).forEach(([date, items]) => {
      const d = localDate(date);
      const section = document.createElement('section');
      section.className = 'event-day';
      section.innerHTML = `
        <div class="event-day-title">
          <span>${String(d.getDate()).padStart(2,'0')}.${String(d.getMonth()+1).padStart(2,'0')}</span>
          <h2>${weekdays[d.getDay()]} · ${d.getDate()} ${months[d.getMonth()]}</h2>
        </div>
        ${items.map(e => {
          const kind = kindOf(e);
          const kindLabel = {event:'СОБЫТИЕ', exhibition:'ВЫСТАВКА', open_call:'OPEN CALL', sketch:'НАБРОСКИ'}[kind];
          let period = formatEventRange(e);
          if (kind === 'exhibition' && !period) {
            period = e.end_date ? `ДО ${formatDateRu(e.end_date)}`
              : `С ${formatDateRu(e.start_date || e.date)}`;
          }
          return `
          <article class="event-card ${kind === 'exhibition' ? 'event-card-exhibition' : ''}">
            <div class="event-time">${kind === 'open_call' ? 'ДЕДЛАЙН' :
              kind === 'exhibition' ? 'ВЫСТАВКА' : esc(e.time || 'ВРЕМЯ УТОЧНЯЕТСЯ')}</div>
            <div class="event-main">
              <span class="event-kind-label">${kindLabel}</span>
              <h3>${esc(e.title)}</h3>
              ${period ? `<p class="event-period">${esc(period)}</p>` : ''}
              <p>${esc(shortDescription(e.description))}</p>
              <div class="event-tags">${(e.categories || []).map(c =>
                `<span class="event-tag">${esc(categoryNames[c] || c)}</span>`).join('')}</div>
            </div>
            <div class="event-meta">
              <p><strong>${esc(e.venue || '')}</strong></p>
              <p>${esc(e.address || '')}</p>
              <p>${esc(cityNames[e.city] || e.city || '')}</p>
              <div class="event-price ${e.price_type === 'free' ? 'free' : ''}">${priceLabel(e)}</div>
              ${admissionLabel(e)}
              <p>${availabilityLabel(e)}</p>
              ${e.availability_checked_at ? `<div class="event-check">МЕСТА ПРОВЕРЕНЫ: ${esc(e.availability_checked_at)}</div>` : ''}
            </div>
            <a class="event-link" href="${esc(e.url)}" target="_blank" rel="noopener">ИСТОЧНИК ↗</a>
          </article>`;
        }).join('')}
      `;
      list.appendChild(section);
    });
    renderSketchPlaces();
  }

  function activate(buttons, clicked) {
    buttons.forEach(b => b.classList.toggle('active', b === clicked));
  }

  function syncKindButtons() {
    kindButtons.forEach(btn => {
      const selected = state.kinds.has(btn.dataset.kind);
      btn.classList.toggle('active', selected);
      btn.setAttribute('aria-pressed', String(selected));
    });
    if (kindReset) kindReset.hidden = state.kinds.size === allKinds.length;
  }
  kindButtons.forEach(btn => btn.addEventListener('click', () => {
    const kind = btn.dataset.kind;
    if (state.kinds.size === allKinds.length) {
      // Starting from "all", the first tap selects just that section.
      state.kinds = new Set([kind]);
    } else if (state.kinds.has(kind)) {
      if (state.kinds.size === 1) state.kinds = new Set(allKinds);
      else state.kinds.delete(kind);
    } else {
      state.kinds.add(kind);
    }
    syncKindButtons();
    render();
  }));
  kindReset?.addEventListener('click', () => {
    state.kinds = new Set(allKinds);
    syncKindButtons();
    render();
  });
  syncKindButtons();
  cityButtons.forEach(btn => btn.addEventListener('click', () => {
    state.city = btn.dataset.city; activate(cityButtons, btn); render();
  }));
  priceButtons.forEach(btn => btn.addEventListener('click', () => {
    state.price = btn.dataset.price; activate(priceButtons, btn); render();
  }));
  registrationButtons.forEach(btn => btn.addEventListener('click', () => {
    state.registration = btn.dataset.registration; activate(registrationButtons, btn); render();
  }));
  availabilityButtons.forEach(btn => btn.addEventListener('click', () => {
    state.availability = btn.dataset.availability; activate(availabilityButtons, btn); render();
  }));
  categorySelect.addEventListener('change', () => { state.category = categorySelect.value; render(); });

  datePresetButtons.forEach(btn => btn.addEventListener('click', () => {
    const now = new Date();
    const preset = btn.dataset.datePreset;
    if (preset === 'today') {
      const iso = isoFromDate(now);
      setDateRange(iso, iso, 'today', 'day');
    } else {
      const monday = mondayOfWeek(now);
      if (preset === 'next-week') monday.setDate(monday.getDate() + 7);
      const sunday = new Date(monday);
      sunday.setDate(sunday.getDate() + 6);
      setDateRange(isoFromDate(monday), isoFromDate(sunday), preset);
    }
    render();
  }));

  dateDay?.addEventListener('change', () => {
    if (dateDay.value) setDateRange(dateDay.value, dateDay.value, '', 'day');
    else setDateRange('', '', '', 'day');
    render();
  });

  const applyManualRange = () => {
    let from = dateFrom?.value || '';
    let to = dateTo?.value || '';

    datePresetButtons.forEach(btn => btn.classList.remove('active'));
    if (dateDay) dateDay.value = '';

    // Keep a partially entered range visible without collapsing it into "ДЕНЬ".
    if (!from || !to) {
      state.dateFrom = '';
      state.dateTo = '';
      state.datePreset = '';
      render();
      return;
    }

    if (from > to) {
      [from, to] = [to, from];
      dateFrom.value = from;
      dateTo.value = to;
    }
    setDateRange(from, to, '', 'range');
    render();
  };
  dateFrom?.addEventListener('change', applyManualRange);
  dateTo?.addEventListener('change', applyManualRange);
  dateReset?.addEventListener('click', () => {
    setDateRange('', '', '', 'range');
    render();
  });

  fetch('/content/sketch-places.json?v=' + Date.now(), { cache: 'no-store' })
    .then(r => { if (!r.ok) throw new Error('sketch-places.json'); return r.json(); })
    .then(data => { sketchPlaces = Array.isArray(data) ? data : (data.places || []); if (state.kinds.has('sketch')) render(); })
    .catch(() => { sketchError = true; if (state.kinds.has('sketch')) render(); });

  Promise.all([
    fetch('/content/events.json?v=' + Date.now(), { cache: 'no-store' }).then(r => { if (!r.ok) throw new Error('events.json'); return r.json(); }),
    fetch('/content/events_time_verified.json?v=' + Date.now(), { cache: 'no-store' }).then(r => r.ok ? r.json() : {corrections:{}}).catch(() => ({corrections:{}}))
  ])
    .then(([data, audit]) => {
      events = Array.isArray(data) ? data : (data.events || []);
      events = events.map(e => {
        const facts = audit.corrections?.[e.id];
        if (facts && String(e.time_verified_at || '') <= String(facts.time_verified_at || '')) {
          e = {...e};
          for (const field of ['date', 'time']) {
            if (field in facts && ([facts['previous_' + field], facts[field]].includes(e[field] || '') || (field === 'time' && !e[field] && facts.time_verification === 'verified'))) {
              if (field === 'date') for (const boundary of ['start_date', 'end_date']) if (e[boundary] === facts.previous_date) e[boundary] = facts.date;
              e[field] = facts[field];
            }
          }
        }
        return normalizeLegacyEvent(e);
      });
      render();
    })
    .catch(() => {
      if (state.kinds.has('sketch') && sketchPlaces.length) return;
      list.innerHTML = '<div class="events-empty"><p>Не удалось загрузить базу событий.</p></div>';
      empty.hidden = true;
    });

  const menuButton = document.querySelector('.menu-button');
  const nav = document.querySelector('.top nav');
  menuButton?.addEventListener('click', () => {
    const open = nav.classList.toggle('open');
    menuButton.setAttribute('aria-expanded', String(open));
  });
})();