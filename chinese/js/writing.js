/* Chinese Lab — one vocabulary word, 10 progressive handwriting repetitions. */
(function (global) {
  'use strict';
  const VERSION = 2;
  const HAN = /[\u3400-\u9fff]/u;
  const LIBRARY = 'https://cdn.jsdelivr.net/npm/hanzi-writer@3.7.3/dist/hanzi-writer.min.js';
  let ctx = null, writer = null, renderToken = 0, libraryPromise = null;
  let characterData = null, dataPromise = null;
  const strokeData = new Map();
  const byId = id => document.getElementById(id);
  const safe = value => ctx.esc(value ?? '');
  const integer = (v, fallback) => Number.isFinite(Number(v)) ? Math.trunc(Number(v)) : fallback;
  const hanziChars = value => Array.from(String(value || '')).filter(c => HAN.test(c));

  function settings() {
    const p = ctx.state.progress;
    if (!p.writing || typeof p.writing !== 'object' || Array.isArray(p.writing)) p.writing = {};
    const w = p.writing;
    if (!w.srs || typeof w.srs !== 'object' || Array.isArray(w.srs)) w.srs = {};
    if (!w.history || typeof w.history !== 'object' || Array.isArray(w.history)) w.history = {};
    if (!Array.isArray(w.lessonIds)) w.lessonIds = [ctx.state.lessonId];
    w.lessonIds = [...new Set(w.lessonIds.map(Number).filter(id => ctx.state.lessons.some(l => l.id === id)))];
    if (!w.lessonIds.length) w.lessonIds = [ctx.state.lessonId];
    w.repetitions = [5, 10].includes(Number(w.repetitions)) ? Number(w.repetitions) : 10;
    if (!['auto', 'manual'].includes(w.prefillMode)) w.prefillMode = 'auto';
    w.prefillCount = Math.max(0, integer(w.prefillCount, 0));
    if (typeof w.autoSound !== 'boolean') w.autoSound = true;
    w.completedWords = Math.max(0, integer(w.completedWords, 0));
    // Keep historic writing.srs and writing.completed (old per-character counts) intact.
    return w;
  }
  function wordPool() {
    const w = settings();
    const unique = new Map();
    ctx.state.lessons.filter(l => w.lessonIds.includes(l.id)).forEach(l => (l.words || []).forEach(entry => {
      const hanzi = String(entry.hanzi || '').trim();
      const chars = hanziChars(hanzi);
      if (!hanzi || chars.length !== Array.from(hanzi).length || unique.has(hanzi)) return;
      unique.set(hanzi, { hanzi, chars, pinyin: entry.pinyin || '',
        ru: entry.ru || '', lesson: l.id });
    }));
    const values = [...unique.values()];
    const now = Date.now();
    return values.sort((a, b) => {
      const rank = word => {
        const records = word.chars.map(char => w.srs[char]).filter(Boolean);
        if (!records.length) return 1e13 + word.lesson * 1000;
        const next = Math.min(...records.map(rec => Number(rec.due) || 0));
        return next <= now ? next : 2e13 + next;
      };
      return rank(a) - rank(b);
    });
  }
  function chosenWord(pool = wordPool()) {
    const selected = settings().selectedWord;
    return pool.find(w => w.hanzi === selected) || pool[0] || null;
  }
  function persist() { ctx.save(); }

  function current() {
    const p = ctx.state.progress;
    let s = p.writingSession;
    if (s?.version === 1 && Array.isArray(s.queue) && s.queue.length) {
      const oldWord = s.queue[Math.max(0, Math.min(s.index || 0, s.queue.length - 1))];
      const candidate = wordPool().find(w => w.hanzi === oldWord?.word);
      const oldHanzi = String(oldWord?.word || oldWord?.char || '');
      const chars = hanziChars(oldHanzi);
      if (!chars.length) { delete p.writingSession; persist(); return null; }
      const word = candidate || { hanzi: oldHanzi, chars, pinyin: oldWord.pinyin || '',
        ru: oldWord.ru || '', lesson: oldWord.lesson || ctx.state.lessonId };
      // Preserve review history. A partially drawn old quiz cannot resume exact pointer strokes.
      s = {version: VERSION, word, attempt: 0, charIndex: 0, rounds: 10,
        stage: 'study', startedAt: Date.now(), completedRounds: 0, cleanRounds: 0,
        mistakes: 0, skipped: 0, roundMistakes: 0, roundHelp: false, roundPrefilled: 0,
        recent: [], showStructure: false, showAnswer: false};
      p.writingSession = s; persist();
    }
    if (!s || s.version !== VERSION || !s.word || !Array.isArray(s.word.chars) ||
      !s.word.chars.length || !Number.isInteger(s.attempt) ||
      s.attempt < 0 || s.attempt >= s.rounds ||
      !Number.isInteger(s.charIndex) || s.charIndex < 0 ||
      s.charIndex >= s.word.chars.length) return null;
    return s;
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
    if (!characterData) return '<p class="writing-guide-note">Загружаем русский разбор иероглифа…</p>';
    if (!global.ChineseLabWritingGuideRU) return '<p class="writing-guide-note">Словарь пока недоступен. Попробуй обновить страницу.</p>';
    const currentWord = current()?.word;
    return global.ChineseLabWritingGuideRU.render(u.char, info || null, {
      lessons: ctx.state.lessons, lessonId: currentWord?.lesson || ctx.state.lessonId
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
  function loadStrokes(library, char) {
    if (strokeData.has(char)) return Promise.resolve(strokeData.get(char));
    if (typeof library.loadCharacterData !== 'function') return Promise.reject(new Error('Hanzi Writer не поддерживает данные черт'));
    return library.loadCharacterData(char).then(data => {
      if (!data || !Array.isArray(data.strokes) || !data.strokes.length) throw new Error('Нет черт для ' + char);
      strokeData.set(char, data);
      return data;
    });
  }
  function clearWriter() {
    if (writer) { try { writer.cancelQuiz(); } catch (_) {} }
    writer = null;
  }
  function speakWord() {
    if (!current() || typeof ctx?.speech !== 'function') return;
    ctx.speech(current().word.hanzi);
  }
  function autoSound() {
    if (settings().autoSound) speakWord();
  }
  function choice(label, action, value, selected) {
    return '<button type="button" class="writing-choice' + (selected ? ' is-on' : '') +
      '" data-action="' + action + '" data-value="' + safe(value) +
      '" aria-pressed="' + String(!!selected) + '">' + safe(label) + '</button>';
  }
  function render() {
    if (!ctx || ctx.state.mode !== 'writing') return;
    ++renderToken;
    clearWriter();
    const s = current();
    if (!s) return drawSettings();
    if (s.stage === 'study') return drawStudy(s);
    if (s.stage === 'roundEnd') return drawRoundEnd(s);
    drawPractice(s);
  }
  function drawSettings() {
    const w = settings();
    const pool = wordPool();
    const chosen = chosenWord(pool);
    const due = pool.filter(word => word.chars.some(ch => w.srs[ch] && Number(w.srs[ch].due) <= Date.now())).length;
    byId('game-panel').innerHTML = '<div class="writing-root">' +
      '<div class="panel-head"><div><div class="eyebrow">写汉字 / НАПИСАНИЕ</div><h3>ОДНО СЛОВО · 10 РАЗ</h3>' +
      '<p class="panel-desc">Разбери состав одного слова, затем пропиши его несколько раз. ' +
      'Первые черты постепенно исчезают — к концу пишешь самостоятельно.</p></div></div>' +
      '<div class="writing-stats"><span>СЛОВ В УРОКАХ: <b>' + pool.length + '</b></span>' +
      '<span>К ПОВТОРЕНИЮ: <b>' + due + '</b></span>' +
      '<span>ОСВОЕНО ЗА ЗАНЯТИЯ: <b>' + w.completedWords + '</b></span></div>' +
      '<div class="writing-setting"><h4>01 / ВЫБЕРИ УРОКИ</h4><div class="writing-lessons">' +
      ctx.state.lessons.map(l => choice('Урок ' + String(l.id).padStart(2, '0'),
        'writing-lesson', l.id, w.lessonIds.includes(l.id))).join('') + '</div></div>' +
      '<div class="writing-setting"><h4>02 / ОДНО СЛОВО</h4>' +
      '<label class="writing-label" for="writing-word-select">Выбери слово или оставь первое из очереди повторения</label>' +
      '<select id="writing-word-select" class="writing-select">' +
      '<option value="">Следующее к повторению' + (pool.length ? ': ' + safe(pool[0].hanzi) : '') + '</option>' +
      pool.map(item => '<option value="' + safe(item.hanzi) + '"' +
        (w.selectedWord === item.hanzi ? ' selected' : '') + '>' +
        safe(item.hanzi + ' · ' + item.pinyin + ' · ' + item.ru) + '</option>').join('') +
      '</select><p class="writing-note">В многознаковом слове ты пропишешь каждый иероглиф по порядку.</p></div>' +
      '<div class="writing-setting"><h4>03 / СКОЛЬКО РАЗ?</h4><div class="writing-choices">' +
      choice('5 раз', 'writing-repetitions', 5, w.repetitions === 5) +
      choice('10 раз', 'writing-repetitions', 10, w.repetitions === 10) + '</div></div>' +
      '<div class="writing-setting"><h4>04 / ПОДСКАЗКИ И ЗВУК</h4><div class="writing-choices">' +
      choice('Постепенно убирать черты', 'writing-prefill-auto', 'auto', w.prefillMode === 'auto') +
      choice('Выбирать число черт вручную', 'writing-prefill-manual', 'manual', w.prefillMode === 'manual') +
      '</div><div class="writing-choices writing-sound-row">' +
      choice('Озвучивать слово: ' + (w.autoSound ? 'ВКЛ' : 'ВЫКЛ'),
        'writing-sound-toggle', 'sound', w.autoSound) + '</div></div>' +
      '<button type="button" data-action="writing-start" class="writing-primary" ' +
      (!chosen ? 'disabled' : '') + '>ИЗУЧИТЬ И НАЧАТЬ →</button>' +
      '<p class="writing-note">Проверка черт и порядок написания работают через Hanzi Writer. ' +
      'Текущий подход сохраняется; незаконченный знак после перезагрузки начинается заново.</p>' +
      (ctx.state.progress.writingLastResult ? '<p class="writing-note">Последняя практика: ' +
       safe(ctx.state.progress.writingLastResult.word || '') + ', ' +
       safe(ctx.state.progress.writingLastResult.done) + ' прописываний.</p>' : '') + '</div>';
  }
  function wordHeader(s, heading) {
    return '<div class="writing-progress-head"><b>ПИСЬМО · ' + safe(heading) + '</b>' +
      '<span>' + (s.stage === 'study' ? 'ПОДГОТОВКА' : (s.attempt + 1) + ' / ' + s.rounds) + '</span></div>' +
      '<div class="writing-progress-track"><span style="width:' +
      Math.round(100 * s.completedRounds / s.rounds) + '%"></span></div>';
  }
  function drawStudy(s) {
    const w = s.word;
    const chars = w.chars;
    byId('game-panel').innerHTML = '<div class="writing-root">' + wordHeader(s, 'ИЗУЧИ СЛОВО') +
      '<div class="writing-prompt"><div class="writing-large-word" lang="zh-CN">' + safe(w.hanzi) + '</div>' +
      '<div class="writing-meaning">' + safe(w.ru) + '</div>' +
      '<div class="writing-pronunciation">' + safe(w.pinyin) + ' · Урок ' + safe(w.lesson) + '</div>' +
      '<p>Нажми на звук, посмотри компоненты и порядок черт. Затем пропиши слово ' +
      s.rounds + ' раз.</p></div>' +
      '<div class="writing-actions"><button type="button" class="writing-secondary" data-action="writing-speak">◖)) ПРОИЗНЕСТИ</button>' +
      '<button type="button" class="writing-primary" data-action="writing-begin">НАЧАТЬ ПРОПИСЫВАТЬ →</button></div>' +
      '<div class="writing-breakdowns">' + chars.map((ch, i) => '<section class="writing-breakdown">' +
        '<h3 class="writing-breakdown-char" lang="zh-CN">' + safe(ch) + ' <small>' + (i + 1) +
        '/' + chars.length + '</small></h3>' + characterGuide({char: ch}) +
        '<button type="button" class="writing-secondary writing-demo-btn" data-action="writing-demo" data-value="' +
        i + '">▶ ПОРЯДОК ЧЕРТ</button><div class="writing-demo-canvas" id="writing-demo-' + i + '"></div></section>').join('') + '</div>' +
      '<button type="button" class="writing-stop" data-action="writing-stop">ЗАКОНЧИТЬ ЗАНЯТИЕ</button></div>';
  }
  async function demoStrokes(s, index) {
    if (s.stage !== 'study' || !Number.isInteger(index) || index < 0 || index >= s.word.chars.length) return;
    const token = renderToken, char = s.word.chars[index];
    try {
      const lib = await loadLibrary();
      const data = await loadStrokes(lib, char);
      if (token !== renderToken || current() !== s || ctx?.state.mode !== 'writing') return;
      const el = byId('writing-demo-' + index);
      if (!el) return;
      clearWriter();
      el.innerHTML = '';
      writer = lib.create(el, char, {width: 180, height: 180, padding: 10,
        showCharacter: false, showOutline: true, strokeAnimationSpeed: 1.5,
        strokeColor: '#111511', outlineColor: '#d0d4c7',
        charDataLoader: (_char, complete) => complete(data)});
      writer.animateCharacter();
    } catch (error) {
      const el = byId('writing-demo-' + index);
      if (el && token === renderToken) el.textContent = 'Порядок черт недоступен. Попробуй позже.';
    }
  }
  function prefillCount(s, strokes) {
    const max = Math.max(0, strokes - 1); // always require at least one drawn stroke
    const w = settings();
    if (w.prefillMode === 'manual') return Math.min(w.prefillCount, max);
    return Math.max(0, Math.min(max, Math.round(max * (1 - Math.min(1, s.attempt / Math.max(1, s.rounds - 2))))));
  }
  function drawPractice(s) {
    const char = s.word.chars[s.charIndex];
    byId('game-panel').innerHTML = '<div class="writing-root">' + wordHeader(s, 'ПРОПИСЫВАНИЕ') +
      '<div class="writing-prompt"><div class="writing-meaning">' + safe(s.word.ru) + '</div>' +
      '<div class="writing-pronunciation">' + safe(s.word.pinyin) +
      ' · Знак ' + (s.charIndex + 1) + ' из ' + s.word.chars.length + '</div>' +
      '<p>Допиши недостающие черты в правильном порядке. Произношение — по кнопке или в начале каждого повтора.</p></div>' +
      '<div class="writing-paper"><div class="writing-grid"><div id="writing-canvas" class="writing-canvas" ' +
      'role="img" aria-label="Напиши черты иероглифа пальцем или мышью"></div></div></div>' +
      '<div id="writing-prefill-controls" class="writing-prefill-controls" aria-live="polite">' +
      'Загружаем данные черт…</div>' +
      '<div class="writing-actions"><button type="button" class="writing-secondary" data-action="writing-speak">◖)) ПРОИЗНЕСТИ</button>' +
      '<button type="button" class="writing-secondary" data-action="writing-structure">СОСТАВ И ПОДСКАЗКА</button>' +
      '<button type="button" class="writing-secondary" data-action="writing-hint">ПОКАЗАТЬ КОНТУР</button>' +
      '<button type="button" class="writing-minor" data-action="writing-restart">СТЕРЕТЬ И ПОВТОРИТЬ</button>' +
      '<button type="button" class="writing-minor" data-action="writing-reveal">ПОСМОТРЕТЬ ОБРАЗЕЦ</button>' +
      '<button type="button" class="writing-minor" data-action="writing-skip">ПРОПУСТИТЬ ЗНАК</button></div>' +
      '<section id="writing-breakdown" class="writing-breakdown"' + (s.showStructure ? '' : ' hidden') + '>' +
      (s.showAnswer ? '<div class="writing-large-word" lang="zh-CN">' + safe(char) + '</div>' : '') +
      characterGuide({char}) + '</section>' +
      '<div id="writing-status" class="writing-note" aria-live="polite"></div>' +
      '<button type="button" class="writing-stop" data-action="writing-stop">ЗАКОНЧИТЬ ЗАНЯТИЕ</button></div>';
    initCanvas(s, char, renderToken);
  }
  function setPrefillControls(s, total, count) {
    const el = byId('writing-prefill-controls');
    if (!el) return;
    const w = settings();
    const max = Math.max(0, total - 1);
    el.innerHTML = '<div class="writing-prefill-label"><strong>НАПИСАНО ЗАРАНЕЕ: ' +
      count + ' ИЗ ' + total + ' ЧЕРТ</strong>' +
      '<span>Тебе осталось ' + (total - count) + '</span></div>' +
      '<div class="writing-prefill-input">' +
      '<button type="button" class="writing-choice' + (w.prefillMode === 'auto' ? ' is-on' : '') +
      '" data-action="writing-prefill-auto" aria-pressed="' + (w.prefillMode === 'auto') +
      '">АВТОМАТИЧЕСКИ</button>' +
      '<label for="writing-prefill-range">СВОЙ ВАРИАНТ</label>' +
      '<input type="range" id="writing-prefill-range" min="0" max="' + max +
      '" value="' + count + '" step="1" aria-label="Сколько первых черт показать заранее">' +
      '<output>' + count + '</output></div>' +
      '<p class="writing-note">0 — чистый лист; ' + max +
      ' — почти готовый иероглиф. В автоматическом режиме подсказка уменьшается при каждом повторе.</p>';
  }
  async function initCanvas(s, char, token) {
    const el = byId('writing-status');
    if (el) el.textContent = 'Загружаем иероглиф…';
    try {
      const library = await loadLibrary();
      const data = await loadStrokes(library, char);
      if (token !== renderToken || ctx.state.mode !== 'writing' || current() !== s ||
        s.stage !== 'practice' || s.word.chars[s.charIndex] !== char) return;
      const canvas = byId('writing-canvas');
      if (!canvas) return;
      const count = prefillCount(s, data.strokes.length);
      setPrefillControls(s, data.strokes.length, count);
      const width = Math.min(284, Math.max(220, canvas.clientWidth || 284));
      writer = library.create(canvas, char, {
        width, height: width, padding: 15, showCharacter: false, showOutline: false,
        strokeColor: '#111511', outlineColor: '#d0d4c7', drawingColor: '#252b1d',
        highlightColor: '#a9d600', showHintAfterMisses: 3,
        charDataLoader: (_character, onLoad) => onLoad(data),
        onLoadCharDataSuccess: () => { if (token === renderToken && byId('writing-status')) byId('writing-status').textContent = ''; },
        onLoadCharDataError: () => showError(token, 'Нет данных черт. Проверь интернет.')
      });
      writer.quiz({
        quizStartStrokeNum: count,
        showHintAfterMisses: 3,
        onMistake: details => {
          if (token === renderToken && byId('writing-status')) byId('writing-status').textContent =
            'Неточная черта. Ошибок: ' + (details.totalMistakes || 0);
        },
        onComplete: details => {
          if (token !== renderToken || ctx.state.mode !== 'writing' || current() !== s ||
            s.stage !== 'practice') return;
          completeCharacter(s, Math.max(0, integer(details.totalMistakes, 0)), count, false);
        }
      });
    } catch (error) { showError(token, 'Не удалось загрузить черты этого знака. Повтори попытку или пропусти его.'); }
  }
  function showError(token, message) {
    if (token !== renderToken) return;
    const el = byId('writing-status');
    if (el) el.textContent = message;
  }
  function completeCharacter(s, mistakes, prefilled, skipped) {
    if (current() !== s || s.stage !== 'practice') return;
    s.roundMistakes += mistakes;
    s.roundPrefilled += prefilled;
    if (skipped) { s.skipped++; s.roundHelp = true; }
    if (s.charIndex + 1 < s.word.chars.length) {
      s.charIndex++;
      s.showStructure = false; s.showAnswer = false;
      persist(); render();
    } else {
      s.completedRounds++;
      s.mistakes += s.roundMistakes;
      if (s.roundMistakes === 0 && s.roundPrefilled === 0 && !s.roundHelp) s.cleanRounds++;
      s.recent.push({mistakes: s.roundMistakes, prefilled: s.roundPrefilled,
        helped: s.roundHelp, skipped});
      s.stage = 'roundEnd';
      persist(); render();
    }
  }
  function drawRoundEnd(s) {
    const finished = s.completedRounds >= s.rounds;
    const last = s.recent[s.recent.length - 1] || {};
    byId('game-panel').innerHTML = '<div class="writing-root">' + wordHeader(s, 'ПОВТОР ЗАВЕРШЁН') +
      '<div class="writing-prompt"><div class="writing-large-word" lang="zh-CN">' + safe(s.word.hanzi) + '</div>' +
      '<div class="writing-meaning">' + safe(s.word.ru) + '</div>' +
      '<div class="writing-pronunciation">' + safe(s.word.pinyin) + '</div></div>' +
      '<div class="writing-feedback">' + s.completedRounds + ' ИЗ ' + s.rounds + ' ПРОПИСЫВАНИЙ · ' +
      (last.mistakes || 0) + ' ОШИБОК · ' + (last.prefilled || 0) + ' ГОТОВЫХ ЧЕРТ</div>' +
      '<div class="writing-actions">' +
      '<button type="button" class="writing-secondary" data-action="writing-speak">◖)) ПРОИЗНЕСТИ</button>' +
      '<button type="button" class="writing-primary" data-action="' +
      (finished ? 'writing-finish' : 'writing-next-round') + '">' +
      (finished ? 'ЗАВЕРШИТЬ ЗАНЯТИЕ →' : 'ПРОПИСАТЬ ЕЩЁ РАЗ →') + '</button>' +
      '</div><button type="button" class="writing-stop" data-action="writing-stop">ЗАКОНЧИТЬ ЗАНЯТИЕ</button></div>';
  }
  function startPractice(s) {
    if (!s) return;
    s.stage = 'practice';
    s.charIndex = 0;
    s.roundMistakes = 0; s.roundPrefilled = 0; s.roundHelp = false;
    s.showStructure = false; s.showAnswer = false;
    persist(); render();
    autoSound();
  }
  function finalize(s, completed) {
    const w = settings();
    const recent = (s.recent || []).slice(-Math.min(3, s.rounds));
    const fullyIndependent = recent.length >= 2 && recent.every(r =>
      !r.helped && !r.skipped && r.mistakes === 0 && r.prefilled === 0);
    const anyMissed = s.skipped > 0;
    const grade = !completed || anyMissed ? 1 :
      fullyIndependent ? 4 : recent.some(r => r.mistakes >= 3 || r.helped) ? 2 : 3;
    if (completed) {
      const now = Date.now();
      // One spaced-repetition rating per character and session, not ten artificial reviews.
      for (const ch of new Set(s.word.chars)) {
        if (global.ChineseLabFSRS6?.next) w.srs[ch] = global.ChineseLabFSRS6.next(w.srs[ch] || null, grade, now);
        else w.srs[ch] = {last: now, due: now + (grade <= 2 ? 86400000 : 3 * 86400000),
          interval: grade <= 2 ? 1 : 3};
      }
      w.completedWords++;
      w.history[s.word.hanzi] = {last: now, rounds: s.completedRounds,
        clean: s.cleanRounds, grade, mistakes: s.mistakes};
      if (grade >= 3) ctx.award(5, 'СЛОВО ПРОПИСАНО');
    }
    ctx.state.progress.writingLastResult = {word: s.word.hanzi,
      done: s.completedRounds, clean: s.cleanRounds, endedAt: Date.now()};
    delete ctx.state.progress.writingSession;
    persist(); render();
  }
  function startSession() {
    const pool = wordPool(), w = settings(), word = chosenWord(pool);
    if (!word) return;
    ctx.state.progress.writingSession = {version: VERSION, word, attempt: 0, charIndex: 0,
      rounds: w.repetitions, stage: 'study', startedAt: Date.now(),
      completedRounds: 0, cleanRounds: 0, mistakes: 0, skipped: 0,
      roundMistakes: 0, roundHelp: false, roundPrefilled: 0,
      recent: [], showStructure: false, showAnswer: false};
    persist(); render();
    autoSound();
  }
  function act(action, button) {
    if (!ctx || ctx.state.mode !== 'writing') return false;
    const w = settings(), s = current(), value = button.dataset.value;
    if (action === 'writing-lesson') {
      const id = Number(value);
      if (w.lessonIds.includes(id) && w.lessonIds.length > 1) w.lessonIds = w.lessonIds.filter(n => n !== id);
      else if (!w.lessonIds.includes(id) && ctx.state.lessons.some(l => l.id === id)) w.lessonIds.push(id);
      if (!wordPool().some(item => item.hanzi === w.selectedWord)) w.selectedWord = '';
      persist(); render();
    } else if (action === 'writing-repetitions') {
      if ([5, 10].includes(Number(value))) w.repetitions = Number(value);
      persist(); render();
    } else if (action === 'writing-sound-toggle') {
      w.autoSound = !w.autoSound; persist(); render();
    } else if (action === 'writing-prefill-auto') {
      w.prefillMode = 'auto'; persist(); render();
    } else if (action === 'writing-prefill-manual') {
      w.prefillMode = 'manual'; persist(); render();
    } else if (action === 'writing-start') startSession();
    else if (action === 'writing-begin' && s) startPractice(s);
    else if (action === 'writing-demo' && s && s.stage === 'study') demoStrokes(s, Number(value));
    else if (action === 'writing-next-round' && s && s.stage === 'roundEnd') {
      s.attempt++; startPractice(s);
    } else if (action === 'writing-finish' && s && s.stage === 'roundEnd') finalize(s, true);
    else if (action === 'writing-stop' && s) finalize(s, false);
    else if (action === 'writing-speak') speakWord();
    else if (action === 'writing-structure' && s && s.stage === 'practice') {
      s.roundHelp = true; s.showStructure = !s.showStructure;
      const el = byId('writing-breakdown'); if (el) el.hidden = !s.showStructure;
      persist();
    } else if (action === 'writing-hint' && s && s.stage === 'practice' && writer) {
      s.roundHelp = true; writer.showOutline(); persist();
    } else if (action === 'writing-restart' && s && s.stage === 'practice') {
      s.roundHelp = true; persist(); render();
    } else if (action === 'writing-reveal' && s && s.stage === 'practice') {
      s.roundHelp = true; s.showStructure = true; s.showAnswer = true; persist(); render();
    } else if (action === 'writing-skip' && s && s.stage === 'practice') {
      completeCharacter(s, 3, 0, true);
    }
    return true;
  }
  function change(event) {
    if (!ctx || ctx.state.mode !== 'writing') return;
    const target = event.target;
    if (target?.id === 'writing-word-select' && !current()) {
      settings().selectedWord = target.value;
      persist(); render();
    } else if (target?.id === 'writing-prefill-range' && current()?.stage === 'practice') {
      const w = settings();
      const max = Math.max(0, (strokeData.get(current().word.chars[current().charIndex])?.strokes?.length || 1) - 1);
      w.prefillMode = 'manual';
      w.prefillCount = Math.max(0, Math.min(max, integer(target.value, 0)));
      current().roundHelp = true; // user explicitly requested extra guidance
      persist(); render();
    }
  }
  document.addEventListener('change', change);
  function mount(context) {
    ctx = context;
    render();
    if (!characterData) loadCharacterData().then(data => {
      if (!data || ctx?.state.mode !== 'writing') return;
      const active = current();
      // Never erase a partly written character when the background glossary finishes loading.
      if (!active || active.stage === 'study' || active.stage === 'roundEnd') render();
      else {
        const guide = byId('writing-breakdown');
        if (guide) guide.innerHTML = (active.showAnswer
          ? '<div class="writing-large-word" lang="zh-CN">' +
            safe(active.word.chars[active.charIndex]) + '</div>' : '') +
          characterGuide({char: active.word.chars[active.charIndex]});
      }
    });
  }
  global.ChineseLabWriting = Object.freeze({mount, action: act, render});
})(window);
