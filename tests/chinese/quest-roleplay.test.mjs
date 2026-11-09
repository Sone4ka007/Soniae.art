import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {join,dirname} from 'node:path';
import {fileURLToPath} from 'node:url';
import '../../chinese/js/quest-roleplay.js';
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
