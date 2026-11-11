import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync, existsSync} from 'node:fs';
import {join, dirname} from 'node:path';
import {fileURLToPath} from 'node:url';
import {runInNewContext} from 'node:vm';

const root=join(dirname(fileURLToPath(import.meta.url)), '..', '..');
const read=path=>readFileSync(join(root,path),'utf8');
const offline=read('chinese/js/offline-bundle.js');
const offlineSceneNames=new Set(
  [...offline.matchAll(/"([^"]+)":"data:image\/svg\+xml;base64,/g)].map(match=>match[1])
);
const browser={
  addEventListener(){},
  __offlineScenes:Object.fromEntries([...offlineSceneNames].map(name=>[name,'available']))
};
runInNewContext(read('chinese/js/scene-match.js'),{window:browser});
runInNewContext(read('chinese/js/exercise-sessions.js'),{window:browser});
const engine=browser.ChineseLabSceneMatch;
const sessions=browser.ChineseLabSessions;
const lessons=Array.from({length:18},(_,i)=>JSON.parse(read('chinese/data/lesson'+(i+1)+'.json')));

test('matching game in every published lesson draws exclusively from its own vocabulary',()=>{
  for(const lesson of lessons){
    const game=engine.init(lesson);
    const vocabulary=new Set(lesson.words.map(word=>word.hanzi));
    assert(game, 'lesson '+lesson.id+' needs a scene');
    assert(game.pairs.length>=3, 'lesson '+lesson.id+' needs at least 3 objects');
    assert.equal(game.order.length,game.pairs.length);
    assert.equal(new Set(game.order).size,game.pairs.length);
    for(const pair of game.pairs){
      assert(vocabulary.has(pair.word), 'lesson '+lesson.id+' contains foreign word '+pair.word);
      assert(pair.ru, 'lesson '+lesson.id+' needs lesson-specific translation');
      assert(pair.x>=0 && pair.y>=0 && pair.w>0 && pair.h>0);
      assert(pair.x+pair.w<=100 && pair.y+pair.h<=100);
    }
    assert(
      offlineSceneNames.has(game.scene) ||
      existsSync(join(root,'chinese/assets',game.scene+'.svg')),
      'scene '+game.scene+' should exist'
    );
    const progress={sessions:{}};
    assert(sessions.persist(progress,lesson.id,'sceneMatch',game,lesson));
    const restored=sessions.restore(progress,lesson.id,'sceneMatch',lesson);
    assert(restored, 'lesson '+lesson.id+' should resume');
    assert.equal(restored.scene,game.scene);
  }
});

test('lesson 8 replaces generic room with four genuine lesson words',()=>{
  const game=engine.init(lessons[7]);
  assert.equal(game.scene,'lesson8-vocabulary');
  assert.deepEqual([...game.pairs.map(p=>p.word)].sort(),['大自然','帽子','故宫','长城'].sort());
  assert(!game.pairs.some(p=>['电脑','手机','椅子','书','杯子'].includes(p.word)));
  const svg=read('chinese/assets/lesson8-vocabulary.svg');
  assert(svg.startsWith('<svg') && svg.includes('viewBox="0 0 1080 620"'));
});

test('lessons 9–11 use topic-appropriate matching scenes',()=>{
  assert.equal(engine.init(lessons[8]).scene,'gallery-studio');
  assert.equal(engine.init(lessons[9]).scene,'winter-plan');
  assert.equal(engine.init(lessons[10]).scene,'lesson11-vocabulary');
});

test('lesson 18 uses its own technology picture, not the generic room',()=>{
  const game=engine.init(lessons[17]);
  assert.equal(game.scene,'tech-bike');
  assert.deepEqual([...game.pairs.map(p=>p.word)],['共享单车','二维码','出口','说明']);
});

test('stale snapshots with foreign words are rejected, without wiping unrelated progress',()=>{
  const lesson=lessons[7];
  const game=engine.init(lesson);
  const stale={...game,scene:'word-search-room',
    pairs:['电脑','手机','椅子'].map((word,i)=>({id:String(i),word,x:2,y:4,w:10,h:10})),
    order:['电脑','手机','椅子'],matched:[]};
  const progress={xp:99,sessions:{'8':{sceneMatch:{version:1,game:stale}}}};
  assert.equal(sessions.restore(progress,8,'sceneMatch',lesson),null);
  assert.equal(progress.xp,99);
});

test('new asset and cache references are versioned for offline devices',()=>{
  const html=read('chinese/index.html'),sw=read('chinese/sw.js');
  assert(html.includes('scene-match.js?v=20261111-5'));
  assert(html.includes('exercise-sessions.js?v=20261111-3'));
  assert(sw.includes('scene-match.js?v=20261111-5'));
  assert(sw.includes('lesson8-vocabulary.svg'));
  assert(sw.includes('hsk4-chinese-lab-pwa-v24'));
});
