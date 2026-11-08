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
   assert.equal(result.schemaVersion,3);
   assert.equal(result.steps.length,6);
   assert.deepEqual(result.steps.map(x=>x.type),['choice','compose','choice','compose','choice','compose']);
   assert.equal(result.branchEndings.length,4);
   assert.equal(new Set(result.branchEndings.map(e=>e.ru)).size,4,'Different choices must produce different outcomes');
   assert.equal(result.steps[2].branchContexts.length,2);
   assert.notEqual(result.steps[2].branchContexts[0].zh,result.steps[2].branchContexts[1].zh);
   assert.equal(result.steps[4].branchContexts.length,lesson.id===1?4:2);
   assert.notEqual(result.steps[4].branchContexts[0].zh,result.steps[4].branchContexts[1].zh);
   if(lesson.id===1) {
     assert.equal(result.steps[2].branchOptions.length,2,'Different first choice must open different decisions');
     assert.equal(result.steps[4].branchOptions.length,4,'Two decisions must open four different situations');
     assert.ok(result.steps[0].setupLines.length>=2,'The first quest choice must show the missing document and deadline');
     assert.match(result.steps[0].contextZh,/食堂/,'The clue for cafeteria action must be visible before choices');
     assert.equal(result.branchEndings.flatMap(e=>e.variants).length,8,'Every path needs a separate consequence');
     assert.equal(new Set(result.branchEndings.flatMap(e=>e.variants.map(v=>v.ru))).size,8);
     assert.notEqual(result.steps[2].branchOptions[0][0].zh,result.steps[2].branchOptions[1][0].zh);
   }
   const outcomes=[];
   for(let a=0;a<2;a++)for(let b=0;b<2;b++)for(let c=0;c<2;c++)
    outcomes.push(result.branchEndings[a*2+b].ru+' '+result.steps[4].options[c].outcomeRu);
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
