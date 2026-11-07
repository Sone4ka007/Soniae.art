// Run: node tests/chinese/word-tiles.test.mjs
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {dirname,resolve} from 'node:path';
import {fileURLToPath} from 'node:url';
import {makeTokenizer} from '../../chinese/scripts/word-tokenizer.mjs';
const dataRoot=resolve(dirname(fileURLToPath(import.meta.url)),'../../chinese/data');
const lessons=Array.from({length:10},(_,i)=>JSON.parse(readFileSync(resolve(dataRoot,'lesson'+(i+1)+'.json'),'utf8')));
const tokenize=makeTokenizer(lessons.flatMap(l=>l.words.map(w=>w.hanzi)));
const sameBag=(a,b)=>a.length===b.length&&JSON.stringify([...a].sort())===JSON.stringify([...b].sort());
assert.deepEqual(tokenize('我喜欢咖啡。'), ['我','喜欢','咖啡。']);
assert.deepEqual(tokenize('住在这里，我觉得很有安全感。'),['住','在','这里，','我','觉得','很','有','安全感。']);
assert.deepEqual(tokenize('我想尝尝贵州的酸汤米线。'),['我','想','尝尝','贵州','的','酸汤米线。']);
let sentences=0,quests=0,variants=0;
for(const lesson of lessons) {
 for(const [i,s] of lesson.sentences.entries()) {
  assert.equal(s.parts.join(''),s.zh,'L'+lesson.id+' S'+(i+1)+' reconstruction');
  assert.deepEqual(s.parts,tokenize(s.zh),'L'+lesson.id+' S'+(i+1)+' not word-tokenized');
  assert.ok(s.parts.length>=2&&s.parts.every(x=>x.trim()!==''));
  for(const v of s.variants){assert.ok(sameBag(s.parts,v));variants++;}
  sentences++;
 }
 for(const s of lesson.quest.steps)if(s.type==='compose') {
   assert.deepEqual(s.tokens,tokenize(s.tokens.join('')),'L'+lesson.id+' compose not word-tokenized');
   for(const ans of s.answers)assert.ok(sameBag(s.tokens,ans));
   quests++;
 }
}
assert.equal(sentences,492);
assert.equal(quests,12);
console.log('PASS: '+sentences+' sentences and '+quests+' compose quests, '+variants+' accepted variants.');
