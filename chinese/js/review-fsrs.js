(function chineseLabReviewFSRS() {
  'use strict';
  // The underlying memory model is FSRS-6 with published default weights.
  // No CDN is needed: scheduling works offline and keeps legacy due dates until the next rating.
  const DAY = 86400000;
  const WEIGHTS = [
    0.212, 1.2931, 2.3065, 8.2956, 6.4133, 0.8334, 3.0194, 0.001,
    1.8722, 0.1666, 0.796, 1.4835, 0.0614, 0.2629, 1.6483,
    0.6014, 1.8729, 0.5425, 0.0912, 0.0658, 0.1542
  ];
  const GRADES = { again: 1, hard: 2, good: 3, easy: 4 };
  const clamp = (v, lo, hi) => Math.max(lo, Math.min(hi, v));
  const finite = v => Number.isFinite(v);
  const bounds = (v, fallback, lo, hi) => clamp(finite(Number(v)) ? Number(v) : fallback, lo, hi);

  function initialDifficulty(grade) {
    return clamp(WEIGHTS[4] - Math.exp(WEIGHTS[5] * (grade - 1)) + 1, 1, 10);
  }

  function fsrs6Next(previous, grade, now) {
    const w = WEIGHTS;
    const record = previous || {};
    const saved = record.fsrs?.model === 'FSRS-6' ? record.fsrs : null;
    const hasLegacy = finite(record.last) && Number(record.last) > 0 && finite(record.interval);
    // Legacy app kept intervals and review timestamps, not full rating history.
    // Seed approximately from the last known interval; never move a due date until rated.
    let S = saved ? bounds(saved.stability, 1, 0.01, 36500)
      : hasLegacy ? bounds(Math.max(Number(record.interval) || 0.2, 0.2), 1, 0.01, 36500) : 0;
    let D = saved ? bounds(saved.difficulty, 5, 1, 10)
      : hasLegacy ? clamp(11 - (Number(record.ease) || 2.5) * 2, 1, 10) : 0;
    const last = saved?.lastReview ?? (hasLegacy ? Number(record.last) : 0);
    let stability, difficulty;
    if (!S || !last || !finite(last)) {
      stability = w[grade - 1];
      difficulty = initialDifficulty(grade);
    } else {
      const elapsedDays = Math.max(0, Math.round((now - last) / DAY));
      const damping = (10 - D) / 9;
      difficulty = clamp(w[7] * initialDifficulty(4) +
        (1 - w[7]) * (D - w[6] * (grade - 3) * damping), 1, 10);
      if (elapsedDays === 0) {
        const multiplier = Math.pow(S, -w[19]) * Math.exp(w[17] * (grade - 3 + w[18]));
        stability = S * (grade === 1 ? multiplier : Math.max(1, multiplier));
      } else {
        const factor = Math.pow(0.9, -1 / w[20]) - 1;
        const recall = Math.pow(1 + factor * elapsedDays / S, -w[20]);
        if (grade === 1) {
          stability = Math.min(
            w[11] * Math.pow(D, -w[12]) *
            (Math.pow(S + 1, w[13]) - 1) * Math.exp(w[14] * (1 - recall)),
            S * Math.exp(-w[17] * w[18])
          );
        } else {
          const hard = grade === 2 ? w[15] : 1;
          const easy = grade === 4 ? w[16] : 1;
          stability = S * (1 + Math.exp(w[8]) * (11 - D) *
            Math.pow(S, -w[9]) * (Math.exp(w[10] * (1 - recall)) - 1) * hard * easy);
        }
      }
    }
    stability = bounds(stability, 1, 0.01, 36500);
    const factor = Math.pow(0.9, -1 / w[20]) - 1;
    const interval = clamp(Math.round(stability / factor * (Math.pow(0.9, -1 / w[20]) - 1)), 1, 36500);
    const isNew = !last || !S;
    const due = grade === 1 ? now + 60000
      : grade === 2 && isNew ? now + 300000
      : now + Math.max(grade === 4 ? 2 : 1, interval) * DAY;
    return {
      ...record,
      reps: grade === 1 ? 0 : (Number(record.reps) || 0) + 1,
      lapses: (Number(record.lapses) || 0) + (grade === 1 ? 1 : 0),
      last: now,
      interval: due - now < DAY ? 0 : Math.round((due - now) / DAY),
      due,
      fsrs: {
        model: 'FSRS-6', stability, difficulty, lastReview: now,
        requestedRetention: 0.9, weights: 'FSRS6-default-21'
      }
    };
  }

  function reviewPrefs() {
    const p = state.progress;
    if (!p.reviewSelect || typeof p.reviewSelect !== 'object') {
      const old = String(p.reviewScope || 'all');
      p.reviewSelect = old === 'saved'
        ? { kind: 'saved', lessonIds: [] }
        : /^lesson:\d+$/.test(old)
          ? { kind: 'lessons', lessonIds: [Number(old.slice(7))] }
          : { kind: 'all', lessonIds: [] };
    }
    const s = p.reviewSelect;
    if (!['all', 'lessons', 'saved'].includes(s.kind)) s.kind = 'all';
    if (!Array.isArray(s.lessonIds)) s.lessonIds = [];
    s.lessonIds = [...new Set(s.lessonIds.map(Number).filter(n =>
      Number.isInteger(n) && state.lessons.some(l => l.id === n)))];
    if (s.kind === 'lessons' && !s.lessonIds.length) s.kind = 'all';
    if (!['minutes', 'words'].includes(p.reviewGoal)) p.reviewGoal = 'words';
    if (![5, 10, 15].includes(p.reviewMinutes)) p.reviewMinutes = 10;
    if (![10, 20, 30].includes(p.reviewWords)) p.reviewWords = 20;
    return s;
  }

  function updateLegacyScope() {
    const s = reviewPrefs();
    state.progress.reviewScope = s.kind === 'lessons'
      ? (s.lessonIds.length === 1 ? 'lesson:' + s.lessonIds[0] : 'custom')
      : s.kind;
  }

  function dedupe(list) {
    const seen = new Set();
    return list.filter(w => {
      if (!w?.hanzi || seen.has(w.hanzi)) return false;
      seen.add(w.hanzi); return true;
    });
  }

  getReviewItems = function () {
    const selected = reviewPrefs();
    if (selected.kind === 'all') return dedupe(coreVocabulary());
    const glossary = allVocabulary();
    if (selected.kind === 'saved') {
      return dedupe(Object.keys(state.progress.saved || {})
        .map(zh => glossary.get(zh) || state.progress.saved[zh]));
    }
    return dedupe(state.lessons
      .filter(l => selected.lessonIds.includes(l.id))
      .flatMap(l => l.words.map(w => glossary.get(w.hanzi) || w)));
  };

  function controlButton(action, value, title, active, extra = '') {
    return `<button type="button" data-action="${action}" data-value="${value}" ${extra} class="${active ? 'is-active' : ''}" aria-pressed="${active}">${title}</button>`;
  }

  function settingsPanel() {
    const s = reviewPrefs();
    const p = state.progress;
    return `<section class="review-session-settings" aria-label="Настройки интервального повторения">
      <h4>ВЫБЕРИ УРОКИ</h4>
      <div class="review-option-buttons">
        ${controlButton('review-all', 'all', 'ВСЕ УРОКИ', s.kind === 'all')}
        ${controlButton('review-saved', 'saved', 'МОИ СЛОВА', s.kind === 'saved')}
      </div>
      <div class="review-lesson-options" role="group" aria-label="Можно выбрать несколько уроков">
        ${state.lessons.map(l => controlButton('review-lesson-toggle', String(l.id),
          `УРОК ${String(l.id).padStart(2, '0')}`, s.kind === 'lessons' && s.lessonIds.includes(l.id))).join('')}
      </div>
      <p class="review-config-note">Нажми на несколько уроков подряд, чтобы объединить их слова. Повторяющиеся слова появятся только один раз.</p>
      <h4>СКОЛЬКО ПОВТОРЯТЬ?</h4>
      <div class="review-option-buttons">
        ${controlButton('review-goal', 'minutes', 'ПО ВРЕМЕНИ', p.reviewGoal === 'minutes')}
        ${controlButton('review-goal', 'words', 'ПО СЛОВАМ', p.reviewGoal === 'words')}
      </div>
      <div class="review-option-buttons">
        ${(p.reviewGoal === 'minutes' ? [5, 10, 15] : [10, 20, 30])
          .map(n => controlButton(p.reviewGoal === 'minutes' ? 'review-minutes' : 'review-words',
            String(n), n + (p.reviewGoal === 'minutes' ? ' МИН' : ' СЛОВ'),
            (p.reviewGoal === 'minutes' ? p.reviewMinutes : p.reviewWords) === n)).join('')}
      </div>
    </section>`;
  }

  function statsMarkup() {
    const stats = getReviewStats();
    return `<div class="review-summary">
      <div><strong>${stats.due}</strong><span>К ПОВТОРЕНИЮ</span></div>
      <div><strong>${stats.newer}</strong><span>НОВЫХ</span></div>
      <div><strong>${stats.future}</strong><span>ЗАПЛАНИРОВАНО</span></div>
    </div>`;
  }

  function remainingText(game) {
    if (game.goal !== 'minutes') return '';
    const seconds = Math.max(0, Math.ceil((game.startedAt + game.minutes * 60000 - Date.now()) / 1000));
    return `${Math.floor(seconds / 60)}:${String(seconds % 60).padStart(2, '0')}`;
  }

  initReview = function () {
    reviewPrefs();
    state.game = {
      isReview: true, started: false, finished: false,
      queue: [], reveal: false, done: 0, good: 0, uniqueSeen: [],
      total: 0, startedAt: 0, goal: state.progress.reviewGoal,
      minutes: state.progress.reviewMinutes, wordLimit: state.progress.reviewWords,
      earlyCount: 0
    };
  };

  function startReviewSession() {
    reviewPrefs();
    const p = state.progress;
    const now = Date.now();
    const items = getReviewItems();
    const due = items.filter(w => reviewRecord(w.hanzi)?.due <= now)
      .sort((a, b) => reviewRecord(a.hanzi).due - reviewRecord(b.hanzi).due);
    const unseen = items.filter(w => !reviewRecord(w.hanzi));
    const future = items.filter(w => reviewRecord(w.hanzi)?.due > now)
      .sort((a, b) => reviewRecord(a.hanzi).due - reviewRecord(b.hanzi).due);
    const limit = p.reviewGoal === 'words' ? p.reviewWords : items.length;
    const queue = [...due, ...unseen, ...future].slice(0, limit);
    const earlyCount = Math.max(0, queue.length - due.length - unseen.length);
    state.game = {
      isReview: true, started: true, finished: queue.length === 0,
      queue, reveal: false, done: 0, good: 0, uniqueSeen: [],
      total: queue.length, startedAt: now, goal: p.reviewGoal,
      minutes: p.reviewMinutes, wordLimit: p.reviewWords, earlyCount
    };
    renderReview();
  }

  function finishReviewSession() {
    if (!state.game?.isReview) return;
    state.game.finished = true;
    state.game.queue = [];
    state.game.reveal = false;
    renderReview();
  }

  renderReview = function () {
    const g = state.game;
    if (!g?.isReview) { initReview(); return renderReview(); }
    const explanations = '<p class="audio-note">FSRS-6 рассчитывает следующий интервал по сложности слова, устойчивости памяти и результатам повторений. Цель сохранения — 90%. Прежние даты не меняются до следующей оценки.</p>';
    const head = header('ИНТЕРВАЛЬНОЕ ПОВТОРЕНИЕ',
      'Выбирай несколько уроков и удобный объём практики.', 'FSRS-6 / СЛОВА');
    const stats = statsMarkup();
    if (!g.started) {
      const available = getReviewItems().length;
      $('#game-panel').innerHTML = `${head}${settingsPanel()}${stats}
        <p class="review-config-note">Доступно слов: ${available}. Если на сегодня нет карточек, можно повторить запланированные раньше срока.</p>
        <button type="button" class="action-btn review-start" data-action="review-start" ${available ? '' : 'disabled'}>НАЧАТЬ ПОВТОРЕНИЕ ↗</button>${explanations}`;
      return;
    }
    if (g.goal === 'minutes' && Date.now() - g.startedAt >= g.minutes * 60000) g.finished = true;
    if (g.finished || !g.queue.length) {
      $('#game-panel').innerHTML = `${head}${stats}<div class="complete">
        <div class="mega">完成!</div><h4>СЕССИЯ ЗАВЕРШЕНА</h4>
        <p>Просмотрено разных слов: ${g.uniqueSeen.length} · всего оценок: ${g.done} · «хорошо/легко»: ${g.good}.</p>
        <button type="button" class="action-btn" data-action="review-restart">НОВАЯ СЕССИЯ ↗</button>
      </div>${explanations}`;
      return;
    }
    const w = g.queue[0], record = reviewRecord(w.hanzi);
    const direction = state.progress.reviewDir || 'hanzi';
    const hint = direction === 'ru' ? 'Попробуй вспомнить иероглифы.'
      : direction === 'audio' ? 'Нажми на динамик и узнай слово по звучанию.'
        : 'Попробуй вспомнить перевод.';
    $('#game-panel').innerHTML = `${head}
      <div class="review-live-bar">
        <span>СЛОВ: ${g.uniqueSeen.length} / ${g.total}</span>
        ${g.goal === 'minutes' ? `<span>ОСТАЛОСЬ: <strong id="review-timer">${remainingText(g)}</strong></span>` : ''}
        <button type="button" data-action="review-end">ЗАВЕРШИТЬ</button>
      </div>
      ${g.earlyCount ? '<p class="review-config-note">В сессию также включены слова, запланированные на более поздние даты.</p>' : ''}
      <div class="review-directions"><span>ВСПОМИНАЙ:</span>
        ${[['hanzi', 'Иероглиф → значение'], ['ru', 'Перевод → иероглиф'], ['audio', 'Только звук']]
          .map(([id, name]) => `<button type="button" data-action="review-direction"
          data-direction="${id}" class="${direction === id ? 'is-active' : ''}">${name}</button>`).join('')}
      </div>
      <div class="review-card">
        <div class="eyebrow">${record ? 'ПОВТОРЕНИЕ' : 'НОВОЕ СЛОВО'} · ${esc(w.origin || 'МОЙ СЛОВАРЬ')}</div>
        ${direction === 'ru' && !g.reveal
          ? `<div class="review-russian">${esc(w.ru || 'Значение не указано')}</div>`
          : direction === 'audio' && !g.reveal
            ? `<button class="review-audio-prompt" type="button" data-speak="${esc(w.hanzi)}">◖))<small>СЛУШАЙ И ВСПОМИНАЙ</small></button>`
            : `<button class="review-word" type="button" data-speak="${esc(w.hanzi)}">${esc(w.hanzi)} <span>◖))</span></button>`}
        ${g.reveal ? `<div class="review-answer"><div>${esc(w.pinyin || '—')}</div>
          <strong>${esc(w.ru || 'Перевод не указан')}</strong>
          <button type="button" class="inspect-small" data-action="inspect" data-zh="${esc(w.hanzi)}">ИЗМЕНИТЬ КАРТОЧКУ</button></div>`
          : `<p class="review-hidden">${hint} Затем раскрой карточку.</p>`}
      </div>
      ${g.reveal ? `<div class="review-grades">
        <button type="button" data-action="review-grade" data-grade="again">СНОВА<small>1 мин</small></button>
        <button type="button" data-action="review-grade" data-grade="hard">ТРУДНО</button>
        <button type="button" data-action="review-grade" data-grade="good">ХОРОШО</button>
        <button type="button" data-action="review-grade" data-grade="easy">ЛЕГКО</button>
      </div>` : '<button type="button" class="action-btn review-reveal" data-action="review-reveal">ПОКАЗАТЬ ОТВЕТ ↓</button>'}
      ${explanations}`;
  };

  gradeReview = function (level) {
    const g = state.game;
    const grade = GRADES[level];
    if (!g?.isReview || !g.started || g.finished || !grade || !g.reveal || !g.queue.length) return;
    const now = Date.now();
    const word = g.queue.shift();
    const original = reviewRecord(word.hanzi);
    state.progress.srs[word.hanzi] = fsrs6Next(original, grade, now);
    if (!g.uniqueSeen.includes(word.hanzi)) g.uniqueSeen.push(word.hanzi);
    if (grade === 1) g.queue.splice(Math.min(3, g.queue.length), 0, word);
    if (grade === 3 || grade === 4) g.good++;
    g.done++;
    g.reveal = false;
    save();
    renderReview();
  };

  document.addEventListener('click', event => {
    const button = event.target.closest('button[data-action]');
    if (!button) return;
    const act = button.dataset.action;
    const prefs = reviewPrefs();
    if (act === 'progress-lesson') {
      prefs.kind = 'lessons';
      prefs.lessonIds = [Number(button.dataset.id)];
      updateLegacyScope(); save(); initReview(); renderReview();
      return;
    }
    if (state.mode !== 'review') return;
    if (act === 'review-all') { prefs.kind = 'all'; prefs.lessonIds = []; }
    else if (act === 'review-saved') { prefs.kind = 'saved'; prefs.lessonIds = []; }
    else if (act === 'review-lesson-toggle') {
      const id = Number(button.dataset.value);
      if (!state.lessons.some(l => l.id === id)) return;
      if (prefs.kind !== 'lessons') { prefs.kind = 'lessons'; prefs.lessonIds = [id]; }
      else if (prefs.lessonIds.includes(id) && prefs.lessonIds.length === 1) return;
      else if (prefs.lessonIds.includes(id)) prefs.lessonIds = prefs.lessonIds.filter(n => n !== id);
      else prefs.lessonIds.push(id);
    }
    else if (act === 'review-goal') {
      state.progress.reviewGoal = button.dataset.value === 'minutes' ? 'minutes' : 'words';
    }
    else if (act === 'review-minutes') {
      const n = Number(button.dataset.value);
      if (![5, 10, 15].includes(n)) return;
      state.progress.reviewMinutes = n;
    }
    else if (act === 'review-words') {
      const n = Number(button.dataset.value);
      if (![10, 20, 30].includes(n)) return;
      state.progress.reviewWords = n;
    }
    else if (act === 'review-start') { startReviewSession(); return; }
    else if (act === 'review-end') { finishReviewSession(); return; }
    else return;
    updateLegacyScope();
    save();
    initReview();
    renderReview();
  });

  setInterval(() => {
    const g = state.game;
    if (state.mode !== 'review' || !g?.isReview || !g.started || g.finished || g.goal !== 'minutes') return;
    const timer = document.getElementById('review-timer');
    if (timer) timer.textContent = remainingText(g);
    if (Date.now() - g.startedAt >= g.minutes * 60000) finishReviewSession();
  }, 1000);

  // Expose pure algorithm helpers for local tests and future migration tooling.
  window.ChineseLabFSRS6 = Object.freeze({ next: fsrs6Next, weights: [...WEIGHTS] });
})();