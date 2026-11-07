// Run: node chinese/scripts/apply-word-tiles.mjs --write
// Check: node chinese/scripts/apply-word-tiles.mjs --check
import {readFileSync,writeFileSync} from 'node:fs';
import {dirname,resolve} from 'node:path';
import {fileURLToPath} from 'node:url';
import {makeTokenizer,rewriteLesson} from './word-tokenizer.mjs';
const base=resolve(dirname(fileURLToPath(import.meta.url)),'../data');
const paths=Array.from({length:10},(_,i)=>resolve(base,'lesson'+(i+1)+'.json'));
const raw=paths.map(p=>readFileSync(p,'utf8'));
const lessons=raw.map(text=>JSON.parse(text));
const tokenize=makeTokenizer(lessons.flatMap(l=>l.words.map(w=>w.hanzi)));
let updates=0;
for(let i=0;i<lessons.length;i++){
  const result=rewriteLesson(lessons[i],tokenize);
  if(result.problems.length)throw new Error(result.problems.join('\n'));
  const next=JSON.stringify(result.lesson,null,2)+'\n';
  if(next!==raw[i]){
    updates++;
    if(process.argv.includes('--write'))writeFileSync(paths[i],next);
  }
}
console.log('Word-by-word lesson files needing updates:',updates);
if(updates&&!process.argv.includes('--write'))process.exitCode=1;
