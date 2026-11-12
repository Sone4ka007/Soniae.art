import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {join,dirname} from 'node:path';
import {fileURLToPath} from 'node:url';
import {runInNewContext} from 'node:vm';

const root=join(dirname(fileURLToPath(import.meta.url)),'..','..');
const read=path=>readFileSync(join(root,path),'utf8');
const context={window:{}};
runInNewContext(read('chinese/js/learning-path.js'),context);
const path=context.window.ChineseLabLearningPath;
const info=path.STAGES.flatMap(stage=>stage.modes.map(id=>({id,title:id.toUpperCase(),icon:'◖'})));
const esc=s=>String(s);

test('five stages preserve every study mode and legacy progress access',()=>{
  assert.equal(path.STAGES.length,5);
  assert.deepEqual(Array.from(path.STAGES,stage=>stage.id),['words','games','input','story','practice']);
  const modes=path.STAGES.flatMap(stage=>stage.modes);
  assert.equal(new Set(modes).size,12);
  assert(['sentence','review','sceneMatch','writing','video'].every(id=>modes.includes(id)));
  assert.equal(path.stageForMode('review'),'games');
  assert.equal(path.stageForMode('sentence'),'games');
  assert.equal(path.stageForMode('today'),null);
  assert.equal(path.stageForMode('progress'),null);
});

test('navigation renders five stage buttons and only exercises in current stage',()=>{
  const state={lastGameMode:'sentence',lastPracticeMode:'video'};
  const nav=path.navigation('sentence',state,info,esc);
  assert.equal((nav.stages.match(/class="learning-step/g)||[]).length,5);
  assert.match(nav.stages,/data-action="mode" data-id="story"/);
  assert.match(nav.stages,/data-action="stage" data-id="games"/);
  assert.match(nav.modes,/data-id="sceneMatch"/);
  assert.match(nav.modes,/data-id="review"/);
  assert.doesNotMatch(nav.modes,/data-id="writing"/);
  assert.equal(path.modeForStage('games',state),'sentence');
  assert.equal(path.modeForStage('practice',state),'video');
  assert.equal(path.modeForStage('games',{lastGameMode:'missing'}),'pairs');
  assert.equal(path.modeForStage('unknown',state),null);
  assert.equal(path.navigation('today',{},info,esc).modes,'');
});

test('resume uses the last study mode and keeps legacy progress compatible',()=>{
  const lessons=[{id:1},{id:2}];
  assert.deepEqual({...path.resumeTarget({lastLessonId:2,lastMode:'story'},lessons)},{lessonId:2,mode:'story'});
  assert.deepEqual({...path.resumeTarget({lastLessonId:2,lastMode:'today',lastStudyMode:'sentence'},lessons)},{lessonId:2,mode:'sentence'});
  assert.deepEqual({...path.resumeTarget({lastLessonId:999,lastMode:'progress'},lessons)},{lessonId:1,mode:'words'});
  const old={lastLessonId:2,lastMode:'today',sessions:{'2':{pairs:{updatedAt:7,game:{pairs:[]}},story:{updatedAt:8,game:{status:'play'}}}}};
  assert.equal(path.resumeTarget(old,lessons).mode,'story');
  assert.equal(path.dueCount({a:{due:90},b:{due:150},c:{}},100),1);
});

test('navigation styles and scripts are offline cached without changing progress key',()=>{
  const html=read('chinese/index.html'),sw=read('chinese/sw.js');
  assert.match(html,/id="lesson-select"/);
  assert.match(html,/id="today-entry"/);
  assert.match(html,/id="mode-subnav"/);
  assert.match(html,/learning-path\.js\?v=20261112-1/);
  assert.match(html,/learning-path\.css\?v=20261112-1/);
  assert.match(sw,/learning-path\.js\?v=20261112-1/);
  assert.match(sw,/learning-path\.css\?v=20261112-1/);
  assert.match(sw,/hsk4-chinese-lab-pwa-v28/);
  assert.match(read('chinese/js/progress-store.js'),/sonya-chinese-lab-progress-v1/);
});
