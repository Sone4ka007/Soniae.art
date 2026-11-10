import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {join,dirname} from 'node:path';
import {fileURLToPath} from 'node:url';
import '../../chinese/js/quest-roleplay.js';
import '../../chinese/js/quest-roleplay-extended.js';
import '../../chinese/js/quest-lesson3.js';
import '../../chinese/js/quest-lesson4.js';
import '../../chinese/js/quest-lesson5.js';
import '../../chinese/js/quest-lesson6.js';
import '../../chinese/js/quest-lessons7-10.js';
import '../../chinese/js/quest-roleplay-remaining.js';
import '../../chinese/js/quest-branches.js';

const root=join(dirname(fileURLToPath(import.meta.url)),'..','..');
const data=name=>JSON.parse(readFileSync(join(root,'chinese','data',name),'utf8'));
const lesson=data('lesson1.json'), chapters=data('readings.json')[1], base=data('hsk3-base.json').words;
const role=globalThis.ChineseLabRoleplay;
const quest=globalThis.ChineseLabQuestBranches.build(lesson,chapters);

test('First lesson launches with interactive staff conversation, not forced reading',()=>{
 assert.equal(quest.playFirst,true);
 assert.equal(quest.schemaVersion,9);
 assert.equal(quest.steps[0].type,'roleplay');
 assert.equal(role.missions.length,5);
 assert.deepEqual(role.missions.map(m=>m.id),['purpose','major','reason','papers','deadline']);
 for(const mission of role.missions){
   assert.ok(mission.teacher&&mission.teacherRu&&mission.reply&&mission.replyRu);
   assert.ok(mission.goal&&mission.sample&&mission.tiles.length>=4);
   assert.ok(mission.require.length>=1);
   assert.equal(role.evaluate(mission.id,mission.sample).ok,true,mission.id+' sample must work');
 }
});

test('Chinese conversation accepts meaningful variants and asks to repeat wrong-topic answers',()=>{
 for(const [id,sentence] of [
   ['purpose','我希望申请奖学金。'],
   ['major','我是国际贸易专业的。'],
   ['reason','我家里的经济压力很大。'],
   ['papers','我的证不见了。'],
   ['deadline','请问，什么时候可以申请奖学金？']
 ])assert.equal(role.evaluate(id,sentence).ok,true,id+': '+sentence);
 for(const [id,sentence] of [
   ['purpose','我想吃面条。'],
   ['purpose','我不想申请奖学金。'],
   ['major','我不学国际贸易。'],
   ['papers','我的证件在这里。'],
   ['deadline','我喜欢咖啡。']
 ])assert.equal(role.evaluate(id,sentence).ok,false,id+': wrong message must not advance conversation');
});

function unknownChinese(sentence,allowed){
 for(const run of String(sentence).matchAll(/[\p{Script=Han}]+/gu)){
   const text=run[0],dp=Array(text.length+1).fill(false);dp[0]=true;
   for(let i=0;i<text.length;i++)if(dp[i])
     for(let j=i+1;j<=text.length;j++)if(allowed.has(text.slice(i,j)))dp[j]=true;
   if(!dp[text.length])return text;
 }
 return null;
}
test('Teacher exchanges use HSK3 plus the current HSK4 lesson, not future vocabulary',()=>{
 const allowed=new Set([...base,...lesson.words.map(w=>w.hanzi)]);
 for(const mission of role.missions)for(const utterance of [mission.teacher,mission.sample,mission.reply]){
   assert.equal(unknownChinese(utterance,allowed),null,mission.id+': '+utterance);
 }
});

test('At least half of current-lesson vocabulary is present in the playable quest itself',()=>{
 const corpus=[
   ...role.missions.flatMap(m=>[m.teacher,m.sample,m.reply]),
   ...quest.steps.flatMap(s=>[
     s.contextZh||'',
     ...(s.setupLines||[]).map(line=>line[0]),
     ...(s.spots||[]).map(spot=>spot.clueZh),
     ...(s.options||[]).flatMap(o=>[o.zh,o.outcomeZh]),
     ...(s.branchContexts||[]).map(x=>x.zh),
   ])
 ].join(' ');
 const covered=lesson.words.filter(w=>corpus.includes(w.hanzi)&&
   (w.hanzi!=='研究'||/研究(?!生)/.test(corpus)));
 assert.ok(covered.length>=Math.ceil(lesson.words.length/2),
   'Main quest covers '+covered.length+'/'+lesson.words.length+' words, expected >= 50%');
});

test('Actual browser code must route Chinese input and roleplay actions, not merely display labels',()=>{
 const html=readFileSync(join(root,'chinese','index.html'),'utf8');
 for(const action of ['quest-roleplay-send','quest-roleplay-hint','quest-roleplay-tile','quest-roleplay-topic']){
   assert.match(html,new RegExp("case '"+action+"':"),action+' must be recognized by the event dispatcher');
 }
 assert.match(html,/engine\.evaluate\(rp\.active,rp\.draft\)/);
 assert.match(html,/rp\.done\.push\(rp\.active\)/);
 assert.match(html,/q\.playFirst/);
 assert.match(html,/s\.type==='roleplay'\?questRoleplay\(s\)/);
});


