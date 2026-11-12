import assert from 'node:assert/strict';
import {existsSync} from 'node:fs';
import {resolve} from 'node:path';
import {pathToFileURL} from 'node:url';
import {chromium} from 'playwright-core';

const chrome=['/usr/bin/google-chrome','/usr/bin/google-chrome-stable','/usr/bin/chromium','/usr/bin/chromium-browser']
  .find(path=>existsSync(path));
assert.ok(chrome,'No Chrome/Chromium executable on this runner');
const browser=await chromium.launch({executablePath:chrome,headless:true,
  args:['--no-sandbox','--disable-dev-shm-usage','--disable-gpu']});
try{
  const page=await browser.newPage({viewport:{width:390,height:844},isMobile:true,hasTouch:true});
  const errors=[];
  page.on('pageerror',error=>errors.push(error.message));
  await page.goto(pathToFileURL(resolve('chinese/index.html')).href,{waitUntil:'domcontentloaded'});
  await page.locator('#lesson-select').waitFor({state:'visible',timeout:30000});
  await page.locator('#lesson-select').selectOption('3');
  await page.locator('#mode-nav [data-action="stage"][data-id="games"]').click();
  await page.locator('#mode-subnav [data-id="sentence"]').click();
  const title=await page.locator('#game-panel').innerText();
  assert.match(title,/ПЕРЕВЕДИ И СОБЕРИ ПРЕДЛОЖЕНИЕ/,'graded sentence pool must contain usable questions');
  assert(await page.locator('.sentence-bank .sentence-tile').count()>=2);
  const starting=await page.locator('#game-panel .chip').innerText();
  await page.locator('[data-action="sentence-hint"]').click();
  assert.match(await page.locator('.feedback').first().innerText(),/Начни с/);
  await page.locator('[data-action="sentence-hint"]').click();
  assert.match(await page.locator('.feedback').first().innerText(),/Первые/);
  await page.locator('[data-action="sentence-reveal"]').click();
  assert(await page.locator('.sentence-solution').isVisible());
  await page.locator('[data-action="sentence-skip"]').click();
  assert(await page.locator('.sentence-bank .sentence-tile').count()>=2);
  const after=await page.locator('#game-panel .chip').innerText();
  assert.notEqual(after,starting,'skip must advance the exercise');
  await page.reload({waitUntil:'domcontentloaded'});
  await page.locator('#mode-subnav [data-id="sentence"].is-active').waitFor({timeout:30000});
  const persisted=await page.locator('#game-panel .chip').innerText();
  assert.equal(persisted,after,'page reload should resume from the next sentence after a skip');
  // A plausible but unlisted order must not be recorded as an error.
  // Use a real scrambled selection guaranteed not to match any accepted variant.
  const before=await page.evaluate(()=>({xp:state.progress.xp,attempts:state.progress.attempts}));
  const wrongIds=await page.evaluate(()=>{
    const g=state.game,q=g.questions[g.index],bank=g.bank.slice();
    const candidates=[bank.slice().reverse(),bank.slice()];
    for(let i=0;i<bank.length;i++)
      for(let j=i+1;j<bank.length;j++){
        const changed=bank.slice();[changed[i],changed[j]]=[changed[j],changed[i]];
        candidates.push(changed);
      }
    const invalid=candidates.find(xs=>!ChineseLabSentenceCoach.accepted(q,xs.map(x=>x.zh)));
    return invalid?.map(x=>x.id)||[];
  });
  assert(wrongIds.length>=2,'Should find an unrecognized tile ordering');
  for(const id of wrongIds)
    await page.locator('.sentence-bank [data-action="sentence-add"][data-id="'+id+'"]').click();
  await page.locator('[data-action="sentence-check"]').click();
  assert(await page.locator('[data-action="sentence-suggest"]').isVisible());
  const afterCheck=await page.evaluate(()=>({xp:state.progress.xp,attempts:state.progress.attempts}));
  assert.deepEqual(afterCheck,before,'Unverified word orders must not lose XP or accrue wrong answers');
  await page.locator('[data-action="sentence-suggest"]').click();
  assert.equal(await page.evaluate(()=>state.progress.sentenceSuggestions?.length),1);
  assert(await page.locator('[data-action="sentence-suggest"]').isDisabled());
  await page.reload({waitUntil:'domcontentloaded'});
  await page.locator('#mode-subnav [data-id="sentence"].is-active').waitFor({timeout:30000});
  assert.equal(await page.evaluate(()=>state.progress.sentenceSuggestions?.length),1);
  assert.deepEqual(errors,[]);
  console.log('Mobile sentence coach: hint ladder, reveal, skip and resume OK');
}finally{await browser.close();}
