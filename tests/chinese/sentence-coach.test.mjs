import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {join,dirname} from 'node:path';
import {fileURLToPath} from 'node:url';
import {runInNewContext} from 'node:vm';

const root=join(dirname(fileURLToPath(import.meta.url)),'..','..');
const read=p=>readFileSync(join(root,p),'utf8');
const lessons=Array.from({length:20},(_,i)=>JSON.parse(read('chinese/data/lesson'+(i+1)+'.json')));
const base=JSON.parse(read('chinese/data/hsk3-base.json')).words;
const extra=JSON.parse(read('chinese/data/extra-words.json'));
const context=JSON.parse(read('chinese/data/context-glossary.json'));
const window={};
runInNewContext(read('chinese/js/hsk3-base.js'),{window});
runInNewContext(read('chinese/js/sentence-coach.js'),{window});
const coach=window.ChineseLabSentenceCoach;
const gloss=coach.translations(lessons,extra,context);

test('HSK1–3 words are bundled identically for offline usage',()=>{
  assert.equal(JSON.stringify(window.ChineseLabHSK3Base),JSON.stringify(base));
  assert.equal(base.length,1000);
});

test('each lesson offers graded, translated, word-level sentences',()=>{
  const counts=[];
  for(const lesson of lessons){
    const known=coach.allowedWords(base,lessons,lesson.id);
    const prepared=lesson.sentences.map(q=>coach.prepareQuestion(q,known,gloss)).filter(Boolean);
    counts.push(prepared.length);
    assert(prepared.length>0,'lesson '+lesson.id+' has no level-safe sentence practice');
    for(const q of prepared){
      assert.equal(coach.normalize(q.parts),coach.normalize(q.zh));
      assert(q.parts.every(p=>known.has(coach.pure(p))));
      assert(q.parts.every(p=>gloss.get(coach.pure(p))?.ru));
      assert(q.variants.every(v=>coach.accepted(q,v)));
      assert(q.parts.length>=2);
    }
  }
  console.log('Level-safe sentence counts by lesson: '+counts.join(', '));
  console.log('Total level-safe sentences: '+counts.reduce((n,c)=>n+c,0));
});

test('new or unlearned vocabulary never leaks into earlier lessons',()=>{
  const example=lessons[2].sentences.find(q=>/有些人会用各种手段骗你的钱/.test(q.zh));
  assert(example);
  assert.equal(coach.prepareQuestion(example,coach.allowedWords(base,lessons,3),gloss),null);
  const later=lessons[19].words.find(w=>!coach.allowedWords(base,lessons,3).has(w.hanzi));
  assert(later,'at least one lesson 20 word should be new in lesson 3');
  assert(!coach.allowedWords(base,lessons,3).has(later.hanzi));
  assert(coach.allowedWords(base,lessons,20).has(later.hanzi));
});

test('tomorrow download exercise accepts only grammatical time placement',()=>{
  const source=lessons[2].sentences.find(q=>q.zh==='我明天打算下载一个新软件。');
  assert(source,'screenshot exercise is in lesson 3');
  const q=coach.prepareQuestion(source,coach.allowedWords(base,lessons,3),gloss);
  assert(q,'screenshot exercise should remain available');
  assert(coach.accepted(q,['我','明天','打算','下载','一','个','新','软件。']));
  assert(coach.accepted(q,['明天','我','打算','下载','一','个','新','软件。']));
  assert(coach.accepted(q,['我','打算','明天','下载','一','个','新','软件。']));
  assert(!coach.accepted(q,['我','明天','下载','打算','一','个','新','软件。']));
});

test('wrong position gives useful, sentence-specific feedback',()=>{
  const q={parts:['有些','人','会','用','各种','手段','骗','你','的','钱。'],
    variants:[['有些','人','会','用','各种','手段','骗','你','的','钱。']]};
  const wrong=['有些','人','用','各种','手段','会','骗','你','的','钱。'];
  assert(!coach.accepted(q,wrong));
  assert.match(coach.diagnose(q,wrong),/会用/);
  assert.match(coach.hint(q,[],1),/有些/);
  assert.match(coach.hint(q,[],3),/正确ный|правильный|Один правильный вариант/i);
});

test('hints, answer reveal, skip and resume controls are wired in the web app',()=>{
  const html=read('chinese/index.html'),sw=read('chinese/sw.js');
  for(const id of ['sentence-hint','sentence-reveal','sentence-skip','sentence-next'])
    assert(html.includes(id),'missing action '+id);
  assert.match(html,/ChineseLabSentenceCoach\.prepareQuestion/);
  assert.match(html,/ChineseLabSentenceCoach\.diagnose/);
  assert.match(html,/ChineseLabSessions\.clear\(state\.progress,state\.lessonId,'sentence'\)/);
  assert.match(sw,/sentence-coach\.js\?v=20261112-1/);
  assert.match(sw,/hsk3-base\.js\?v=20261112-1/);
  assert.match(sw,/hsk4-chinese-lab-pwa-v30/);
});
