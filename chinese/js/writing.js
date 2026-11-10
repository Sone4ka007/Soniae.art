/* Chinese Lab — handwriting practice, lesson-based and account-aware. */
(function (global) {
  'use strict';
  const VERSION = 1;
  const HAN = /[\u3400-\u9fff]/u;
  const LIBRARY = 'https://cdn.jsdelivr.net/npm/hanzi-writer@3.7.3/dist/hanzi-writer.min.js';
  let ctx = null, writer = null, renderToken = 0, libraryPromise = null;
  let characterData = null, dataPromise = null;
  const byId = id => document.getElementById(id);
  const safe = value => ctx.esc(value ?? '');
  const integer = (value, fallback) => Number.isFinite(Number(value)) ? Math.trunc(Number(value)) : fallback;


  function settings() {
    const p = ctx.state.progress;
    if (!p.writing || typeof p.writing !== 'object' || Array.isArray(p.writing)) p.writing = {};
    const w = p.writing;
    if (!w.srs || typeof w.srs !== 'object' || Array.isArray(w.srs)) w.srs = {};
    if (!Array.isArray(w.lessonIds)) w.lessonIds = [ctx.state.lessonId];
    w.lessonIds = [...new Set(w.lessonIds.map(Number).filter(id => ctx.state.lessons.some(l => l.id === id)))];
    if (!w.lessonIds.length) w.lessonIds = [ctx.state.lessonId];
    // Short, deliberate sessions: the learner writes no more than two characters.
    w.goal = 'words';
    if (![1, 2].includes(w.wordCount)) w.wordCount = 1;
    w.completed = Math.max(0, integer(w.completed, 0));
    w.success = Math.max(0, integer(w.success, 0));
    return w;
  }
  function current() {
    const s = ctx.state.progress.writingSession;
    if (!s || s.version !== VERSION || !Array.isArray(s.queue) || !s.queue.length ||
        !Number.isInteger(s.index) || s.index < 0 || s.index >= s.queue.length) return null;
    // Migrate unfinished old 10/20/30-character sessions without deleting their review history.
    if (s.queue.length > 2) {
      s.queue = s.queue.slice(s.index, s.index + 2);
      s.index = 0;
      s.goal = 'words';
      s.stage = 'study';
      s.hintUsed = false;
      ctx.save();
    }
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

  // Russian learning cues for selected common characters. These are NOT historical proof.
  const memoryCues = {
    '签':'Сверху ⺮ «бамбук», снизу 佥 — фонетическая часть. В прошлом бамбуковые планки использовались для записей.',
    '证':'讠 связан с речью, 正 — с правильностью. Запомни «подтвердить правильными словами». Это мнемоника.',
    '入':'Форма помогает представить движение внутрь. Древнее происхождение знака сложнее, чем простая картинка.',
    '学':'Снизу 子 «ребёнок», сверху элементы, связанные с местом обучения. Удобная мнемоника: ребёнок учится под крышей.',
    '好':'В современной форме слева 女, справа 子. Для запоминания: «женщина и ребёнок»; культурные трактовки не следует выдавать за буквальное значение.',
    '妈':'女 связана со значением, 马 служит звуковой подсказкой. Это один из типичных смысло-звуковых знаков.',
    '休':'亻 «человек» + 木 «дерево»: человек прислонился к дереву, чтобы отдохнуть.',
    '明':'日 «солнце» и 月 «луна»; обе части помогают запомнить понятие света.',
    '林':'Два 木 «дерево»: несколько деревьев складываются в лес.',
    '感':'Внизу 心 «сердце», сверху 咸. Сердце помогает вспомнить связь с чувствами.',
    '未':'Сравни с 末: у 未 верхняя горизонтальная черта короче нижней. Это зрительная подсказка, не объяснение происхождения.',
    '末':'木 «дерево» и верхняя длинная черта — условная отметка вершины.',
    '材':'木 указывает на дерево/материал, 才 — звуковая часть.',
    '校':'木 — смысловая часть, 交 — историческая звуковая подсказка; современное чтение изменилось.',
    '料':'米 «рис» и 斗 «мера»: удобно представить измерение крупы.',
    '减':'冫 «лёд/холод» — смысловая часть в источнике, 咸 — историческая звуковая.',
    '轻':'车 «повозка», 工 в составе правой части связан с историческим звучанием.',
    '通':'辶 «движение», 甬 — звуковой компонент.',
    '识':'讠 «речь», 只 — историческая звуковая часть.',
    '奖':'Смысловая и фонетическая роли исторически сложнее, чем современная видимая форма. Не разбирай знак лишь как набор современных значений.',
    '知':'口 «рот/речь», 矢 — фонетическая часть по источнику. Сегодня чтение частей может не совпадать.',
    '言':'Древний знак связан с речью; в упрощённых иероглифах часто встречается как 讠.',
    '口':'Пиктограмма рта в сильно упрощённой квадратной форме.',
    '日':'Пиктограмма солнца: первоначальная круглая форма стала прямоугольной.',
    '月':'Пиктограмма луны; современные компоненты 月 в разных знаках могут иметь и другое историческое происхождение.',
    '木':'Пиктограмма дерева с ветвями, стволом и корнями.',
    '山':'Пиктограмма горных вершин.',
    '人':'Пиктограмма человека. Нынешний знак очень схематичен.',
    '女':'Упрощённый контур человека в древних формах; не пытайся объяснять отдельные современные черты буквально.',
    '子':'В ранних формах изображает ребёнка.',
    '上':'Горизонтальная черта отмечает опору, другая — положение над ней.',
    '下':'Горизонтальная черта отмечает опору, другая — положение под ней.'
  };
  const componentNames = {
    '⺮':'бамбук','竹':'бамбук','讠':'речь / слова','言':'речь','辶':'движение',
    '忄':'чувства / сердце','心':'сердце','扌':'рука','手':'рука','木':'дерево',
    '氵':'вода','水':'вода','灬':'огонь','火':'огонь','艹':'трава / растения',
    '亻':'человек','人':'человек','女':'женщина','子':'ребёнок',
    '口':'рот / речь','贝':'раковина / деньги','车':'повозка','日':'солнце / день',
    '月':'луна / месяц','纟':'нить / шёлк','冫':'лёд / холод','土':'земля',
    '石':'камень','米':'рис','力':'сила','山':'гора','刂':'нож',
    '目':'глаз','金':'металл / золото','钅':'металл','雨':'дождь','足':'нога',
    '⺍':'часть верхнего компонента','冖':'крышка','田':'поле','刀':'нож'
  };
  const compositionNames = {
    '⿰':'слева направо','⿱':'сверху вниз','⿲':'три части по горизонтали',
    '⿳':'три части по вертикали','⿴':'внутри рамки','⿵':'окружение сверху',
    '⿶':'окружение снизу','⿷':'окружение слева','⿸':'окружение сверху слева',
    '⿹':'окружение сверху справа','⿺':'окружение снизу слева','⿻':'перекрывающиеся элементы'
  };

  function loadCharacterData() {
    if (characterData) return Promise.resolve(characterData);
    if (!dataPromise) {
      dataPromise = fetch('./data/character-components.json')
        .then(response => { if (!response.ok) throw new Error('Не удалось загрузить разбор'); return response.json(); })
        .then(data => { characterData = data.characters || {}; return characterData; })
        .catch(error => {
          console.warn('Chinese Lab character etymology unavailable', error);
          // Retry on a future mode switch if network failure was temporary.
          dataPromise = null;
          return null;
        });
    }
    return dataPromise;
  }

  function characterGuide(u) {
    const info = characterData?.[u.char];
    if (!characterData) return '<p class="writing-guide-note">Загружаем разбор компонентов…</p>';
    if (!info) return '<p class="writing-guide-note">Проверенных данных о составе этого знака пока нет.</p>';
    const raw = String(info.decomposition || '');
    const valid = raw && !raw.startsWith('？');
    const knownPieces = valid ? Array.from(raw).filter(c => !compositionNames[c] && c !== '？') : [];
    const pieces = knownPieces.length ? '<div class="writing-components">' + knownPieces.map(c =>
      '<span class="writing-component"><b lang="zh-CN">' + safe(c) + '</b><small>' +
      safe(componentNames[c] || 'компонент') + '</small></span>').join('') + '</div>' : '';
    const layout = compositionNames[Array.from(raw)[0]];
    const etym = info.etymology || {};
    let historical = '';
    if (etym.type === 'pictophonetic') {
      historical = 'По словарю, это смысло-звуковой знак.';
      if (etym.semantic) historical += ' Смысловой компонент: ' + etym.semantic +
        (componentNames[etym.semantic] ? ' (' + componentNames[etym.semantic] + ')' : '') + '.';
      if (etym.phonetic) historical += ' Фонетический компонент: ' + etym.phonetic +
        '. Современное произношение может отличаться.';
    } else if (etym.type === 'ideographic') {
      historical = 'Источник относит знак к смысловым образованиям. Значение может объясняться сочетанием частей.';
    } else if (etym.type === 'pictographic') {
      historical = 'Источник относит знак к пиктограммам: его ранние формы представляли изображение.';
    } else {
      historical = 'Источник не даёт надёжной классификации происхождения этого знака.';
    }
    return '<h4>ИЗ ЧЕГО СОСТОИТ</h4>' +
      (valid ? '<div class="writing-ids"><span lang="zh-CN">' + safe(raw) + '</span>' +
        (layout ? '<small>' + safe(layout) + '</small>' : '') +
        (raw.includes('？') ? '<small>часть структуры пока не определена</small>' : '') + '</div>' + pieces
        : '<p class="writing-guide-note">Для этого знака нет полного подтверждённого разложения.</p>') +
      '<p class="writing-guide-note">Словарный ключ: <strong lang="zh-CN">' +
      safe(info.radical || '—') + '</strong>. Ключ не всегда равен смысловой части.</p>' +
      '<h4>ПРОИСХОЖДЕНИЕ · ПОДСКАЗКА</h4>' +
      '<p>' + safe(historical) + '</p>' +
      (memoryCues[u.char] ? '<p class="writing-memory"><strong>Как запомнить:</strong> ' +
        safe(memoryCues[u.char]) + '</p>' : '') +
      (etym.hint ? '<details class="writing-source"><summary>Комментарий источника (англ.)</summary>' +
        '<p>' + safe(etym.hint) + '</p></details>' : '') +
      '<p class="writing-guide-foot">Графический состав не всегда совпадает с исторической этимологией. ' +
      'Источник: <a href="https://github.com/skishore/makemeahanzi" target="_blank" rel="noopener noreferrer">Make Me a Hanzi</a>.</p>';
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
      '<div class="writing-setting"><h4>02 / СКОЛЬКО ИЕРОГЛИФОВ?</h4><p class="writing-note">Лучше подробно изучить один-два знака и написать их по памяти, чем быстро обвести десяток.</p><div class="writing-choices">' +
      choice('1 иероглиф', 'writing-count', 1, w.wordCount === 1) +
      choice('2 иероглифа', 'writing-count', 2, w.wordCount === 2) +
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
    const target = s.queue.length;
    return progress + ' / ' + target;
  }
  function drawTask(s) {
    const u = s.queue[s.index];
    if (!u || !HAN.test(u.char)) { stepNext(); return; }
    const stage = s.stage;
    const showGuide = stage !== 'recall' || !!s.showStructure;
    const sourcePronunciation = characterData?.[u.char]?.pinyin?.join(', ');
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
      : stage === 'recall' ? '<button class="writing-secondary" type="button" data-action="writing-structure">СОСТАВ И ПОДСКАЗКА</button>' +
        '<button class="writing-secondary" type="button" data-action="writing-hint">КОНТУР</button>' +
        '<button class="writing-secondary" type="button" data-action="writing-restart">СТЕРЕТЬ И НАЧАТЬ ЗАНОВО</button>' +
        '<button class="writing-minor" type="button" data-action="writing-reveal">ПОКАЗАТЬ ОТВЕТ</button>'
      : '<button class="writing-primary" type="button" data-action="writing-next">СЛЕДУЮЩИЙ ЗНАК →</button>';
    byId('game-panel').innerHTML = '<div class="writing-root"><div class="writing-progress-head"><b>ПИСЬМО · ' +
      safe(phase) + '</b><span>' + safe(progressLabel(s)) + '</span></div>' +
      '<div class="writing-progress-track"><span style="width:' + Math.round(100 * s.index / s.queue.length) + '%"></span></div>' +
      '<div class="writing-prompt"><div class="writing-meaning">' + safe(u.ru) + '</div>' +
      '<div class="writing-pronunciation">' + safe(sourcePronunciation || u.pinyin) +
      ' · Урок ' + u.lesson + '</div>' +
      (stage !== 'recall' ? '<div class="writing-context">В слове <b lang="zh-CN">' + safe(u.word) +
        '</b> (' + safe(u.pinyin) + ')' + wordPlace + '</div>' : '') +
      '<p>' + prompt + '</p></div>' +
      '<div class="writing-paper"><div class="writing-grid"><div id="writing-canvas" class="writing-canvas" role="img" ' +
      'aria-label="Поле для написания иероглифа пальцем или мышью">' + display + '</div></div></div>' +
      (stage === 'result' ? '<div class="writing-feedback" aria-live="polite">' +
        (s.lastResult?.revealed ? 'ОТВЕТ ПОКАЗАН · ПОВТОРИ ПОЗЖЕ' : 'НАПИСАНО · ' +
          (s.lastResult?.mistakes || 0) + ' ОШИБОК В ЧЕРТАХ') + '</div>' : '') +
      '<div class="writing-actions">' + controls + '</div>' +
      '<section id="writing-breakdown" class="writing-breakdown" ' +
      (showGuide ? '' : 'hidden') + '>' + characterGuide(u) + '</section>' +
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
    if (s.index + 1 >= s.queue.length) { endSession(); return; }
    s.index++;
    s.stage = 'study'; s.hintUsed = false; s.showStructure = false; s.lastResult = null;
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
    const selected = pool.slice(0, w.wordCount);
    ctx.state.progress.writingSession = {
      version: VERSION, queue: selected, index: 0, stage: 'study', startedAt: Date.now(),
      goal: 'words', done: 0, clean: 0, hintUsed: false, showStructure: false, lastResult: null
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
    } else if (action === 'writing-count') { if ([1, 2].includes(n)) w.wordCount = n; persist(); render(); }
    else if (action === 'writing-start') startSession();
    else if (action === 'writing-stop') endSession();
    else if (action === 'writing-animate' && writer) writer.animateCharacter();
    else if (action === 'writing-trace' && s) { s.stage = 'trace'; persist(); render(); }
    else if (action === 'writing-recall' && s) { s.stage = 'recall'; s.showStructure = false; persist(); render(); }
    else if (action === 'writing-structure' && s) {
      s.hintUsed = true; s.showStructure = !s.showStructure;
      const guide = byId('writing-breakdown');
      if (guide) guide.hidden = !s.showStructure;
      persist();
    }
    else if (action === 'writing-hint' && s && writer) { s.hintUsed = true; writer.showOutline(); persist(); }
    else if (action === 'writing-restart' && s) { s.hintUsed = true; render(); }
    else if (action === 'writing-reveal' && s) finishCharacter(0, true);
    else if (action === 'writing-next') stepNext();
    return true;
  }
  function mount(context) {
    ctx = context;
    render();
    if (!characterData) loadCharacterData().then(data => {
      if (data && ctx?.state.mode === 'writing') render();
    });
  }
  global.ChineseLabWriting = Object.freeze({ mount, action: act, render });
})(window);