test('Lesson 2 uses its own landlord conversation and rejects wrong-topic answers',()=>{
 const rentalLesson=data('lesson2.json'), rentalChapters=data('readings.json')[2];
 const q=globalThis.ChineseLabQuestBranches.build(rentalLesson,rentalChapters);
 const engine=role.forLesson(2);
 assert.equal(q.playFirst,true);
 assert.equal(q.steps[0].type,'roleplay');
 assert.deepEqual(engine.missions.map(x=>x.id),['purpose','price','quiet','move']);
 assert.notEqual(engine.missions[0].teacher,role.missions[0].teacher);
 for(const mission of engine.missions){
   assert.equal(engine.evaluate(mission.id,mission.sample).ok,true,mission.id);
 }
 for(const [id,wrong] of [
   ['purpose','我不想租这个房子。'],
   ['purpose','我想吃面条。'],
   ['price','我平常晚上学习。'],
   ['quiet','这个房子的位置很好。'],
   ['move','我不想入住。']
 ])assert.equal(engine.evaluate(id,wrong).ok,false,id+': '+wrong);
 const allowed=new Set([...base,...lesson.words.map(w=>w.hanzi),...rentalLesson.words.map(w=>w.hanzi)]);
 for(const mission of engine.missions)for(const statement of [mission.teacher,mission.sample,mission.reply]){
   assert.equal(unknownChinese(statement,allowed),null,mission.id+': '+statement);
 }
 const corpus=[...engine.missions.flatMap(x=>[x.teacher,x.sample,x.reply]),
   ...q.steps.flatMap(s=>[s.contextZh,...(s.setupLines||[]).map(x=>x[0]),
     ...(s.spots||[]).flatMap(x=>[x.word,x.clueZh]),
     ...(s.options||[]).flatMap(x=>[x.zh,x.outcomeZh]),
     ...(s.branchContexts||[]).map(x=>x.zh),
     ...(s.branchOptions||[]).flatMap(g=>g.flatMap(o=>[o.zh,o.outcomeZh]))])].join(' ');
 const covered=rentalLesson.words.filter(w=>corpus.includes(w.hanzi));
 assert.ok(covered.length>=Math.ceil(rentalLesson.words.length/2),'Lesson 2 quest has '+covered.length+' words');
});


for(const lessonId of [3,4,5,6,7,8,9,10]){
 test('Lesson '+lessonId+' has a playable conversation, accepted meaning and graded Chinese',()=>{
   const l=data('lesson'+lessonId+'.json'),ch=data('readings.json')[lessonId];
   const q=globalThis.ChineseLabQuestBranches.build(l,ch);
   const engine=role.forLesson(lessonId);
   assert.equal(q.playFirst,true);
   assert.equal(q.steps[0].type,'roleplay');
   assert.equal(engine.missions.length,4);
   for(const m of engine.missions)assert.equal(engine.evaluate(m.id,m.sample).ok,true,m.id);
   const bad={
     3:[
       ['purpose','我不想买咖啡。'],
       ['purpose','我想买车票。'],
       ['payment','我喜欢咖啡。'],
       ['check','我想去学校。']
     ],
     4:[
       ['purpose','我想买咖啡。'],
       ['phone','我的手机有信号。'],
       ['help','我不需要帮助。'],
       ['thanks','我喜欢咖啡。']
     ],
     5:[
       ['purpose','我想去学校。'],
       ['spice','我今天想看电视。'],
       ['amount','我喜欢吃鱼。'],
       ['bill','我们不想各付各的。']
     ],
     6:[
       ['purpose','我不想挂号。'],
       ['symptoms','我没有咳嗽，身体很好。'],
       ['form','我不需要写表。'],
       ['fee','我的房租很便宜。']
     ],
     7:[
       ['purpose','我不想做市场调查。'],
       ['client','我不想采访客户。'],
       ['method','我想吃米饭。']
     ],
     8:[
       ['purpose','我不想休息，我还要加班。'],
       ['weekend','我不想去郊区。'],
       ['rest','我不想休息。']
     ],
     9:[
       ['purpose','我想去医院。'],
       ['painting','我想买咖啡。'],
       ['permission','我不想问你，可以给这张画拍照吗？']
     ],
     10:[
       ['purpose','哈尔滨不冷。'],
       ['coat','我不需要厚衣服。'],
       ['climate','广州和哈尔滨没有差别。']
     ]
   }[lessonId];
   for(const [id,sentence] of bad)assert.equal(engine.evaluate(id,sentence).ok,false,id+': '+sentence);
   const allowed=new Set([...base,...Array.from({length:lessonId},(_,i)=>data('lesson'+(i+1)+'.json'))
     .flatMap(item=>item.words.map(w=>w.hanzi))]);
   for(const m of engine.missions)for(const sentence of [m.teacher,m.sample,m.reply]){
     assert.equal(unknownChinese(sentence,allowed),null,m.id+': '+sentence);
   }
   const main=[
     ...engine.missions.flatMap(m=>[m.teacher,m.sample,m.reply]),
     ...q.steps.flatMap(st=>[st.contextZh,
       ...(st.spots||[]).flatMap(x=>[x.word,x.clueZh]),
       ...(st.setupLines||[]).map(x=>x[0]),
       ...(st.branchContexts||[]).map(x=>x.zh),
       ...(st.options||[]).flatMap(x=>[x.zh,x.outcomeZh]),
       ...(st.branchOptions||[]).flatMap(group=>group.flatMap(x=>[x.zh,x.outcomeZh])),
       st.successZh])
   ].join(' ');
   const covered=l.words.filter(w=>main.includes(w.hanzi));
   assert.ok(covered.length>=Math.ceil(l.words.length/2),
     'Lesson '+lessonId+' main quest uses '+covered.length+' of '+l.words.length+' words');
   assert.equal(q.branchEndings.flatMap(e=>e.variants).length,8);
 });
}
