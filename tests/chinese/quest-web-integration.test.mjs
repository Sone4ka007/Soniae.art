import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { Script } from 'node:vm';

const root=join(dirname(fileURLToPath(import.meta.url)),'..','..');
const html=readFileSync(join(root,'chinese/index.html'),'utf8');
const offlineBundle=readFileSync(join(root,'chinese/js/offline-bundle.js'),'utf8');
const sw=readFileSync(join(root,'chinese/sw.js'),'utf8');

test('Chinese Lab browser inline scripts have valid syntax',()=>{
 let n=0;
 for(const m of html.matchAll(/<script\b([^>]*)>([\s\S]*?)<\/script>/gi)){
   const attrs=m[1],code=m[2];
   if(/\bsrc\s*=/.test(attrs)||/\btype\s*=\s*["']application\/json/.test(attrs)||!code.trim())continue;
   assert.doesNotThrow(()=>new Script(code),`Inline script ${++n} is invalid`);
 }
 assert.ok(n>=2,'Expected inline application scripts');
 assert.doesNotThrow(()=>new Script(offlineBundle),'Extracted offline data script is invalid');
});
test('printed notice art is updated from visa copy to enrollment notice',()=>{
 const prefix='"printer-notice":"data:image/svg+xml;base64,';
 const begin=offlineBundle.indexOf(prefix);
 assert.ok(begin>=0,'Missing school notice illustration');
 const first=begin+prefix.length;
 const finish=offlineBundle.indexOf('"',first);
 const drawing=Buffer.from(offlineBundle.slice(first,finish),'base64').toString('utf8');
 assert.ok(drawing.includes('入学通知'),'The picture must show 入学通知');
 assert.ok(!drawing.includes('签证复印件'),'The old visa copy should not remain in the picture');
});
test('Chinese Lab connects route-aware story quests with reading chapters',()=>{
 assert.match(html,/quest-branches\.js\?v=20261110-4/);
 assert.match(html,/ChineseLabQuestBranches\.build\(l,state\.readings\[String\(l\.id\)\]\)/);
 assert.match(html,/g\.routeChoices\[option\.branchAt\]=option\.branchValue/);
 assert.match(html,/step\.branchContexts/);
 assert.match(html,/step\.branchOptions\?\.\[key\]/);
 assert.match(html,/upcoming\?\.skipWhenRoute\?\.every/);
 assert.match(html,/questExplore\(s\)/);
 assert.match(html,/quest-roleplay\.js\?v=20261110-4/);
 assert.match(html,/quest-roleplay-extended\.js\?v=20261110-3/);
 assert.match(html,/quest-lesson3\.js\?v=20261110-1/);
 assert.match(html,/quest-lesson4\.js\?v=20261110-2/);
 assert.match(html,/quest-lesson5\.js\?v=20261110-1/);
 assert.match(html,/quest-lesson6\.js\?v=20261110-1/);
 assert.match(html,/quest-lessons7-10\.js\?v=20261110-3/);
 assert.match(html,/quest-roleplay-remaining\.js\?v=20261110-2/);
 assert.match(html,/lesson\(\)\.id===3\|\|lesson\(\)\.id===4/);
 assert.match(html,/lesson\(\)\.id===5\|\|lesson\(\)\.id===6/);
 assert.match(html,/lesson\(\)\.id>=7&&lesson\(\)\.id<=10/);
 assert.match(html,/quest-roleplay-view\.js\?v=20261110-4/);
 assert.match(html,/function questRoleplay\(s\)/);
 assert.match(html,/data-action="quest-start"/);
 assert.match(html,/questRoleplay\(s\)/);
 for(const action of ['quest-roleplay-send','quest-roleplay-topic','quest-roleplay-hint'])assert.match(html,new RegExp("case '"+action+"':"));
 assert.match(html,/quest-hotspot/);
 assert.match(html,/quest-preview-location/,'First location artwork needs to be visible on the intro');
 assert.match(html,/function questOpening\(q\)/,'Reading must start with a full beginning');
 assert.match(html,/questOpening\(q\)/,'Quest opening must render in intro');
 assert.match(html,/quest-opening-beat/,'Each narrative beat should be readable separately');
 assert.match(html,/СНАЧАЛА — ИСТОРИЯ/,'Intro should clearly introduce story before quest');
 assert.ok(offlineBundle.includes('"printer-notice":"data:image/svg+xml;base64,'), 'Updated illustration must contain enrollment notice art');
 assert.match(html,/quest-story-evidence-list/);
 assert.match(html,/ending\.variants\?\.\[third\]/);
 assert.match(html,/q\.branchEndings\[route\]/);
 assert.match(html,/questSchema === lesson\(\)\.quest\.schemaVersion/);
});


test('offline fallback is loaded before application scripts and included in PWA cache',()=>{
 const fallback=html.indexOf('<script src="./js/offline-bundle.js"></script>');
 const progress=html.indexOf('<script src="./js/progress-store.js"></script>');
 assert.ok(fallback>=0 && progress>fallback,'Offline data must load before the app');
 assert.match(sw, /"\\/chinese\\/js\\/offline-bundle\\.js"/);
 assert.match(offlineBundle, /window\\.chineseLabLessonFetch=async url=>/);
});
