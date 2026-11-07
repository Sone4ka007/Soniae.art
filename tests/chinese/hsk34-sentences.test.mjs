// Regression guardrails for Chinese Lab HSK 3–4 examples.
// Run: node tests/chinese/hsk34-sentences.test.mjs
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '../../chinese/data');
const read = name => JSON.parse(readFileSync(resolve(root, name), 'utf8'));
const normalize = text => String(text).replace(/[\\s。，？！、：；“”！？]/g, '');
const hanziLength = text => (String(text).match(/[\\u3400-\\u9fff]/g) || []).length;
let sentences = 0, missions = 0;
for (let i = 1; i <= 10; i++) {
  const lesson = read('lesson' + i + '.json');
  const words = new Set(lesson.words.map(word => word.hanzi));
  assert.equal(words.size, lesson.words.length, 'duplicate lesson words L' + i);
  for (const [idx, s] of lesson.sentences.entries()) {
    const where = 'lesson ' + i + ', sentence ' + (idx+1);
    assert.ok(s.zh && s.ru, where + ': missing Chinese or Russian');
    assert.ok(Array.isArray(s.parts) && s.parts.length >= 2, where + ': too few chunks');
    assert.ok(s.parts.every(p => hanziLength(p) <= 10), where + ': a chunk is too long');
    assert.equal(normalize(s.parts.join('')), normalize(s.zh), where + ': parts mismatch');
    assert.ok(Array.isArray(s.variants) &&
      s.variants.some(v => normalize(v.join('')) === normalize(s.zh)), where + ': missing variant');
    assert.ok((s.targets || []).every(w => s.zh.includes(w)), where + ': missing target word');
    sentences++;
  }
  for (const g of lesson.quest.vocabMissions) for (const m of g.tasks) {
    assert.ok(words.has(m.word), 'lesson ' + i + ': unknown mission word ' + m.word);
    assert.ok(m.sentence?.includes(m.word) && m.ru,
      'lesson ' + i + ': mission missing target or translation for ' + m.word);
    missions++;
  }
}
assert.equal(read('lesson2.json').sentences[29].zh,
  '住在这里，我觉得很有安全感。', 'lesson 2: security example lost colloquial form');
assert.equal(sentences, 492, 'unexpected sentence count');
assert.equal(missions, 403, 'unexpected mission count');
console.log('PASS: ' + sentences + ' HSK 3–4 examples, ' + missions + ' missions.');
