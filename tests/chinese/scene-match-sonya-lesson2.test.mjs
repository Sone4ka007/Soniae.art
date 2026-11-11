import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {dirname,join} from 'node:path';
import {fileURLToPath} from 'node:url';
import {Script,runInNewContext} from 'node:vm';

const root=join(dirname(fileURLToPath(import.meta.url)),'..','..');
const read=path=>readFileSync(join(root,path),'utf8');
const lesson1=JSON.parse(read('chinese/data/lesson1.json'));
const lesson2=JSON.parse(read('chinese/data/lesson2.json'));
const context={addEventListener(){}};
const matching=read('chinese/js/scene-match.js');
runInNewContext(matching,{window:context});
runInNewContext(read('chinese/js/exercise-sessions.js'),{window:context});
const engine=context.ChineseLabSceneMatch,sessions=context.ChineseLabSessions;
function handlers(){
 const score={points:0,errors:0,spoken:[]};
 return {lesson:lesson2,score,
  award(n){score.points+=n;},miss(){score.errors++;},
  speech(w){score.spoken.push(w);},render(){}
 };
}
function choose(game,pair,h){
 engine.action('scene-spot',{dataset:{sceneId:pair.id}},game,h);
 engine.action('scene-word',{dataset:{sceneWord:pair.word}},game,h);
}
const draw=game=>engine.render(lesson2,game,{esc:String,sceneURL:name=>'assets/'+name+'.svg'});

test('both lesson 2 SVG files are compact, drawn from source and use fixed viewBox',()=>{
 for(const name of ['sonya-lesson2-apartment','sonya-lesson2-details']){
  const svg=read('chinese/assets/'+name+'.svg');
  assert.match(svg,/viewBox="0 0 1080 620"/);
  assert.match(svg,/<path /);
  assert(svg.length<100000);
 }
 assert.doesNotThrow(()=>new Script(matching));
});

test('lesson 2 only uses the seven actual textbook entries, including 亮 and 价格',()=>{
 const first=engine.init(lesson2);
 assert.equal(first.scene,'sonya-lesson2-apartment');
 assert.equal(first.sceneIndex,0);
 assert.equal(first.sceneCount,2);
 assert.deepEqual(Array.from(first.pairs,p=>p.word).sort(),['厨房','客厅','毛巾','亮'].sort());
 const vocabulary=new Set(lesson2.words.map(w=>w.hanzi));
 for(const p of first.pairs){
  assert(vocabulary.has(p.word));
  assert(p.x>=0 && p.y>=0 && p.w>0 && p.h>0);
  assert(p.x+p.w<=100.05 && p.y+p.h<=100.05);
 }
 assert(!first.pairs.some(p=>p.word==='灯'||p.word==='灯光'));
});

test('four apartment words unlock three household words and all seven pictures',()=>{
 const g=engine.init(lesson2),h=handlers();
 for(const p of [...g.pairs])choose(g,p,h);
 assert.equal(h.score.points,32);
 assert(draw(g).includes('data-action="scene-next"'));
 engine.action('scene-next',{dataset:{}},g,h);
 assert.equal(g.scene,'sonya-lesson2-details');
 assert.deepEqual(Array.from(g.pairs,p=>p.word).sort(),['价格','日记','种'].sort());
 assert(!g.pairs.some(p=>p.word==='房租'||p.word==='种植'));
 for(const p of [...g.pairs])choose(g,p,h);
 assert.equal(g.matched.length,3);
 assert.equal(h.score.points,56);
 assert.equal(h.score.spoken.length,7);
 assert(draw(g).includes('7 РИСУНКОВ НАЙДЕНО'));
 assert(!draw(g).includes('data-action="scene-next"'));
});

test('lesson 2 progress and zoom persist without changing lesson 1 behavior',()=>{
 const first=engine.init(lesson1);
 assert.equal(first.scene,'sonya-lesson1-documents');
 const g=engine.init(lesson2),h=handlers(),progress={sessions:{}};
 const chosen=g.pairs[0];
 choose(g,chosen,h);
 engine.action('scene-zoom',{dataset:{}},g,h);
 assert.equal(g.zoom,true);
 assert(sessions.persist(progress,2,'sceneMatch',g,lesson2));
 const restored=sessions.restore(progress,2,'sceneMatch',lesson2);
 assert.equal(restored?.zoom,true);
 assert.equal(restored?.matched.length,1);
 const old={...g,scene:'apartment'};
 assert.equal(sessions.restore({sessions:{'2':{sceneMatch:{version:1,game:old}}}},2,'sceneMatch',lesson2),null);
 assert.equal(h.score.errors,0);
});

test('lesson 2 assets and updated matching version are offline cached',()=>{
 const html=read('chinese/index.html'),sw=read('chinese/sw.js');
 assert(html.includes('scene-match.js?v=20261111-6'));
 assert(sw.includes('scene-match.js?v=20261111-6'));
 assert(sw.includes('sonya-lesson2-apartment.svg'));
 assert(sw.includes('sonya-lesson2-details.svg'));
});
