/* Chinese Lab — local-first progress layer.
 * Keep the historic v1 key so users do not lose existing progress.
 * A future authenticated adapter should exchange the same progress object,
 * not replace the lesson or SRS format.
 */
(function (global) {
  'use strict';
  const STORAGE_KEY = 'sonya-chinese-lab-progress-v1';
  const accountKey = userId => userId ? STORAGE_KEY + '-user-' + String(userId) : STORAGE_KEY;
  const EXPORT_FORMAT = 'chinese-lab-progress';
  const EXPORT_VERSION = 1;
  const OBJECT_FIELDS = ['stories', 'weak', 'saved', 'srs', 'ciDone', 'questWords'];
  const COUNTERS = ['xp', 'correct', 'attempts'];

  function isRecord(value) {
    return value !== null && typeof value === 'object' &&
      !Array.isArray(value) && Object.getPrototypeOf(value) === Object.prototype;
  }
  function validate(progress) {
    if (!isRecord(progress)) throw new Error('В файле нет данных прогресса.');
    for (const key of OBJECT_FIELDS) {
      if (progress[key] !== undefined && !isRecord(progress[key])) {
        throw new Error('Некорректное поле прогресса: ' + key);
      }
    }
    for (const key of COUNTERS) {
      if (progress[key] !== undefined &&
        (!Number.isFinite(progress[key]) || progress[key] < 0)) {
        throw new Error('Некорректное значение: ' + key);
      }
    }
    return progress;
  }
  function load(defaults, userId = null) {
    try {
      const raw = global.localStorage.getItem(accountKey(userId));
      return raw ? { ...defaults, ...validate(JSON.parse(raw)) } : { ...defaults };
    } catch (error) {
      console.warn('Chinese Lab: сохранённые данные недоступны', error);
      return { ...defaults };
    }
  }
  function save(progress, userId = null) {
    try {
      validate(progress);
      global.localStorage.setItem(accountKey(userId), JSON.stringify(progress));
      return true;
    } catch (error) {
      console.warn('Chinese Lab: не удалось сохранить прогресс', error);
      return false;
    }
  }
  function exportText(progress) {
    validate(progress);
    return JSON.stringify({
      format: EXPORT_FORMAT,
      schemaVersion: EXPORT_VERSION,
      exportedAt: new Date().toISOString(),
      progress
    }, null, 2);
  }
  function parseImport(text) {
    if (typeof text !== 'string' || text.length > 8 * 1024 * 1024) {
      throw new Error('Файл должен быть JSON размером не больше 8 МБ.');
    }
    let backup;
    try { backup = JSON.parse(text); }
    catch { throw new Error('Не удалось прочитать JSON-файл.'); }
    if (!isRecord(backup) || backup.format !== EXPORT_FORMAT ||
        backup.schemaVersion !== EXPORT_VERSION) {
      throw new Error('Это не резервная копия Chinese Lab поддерживаемой версии.');
    }
    return validate(backup.progress);
  }
  global.ChineseLabProgress = Object.freeze({
    storageKey: STORAGE_KEY,
    schemaVersion: EXPORT_VERSION,
    load, save, validate, exportText, parseImport
  });
})(window);
