import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {dirname,join} from 'node:path';
import {fileURLToPath} from 'node:url';
import {Script,runInNewContext} from 'node:vm';

const root=join(dirname(fileURLToPath(import.meta.url)),'..','..');
const read=path=>readFileSync(join(root,path),'utf8');
const lesson=JSON.parse(read('chinese/data/lesson1.json'));
const context={addEventListener(){}};
const artScript=read('chinese/js/scene-match.js');
const sessionScript=read('chinese/js/exercise-sessions.js');
runInNewContext(artScript,{window:context});
runInNewContext(sessionScript,{window:context});
const engine=context.ChineseLabSceneMatch;
const sessions=context.ChineseLabSessions;
const docs=['签证','材料','证件','奖学金'].sort();
const campus=['教师','课程','食堂','活动'].sort();
function handlers(){
 const calls={xp:0,misses:0,spoken:[],renders:0};
 return {...calls,lesson,award(n){this.xp+=n;},miss(){this.misses++;},speech(s){this.spoken.push(s);},render(){this.renders++;}};
}
function pick(game,pair,h){
 engine.action('scene-spot',{dataset:{sceneId:pair.id}},game,h);
 engine.action('scene-word',{dataset:{sceneWord:pair.word}},game,h);
}
function rendered(game){
 return engine.render(lesson,game,{esc:s=>String(s),sceneURL:key=>'assets/'+key+'.svg'});
}
test('two original SVG assets have matching viewBox and stay within file size budget',()=>{
 for(const basename of ['sonya-lesson1-documents','sonya-lesson1-campus']){
  const svg=read('chinese/assets/'+basename+'.svg');
  assert(svg.startsWith('<svg'));
  assert(svg.includes('viewBox="0 0 1080 620"'));
  assert(svg.includes('<path'));
  assert(svg.length<100000,'Do not bloat PWA cache');
 }
 assert.doesNotThrow(()=>new Script(artScript));
});
test('first round covers four genuine lesson-one words and no extra vocabulary',()=>{
 const game=engine.init(lesson);
 assert.equal(game.scene,'sonya-lesson1-documents');
 assert.equal(game.sceneIndex,0);
 assert.equal(game.sceneCount,2);
 assert.equal(game.pairs.length,4);
 assert.deepEqual(Array.from(game.pairs,p=>p.word).sort(),docs);
 assert(!game.pairs.some(p=>['护照','课程表'].includes(p.word)));
 const known=new Set(lesson.words.map(w=>w.hanzi));
 for(const p of game.pairs){
  assert(known.has(p.word));
  assert(p.x>=0&&p.y>=0&&p.w>0&&p.h>0);
  assert(p.x+p.w<=100&&p.y+p.h<=100);
 }
 assert(rendered(game).includes('sonya-lesson1-documents.svg'));
 assert(!rendered(game).includes('data-action="scene-next"'));
});
test('correct pairs unlock second scene and finish all eight artworks',()=>{
 const game=engine.init(lesson),h=handlers();
 for(const pair of game.pairs.map(x=>({...x})))pick(game,pair,h);
 assert.equal(game.matched.length,4);
 assert.equal(h.xp,32);
 assert(rendered(game).includes('data-action="scene-next"'));
 engine.action('scene-next',{dataset:{}},game,h);
 assert.equal(game.scene,'sonya-lesson1-campus');
 assert.equal(game.sceneIndex,1);
 assert.equal(game.matched.length,0);
 assert.deepEqual(Array.from(game.pairs,p=>p.word).sort(),campus);
 assert(rendered(game).includes('sonya-lesson1-campus.svg'));
 for(const pair of game.pairs.map(x=>({...x})))pick(game,pair,h);
 assert.equal(h.xp,64);
 assert.equal(h.spoken.length,8);
 assert.equal(game.matched.length,4);
 assert(!rendered(game).includes('data-action="scene-next"'));
 assert(rendered(game).includes('8 РИСУНКОВ НАЙДЕНО'));
});
test('mistakes earn no XP; partial progress persists across reloads',()=>{
 const game=engine.init(lesson),h=handlers(),p={sessions:{}};
 engine.action('scene-spot',{dataset:{sceneId:game.pairs[0].id}},game,h);
 engine.action('scene-word',{dataset:{sceneWord:game.pairs[1].word}},game,h);
 assert.equal(h.misses,1);
 assert.equal(h.xp,0);
 pick(game,game.pairs[1],h);
 assert.equal(h.xp,8);
 assert.equal(game.matched.length,1);
 assert(sessions.persist(p,1,'sceneMatch',game,lesson));
 assert.equal(sessions.restore(p,1,'sceneMatch',lesson)?.matched.length,1);
 const incompatible={...game,scene:'word-search-room'};
 assert(!sessions.restore({sessions:{'1':{sceneMatch:{version:1,game:incompatible}}}},1,'sceneMatch',lesson));
});
test('illustrations have a larger pannable surface, zoom, and preserve game progress',()=>{
 const game=engine.init(lesson),h=handlers();
 assert.equal(game.zoom,false);
 assert(rendered(game).includes('scene-match-canvas'));
 assert(rendered(game).includes('data-action="scene-zoom"'));
 engine.action('scene-zoom',{dataset:{}},game,h);
 assert.equal(game.zoom,true);
 assert(rendered(game).includes('is-zoomed'));
 assert.equal(h.xp,0);
 const p={sessions:{}};
 assert(sessions.persist(p,1,'sceneMatch',game,lesson));
 assert.equal(sessions.restore(p,1,'sceneMatch',lesson)?.zoom,true);
 engine.action('scene-zoom',{dataset:{}},game,h);
 assert.equal(game.zoom,false);
 const css=read('chinese/css/scene-match.css');
 assert(css.includes('scene-match-canvas'));
 assert(css.includes('580px')&&css.includes('880px'));
 const html=read('chinese/index.html');
 assert(html.includes("picture.addEventListener('scroll'"));
 assert(html.includes("case 'scene-zoom'"));
});
test('site entry and cache include the new artwork while other lesson data stays intact',()=>{
 const html=read('chinese/index.html'),sw=read('chinese/sw.js');
 assert(html.includes('scene-next'));
 assert(html.includes('./js/scene-match.js?v=20261111-3'));
 assert(sw.includes('sonya-lesson1-documents.svg'));
 assert(sw.includes('sonya-lesson1-campus.svg'));
 assert(sw.includes('scene-match.js?v=20261111-3'));
 assert(!lesson.words.some(w=>w.hanzi==='护照'||w.hanzi==='课程表'));
});
