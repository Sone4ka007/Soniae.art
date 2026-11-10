/* Chinese Lab — handwriting practice, lesson-based and account-aware. */
(function (global) {
  'use strict';
  const VERSION = 1;
  const HAN = /[\u3400-\u9fff]/u;
  const LIBRARY = 'https://cdn.jsdelivr.net/npm/hanzi-writer@3.7.3/dist/hanzi-writer.min.js';
  let ctx = null, writer = null, renderToken = 0, libraryPromise = null;
  const byId = id => document.getElementById(id);
  const safe = value => ctx.esc(value ?? '');
  const integer = (value, fallback) => Number.isFinite(Number(value)) ? Math.trunc(Number(value)) : fallback;
  const unitKey = item => item && item.char + '|' + item.word;

  function settings() {
    const p = ctx.state.progress;
    if (!p.writing || typeof p.writing !== 'object' || Array.isArray(p.writing)) p.writing = {};
    const w = p.writing;
    if (!w.srs || typeof w.srs !== 'object' || Array.isArray(w.srs)) w.srs = {};
    if (!Array.isArray(w.lessonIds)) w.lessonIds = [ctx.state.lessonId];
    w.lessonIds = [...new Set(w.lessonIds.map(Number).filter(id => ctx.state.lessons.some(l => l.id === id)))];
    if (!w.lessonIds.length) w.lessonIds = [ctx.state.lessonId];
    if (!['words', 'minutes'].includes(w.goal)) w.goal = 'words';
    if (![10, 20, 30].includes(w.wordCount)) w.wordCount = 10;
    if (![5, 10, 15].includes(w.minutes)) w.minutes = 5;
    w.completed = Math.max(0, integer(w.completed, 0));
    w.success = Math.max(0, integer(w.success, 0));
    return w;
  }
  function current() {
    const s = ctx.state.progress.writingSession;
    if (!s || s.version !== VERSION || !Array.isArray(s.queue) || !s.queue.length ||
        !Number.isInteger(s.index) || s.index < 0 || s.index >= s.queue.length) return null;
    return s;
  }
  function lessonsPool() {
    const w = settings();
    const byCharacter = new Map();
    ctx.state.lessons.filter(l => w.lessonIds.includes(l.id)).forEach(l => {
      (l.words || []).forEach(word => {
        const characters = Array.from(String(word.hanzi || ''));
        characters.forEach((char, index) => {
          if (!HAN.test(char) || byCharacter.has(char)) return;
          byCharacter.set(char, { char, word: word.hanzi, pinyin: word.pinyin || '',
            ru: word.ru || '', position: index + 1, length: characters.length, lesson: l.id });
        });
      });
    });
    const now = Date.now(), reviews = w.srs;
    return [...byCharacter.values()].sort((a, b) => {
      const rank = item => {
        const r = reviews[item.char];
        if (!r) return 1e13 + item.lesson * 1000;
        return Number(r.due) <= now ? Number(r.due) || 0 : 2e13 + Number(r.due);
      };
      return rank(a) - rank(b);
    });
  }
  function loadLibrary() {
    if (global.HanziWriter) return Promise.resolve(global.HanziWriter);
    if (libraryPromise) return libraryPromise;
    libraryPromise = new Promise((resolve, reject) => {
      const script = document.createElement('script');
      script.src = LIBRARY;
      script.async = true;
      script.onload = () => global.HanziWriter ? resolve(global.HanziWriter) : reject(new Error('Библиотека недоступна'));
      script.onerror = () => reject(new Error('Не удалось загрузить Hanzi Writer'));
      document.head.appendChild(script);
    }).catch(error => { libraryPromise = null; throw error; });
    return libraryPromise;
  }
  function clearWriter() {
    if (writer) { try { writer.cancelQuiz(); } catch (_) {} }
    writer = null;
  }
  function render() {
    if (!ctx || ctx.state.mode !== 'writing') return;
    ++renderToken;
    clearWriter();
    const session = current();
    if (session) drawTask(session);
    else drawSettings();
  }
  function choice(label, action, value, active) {
    return '<button type="button" class="writing-choice' + (active ? ' is-on' : '') +
      '" data-action="' + action + '" data-value="' + safe(value) + '" aria-pressed="' +
      String(!!active) + '">' + safe(label) + '</button>';
  }
  function drawSettings() {
    const w = settings();
    const lessons = ctx.state.lessons;
    const pool = lessonsPool();
    const due = pool.filter(item => w.srs[item.char] && Number(w.srs[item.char].due) <= Date.now()).length;
    const panel = byId('game-panel');
    panel.innerHTML = '<div class="writing-root">' +
      '<div class="panel-head"><div><div class="eyebrow">写汉字 / НОВЫЙ РЕЖИМ</div><h3>ПИШИ ИЕРОГЛИФЫ</h3>' +
      '<p class="panel-desc">Сначала изучи черты, затем обведи и напиши знак по памяти. Пальцем или мышью.</p></div>' +
      '<span class="chip">ОТДЕЛЬНЫЙ ПРОГРЕСС</span></div>' +
      '<div class="writing-stats"><span>ЗНАКОВ НА ВЫБОР: <b>' + pool.length + '</b></span><span>К ПОВТОРЕНИЮ: <b>' + due +
      '</b></span><span>НАПИСАНО: <b>' + w.completed + '</b></span></div>' +
      '<div class="writing-setting"><h4>01 / ВЫБЕРИ УРОКИ</h4><div class="writing-lessons">' +
      lessons.map(l => choice('Урок ' + String(l.id).padStart(2, '0'), 'writing-lesson', l.id,
        w.lessonIds.includes(l.id))).join('') + '</div></div>' +
      '<div class="writing-setting"><h4>02 / ДЛИТЕЛЬНОСТЬ</h4><div class="writing-choices">' +
      choice('По количеству', 'writing-goal', 'words', w.goal === 'words') +
      choice('По времени', 'writing-goal', 'minutes', w.goal === 'minutes') + '</div><div class="writing-choices">' +
      (w.goal === 'words' ? [10, 20, 30].map(n => choice(n + ' иероглифов', 'writing-count', n, w.wordCount === n)).join('')
        : [5, 10, 15].map(n => choice(n + ' минут', 'writing-minutes', n, w.minutes === n)).join('')) +
      '</div></div>' +
      '<button type="button" class="action-btn writing-primary" data-action="writing-start" ' +
      (!pool.length ? 'disabled' : '') + '>НАЧАТЬ ПИСАТЬ →</button>' +
      '<p class="writing-note">Первые загрузки анимации и данных черт требуют интернета. Результаты сохраняются в профиле Chinese Lab и резервной копии.</p>' +
      (ctx.state.progress.writingLastResult ? '<p class="writing-note">Последняя тренировка: ' +
       safe(ctx.state.progress.writingLastResult.done) + ' знаков, без подсказок: ' +
       safe(ctx.state.progress.writingLastResult.clean) + '.</p>' : '') + '</div>';
  }
  function progressLabel(s) {
    const progress = s.index + 1;
    const target = s.goal === 'words' ? s.queue.length : s.minutes + ' мин';
    return progress + ' / ' + target;
  }
  function drawTask(s) {
    const u = s.queue[s.index];
    if (!u || !HAN.test(u.char)) { stepNext(); return; }
    const stage = s.stage;
    const wordPlace = u.length > 1 ? ' · ' + u.position + '-й знак из ' + u.length : '';
    const phase = {study:'ИЗУЧИ', trace:'ОБВЕДИ', recall:'НАПИШИ ПО ПАМЯТИ', result:'РЕЗУЛЬТАТ'}[stage] || 'ИЗУЧИ';
    const display = stage === 'study' || stage === 'result' ? '<span lang="zh-CN">' + safe(u.char) + '</span>' : '';
    const prompt = stage === 'recall' ? 'Не показываем иероглиф до ответа.' :
      stage === 'trace' ? 'Следуй бледному контуру. Порядок черт проверяется.' :
      stage === 'study' ? 'Посмотри на форму и порядок черт.' : 'Иероглиф записан в историю повторения.';
    const controls = stage === 'study' ?
      '<button class="writing-secondary" type="button" data-action="writing-animate">АНИМАЦИЯ ЧЕРТ</button>' +
      '<button class="writing-primary" type="button" data-action="writing-trace">ОБВЕСТИ →</button>' +
      '<button class="writing-minor" type="button" data-action="writing-recall">Сразу по памяти</button>'
      : stage === 'trace' ? '<button class="writing-secondary" type="button" data-action="writing-animate">ПОКАЗАТЬ ЧЕРТЫ</button>' +
        '<button class="writing-minor" type="button" data-action="writing-recall">Без контура →</button>'
      : stage === 'recall' ? '<button class="writing-secondary" type="button" data-action="writing-hint">КОНТУР / ПОДСКАЗКА</button>' +
        '<button class="writing-secondary" type="button" data-action="writing-restart">СТЕРЕТЬ И НАЧАТЬ ЗАНОВО</button>' +
        '<button class="writing-minor" type="button" data-action="writing-reveal">ПОКАЗАТЬ ОТВЕТ</button>'
      : '<button class="writing-primary" type="button" data-action="writing-next">СЛЕДУЮЩИЙ ЗНАК →</button>';
    byId('game-panel').innerHTML = '<div class="writing-root"><div class="writing-progress-head"><b>ПИСЬМО · ' +
      safe(phase) + '</b><span>' + safe(progressLabel(s)) + '</span></div>' +
      '<div class="writing-progress-track"><span style="width:' + Math.round(100 * s.index / s.queue.length) + '%"></span></div>' +
      '<div class="writing-prompt"><div class="writing-meaning">' + safe(u.ru) + '</div>' +
      '<div class="writing-pronunciation">' + safe(u.pinyin) + wordPlace +
      ' · Урок ' + u.lesson + '</div><p>' + prompt + '</p></div>' +
      '<div class="writing-paper"><div class="writing-grid"><div id="writing-canvas" class="writing-canvas" role="img" ' +
      'aria-label="Поле для написания иероглифа пальцем или мышью">' + display + '</div></div></div>' +
      (stage === 'result' ? '<div class="writing-feedback" aria-live="polite">' +
        (s.lastResult?.revealed ? 'ОТВЕТ ПОКАЗАН · ПОВТОРИ ПОЗЖЕ' : 'НАПИСАНО · ' +
          (s.lastResult?.mistakes || 0) + ' ОШИБОК В ЧЕРТАХ') + '</div>' : '') +
      '<div class="writing-actions">' + controls + '</div>' +
      '<div id="writing-status" class="writing-note" aria-live="polite"></div>' +
      '<button type="button" data-action="writing-stop" class="writing-stop">ЗАКОНЧИТЬ ЗАНЯТИЕ</button></div>';
    if (stage !== 'result') initCanvas(s, u, stage, renderToken);
  }
  async function initCanvas(s, u, stage, token) {
    const status = byId('writing-status');
    if (status) status.textContent = 'Загружаем данные черт…';
    let library;
    try { library = await loadLibrary(); }
    catch (error) { showError(token, 'Библиотека письма не загрузилась. Проверь соединение с интернетом.'); return; }
    if (token !== renderToken || ctx.state.mode !== 'writing' || current() !== s) return;
    const canvas = byId('writing-canvas');
    if (!canvas) return;
    canvas.innerHTML = '';
    const isTrace = stage === 'trace', isRecall = stage === 'recall';
    const width = Math.min(284, Math.max(220, canvas.clientWidth || 284));
    try {
      writer = library.create(canvas, u.char, {
        width, height: width, padding: 15, showCharacter: stage === 'study',
        showOutline: isTrace, strokeColor: '#111511', outlineColor: '#d0d4c7',
        drawingColor: '#252b1d', highlightColor: '#a9d600', showHintAfterMisses: 3,
        onLoadCharDataSuccess: () => { if (token === renderToken && byId('writing-status')) byId('writing-status').textContent = ''; },
        onLoadCharDataError: () => showError(token, 'Нет данных черт для этого иероглифа. Перейди к следующему знаку.')
      });
      if (isTrace || isRecall) {
        writer.quiz({
          showHintAfterMisses: 3,
          onMistake: data => {
            if (token === renderToken && byId('writing-status')) byId('writing-status').textContent =
              'Неточная черта — попробуй ещё раз. Ошибок: ' + (data.totalMistakes || 0);
          },
          onComplete: data => {
            if (token !== renderToken || ctx.state.mode !== 'writing' || current() !== s) return;
            if (isTrace) { s.stage = 'recall'; ctx.save(); render(); }
            else finishCharacter(Math.max(0, integer(data.totalMistakes, 0)), false);
          }
        });
      }
    } catch (error) { showError(token, 'Не удалось открыть упражнение для этого иероглифа.'); }
  }
  function showError(token, message) {
    if (token !== renderToken) return;
    const el = byId('writing-status');
    if (el) el.textContent = message;
  }
  function persist() { ctx.save(); }
  function finishCharacter(mistakes, revealed) {
    const s = current();
    if (!s || s.stage === 'result') return;
    const u = s.queue[s.index], w = settings();
    const grade = revealed ? 1 : (s.hintUsed || mistakes >= 3 ? 2 : mistakes >= 1 ? 3 : 4);
    const now = Date.now();
    const previous = w.srs[u.char] || null;
    if (global.ChineseLabFSRS6?.next) w.srs[u.char] = global.ChineseLabFSRS6.next(previous, grade, now);
    else w.srs[u.char] = { due: now + (grade <= 2 ? 86400000 : 3 * 86400000), last: now, interval: grade <= 2 ? 1 : 3 };
    w.completed++; s.done++;
    if (!revealed && !s.hintUsed && mistakes === 0) { w.success++; s.clean++; ctx.award(3, 'ИЕРОГЛИФ НАПИСАН'); }
    s.lastResult = { mistakes, revealed, grade };
    s.stage = 'result';
    persist();
    render();
  }
  function stepNext() {
    const s = current();
    if (!s) { render(); return; }
    const timedOut = s.goal === 'minutes' && Date.now() - s.startedAt >= s.minutes * 60000;
    if (s.index + 1 >= s.queue.length || timedOut) { endSession(); return; }
    s.index++;
    s.stage = 'study'; s.hintUsed = false; s.lastResult = null;
    persist(); render();
  }
  function endSession() {
    const s = current();
    if (!s) return;
    ctx.state.progress.writingLastResult = { done: s.done, clean: s.clean, endedAt: Date.now() };
    delete ctx.state.progress.writingSession;
    persist();
    render();
  }
  function startSession() {
    const w = settings(), pool = lessonsPool();
    if (!pool.length) return;
    const selected = pool.slice(0, w.goal === 'words' ? w.wordCount : 90);
    ctx.state.progress.writingSession = {
      version: VERSION, queue: selected, index: 0, stage: 'study', startedAt: Date.now(),
      goal: w.goal, minutes: w.minutes, done: 0, clean: 0, hintUsed: false, lastResult: null
    };
    persist(); render();
  }
  function act(action, button) {
    if (!ctx || ctx.state.mode !== 'writing') return false;
    const w = settings(), s = current();
    const n = Number(button.dataset.value);
    if (action === 'writing-lesson') {
      if (w.lessonIds.includes(n) && w.lessonIds.length > 1) w.lessonIds = w.lessonIds.filter(id => id !== n);
      else if (!w.lessonIds.includes(n) && ctx.state.lessons.some(l => l.id === n)) w.lessonIds.push(n);
      persist(); render();
    } else if (action === 'writing-goal') { w.goal = button.dataset.value === 'minutes' ? 'minutes' : 'words'; persist(); render(); }
    else if (action === 'writing-count') { if ([10, 20, 30].includes(n)) w.wordCount = n; persist(); render(); }
    else if (action === 'writing-minutes') { if ([5, 10, 15].includes(n)) w.minutes = n; persist(); render(); }
    else if (action === 'writing-start') startSession();
    else if (action === 'writing-stop') endSession();
    else if (action === 'writing-animate' && writer) writer.animateCharacter();
    else if (action === 'writing-trace' && s) { s.stage = 'trace'; persist(); render(); }
    else if (action === 'writing-recall' && s) { s.stage = 'recall'; persist(); render(); }
    else if (action === 'writing-hint' && s && writer) { s.hintUsed = true; writer.showOutline(); persist(); }
    else if (action === 'writing-restart' && s) { s.hintUsed = true; render(); }
    else if (action === 'writing-reveal' && s) finishCharacter(0, true);
    else if (action === 'writing-next') stepNext();
    return true;
  }
  function mount(context) { ctx = context; render(); }
  global.ChineseLabWriting = Object.freeze({ mount, action: act, render });
})(window);