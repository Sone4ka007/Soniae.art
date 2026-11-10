import {readFileSync} from 'node:fs';
import {fileURLToPath} from 'node:url';
import {resolve, dirname} from 'node:path';
import vm from 'node:vm';
import assert from 'node:assert/strict';

const here=dirname(fileURLToPath(import.meta.url));
const script=readFileSync(resolve(here,'../../chinese/js/streak.js'),'utf8');
const sandbox={window:{}};
vm.runInNewContext(script,sandbox);
const streak=sandbox.window.ChineseLabStreak;
const at=day=>new Date(day+'T12:00:00');

assert.equal(streak.summary({xp:150},at('2026-11-10')).current,0,'legacy progress must remain valid');
const p={xp:150};
for(let i=0;i<4;i++)assert.equal(streak.record(p,at('2026-11-07')).reachedGoal,false);
assert.equal(streak.record(p,at('2026-11-07')).reachedGoal,true);
assert.equal(streak.record(p,at('2026-11-07')).reachedGoal,false,'daily goal fires once');
for(let i=0;i<5;i++)streak.record(p,at('2026-11-08'));
assert.equal(streak.summary(p,at('2026-11-08')).current,2);
assert.equal(streak.summary(p,at('2026-11-09')).current,2,'yesterday keeps current streak until today ends');
assert.equal(streak.summary(p,at('2026-11-10')).current,0,'missed day breaks current streak');
assert.equal(streak.summary(p,at('2026-11-10')).best,2,'best streak remains');
assert.match(streak.render(p,at('2026-11-08')),/ПОСЛЕДНИЕ 28 ДНЕЙ/);
assert.equal(streak.summary({dailyActivity:{'2026-11-12':5}},at('2026-11-10')).current,0,'future days are ignored');
console.log('Chinese Lab streak tests: OK');
