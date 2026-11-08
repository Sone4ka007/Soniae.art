import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {join,dirname} from 'node:path';
import {fileURLToPath} from 'node:url';
import '../../chinese/js/quest-branches.js';

const dataDir=join(dirname(fileURLToPath(import.meta.url)),'../../chinese/data');
const load=name=>JSON.parse(readFileSync(join(dataDir,name),'utf8'));
const readings=load('readings.json');
const base=load('hsk3-base.json').words;
const lessonData=Array.from({length:10},(_,i)=>load(`lesson${i+1}.json`));
const names=['安娜','小林','小陈','王老师','陈阿姨','刘明','李文','王','陈','林','刘','北京','上海','中国','贵州','广州','哈尔滨','长城','故宫'];

function findUnknown(text,allowed) {
 for(const m of String(text).matchAll(/[\p{Script=Han}]+/gu)){
  const run=m[0],dp=Array(run.length+1).fill(false);
  dp[0]=true;
  for(let i=0;i<run.length;i++)if(dp[i])
   for(let j=i+1;j<=run.length;j++)
    if(allowed.has(run.slice(i,j)))dp[j]=true;
  if(!dp[run.length])return run;
 }
 return null;
}

test('Chinese word tiles split phrase into words, not clauses',()=>{
 const parts=globalThis.ChineseLabQuestBranches.tiles('我喜欢咖啡。');
 assert.deepEqual(parts,['我','喜欢','咖啡。']);
 assert.equal(parts.join(''),'我喜欢咖啡。');

 const complex=globalThis.ChineseLabQuestBranches.tiles('安娜和小陈坐在客厅里，有一台电视。');
 assert.ok(complex.includes('小陈'),'小陈 is a proper name, not two separate tiles');
 assert.ok(complex.includes('坐'));
 assert.ok(complex.includes('在'));
 assert.ok(complex.includes('一'));
 assert.ok(complex.includes('台'));
 assert.ok(!complex.includes('坐在'));
 assert.ok(!complex.includes('一台'));
 const proper=globalThis.ChineseLabQuestBranches.tiles('我看见酸汤米线。',['酸汤米线']);
 assert.ok(proper.some(tile=>tile.startsWith('酸汤米线')),'Protect lesson-specific words, with trailing punctuation attached');

});

