/* Chinese Lab — lesson scene object-to-word matching.
 * Works with lesson.scene.spots and lesson.words; no duplicate vocabulary.
 * The host app owns XP, speech, saving and mode navigation.
 */
(function (global) {
  'use strict';

  function objects(lesson) {
    const words = new Set((lesson?.words || []).map(w => w.hanzi));
    const used = new Set();
    return (lesson?.scene?.spots || []).filter(s => {
      if (!s || typeof s.id !== 'string' || used.has(s.id) ||
          typeof s.word !== 'string' || !words.has(s.word) ||
          ![s.x, s.y, s.w, s.h].every(Number.isFinite) ||
          s.w <= 0 || s.h <= 0 || s.x < 0 || s.y < 0 ||
          s.x + s.w > 100 || s.y + s.h > 100) return false;
      used.add(s.id);
      return true;
    });
  }

  function create(lesson, shuffle) {
    const ids = objects(lesson).map(s => s.id);
    return {
      order: shuffle(ids), selected: null, matched: [],
      hintLevel: 0, zoomed: false, errors: 0, notice: ''
    };
  }

  function valid(game, lesson) {
    if (!game || typeof game !== 'object' || Array.isArray(game)) return false;
    const available = objects(lesson).map(s => s.id);
    if (!available.length || !Array.isArray(game.order) ||
        game.order.length !== available.length ||
        new Set(game.order).size !== available.length ||
        !game.order.every(id => available.includes(id)) ||
        !Array.isArray(game.matched) ||
        new Set(game.matched).size !== game.matched.length ||
        !game.matched.every(id => game.order.includes(id))) return false;
    return (game.selected === null ||
            (game.order.includes(game.selected) && !game.matched.includes(game.selected))) &&
      Number.isInteger(game.hintLevel) && game.hintLevel >= 0 && game.hintLevel <= 3 &&
      typeof game.zoomed === 'boolean' &&
      Number.isInteger(game.errors) && game.errors >= 0 &&
      typeof game.notice === 'string' && game.notice.length < 400;
  }

  function render(lesson, game, options) {
    const {esc, sceneURL} = options;
    const available = new Map(objects(lesson).map(s => [s.id, s]));
    const words = new Map((lesson.words || []).map(w => [w.hanzi, w]));
    const total = game.order.length;
    if (!total) return '<p class="feedback is-error">Для этого урока пока нет предметов на иллюстрации.</p>';
    const finished = game.matched.length === total;
    const active = available.get(game.selected);
    const cards = game.order.map(id => {
      const s = available.get(id), w = words.get(s.word);
      const matched = game.matched.includes(id), selected = game.selected === id;
      const showPinyin = matched || (selected && game.hintLevel >= 1);
      const showRu = matched || (selected && game.hintLevel >= 2);
      return '<button type="button" class="object-match-word' +
        (matched ? ' is-matched' : '') + (selected ? ' is-selected' : '') +
        '" data-action="object-word" data-id="' + esc(id) + '"' +
        (matched ? ' disabled' : '') + ' aria-pressed="' + selected + '">' +
        '<span class="object-match-hanzi">' + esc(w.hanzi) + '</span>' +
        (showPinyin ? '<span class="object-match-pinyin">' + esc(w.pinyin || '') + '</span>' : '') +
        (showRu ? '<span class="object-match-ru">' + esc(w.ru || s.ru || '') + '</span>' : '') +
        '<span class="object-match-mark" aria-hidden="true">' + (matched ? '✓' : selected ? '◖' : '○') + '</span>' +
        '</button>';
    }).join('');
    const hotspots = game.order.map((id, i) => {
      const s = available.get(id), matched = game.matched.includes(id);
      const guided = game.selected === id && game.hintLevel >= 3;
      return '<button type="button" class="object-match-spot' +
        (matched ? ' is-matched' : '') + (guided ? ' is-guided' : '') +
        '" data-action="object-spot" data-id="' + esc(id) + '"' +
        ' style="left:' + s.x + '%;top:' + s.y + '%;width:' + s.w + '%;height:' + s.h + '%"' +
        ' aria-label="' + (matched ? 'Найдено: ' + esc(s.word) : 'Область ' + (i + 1) + ' на картинке') + '"' +
        (matched ? ' disabled' : '') + '>' +
        (matched ? '<span aria-hidden="true">✓</span>' : guided ? '<span aria-hidden="true">◎</span>' : '') +
        '</button>';
    }).join('');
    const hintButton = !finished && active && game.hintLevel < 3 ?
      '<button type="button" class="object-match-control" data-action="object-hint">' +
      (game.hintLevel === 0 ? 'ПОДСКАЗКА: ПИНЬИНЬ' :
       game.hintLevel === 1 ? 'ПОКАЗАТЬ ПЕРЕВОД' : 'ПОКАЗАТЬ МЕСТО') +
      '</button>' : '';
    const instruction = finished ? 'Все предметы найдены. Слова можно повторить, начав новый раунд.' :
      active ? 'Найди на иллюстрации: ' + active.word :
      'Нажми на китайское слово, затем найди соответствующий предмет на картинке.';
    return '<section class="object-match" aria-label="Найди предмет">' +
      '<div class="object-match-meter"><div class="progress-track"><div style="width:' +
      Math.round(100 * game.matched.length / total) +
      '%"></div></div><span>НАЙДЕНО ' + game.matched.length + ' / ' + total + '</span></div>' +
      '<p class="object-match-instruction">' + esc(instruction) + '</p>' +
      '<div class="object-match-controls"><button type="button" class="object-match-control" data-action="object-zoom" aria-pressed="' + game.zoomed + '">' +
      (game.zoomed ? 'УМЕНЬШИТЬ КАРТИНКУ −' : 'УВЕЛИЧИТЬ КАРТИНКУ +') +
      '</button>' + hintButton + '</div>' +
      '<div class="object-match-viewport' + (game.zoomed ? ' is-zoomed' : '') + '">' +
      '<div class="object-match-scene"><img src="' + esc(sceneURL(lesson.scene.image)) +
      '" alt="Иллюстрация: ' + esc(lesson.scene.location || lesson.scene.title || 'университет') +
      '" draggable="false">' + hotspots + '</div></div>' +
      '<div class="object-match-words" aria-label="Китайские слова">' + cards + '</div>' +
      '<p class="object-match-notice" role="status" aria-live="polite">' +
      (finished ? 'Готово! Ты нашла все ' + total + ' предметов. Открой «НАЧАТЬ ЗАНОВО» для нового раунда.' :
       esc(game.notice || 'Переводы скрыты. При необходимости открывай подсказки постепенно.')) +
      '</p></section>';
  }

  function action(name, id, game, lesson, deps) {
    const byId = new Map(objects(lesson).map(s => [s.id, s]));
    if (!valid(game, lesson)) return false;
    if (name === 'object-zoom') {
      game.zoomed = !game.zoomed;
      return true;
    }
    if (name === 'object-word') {
      if (!byId.has(id) || game.matched.includes(id)) return false;
      game.selected = id;
      game.hintLevel = 0;
      game.notice = 'Теперь найди предмет на иллюстрации.';
      deps.speech(byId.get(id).word);
      return true;
    }
    if (name === 'object-hint') {
      if (!game.selected || game.hintLevel >= 3) return false;
      game.hintLevel++;
      game.notice = game.hintLevel === 3 ? 'Место предмета подсвечено на картинке.' : '';
      return true;
    }
    if (name === 'object-spot') {
      if (!byId.has(id) || game.matched.includes(id)) return false;
      if (!game.selected) {
        game.notice = 'Сначала выбери одно слово под картинкой.';
        return true;
      }
      const expected = byId.get(game.selected);
      if (game.selected === id) {
        game.matched.push(id);
        game.selected = null;
        game.hintLevel = 0;
        game.notice = 'Верно: ' + expected.word + ' — ' + (lesson.words.find(w => w.hanzi === expected.word)?.ru || expected.ru || '');
        deps.award(10, 'НАЙДЕН ПРЕДМЕТ');
        deps.speech(expected.word);
      } else {
        game.errors++;
        game.notice = 'Это другой предмет. Попробуй ещё раз.';
        deps.miss(expected.word);
      }
      return true;
    }
    return false;
  }

  global.ChineseLabObjectMatch = Object.freeze({objects, create, valid, render, action});
})(window);
