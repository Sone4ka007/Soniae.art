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
  // Five-step navigation and the Today dashboard must work on mobile.
  await page.locator('#lesson-select').waitFor({state:'visible',timeout:20000});
  // The file:// browser fixture uses the bundled offline lessons (1–10).
  // The full published manifest with 20 lessons is checked separately in Node tests.
  const loadedCount=await page.locator('#lesson-select option').count();
  assert(loadedCount>=10&&loadedCount<=20);
  assert.equal(await page.locator('#mode-nav .learning-step').count(),5);
  await page.locator('#today-entry').click();
  assert.match(await page.locator('#game-panel').innerText(),/ПРОДОЛЖИТЬ ОБУЧЕНИЕ/);
  const lastValue=await page.locator('#lesson-select option').last().getAttribute('value');
  await page.locator('#lesson-select').selectOption(lastValue);
  assert.equal(await page.locator('#lesson-select').inputValue(),lastValue);
  assert((await page.locator('#lesson-intro h2').innerText()).length>0);
  await page.locator('#lesson-select').selectOption('1');
  await page.locator('#mode-nav [data-action="stage"][data-id="games"]').click();
  assert.equal(await page.locator('#mode-subnav [data-action="mode"]').count(),7);
  await page.locator('#mode-subnav [data-id="sentence"]').click();
  await page.locator('#today-entry').click();
  await page.locator('[data-action="today-continue"]').click();
  assert.equal(await page.locator('#mode-subnav [data-id="sentence"].is-active').count(),1);
    // The course now opens with the dictionary. Enter the story mode explicitly.
  await page.locator('#mode-nav [data-action="mode"][data-id="story"]').click({timeout:20000});
  try {
    await page.waitForSelector('#game-panel .quest-rp-start',{timeout:30000});
  } catch (error) {
    const panel=await page.locator('#game-panel').innerText().catch(()=>'<unavailable>');
    console.error('Chinese Lab boot diagnostic', JSON.stringify({
      title:await page.title(), url:page.url(), panel:panel.slice(0,1400), pageErrors:errors
    }));
    throw error;
  }
  const intro=await page.locator('#game-panel').innerText();
  assert.match(intro,/СИМУЛЯЦИЯ/);
  assert.match(intro,/ТВОЙ ПЕРВЫЙ РАЗГОВОР/);
  assert.match(intro,/Тебя встречает преподавательница Ван/);
  assert.equal(await page.locator('.quest-opening-beat').count(),0,'Starting an interactive quest must not force a long story to read');
  await page.locator('[data-action="quest-start"]').click();
  await page.locator('.quest-rp-teacher').waitFor();
  assert.match(await page.locator('.quest-rp-teacher').innerText(),/你好/);
  assert.equal(await page.locator('.quest-rp-goal').count(),5);
  assert.ok(await page.locator('.quest-rp-scene img').evaluate(el=>el.complete&&el.naturalWidth>0));

  await page.locator('#quest-roleplay-input').fill('请您再说一遍。');
  await page.locator('[data-action="quest-roleplay-send"]').click();
  assert.match(await page.locator('.quest-rp-feedback').innerText(),/(?:СОБЕСЕДНИК ПОВТОРИЛ|ПРЕПОДАВАТЕЛЬНИЦА ПОВТОРИЛА)/,'Requesting repetition must not count as failure');
  assert.match(await page.locator('.quest-rp-feedback').innerText(),/你好/);
  await page.locator('#quest-roleplay-input').fill('我不想申请奖学金。');
  await page.locator('[data-action="quest-roleplay-send"]').click();
  assert.match(await page.locator('.quest-rp-feedback').innerText(),/你不想申请/,'A negated intention must produce a different response');
    await page.locator('#quest-roleplay-input').fill('我想吃面条。');
  await page.locator('[data-action="quest-roleplay-send"]').click();
  assert.match(await page.locator('.quest-rp-feedback').innerText(),/没听懂/,'Wrong-topic Chinese must be met with clarification');
  await page.locator('#quest-roleplay-input').fill('我想申请奖学金。');
  await page.locator('[data-action="quest-roleplay-send"]').click();
  assert.match(await page.locator('.quest-rp-feedback').innerText(),/申请奖学金需要一些材料/);
  await page.locator('[data-action="quest-roleplay-next"]').click();

  await page.locator('[data-action="quest-roleplay-hint"]').click();
  assert.ok(await page.locator('.quest-rp-bank [data-action="quest-roleplay-tile"]').count()>=5,'Optional Chinese word tiles should help phrase construction');
  await page.locator('#quest-roleplay-input').fill('我的专业是国际贸易。');
  await page.locator('[data-action="quest-roleplay-send"]').click();
  assert.match(await page.locator('.quest-rp-feedback').innerText(),/研究生/);
  await page.locator('[data-action="quest-roleplay-next"]').click();

  await page.locator('#quest-roleplay-input').fill('我想减轻家里的经济压力。');
  await page.locator('[data-action="quest-roleplay-send"]').click();
  await page.locator('[data-action="quest-roleplay-next"]').click();

  await page.locator('#quest-roleplay-input').fill('我的证件找不到了。');
  await page.locator('[data-action="quest-roleplay-send"]').click();
  await page.locator('[data-action="quest-roleplay-next"]').click();

  await page.locator('#quest-roleplay-input').fill('请问，今天几点以前要交材料？');
  await page.locator('[data-action="quest-roleplay-send"]').click();
  assert.match(await page.locator('.quest-rp-feedback').innerText(),/五点/);
  assert.match(await page.locator('.quest-rp-progress').innerText(),/5 \/ 5/);
  await page.locator('.quest-ready [data-action="quest-next"]').click();
  await page.locator('.quest-canvas img').waitFor({state:'visible',timeout:10000});
  assert.ok(await page.locator('.quest-canvas img').evaluate(el=>el.complete&&el.naturalWidth>0),'First illustrated investigation must appear after real conversation');
  assert.ok(await page.locator('.quest-hotspot').count()>=6);
  assert.ok(await page.locator('.quest-hotspot-word').count()>=6);

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
  // SVG scene loading is asynchronous; visibility alone does not mean the image decoded.
  await page.locator('.quest-canvas img').evaluate(img=>img.decode());
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
  console.log('PASS mobile browser: meaningful Chinese teacher roleplay, errors, spoken responses and optional word hints, followed by illustrated campus, cafeteria and submission route.');
} finally {
 await browser.close();
}