for(const lesson of lessonData){
 test(`lesson ${lesson.id}: three linked chapters, four distinct endings and graded vocabulary`,()=>{
   const chapters=readings[lesson.id];
   const result=globalThis.ChineseLabQuestBranches.build(lesson,chapters);
   assert.equal(result.schemaVersion,6);
   assert.equal(result.steps.length,8);
   assert.deepEqual(result.steps.map(x=>x.type),['explore','choice','compose','choice','compose','explore','choice','compose']);
   const decisions=result.steps.filter(s=>s.type==='choice');
   const illustrations=result.steps.filter(s=>s.type==='explore');
   assert.equal(illustrations.length,2,'Every quest must include two illustrated investigations');
   for(const scene of illustrations){
     assert.ok(scene.image&&scene.spots.length>=3,'Illustrations must have hotspots');
     assert.ok(scene.required.every(id=>scene.spots.some(s=>s.id===id)),'Every required clue must be on scene');
     assert.ok(scene.spots.every(s=>s.clueZh&&s.clueRu),'Every clue has Chinese and Russian');
     assert.equal(new Set(scene.spots.map(s=>s.id)).size,scene.spots.length);
     const original=lesson.quest.steps.filter(s=>s.type==='explore')[illustrations.indexOf(scene)];
     assert.deepEqual(scene.spots.map(s=>s.id),original.spots.map(s=>s.id),
       'Each hotspot must still point to its originally illustrated object');
     assert.ok(scene.spots.every(s=>s.word && s.clueZh && s.clueRu),
       'Image hotspots need an object name and a matching explanatory clue');
   }
   if(lesson.id===1){
     assert.deepEqual(illustrations[0].spots.map(s=>s.word),['奖学金','材料','证件','教师','课程','食堂']);
     assert.equal(illustrations[1].image,'printer-notice');
     assert.equal(illustrations[1].spots.find(s=>s.id==='copy').word,'入学通知');
     assert.ok(illustrations[0].spots.find(s=>s.id==='canteen').clueZh.includes('食堂'));
     assert.ok(illustrations[0].spots.find(s=>s.id==='folder').clueZh.includes('证'));
   }
   const artNames={8:['rest-plan','park-rest'],9:['gallery-friends','gallery-studio'],10:['winter-plan','winter-station']};
   if(artNames[lesson.id]){
     assert.deepEqual(illustrations.map(s=>s.image),artNames[lesson.id],
       'The quest must use artwork illustrating the actual story');
     for(const [i,scene] of illustrations.entries()){
       const art=readFileSync(join(dataDir,'..','assets',scene.image+'.svg'),'utf8');
       assert.ok(art.trim().startsWith('<svg '),'Scene art must be SVG');
       for(const spot of scene.spots)assert.ok(art.includes(spot.word),
         'Hotspot '+spot.id+' must name an object actually shown/labeled in '+scene.image);
     }
   }
   assert.equal(result.branchEndings.length,4);
   assert.equal(new Set(result.branchEndings.map(e=>e.ru)).size,4,'Different choices must produce different outcomes');
   assert.equal(decisions[1].branchContexts.length,2);
   assert.notEqual(decisions[1].branchContexts[0].zh,decisions[1].branchContexts[1].zh);
   assert.equal(decisions[2].branchContexts.length,lesson.id===1?4:2);
   assert.notEqual(decisions[2].branchContexts[0].zh,decisions[2].branchContexts[1].zh);
   if(lesson.id===1) {
     assert.equal(decisions[1].branchOptions.length,2,'Different first choice must open different decisions');
     assert.equal(decisions[2].branchOptions.length,4,'Two decisions must open four different situations');
     assert.ok(decisions[0].setupLines.length>=2,'The first quest choice must show the missing document and deadline');
     assert.match(decisions[0].contextZh,/食堂/,'The clue for cafeteria action must be visible before choices');
     assert.equal(result.branchEndings.flatMap(e=>e.variants).length,8,'Every path needs a separate consequence');
     assert.equal(new Set(result.branchEndings.flatMap(e=>e.variants.map(v=>v.ru))).size,8);
     assert.notEqual(decisions[1].branchOptions[0][0].zh,decisions[1].branchOptions[1][0].zh);
   }
   const outcomes=[];
   for(let a=0;a<2;a++)for(let b=0;b<2;b++)for(let c=0;c<2;c++) {
     const ending=result.branchEndings[a*2+b];
     outcomes.push(ending.variants
       ? ending.variants[c].ru
       : ending.ru+' '+decisions[2].options[c].outcomeRu);
   }
   assert.equal(new Set(outcomes).size,8,'Third decision must affect epilogue');

   const groupTasks=result.vocabMissions.flatMap(g=>g.tasks);
   const target=lesson.words.map(w=>w.hanzi);
   assert.deepEqual([...new Set(groupTasks.map(t=>t.word))].sort(),[...new Set(target)].sort());
   const availableLines=chapters.flatMap(c=>c.lines);
   for(const task of groupTasks) {
     assert.ok(availableLines.some(([zh,ru])=>zh===task.sentence&&ru===task.ru),
       `Mission ${task.word} must reuse a translated line of Anna's story`);
     assert.ok(task.sentence.includes(task.word));
   }
   for(const step of result.steps.filter(s=>s.type==='choice')){
     assert.ok(step.branchContexts?.length||step.setupLines?.length,'Decision needs an explicit context');
   }
   for(const step of result.steps.filter(s=>s.type==='compose')){
     assert.ok(step.tokens.length>=2);
     assert.equal(step.tokens.join(''),step.successZh);
     assert.deepEqual(step.answers[0],step.tokens);
   }
   for(const step of result.steps.filter(s=>s.type==='choice')){
     if(step.branchOptions){
       const target=step.branchContexts.length;
       assert.equal(step.branchOptions.length,target,'Every possible state needs actions');
       for(const group of step.branchOptions){
         assert.equal(group.length,2);
         assert.notEqual(group[0].outcomeRu,group[1].outcomeRu);
       }
     }
   }
   const allowed=new Set([...base,...names,...lessonData.slice(0,lesson.id).flatMap(l=>l.words.map(w=>w.hanzi))]);
   const chinese=[
     result.introZh,
     ...result.steps.flatMap(s=>[
       s.contextZh,
       ...(s.spots||[]).flatMap(x=>[x.word,x.clueZh]),
       ...(s.setupLines||[]).map(x=>x[0]),
       ...(s.branchContexts||[]).flatMap(x=>[x.zh,...(x.setupLines||[]).map(y=>y[0])]),
       ...(s.options||[]).flatMap(x=>[x.zh,x.outcomeZh]),
       ...(s.branchOptions||[]).flatMap(group=>group.flatMap(x=>[x.zh,x.outcomeZh])),
       ...(s.successZh?[s.successZh]:[])
     ]),
     ...result.branchEndings.flatMap(x=>[x.zh,...(x.variants||[]).map(v=>v.zh)]),
     ...groupTasks.map(x=>x.sentence)
   ];
   for(const line of chinese) assert.equal(findUnknown(line,allowed),null,
     `Out-of-level Chinese vocabulary in lesson ${lesson.id}: ${line}`);
 });
}
