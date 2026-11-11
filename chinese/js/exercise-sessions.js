/* Chinese Lab — resumable exercise sessions (v1).
 * The snapshots are included in the existing progress JSON, so localStorage,
 * backups and authenticated Supabase sync use the same data automatically.
 * Keep them separate per lesson and mode.
 */
(function (global) {
  'use strict';
  const MODES = new Set(['story', 'pairs', 'sceneMatch', 'translate', 'reverse', 'build', 'sentence']);
  const MAX_SNAPSHOT_LENGTH = 250000;
  const isObject = value => value !== null && typeof value === 'object' && !Array.isArray(value);
  const validIndex = (value, count) => Number.isInteger(value) && value >= 0 && value <= count;

  function validGame(mode, game, lesson) {
    if (!MODES.has(mode) || !isObject(game)) return false;
    if (mode === 'story') {
      const count = lesson?.quest?.steps?.length || 0;
      return game.isQuest === true &&
        ['intro', 'play', 'complete'].includes(game.status) &&
        validIndex(game.stage, count) &&
        (game.status !== 'play' || game.stage < count) &&
        Array.isArray(game.seen) && Array.isArray(game.items) &&
        Array.isArray(game.tokens) && Array.isArray(game.selected) &&
        Array.isArray(game.choices) && Array.isArray(game.revealed) &&
        isObject(game.flags);
    }
    if (mode === 'pairs') {
      return Array.isArray(game.pairs) && game.pairs.length > 0 &&
        Array.isArray(game.left) && Array.isArray(game.right) &&
        Array.isArray(game.matched);
    }
    if (mode === 'sceneMatch') {
      // Discard old lesson-one matching rounds after switching to the author's
      // two-scene artwork; XP and all other modes remain unchanged.
      if (lesson?.id === 1 &&
          !(game.sceneIndex === 0 && game.scene === 'sonya-lesson1-documents' ||
            game.sceneIndex === 1 && game.scene === 'sonya-lesson1-campus') ) return false;
      return typeof game.scene === 'string' &&
        Array.isArray(game.pairs) && game.pairs.length >= 3 && game.pairs.length <= 6 &&
        game.pairs.every(p => p && typeof p.id === 'string' && typeof p.word === 'string') &&
        Array.isArray(game.order) && game.order.length === game.pairs.length &&
        Array.isArray(game.matched) && game.matched.every(id => game.pairs.some(p => p.id === id)) &&
        (game.chosenSpot === null || game.pairs.some(p => p.id === game.chosenSpot)) &&
        (game.chosenWord === null || game.pairs.some(p => p.word === game.chosenWord));
    }
    if (!Array.isArray(game.questions) || !validIndex(game.index, game.questions.length)) return false;
    if (mode === 'translate' || mode === 'reverse') {
      return Array.isArray(game.choices) && typeof game.answered === 'boolean' &&
        Number.isInteger(game.correct);
    }
    if (mode === 'build') {
      return Array.isArray(game.tiles) && Array.isArray(game.selected) &&
        typeof game.verified === 'boolean' && Number.isInteger(game.correct);
    }
    if (mode === 'sentence') {
      return Array.isArray(game.bank) && Array.isArray(game.selected) &&
        typeof game.done === 'boolean' && Number.isInteger(game.correct);
    }
    return false;
  }

  function restore(progress, lessonId, mode, lesson) {
    const item = progress?.sessions?.[String(lessonId)]?.[mode];
    if (!item || item.version !== 1 || !validGame(mode, item.game, lesson)) return null;
    try { return JSON.parse(JSON.stringify(item.game)); }
    catch { return null; }
  }

  function persist(progress, lessonId, mode, game, lesson) {
    if (!isObject(progress) || !Number.isInteger(lessonId) || !validGame(mode, game, lesson)) return false;
    let json;
    try { json = JSON.stringify(game); }
    catch { return false; }
    if (!json || json.length > MAX_SNAPSHOT_LENGTH) return false;
    const key = String(lessonId);
    const existing = progress.sessions?.[key]?.[mode];
    if (existing?.version === 1 && JSON.stringify(existing.game) === json) return false;
    if (!isObject(progress.sessions)) progress.sessions = {};
    if (!isObject(progress.sessions[key])) progress.sessions[key] = {};
    progress.sessions[key][mode] = {
      version: 1,
      updatedAt: Date.now(),
      game: JSON.parse(json)
    };
    return true;
  }

  function clear(progress, lessonId, mode) {
    if (!MODES.has(mode) || !isObject(progress?.sessions?.[String(lessonId)])) return false;
    const sessions = progress.sessions[String(lessonId)];
    if (!Object.prototype.hasOwnProperty.call(sessions, mode)) return false;
    delete sessions[mode];
    if (!Object.keys(sessions).length) delete progress.sessions[String(lessonId)];
    return true;
  }

  global.ChineseLabSessions = Object.freeze({
    modes: MODES, restore, persist, clear
  });
})(window);
