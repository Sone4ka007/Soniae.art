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
  const datePresetButtons = [...document.querySelectorAll('[data-date-preset]')];
  const dateDay = document.getElementById('date-day');
  const dateFrom = document.getElementById('date-from');
  const dateTo = document.getElementById('date-to');
  const dateReset = document.getElementById('date-reset');
  const state = {
    kind: 'event', city: 'all', price: 'all', category: 'all',
    registration: 'all', availability: 'all',
    dateFrom: '', dateTo: '', datePreset: ''
  };
  const cityNames = { moscow: 'МОСКВА', spb: 'ПЕТЕРБУРГ', russia: 'РОССИЯ', international: 'МЕЖДУНАРОДНЫЙ' };
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
    if (!range) return state.kind === 'exhibition' ? 'ТЕКУЩИЕ ВЫСТАВКИ' : (state.kind === 'open_call' ? 'ДЕДЛАЙНЫ · 90 ДНЕЙ' : '30 ДНЕЙ ВПЕРЁД');
    if (range.from === range.to) return formatDateRu(range.from).toUpperCase();
    return `${formatDateRu(range.from).toUpperCase()} — ${formatDateRu(range.to).toUpperCase()}`;
  }

  function isVisible(e) {
    if (e.status !== 'approved') return false;
    if ((e.kind || 'event') !== state.kind) return false;
    const custom = customDateRange();
    const today = todayIso();
    const max = new Date(); max.setDate(max.getDate() + (state.kind === 'event' ? 30 : 90));
    const defaultTo = isoFromDate(max);
    const rangeFrom = custom ? custom.from : today;
    const rangeTo = custom ? custom.to : defaultTo;
    if (state.kind === 'exhibition') {
      const start = e.start_date || e.date;
      const end = e.end_date || '9999-12-31';
      if (!start || end < rangeFrom || start > rangeTo) return false;
    } else if (state.kind === 'event') {
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

  function availabilityLabel(e) {
    if (e.availability === 'available') return 'ЕСТЬ МЕСТА / БИЛЕТЫ';
    if (e.availability === 'sold_out') return 'МЕСТ НЕТ / ЗАПИСЬ ЗАКРЫТА';
    return 'ДОСТУПНОСТЬ НЕ ПРОВЕРЕНА';
  }

  function render() {
    let visible = events.filter(isVisible).sort((a,b) => {
      const ad = a.start_date || a.date || '';
      const bd = b.start_date || b.date || '';
      return ad.localeCompare(bd) || String(a.title||'').localeCompare(String(b.title||''));
    });

    if (state.kind === 'exhibition') {
      const unique = new Map();
      visible.forEach(e => {
        // Different exhibitions often share one museum landing page.
        // Prefer the stable record id; only fall back to exhibition identity fields.
        const key = e.id || [
          (e.title || '').trim().toLowerCase(),
          (e.venue || '').trim().toLowerCase(),
          e.start_date || e.date || '',
          e.end_date || ''
        ].join('|');
        if (!unique.has(key)) unique.set(key,e);
      });
      visible = [...unique.values()];
      count.textContent = `${visible.length} ${visible.length === 1 ? 'ВЫСТАВКА' : 'ВЫСТАВКИ'}`;
      document.getElementById('events-range').textContent = dateRangeLabel();
      empty.hidden = visible.length !== 0;
      list.innerHTML = visible.map(e => {
        let period = 'ИДЁТ СЕЙЧАС · ДАТА ОКОНЧАНИЯ НЕ УКАЗАНА';
        if (e.start_date && e.end_date) period = `${formatDateRu(e.start_date)} — ${formatDateRu(e.end_date)}`;
        else if (e.start_date) period = `С ${formatDateRu(e.start_date)}`;
        else if (e.end_date) period = `ДО ${formatDateRu(e.end_date)}`;
        return `
          <article class="event-card exhibition-card">
            <div class="event-main">
              <h3>${esc(e.title)}</h3>
              <p class="event-period">${period}</p>
              <p>${esc(shortDescription(e.description))}</p>
              <div class="event-tags">${(e.categories || []).map(c => `<span class="event-tag">${esc(categoryNames[c] || c)}</span>`).join('')}</div>
            </div>
            <div class="event-meta">
              <p><strong>${esc(e.venue || '')}</strong></p>
              <p>${esc(e.address || '')}</p>
              <p>${esc(cityNames[e.city] || e.city || '')}</p>
              <div class="event-price ${e.price_type === 'free' ? 'free' : ''}">${priceLabel(e)}</div>
              ${e.registration === true ? '<p>НУЖНА РЕГИСТРАЦИЯ</p>' : e.registration === false ? '<p>БЕЗ РЕГИСТРАЦИИ</p>' : ''}
              <p>${availabilityLabel(e)}</p>
              ${e.availability_checked_at ? `<div class="event-check">МЕСТА ПРОВЕРЕНЫ: ${esc(e.availability_checked_at)}</div>` : ''}
            </div>
            <a class="event-link" href="${esc(e.url)}" target="_blank" rel="noopener">ИСТОЧНИК ↗</a>
          </article>`;
      }).join('');
      return;
    }

    if (state.kind === 'open_call') {
      count.textContent = `${visible.length} OPEN CALLS`;
      document.getElementById('events-range').textContent = dateRangeLabel();
    } else {
      count.textContent = `${visible.length} ${visible.length === 1 ? 'СОБЫТИЕ' : visible.length > 1 && visible.length < 5 ? 'СОБЫТИЯ' : 'СОБЫТИЙ'}`;
      document.getElementById('events-range').textContent = dateRangeLabel();
    }

    empty.hidden = visible.length !== 0;
    list.innerHTML = '';

    const groups = visible.reduce((acc,e) => {
      (acc[e.date] ||= []).push(e);
      return acc;
    }, {});

    Object.entries(groups).forEach(([date, items]) => {
      const d = localDate(date);
      const section = document.createElement('section');
      section.className = 'event-day';
      section.innerHTML = `
        <div class="event-day-title">
          <span>${String(d.getDate()).padStart(2,'0')}.${String(d.getMonth()+1).padStart(2,'0')}</span>
          <h2>${state.kind === 'open_call' ? 'ДЕДЛАЙН · ' : weekdays[d.getDay()] + ' · '}${d.getDate()} ${months[d.getMonth()]}</h2>
        </div>
        ${items.map(e => `
          <article class="event-card">
            <div class="event-time">${state.kind === 'open_call' ? 'OPEN CALL' : esc(e.time || '—')}</div>
            <div class="event-main">
              <h3>${esc(e.title)}</h3>
              ${formatEventRange(e) ? `<p class="event-period">${esc(formatEventRange(e))}</p>` : ''}
              <p>${esc(shortDescription(e.description))}</p>
              <div class="event-tags">${(e.categories || []).map(c => `<span class="event-tag">${esc(categoryNames[c] || c)}</span>`).join('')}</div>
            </div>
            <div class="event-meta">
              <p><strong>${esc(e.venue || '')}</strong></p>
              <p>${esc(e.address || '')}</p>
              <p>${esc(cityNames[e.city] || e.city || '')}</p>
              <div class="event-price ${e.price_type === 'free' ? 'free' : ''}">${priceLabel(e)}</div>
              ${e.registration === true ? '<p>НУЖНА РЕГИСТРАЦИЯ</p>' : e.registration === false ? '<p>БЕЗ РЕГИСТРАЦИИ</p>' : ''}
              <p>${availabilityLabel(e)}</p>
              ${e.availability_checked_at ? `<div class="event-check">МЕСТА ПРОВЕРЕНЫ: ${esc(e.availability_checked_at)}</div>` : ''}
              ${e.checked_at ? `<div class="event-check">ПРОВЕРЕНО: ${esc(e.checked_at)}</div>` : ''}
            </div>
            <a class="event-link" href="${esc(e.url)}" target="_blank" rel="noopener">ИСТОЧНИК ↗</a>
          </article>`).join('')}
      `;
      list.appendChild(section);
    });
  }

  function activate(buttons, clicked) {
    buttons.forEach(b => b.classList.toggle('active', b === clicked));
  }

  kindButtons.forEach(btn => btn.addEventListener('click', () => {
    state.kind = btn.dataset.kind; activate(kindButtons, btn); render();
  }));
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

  fetch('/content/events.json', { cache: 'no-store' })
    .then(r => { if (!r.ok) throw new Error('events.json'); return r.json(); })
    .then(data => { events = Array.isArray(data) ? data : (data.events || []); render(); })
    .catch(() => {
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