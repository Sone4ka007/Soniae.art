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
  assert.match(intro,/КВЕСТ v8/,'New quest must display a recognizable version on the intro');
  assert.match(intro,/Анна приехала в Китай/,'First-time player must see Anna’s background before investigation');
  assert.match(intro,/стипендию/,'First-time player must understand why scholarship matters');
  assert.match(intro,/17:00/,'First-time player must understand the deadline');
  assert.equal(await page.locator('.quest-opening-beat').count(),4,'Full opening must be told in four chronological parts');
  const beats=await page.locator('.quest-opening-beat-label').allInnerTexts();
  assert.match(beats[0],/АННА ПРИЕХАЛА/);
  assert.match(beats[1],/СТИПЕНДИЯ/);
  assert.match(beats[2],/ПРОВЕРКА/);
  assert.match(beats[3],/14:30/);
  await page.locator('.quest-opening-beat [data-action="quest-gloss"]').first().click();
  assert.match(await page.locator('.quest-opening-beat .quest-reveal-text').first().innerText(),/Анна приехала в Китай/);
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
  await page.locator('.quest-ready [data-action="quest-next"]').click();
  const dialogue=await page.locator('.quest-story-evidence-list').innerText();
  assert.match(dialogue,/小林/,'After investigation, Xiaolin must be introduced in the story');
  assert.match(dialogue,/证件/,'The dialogue must explain what Anna is looking for');
  assert.match(await page.locator('.quest-narrative').innerText(),/食堂/,'Only after meeting Xiaolin does the player receive the cafeteria clue');
  await page.locator('.quest-choice').first().click();
  await page.locator('.quest-feedback [data-action="quest-next"]').click();
  await page.locator('.quest-canvas img').waitFor({state:'visible',timeout:10000});
  const cafeteriaImage=await page.locator('.quest-canvas img').getAttribute('src');
  assert.match(cafeteriaImage,/cafeteria-search/,'Cafeteria must be a real scene instead of a skipped plot event');
  assert.equal(await page.locator('.quest-hotspot[data-id="bags"]').count(),1,'Two matching bags must be inspectable');
  assert.equal(await page.locator('.quest-hotspot[data-id="chen"]').count(),1,'Xiao Chen must be present in the cafeteria');
  assert.ok(await page.locator('.quest-canvas img').evaluate(el=>el.complete&&el.naturalWidth>0),'Cafeteria illustration must actually load');
  await page.locator('.quest-hotspot[data-id="bags"]').click();
  await page.locator('.quest-hotspot[data-id="chen"]').click();
  await page.locator('.quest-ready').waitFor({state:'visible',timeout:10000});
  await page.locator('.quest-ready [data-action="quest-next"]').click();
  assert.match(await page.locator('.quest-task').innerText(),/твою сумку/i,'The story should request permission before inspecting someone else’s bag');
  for(let i=0;i<7;i++)await page.locator('[data-action="quest-token"][data-index="'+i+'"]').click();
  await page.locator('[data-action="quest-check"]').click();
  await page.locator('.quest-feedback [data-action="quest-next"]').click();
  assert.match(await page.locator('.quest-scene-recap').innerText(),/Сяо Чэнь/,'After investigation we must speak with Xiao Chen');
  await page.locator('.quest-choice').first().click();
  assert.match(await page.locator('.quest-feedback').innerText(),/小陈/,'The document is returned through dialogue, not offscreen');
  await page.locator('.quest-feedback [data-action="quest-next"]').click();
  assert.match(await page.locator('.quest-canvas img').getAttribute('src'),/campus-submit/,'Submitting documents must be illustrated');
  assert.ok(await page.locator('.quest-canvas img').evaluate(el=>el.complete&&el.naturalWidth>0),'Submission artwork must load');
  for(const id of ['notice','form','clock'])await page.locator('.quest-hotspot[data-id="'+id+'"]').click();
  await page.locator('.quest-ready [data-action="quest-next"]').click();
  await page.locator('.quest-choice').first().click();
  await page.locator('.quest-feedback [data-action="quest-next"]').click();
  assert.match(await page.locator('.quest-end').innerText(),/ЗАЯВЛЕНИЕ ПРИНЯТО/,'A complete route must reach its earned ending');

  assert.equal(errors.length,0,'Browser errors: '+errors.join(' ; '));
  console.log('PASS mobile browser: full opening, campus investigation, cafeteria search, permission dialogue, document recovery, submission scene and route-specific ending.');
} finally {
 await browser.close();
}
