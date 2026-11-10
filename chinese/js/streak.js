/* Chinese Lab — daily activity streak.
 * Count only successful XP-earning learning actions, never page visits.
 * Dates use the learner's local calendar day, not UTC.
 */
(function (global) {
  'use strict';
  const GOAL = 5;
  const DAY_MS = 86400000;
  const pad = value => String(value).padStart(2, '0');
  function dayKey(date = new Date()) {
    return [date.getFullYear(), pad(date.getMonth() + 1), pad(date.getDate())].join('-');
  }
  function dayNumber(key) {
    if (typeof key !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(key)) return null;
    const [y, m, d] = key.split('-').map(Number);
    const date = new Date(Date.UTC(y, m - 1, d));
    return date.toISOString().slice(0, 10) === key ? Math.floor(date.getTime() / DAY_MS) : null;
  }
  function safeCount(value) {
    return Number.isFinite(value) && value > 0 ? Math.floor(value) : 0;
  }
  function record(progress, now = new Date()) {
    if (!progress || typeof progress !== 'object') return { reachedGoal: false };
    if (!progress.dailyActivity || typeof progress.dailyActivity !== 'object' || Array.isArray(progress.dailyActivity)) {
      progress.dailyActivity = {};
    }
    const key = dayKey(now);
    const was = safeCount(progress.dailyActivity[key]);
    progress.dailyActivity[key] = Math.min(100000, was + 1);
    return { reachedGoal: was < GOAL && progress.dailyActivity[key] >= GOAL };
  }
  function summary(progress, now = new Date()) {
    const raw = progress?.dailyActivity || {};
    const activity = raw && typeof raw === 'object' && !Array.isArray(raw) ? raw : {};
    const today = dayKey(now);
    const todayNumber = dayNumber(today);
    const done = [...new Set(Object.entries(activity).filter(([date, count]) =>
      safeCount(count) >= GOAL && dayNumber(date) !== null && dayNumber(date) <= todayNumber
    ).map(([date]) => dayNumber(date)))].sort((a, b) => a - b);
    const completed = new Set(done);
    const start = completed.has(todayNumber) ? todayNumber :
      completed.has(todayNumber - 1) ? todayNumber - 1 : null;
    let current = 0;
    if (start !== null) {
      for (let d = start; completed.has(d); d--) current++;
    }
    let best = 0, run = 0, previous = null;
    for (const d of done) {
      run = previous !== null && d === previous + 1 ? run + 1 : 1;
      best = Math.max(best, run);
      previous = d;
    }
    const todayCount = safeCount(activity[today]);
    return { current, best, today, todayCount, goal: GOAL,
      completedToday: todayCount >= GOAL, remaining: Math.max(0, GOAL - todayCount),
      activity };
  }
  function render(progress, now = new Date()) {
    const stats = summary(progress, now);
    const count = Math.min(stats.goal, stats.todayCount);
    const percent = count / stats.goal * 100;
    const start = new Date(now.getFullYear(), now.getMonth(), now.getDate() - 27, 12);
    const offset = (start.getDay() + 6) % 7;
    const empty = Array.from({ length: offset }, () => '<span class="streak-day is-padding" aria-hidden="true"></span>').join('');
    const cells = Array.from({ length: 28 }, (_, i) => {
      const date = new Date(start.getFullYear(), start.getMonth(), start.getDate() + i, 12);
      const key = dayKey(date);
      const amount = safeCount(stats.activity[key]);
      const css = amount >= GOAL ? 'is-complete' : amount > 0 ? 'is-partial' : 'is-empty';
      const todayClass = key === stats.today ? ' is-today' : '';
      const stamp = date.toLocaleDateString('ru-RU', { day:'numeric', month:'long' });
      return '<span class="streak-day ' + css + todayClass + '" title="' + stamp + ': ' + amount + ' / ' + GOAL + ' действий" aria-label="' + stamp + ': ' + (amount >= GOAL ? 'цель выполнена' : amount + ' из ' + GOAL) + '">' + date.getDate() + '</span>';
    }).join('');
    const status = stats.completedToday
      ? 'Дневная цель выполнена. Завтра можно продолжить серию.'
      : 'Ещё ' + stats.remaining + ' действий с XP, чтобы засчитать сегодняшний день.';
    return '<section class="streak-panel" aria-label="Серия дней занятий">' +
      '<div class="streak-head"><div><p class="streak-kicker">ЕЖЕДНЕВНАЯ ПРАКТИКА</p><h4>УДАРНЫЙ РЕЖИМ</h4></div>' +
      '<span class="streak-label">' + (stats.completedToday ? 'ЦЕЛЬ ВЫПОЛНЕНА' : 'ЦЕЛЬ НА СЕГОДНЯ') + '</span></div>' +
      '<div class="streak-metrics"><div><strong>' + stats.current + '</strong><span>ДНЕЙ ПОДРЯД</span></div>' +
      '<div><strong>' + stats.best + '</strong><span>ЛУЧШАЯ СЕРИЯ</span></div></div>' +
      '<div class="streak-goal"><div><b>СЕГОДНЯ</b><span>' + count + ' / ' + GOAL + ' действий с XP</span></div>' +
      '<div class="streak-track" role="progressbar" aria-label="Дневная цель" aria-valuemin="0" aria-valuemax="' + GOAL + '" aria-valuenow="' + count + '"><i style="width:' + percent + '%"></i></div>' +
      '<p>' + status + '</p></div>' +
      '<div class="streak-calendar-title">ПОСЛЕДНИЕ 28 ДНЕЙ</div>' +
      '<div class="streak-weekdays" aria-hidden="true"><span>ПН</span><span>ВТ</span><span>СР</span><span>ЧТ</span><span>ПТ</span><span>СБ</span><span>ВС</span></div>' +
      '<div class="streak-calendar">' + empty + cells + '</div>' +
      '<p class="streak-note">Засчитываются дни с пятью успешными действиями, за которые начислен XP. Старые XP без даты нельзя добавить в календарь задним числом.</p></section>';
  }
  global.ChineseLabStreak = Object.freeze({goal: GOAL, dayKey, record, summary, render});
})(window);
