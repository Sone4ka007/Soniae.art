// Проверка охвата словарей учебника сюжетными главами Chinese Lab.
// Запуск: node chinese/scripts/audit-story-vocabulary.mjs 5
// Без номера показывает статистику по всем урокам (без ошибки из-за ещё не переработанных глав).
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const data = join(dirname(fileURLToPath(import.meta.url)), '..', 'data');
const readings = JSON.parse(readFileSync(join(data, 'readings.json'), 'utf8'));
const specified = process.argv.slice(2);
const lessonIds = specified.length ? specified.map(Number) : Array.from({ length: 9 }, (_, i) => i + 1);
let failed = false;

for (const id of lessonIds) {
  if (!Number.isInteger(id) || id < 1 || id > 20) {
    throw Error('Номер урока должен быть целым числом от 1 до 20');
  }
  const lesson = JSON.parse(readFileSync(join(data, `lesson${id}.json`), 'utf8'));
  const chapters = readings[id] || [];
  if (!chapters.length) throw Error(`Урок ${id}: отсутствуют главы`);

  const lines = chapters.flatMap(ch => ch.lines || []);
  if (lines.some(line => !Array.isArray(line) || line.length !== 2 || !line[0] || !line[1])) {
    throw Error(`Урок ${id}: отсутствует китайский текст или перевод`);
  }
  const chinese = lines.map(line => line[0]).join('\n');
  const missing = lesson.words.filter(word => !chinese.includes(word.hanzi));
  const covered = lesson.words.length - missing.length;
  console.log(`Урок ${id}: ${covered}/${lesson.words.length} слов в ${chapters.length} главах`);
  if (missing.length) {
    console.log('  Отсутствуют: ' + missing.map(word => word.hanzi).join('、'));
    if (specified.length) failed = true;
  }
}
if (failed) process.exitCode = 1;
