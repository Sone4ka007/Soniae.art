import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {join,dirname} from 'node:path';
import {fileURLToPath} from 'node:url';
import '../../chinese/js/quest-lesson3.js';
import '../../chinese/js/quest-lesson4.js';
import '../../chinese/js/quest-lesson5.js';
import '../../chinese/js/quest-lesson6.js';
import '../../chinese/js/quest-lessons7-10.js';
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
   assert.equal(result.schemaVersion,9);
   assert.equal(result.steps.length,lesson.id===1?8:8);
   assert.deepEqual(result.steps.map(x=>x.type),lesson.id===1
     ?['roleplay','explore','choice','explore','compose','choice','explore','choice']
     :[2,3,5,6,7,8,9,10].includes(lesson.id)
       ?['roleplay','explore','choice','explore','compose','choice','compose','choice']
       :lesson.id===4
         ?['roleplay','explore','choice','compose','choice','explore','compose','choice']
         :['explore','choice','compose','choice','compose','explore','choice','compose']);
   const decisions=result.steps.filter(s=>s.type==='choice');
   const illustrations=result.steps.filter(s=>s.type==='explore');
   assert.equal(illustrations.length,lesson.id===1?3:2,'Lesson 1 must show the missing cafeteria investigation');
   for(const scene of illustrations){
     assert.ok(scene.image&&scene.spots.length>=3,'Illustrations must have hotspots');
     assert.ok(scene.required.every(id=>scene.spots.some(s=>s.id===id)),'Every required clue must be on scene');
     assert.ok(scene.spots.every(s=>s.clueZh&&s.clueRu),'Every clue has Chinese and Russian');
     assert.equal(new Set(scene.spots.map(s=>s.id)).size,scene.spots.length);
     const original=lesson.quest.steps.filter(s=>s.type==='explore')[illustrations.indexOf(scene)];
     if(original && (lesson.id!==1 || illustrations.indexOf(scene)===0))
       assert.deepEqual(scene.spots.map(s=>s.id),original.spots.map(s=>s.id),
         'Original illustration hotspots must remain attached to the same objects');
     assert.ok(scene.spots.every(s=>s.word && s.clueZh && s.clueRu),
       'Image hotspots need an object name and a matching explanatory clue');
   }
   assert.ok(result.opening?.summaryRu?.length>50,'Every quest must introduce its setup before the first investigation');
   assert.ok(result.opening?.panels?.length>=2,'Chronological opening requires multiple scenes');
   assert.ok(result.opening.panels.every(p=>p.lines.length>0),'Every opening card has Chinese and translated reading text');
   if(lesson.id===1){
     assert.equal(result.opening.panels.length,4,'First quest must restore all four opening narrative beats');
     assert.equal(result.steps[0].type,'roleplay','The first interaction must be a live conversation, not a reading');
     assert.equal(result.playFirst,true,'Lesson 1 should start with gameplay rather than narrative panels');
     assert.match(result.opening.summaryRu,/магистратуре/);
     assert.match(result.opening.summaryRu,/17:00/);
     const openingLines=result.opening.panels.flatMap(p=>p.lines).map(x=>x[0]);
     assert.ok(openingLines.some(x=>x.includes('安娜来中国读硕士')),'Anna must be introduced from her first chapter line');
     assert.ok(openingLines.some(x=>x.includes('经济压力')),'Scholarship motivation must appear before the investigation');
     assert.ok(openingLines.some(x=>x.includes('找不到了')),'The missing document must be explained');
     assert.ok(openingLines.some(x=>x.includes('五点')),'The exact deadline must be clear');
     const firstChoice=result.steps.find(s=>s.type==='choice');
     assert.ok(firstChoice.setupLines.some(x=>x[0].includes('小林来了')),'Xiaolin must enter the story before his cafeteria clue');
     assert.ok(!illustrations[0].spots.find(s=>s.id==='canteen').clueZh.includes('小林'),'A cafeteria sign cannot reveal something a character has not told Anna');
     assert.deepEqual(illustrations[0].spots.map(s=>s.word),['奖学金','材料','证件','教师','课程','食堂']);
     assert.deepEqual(illustrations.map(s=>s.image),['campus','cafeteria-search','campus-submit']);
     assert.ok(illustrations[1].spots.some(s=>s.id==='bags'&&s.word==='包'), 'Bags must be labelled as bags');
     assert.ok(illustrations[1].spots.some(s=>s.id==='chen'&&s.word==='本科'), 'Student badge should match noun 本科');
     assert.ok(illustrations[2].spots.some(s=>s.id==='notice'&&s.word==='通知'), 'Phone must have admission notice');
     for(const image of ['cafeteria-search','campus-submit']){
       const art=readFileSync(join(dataDir,'..','assets',image+'.svg'),'utf8');
       assert.ok(art.includes('<svg ')&&art.includes('viewBox="0 0 1080 620"'));
     }
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
   assert.equal(decisions[2].branchContexts.length,4);
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
   if(lesson.id===2) {
     assert.equal(result.playFirst,true,'Lesson 2 must start with conversation, not forced reading');
     assert.equal(result.steps[0].type,'roleplay');
     assert.equal(result.opening.panels.length,4);
     assert.deepEqual(illustrations.map(x=>x.image),['apartment','night']);
     assert.ok(result.steps[1].required.includes('kitchen'));
     assert.ok(result.steps[3].required.includes('window'));
     assert.equal(result.branchEndings.flatMap(x=>x.variants).length,8);
     assert.equal(new Set(result.branchEndings.flatMap(x=>x.variants.map(v=>v.ru))).size,8);
     assert.ok(result.opening.summaryRu.includes('3000'));
     assert.ok(result.steps.some(s=>s.type==='compose'&&s.successZh.includes('平常晚上')));
   }
   if(lesson.id===3||lesson.id===4) {
     assert.equal(result.playFirst,true,'New lessons must open with real gameplay');
     assert.equal(result.steps[0].type,'roleplay');
     assert.equal(result.opening.panels.length,4);
     const expectedImages=lesson.id===3?['mobile_cafe','mobile_phone']:['metro_help','metro_services'];
     assert.deepEqual(illustrations.map(x=>x.image),expectedImages);
     assert.equal(result.branchEndings.flatMap(e=>e.variants).length,8);
     assert.equal(new Set(result.branchEndings.flatMap(e=>e.variants.map(x=>x.ru))).size,8);
     assert.equal(decisions[1].branchOptions.length,2);
     assert.equal(decisions[2].branchOptions.length,4);
     if(lesson.id===3) {
       assert.deepEqual(illustrations[0].required,['official','price','stranger']);
       assert.deepEqual(illustrations[1].required,['message','order','password']);
     }else{
       assert.deepEqual(illustrations[0].required,['tickets','desk','map']);
       assert.deepEqual(illustrations[1].required,['umbrella','charge','flowers','breakfast']);
     }
   }
   if(lesson.id===5||lesson.id===6) {
     assert.equal(result.playFirst,true,'Lessons 5 and 6 start with interactive speaking');
     assert.equal(result.steps[0].type,'roleplay');
     assert.equal(result.opening.panels.length,4);
     assert.equal(result.steps.length,8);
     const expected=lesson.id===5?['restaurant_menu','banquet_table']:['hospital_lobby','hospital_room'];
     assert.deepEqual(illustrations.map(x=>x.image),expected);
     assert.equal(result.branchEndings.flatMap(x=>x.variants).length,8);
     assert.equal(new Set(result.branchEndings.flatMap(x=>x.variants.map(v=>v.ru))).size,8);
     assert.equal(decisions[1].branchOptions.length,2);
     assert.equal(decisions[2].branchOptions.length,4);
     if(lesson.id===5) {
       assert.deepEqual(illustrations[0].required,['menu','pepper','soup']);
       assert.deepEqual(illustrations[1].required,['namecards','notice','host']);
     }else{
       assert.deepEqual(illustrations[0].required,['registration','nurse','queue']);
       assert.deepEqual(illustrations[1].required,['thermometer','test','cabinet']);
     }
   }
   if(lesson.id>=7) {
     assert.equal(result.playFirst,true,'Later lessons must start in dialogue, not a passive reader');
     assert.equal(result.steps[0].type,'roleplay');
     assert.equal(result.opening.panels.length,4);
     assert.equal(result.branchEndings.flatMap(e=>e.variants).length,8);
     assert.equal(new Set(result.branchEndings.flatMap(e=>e.variants.map(v=>v.ru))).size,8);
     assert.equal(decisions[1].branchOptions.length,2,'Middle decision follows first route');
     assert.equal(decisions[2].branchOptions.length,4,'Final decision follows first and second routes');
     const original=lesson.quest.steps.filter(s=>s.type==='explore');
     assert.deepEqual(illustrations.map(s=>s.spots.map(p=>p.id)),original.map(s=>s.spots.map(p=>p.id)),
       'Existing illustrated hotspots must survive the rewrite');
     const req={
       7:[['plan','clients','computer'],['forms','chart','sample']],
       8:[['schedule','sleep','clock'],['path','view','air']],
       9:[['folder','names','camera'],['sketchbook','permission','phone']],
       10:[['weather','route','note'],['coat','map','cup']]
     };
     assert.deepEqual(illustrations.map(s=>s.required),req[lesson.id]);
     assert.ok(result.opening.summaryRu.length>200,'A new player needs the full situation');
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
     assert.ok(step.branchContexts?.length||step.setupLines?.length||step.contextZh?.length,'Decision needs an explicit context');
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
