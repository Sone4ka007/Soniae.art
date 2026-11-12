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
  assert.deepEqual(errors,[]);
  console.log('Mobile sentence coach: hint ladder, reveal, skip and resume OK');
}finally{await browser.close();}
