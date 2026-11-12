import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {join,dirname} from 'node:path';
import {fileURLToPath} from 'node:url';
import {runInNewContext} from 'node:vm';

const root=join(dirname(fileURLToPath(import.meta.url)),'..','..');
const read=path=>readFileSync(join(root,path),'utf8');
const window={};
runInNewContext(read('chinese/js/learning-path.js'),{window});
runInNewContext(read('chinese/js/exercise-sessions.js'),{window});
const path=window.ChineseLabLearningPath;
const sessions=window.ChineseLabSessions;

test('word substitution has its own game mode and navigation entry',()=>{
  assert.equal(path.stageForMode('substitute'),'games');
  const info=path.STAGES.flatMap(s=>s.modes.map(id=>({id,icon:'?',title:id})));
  const nav=path.navigation('substitute',{lastGameMode:'substitute'},info,String);
  assert.match(nav.modes,/data-id="substitute"/);
  assert.match(nav.modes,/data-id="sentence"/);
  assert.equal(path.modeForStage('games',{lastGameMode:'substitute'}),'substitute');
});

test('word substitution is not attached to sentence assembly',()=>{
  const html=read('chinese/index.html');
  const sentence=html.split('function renderSentence(){')[1].split('function sentenceAction(')[0];
  assert(!sentence.includes('questMissionBox()'));
  assert.match(html,/function renderSubstitution\(\)/);
  assert.match(html,/mode === 'substitute'\) initSubstitution/);
  assert.match(html,/kind === 'substitute'\) renderSubstitution/);
  assert(!html.includes('САЙД-КВЕСТ · СЛОВА В ПРЕДЛОЖЕНИЯХ'));
});

test('word substitution resumes independently, without losing vocabulary completion',()=>{
  const lesson={id:3,quest:{vocabMissions:[{tasks:[{word:'下载'}]},{tasks:[{word:'准备'}]}]}};
  const progress={questWords:{3:{'下载':true}}};
  const game={missionStage:1,missionOpen:true,missionResult:null,missionNotice:'',revealed:['hint']};
  assert.equal(sessions.persist(progress,3,'substitute',game,lesson),true);
  const restored=sessions.restore(progress,3,'substitute',lesson);
  assert(restored);
  assert.equal(restored.missionStage,1);
  assert.equal(restored.missionOpen,true);
  assert.equal(progress.questWords[3]['下载'],true);
  assert.equal(sessions.restore(progress,3,'sentence',lesson),null);
  assert.equal(sessions.clear(progress,3,'substitute'),true);
  assert.equal(progress.questWords[3]['下载'],true);
});

test('four answer choices have distinct, visibly labeled listen and translation controls',()=>{
  const html=read('chinese/index.html');
  const css=read('chinese/css/substitution-cards.css');
  const sw=read('chinese/sw.js');
  assert.match(html,/ВАРИАНТЫ ОТВЕТА/);
  assert.match(html,/quest-mission-pick/);
  assert.match(html,/▶ Слушать/);
  assert.match(html,/Перевод ↓/);
  assert.match(html,/quest-mission-translate/);
  assert.match(html,/missionChoiceReveals/);
  assert.match(css,/quest-mission-tool/);
  assert.match(css,/@media\\(max-width:640px\\)/);
  assert.match(sw,/substitution-cards\\.css\\?v=20261112-1/);
  assert.match(sw,/hsk4-chinese-lab-pwa-v32/);
});
