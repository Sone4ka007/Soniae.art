// Chinese Lab: vocabulary gate for graded stories and interactive decisions.
// Allowed in lesson N: cumulative HSK 1–3 (2025 exam syllabus) plus HSK 4 lesson 1..N.
// Usage: node chinese/scripts/audit-reading-level.mjs [--lesson N] [--strict]
// --strict exits nonzero on unknown vocabulary; diagnostic mode always exits zero.
// A word-level segmenter is approximate: review false positives and contextual names manually.
import {readFileSync} from 'node:fs';
import {dirname,join} from 'node:path';
import {fileURLToPath} from 'node:url';

const root=join(dirname(fileURLToPath(import.meta.url)),'..');
const data=join(root,'data');
const load=name=>JSON.parse(readFileSync(join(data,name),'utf8'));
const base=load('hsk3-base.json').words;
const readings=load('readings.json');
const manifest=load('manifest.json');
const lessonIds=manifest.lessons.map(x=>Number(x.match(/lesson(\d+)\.json/)[1]));
const opts=process.argv.slice(2);
const strict=opts.includes('--strict');
const only=opts.includes('--lesson')?Number(opts[opts.indexOf('--lesson')+1]):null;
const segmenter=new Intl.Segmenter('zh-Hans',{granularity:'word'});
const properNames=new Set(['安娜','小林','小陈','王老师','陈阿姨','刘明','李文','王','陈','林','刘','北京','上海','中国','贵州','广州','哈尔滨','长城','故宫']);
const vocabByLesson=new Map(lessonIds.map(id=>[id,load(`lesson${id}.json`).words.map(w=>w.hanzi)]));
const allLessonWords=[...vocabByLesson.values()].flat();

function canBuild(token,allowed) {
  const memo=Array(token.length+1).fill(false);
  memo[0]=true;
  for(let i=0;i<token.length;i++) if(memo[i])
    for(let j=i+1;j<=token.length;j++)
      if(allowed.has(token.slice(i,j)))memo[j]=true;
  return memo[token.length];
}
function inspect(text,allowed) {
 const unknown=[];
 for(const match of text.matchAll(/[\p{Script=Han}]+/gu)){
  const run=match[0];
  // Protect known multi-character lesson words (e.g. 入住), even if
  // Intl.Segmenter splits them incorrectly.
  if(canBuild(run,allowed))continue;
  for(const {segment,isWordLike} of segmenter.segment(run)){
   if(!isWordLike || allowed.has(segment) || canBuild(segment,allowed))continue;
   unknown.push(segment);
  }
 }
 return unknown;
}
let flagged=0;
for(const id of lessonIds) {
 if(only!==null && only!==id)continue;
 const allowed=new Set([...base,...properNames,...lessonIds.filter(i=>i<=id).flatMap(i=>vocabByLesson.get(i))]);
 const issues=[];
 const chapters=readings[id]||[];
 for(const chapter of chapters){
  const samples=[];
  for(let i=0;i<(chapter.lines||[]).length;i++)samples.push({where:`line ${i+1}`,zh:chapter.lines[i][0]});
  for(let i=0;i<(chapter.questions||[]).length;i++)
   for(const option of chapter.questions[i].options||[])samples.push({where:`question ${i+1}`,zh:option});
  const decision=chapter.decision;
  if(decision)for(let i=0;i<(decision.options||[]).length;i++){
    const item=decision.options[i];
    if(item.zh)samples.push({where:`choice ${i+1}`,zh:item.zh});
    if(item.resultZh)samples.push({where:`choice result ${i+1}`,zh:item.resultZh});
  }
  for(const {where,zh} of samples){
   const unknown=inspect(zh,allowed);
   if(unknown.length)issues.push({chapter:chapter.id,where,unknown,zh});
  }
 }
 const unique=[...new Set(issues.flatMap(x=>x.unknown))];
 const future=unique.filter(word=>!allowed.has(word)&&allLessonWords.includes(word));
 flagged+=issues.length;
 console.log(`Lesson ${id}: ${chapters.length} chapters, ${issues.length} locations, ${unique.length} suspect words`);
 if(unique.length)console.log('  Unknown / verify: '+unique.join('、'));
 if(future.length)console.log('  From later HSK 4 lessons: '+future.join('、'));
 if(only!==null)for(const issue of issues)console.log(`  [${issue.chapter} ${issue.where}] ${issue.unknown.join('、')}: ${issue.zh}`);
}
console.log(`Total flagged locations: ${flagged}. Contextual names and segmentation need manual review.`);
if(strict && flagged)process.exitCode=1;
