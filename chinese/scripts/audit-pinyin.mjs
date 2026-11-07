/* Audit every dictionary source and the embedded offline copy of Chinese Lab.
 * Run: node chinese/scripts/audit-pinyin.mjs
 */
import fs from 'node:fs';
import path from 'node:path';
import {fileURLToPath} from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const read = filename => JSON.parse(fs.readFileSync(path.join(root, 'data', filename), 'utf8'));
const manifest = read('manifest.json');
const context = read('context-glossary.json');
const extras = read('extra-words.json');
const lessons = manifest.lessons.map(read);
const errors = [];

for (const [filename, entries] of [
  ['context-glossary.json', context],
  ['extra-words.json', extras],
  ...lessons.map((lesson, index) => [manifest.lessons[index], lesson.words])
]) {
  for (const item of entries) {
    if (!item.hanzi || !String(item.pinyin || '').trim()) {
      errors.push(`${filename}: ${item.hanzi || '[empty Hanzi]'} has no pinyin`);
    }
  }
}

const html = fs.readFileSync(path.join(root, 'index.html'), 'utf8');
const marker = 'window.__offlineData=';
const start = html.indexOf(marker);
const finish = html.indexOf('};\n', start + marker.length);
if (start < 0 || finish < 0) {
  errors.push('index.html: embedded offline dictionary could not be parsed');
} else {
  const offline = JSON.parse(html.slice(start + marker.length, finish + 1));
  const embedded = new Map((offline['context-glossary.json'] || []).map(w => [w.hanzi, w.pinyin]));
  for (const word of context) {
    if (!embedded.has(word.hanzi) || embedded.get(word.hanzi) !== word.pinyin) {
      errors.push(`index.html: outdated offline entry ${word.hanzi}`);
    }
  }
  for (const name of manifest.lessons) {
    if (!offline[name]) errors.push(`index.html: missing embedded ${name}`);
  }
}

const fallbackSource = fs.readFileSync(path.join(root, 'js/pinyin-chars.js'), 'utf8');
const fallbackMatch = fallbackSource.match(/Object\.freeze\((\{.*\})\)/s);
if (!fallbackMatch) errors.push('js/pinyin-chars.js: missing character lookup');
else {
  const charMap = JSON.parse(fallbackMatch[1]);
  const usedChars = new Set(JSON.stringify([context, extras, lessons]).match(/\p{Script=Han}/gu) || []);
  for (const c of usedChars) if (!charMap[c]) errors.push(`js/pinyin-chars.js: missing ${c}`);
}

if (errors.length) {
  console.error('Chinese Lab pinyin audit failed (' + errors.length + '):');
  for (const issue of errors.slice(0, 60)) console.error(' - ' + issue);
  process.exitCode = 1;
} else {
  console.log('Chinese Lab pinyin audit: all entries and offline fallback verified.');
}
