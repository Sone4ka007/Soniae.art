import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = join(dirname(fileURLToPath(import.meta.url)), '..', '..', 'chinese', 'data');
const load = file => JSON.parse(readFileSync(join(root,file), 'utf8'));
const readings = load('readings.json');
const hsk3 = load('hsk3-base.json').words;
const manifest = load('manifest.json');
const lessonIds = manifest.lessons.map(file => Number(file.match(/lesson(\d+)\.json/)[1]));
const knownNames = ['安娜','小林','小明','小陈','王老师','陈阿姨','刘明','李文','王','陈','林','刘','北京','上海','中国','贵州','广州','哈尔滨','长城','故宫'];
const vocab = new Map(lessonIds.map(id => [id, load(`lesson${id}.json`).words.map(word=>word.hanzi)]));

function hasOnlyKnownWords(text, known) {
  for (const match of text.matchAll(/[\p{Script=Han}]+/gu)) {
    const run=match[0], dp=Array(run.length+1).fill(false);
    dp[0]=true;
    for(let i=0;i<run.length;i++) if(dp[i])
      for(let j=i+1;j<=run.length;j++)
        if(known.has(run.slice(i,j))) dp[j]=true;
    if(!dp[run.length]) return run;
  }
  return null;
}

for (const id of lessonIds) {
  test(`lesson ${id}: reading only uses cumulative HSK 1–3 + lessons 1..${id}`, () => {
    const known = new Set([...hsk3,...knownNames,...lessonIds.filter(n=>n<=id).flatMap(n=>vocab.get(n))]);
    const chapters=readings[id];
    assert.equal(chapters?.length,3,'Expected three reading chapters');
    const chinese=[];
    for (const chapter of chapters) {
      assert.ok(chapter.lines.length>=10, `Chapter ${chapter.id} is too short`);
      for(const [zh,ru] of chapter.lines){
        assert.ok(zh && ru,`Missing translation in chapter ${chapter.id}`);
        chinese.push(zh);
      }
      assert.equal(chapter.questions?.length,3);
      const check=[...chapter.lines.map(([zh])=>zh)];
      for(const question of chapter.questions){
        assert.ok(question.correct>=0 && question.correct<question.options.length);
        check.push(...question.options);
      }
      assert.ok(chapter.decision?.options?.length);
      for(const option of chapter.decision.options) check.push(option.zh,option.resultZh);
      for (const zh of check) {
        const invalid=hasOnlyKnownWords(zh,known);
        assert.equal(invalid,null,`Lesson ${id} chapter ${chapter.id}: unknown vocabulary "${invalid}" in "${zh}"`);
      }
    }
    for(const word of vocab.get(id)) assert.ok(chinese.some(zh=>zh.includes(word)),`Lesson ${id} missing target word ${word}`);
  });
}
