import assert from 'node:assert/strict';
import { existsSync } from 'node:fs';
import { resolve } from 'node:path';
import { pathToFileURL } from 'node:url';
import { chromium } from 'playwright-core';

const chrome=['/usr/bin/google-chrome','/usr/bin/google-chrome-stable','/usr/bin/chromium','/usr/bin/chromium-browser']
  .find(path=>existsSync(path));
assert.ok(chrome,'No Chrome/Chromium executable on this runner');
const browser=await chromium.launch({
  executablePath:chrome,headless:true,
  args:['--no-sandbox','--disable-dev-shm-usage','--disable-gpu']
});
const errors=[];
try {
  const context=await browser.newContext({viewport:{width:390,height:844},isMobile:true,hasTouch:true});
  const page=await context.newPage();
  page.on('pageerror',error=>errors.push(error.message));
  await page.goto(pathToFileURL(resolve('chinese/index.html')).href,{waitUntil:'domcontentloaded'});
  await page.waitForSelector('#game-panel .quest-intro-v7',{timeout:15000});

  const intro=await page.locator('#game-panel').innerText();
  assert.match(intro,/КВЕСТ v6/,'New quest must display a recognizable version on the intro');
  assert.match(intro,/МНЕМОНИКИ/,'Mnemonic hint must be available before starting');

  const preview=page.locator('.quest-preview-location img');
  await preview.waitFor({state:'visible',timeout:10000});
  assert.ok(await preview.evaluate(el=>el.complete&&el.naturalWidth>0),'First location must render an actual illustration');

  await page.locator('.quest-mnemonic-intro [data-action="quest-memory"]').click();
  assert.match(await page.locator('.quest-mnemonic-intro .quest-memory-body').innerText(),/пропавшее удостоверение/);
  await page.locator('.quest-mnemonic-intro [data-action="quest-memory-test"]').click();
  assert.match(await page.locator('.quest-mnemonic-intro .quest-memory-body').innerText(),/ПРОВЕРКА СЕБЯ/);
  await page.locator('.quest-mnemonic-intro [data-action="quest-memory-answer"]').click();
  assert.match(await page.locator('.quest-mnemonic-intro .quest-memory-body').innerText(),/zhèngjiàn/);

  await page.locator('[data-action="quest-start"]').click();
  await page.locator('.quest-canvas img').waitFor({state:'visible',timeout:10000});
  assert.ok(await page.locator('.quest-canvas img').evaluate(el=>el.complete&&el.naturalWidth>0),'Location must be drawn in the game');
  assert.ok(await page.locator('.quest-hotspot').count()>=6,'First scene must contain clickable illustrated evidence');
  assert.ok(await page.locator('.quest-hotspot-word').count()>=6,'Objects on the picture must have Chinese labels');

  const poster=page.locator('.quest-hotspot[data-id="poster"]');
  await poster.click();
  assert.match(await page.locator('.quest-findings').innerText(),/奖学金/);
  await page.locator('.quest-finding [data-action="quest-memory"]').first().click();
  assert.match(await page.locator('.quest-finding .quest-memory-body').first().innerText(),/награда/);
  await page.locator('.quest-hotspot[data-id="folder"]').click();
  await page.locator('.quest-hotspot[data-id="canteen"]').click();
  await page.locator('.quest-ready').waitFor({state:'visible',timeout:10000});

  assert.equal(errors.length,0,'Browser errors: '+errors.join(' ; '));
  console.log('PASS mobile browser: first location illustration, six Chinese object labels, mnemonic buttons, self-recall, clickable evidence and quest continuation.');
} finally {
 await browser.close();
}
