import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { Script } from 'node:vm';

const root=join(dirname(fileURLToPath(import.meta.url)),'..','..');
const html=readFileSync(join(root,'chinese/index.html'),'utf8');

test('Chinese Lab browser inline scripts have valid syntax',()=>{
 let n=0;
 for(const m of html.matchAll(/<script\b([^>]*)>([\s\S]*?)<\/script>/gi)){
   const attrs=m[1],code=m[2];
   if(/\bsrc\s*=/.test(attrs)||/\btype\s*=\s*["']application\/json/.test(attrs)||!code.trim())continue;
   assert.doesNotThrow(()=>new Script(code),`Inline script ${++n} is invalid`);
 }
 assert.ok(n>=2,'Expected inline application scripts');
});
test('Chinese Lab connects route-aware story quests with reading chapters',()=>{
 assert.match(html,/quest-branches\.js\?v=20261108-3/);
 assert.match(html,/ChineseLabQuestBranches\.build\(l,state\.readings\[String\(l\.id\)\]\)/);
 assert.match(html,/g\.routeChoices\[option\.branchAt\]=option\.branchValue/);
 assert.match(html,/step\.branchContexts/);
 assert.match(html,/step\.branchOptions\?\.\[key\]/);
 assert.match(html,/upcoming\?\.skipWhenRoute\?\.every/);
 assert.match(html,/questExplore\(s\)/);
 assert.match(html,/quest-hotspot/);
 assert.match(html,/quest-story-evidence-list/);
 assert.match(html,/ending\.variants\?\.\[third\]/);
 assert.match(html,/q\.branchEndings\[route\]/);
 assert.match(html,/questSchema === lesson\(\)\.quest\.schemaVersion/);
});
