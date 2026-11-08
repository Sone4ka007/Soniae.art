import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join,dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import '../../chinese/js/quest-mnemonics.js';

const root=join(dirname(fileURLToPath(import.meta.url)),'..','..');
const dataDir=join(root,'chinese','data');
const words=JSON.parse(readFileSync(join(dataDir,'lesson1.json'),'utf8')).words;
const wordSet=new Set(words.map(w=>w.hanzi));
const m=globalThis.ChineseLabMnemonics;
const cards=m.list(1);

test('lesson 1 has >= 50% optional mnemonic associations for its vocabulary',()=>{
 assert.ok(cards.length>=Math.ceil(words.length/2),`${cards.length} / ${words.length}`);
 assert.equal(new Set(cards.map(c=>c.word)).size,cards.length);
 assert.ok(cards.every(c=>wordSet.has(c.word)),'Every mnemonic is an actual lesson word');
 for(const card of cards){
  assert.ok(card.cue.length>35 && card.cue.length<260,card.word+' cue must be short but meaningful');
  assert.ok(card.kind&&card.recall,card.word+' needs a prompt and association type');
  assert.deepEqual(m.get(1,card.word),card);
 }
 assert.equal(m.get(2,'证件'),null,'The first lesson cards must not leak into other lessons');
});

test('illustrated first-lesson nouns have mnemonic cues',()=>{
 const quest=JSON.parse(readFileSync(join(dataDir,'lesson1.json'),'utf8')).quest;
 const seen=new Set(quest.steps.filter(s=>s.type==='explore').flatMap(s=>s.spots.map(x=>x.word)));
 for(const word of ['证件','材料','奖学金','课程','食堂','教师'])
   assert.ok(seen.has(word)&&m.get(1,word),word+' must be tied to illustrated evidence');
});

test('quest exposes hints only by deliberate button press and supports self recall',()=>{
 const html=readFileSync(join(root,'chinese','index.html'),'utf8');
 assert.match(html,/quest-mnemonics\.js\?v=20261109-1/);
 assert.match(html,/function questMnemonic\(word\)/);
 assert.match(html,/data-action="quest-memory"/);
 assert.match(html,/data-action="quest-memory-test"/);
 assert.match(html,/data-action="quest-memory-answer"/);
 assert.match(html,/questMnemonic\(o\.word\)/);
 assert.match(html,/questMnemonic\(t\.word\)/);
 assert.match(html,/quest-memory-toggle/);
 assert.match(html,/mnemonicSeen/);
 assert.match(html,/quest-hotspot-word/);
});
