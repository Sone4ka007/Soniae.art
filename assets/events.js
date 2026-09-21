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
  const state = { kind: 'event', city: 'all', price: 'all', category: 'all', registration: 'all', availability: 'all' };
  const cityNames = { moscow: 'МОСКВА', spb: 'ПЕТЕРБУРГ' };
  const categoryNames = {
    lecture:'ЛЕКЦИЯ', exhibition:'ВЫСТАВКА', tour:'ЭКСКУРСИЯ',
    workshop:'ВОРКШОП', 'artist-talk':'ARTIST TALK', photo:'ФОТОГРАФИЯ',
    architecture:'АРХИТЕКТУРА', market:'АРТ-РЫНОК'
  };
  const months = ['ЯНВАРЯ','ФЕВРАЛЯ','МАРТА','АПРЕЛЯ','МАЯ','ИЮНЯ','ИЮЛЯ','АВГУСТА','СЕНТЯБРЯ','ОКТЯБРЯ','НОЯБРЯ','ДЕКАБРЯ'];
  const weekdays = ['ВОСКРЕСЕНЬЕ','ПОНЕДЕЛЬНИК','ВТОРНИК','СРЕДА','ЧЕТВЕРГ','ПЯТНИЦА','СУББОТА'];

  let events = [];

  const esc = value => String(value ?? '').replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  const localDate = iso => new Date(iso + 'T00:00:00');
  const todayIso = () => {
    const d = new Date();
    const y = d.getFullYear(), m = String(d.getMonth()+1).padStart(2,'0'), day = String(d.getDate()).padStart(2,'0');
    return `${y}-${m}-${day}`;
  };

  function isVisible(e) {
    if (e.status !== 'approved') return false;
    if ((e.kind || 'event') !== state.kind) return false;
    if (!e.date || e.date < todayIso()) return false;
    const max = new Date(); max.setDate(max.getDate() + (state.kind === 'open_call' ? 90 : 30));
    const maxIso = `${max.getFullYear()}-${String(max.getMonth()+1).padStart(2,'0')}-${String(max.getDate()).padStart(2,'0')}`;
    if (e.date > maxIso) return false;
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

  function priceLabel(e) {
    if (e.price_type === 'free' || Number(e.price) === 0) return 'БЕСПЛАТНО';
    if (e.price_text) return esc(e.price_text);
    if (e.price !== null && e.price !== undefined && e.price !== '') return `${esc(e.price)} ₽`;
    return 'ЦЕНА НЕ УКАЗАНА';
  }

  function availabilityLabel(e) {
    if (e.availability === 'available') return 'ЕСТЬ МЕСТА / БИЛЕТЫ';
    if (e.availability === 'sold_out') return 'МЕСТ НЕТ / ЗАПИСЬ ЗАКРЫТА';
    return 'ДОСТУПНОСТЬ НЕ ПРОВЕРЕНА';
  }

  function render() {
    const visible = events.filter(isVisible).sort((a,b) => (a.date+a.time).localeCompare(b.date+b.time));
    if (state.kind === 'open_call') {
      count.textContent = `${visible.length} OPEN CALLS`;
      document.getElementById('events-range').textContent = 'ДЕДЛАЙНЫ · 90 ДНЕЙ';
    } else {
      count.textContent = `${visible.length} ${visible.length === 1 ? 'СОБЫТИЕ' : visible.length > 1 && visible.length < 5 ? 'СОБЫТИЯ' : 'СОБЫТИЙ'}`;
      document.getElementById('events-range').textContent = '30 ДНЕЙ ВПЕРЁД';
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
              <p>${esc(e.description || '')}</p>
              <div class="event-tags">${(e.categories || []).map(c => `<span class="event-tag">${esc(categoryNames[c] || c)}</span>`).join('')}</div>
            </div>
            <div class="event-meta">
              <p><strong>${esc(e.venue || '')}</strong></p>
              <p>${esc(e.address || '')}</p>
              <p>${esc(cityNames[e.city] || e.city || '')}</p>
              <div class="event-price ${Number(e.price) === 0 ? 'free' : ''}">${priceLabel(e)}</div>
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