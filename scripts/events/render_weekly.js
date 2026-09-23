const { chromium } = require('playwright');
const fs = require('fs');
const path = require('path');

async function renderDirectory(page, dir) {
  if (!fs.existsSync(dir)) return;
  for (const f of fs.readdirSync(dir).filter(x => x.endsWith('.html')).sort()) {
    await page.setViewportSize({ width: 1080, height: 1350 });
    await page.goto('file://' + path.join(dir, f), { waitUntil: 'networkidle' });
    await page.screenshot({
      path: path.join(dir, f.replace(/\.html$/, '.png')),
      fullPage: false
    });
  }
}

(async()=>{
  const root=process.cwd();
  const out=path.join(root,'dist/events-weekly');
  const browser=await chromium.launch({headless:true});
  const page=await browser.newPage();

  const weekly='file://'+path.join(out,'weekly.html');
  await page.goto(weekly,{waitUntil:'networkidle'});
  await page.pdf({
    path:path.join(out,'events-weekly.pdf'),
    format:'A4',
    printBackground:true,
    preferCSSPageSize:true
  });

  await renderDirectory(page, path.join(out,'carousel'));
  await renderDirectory(page, path.join(out,'social','instagram'));

  await browser.close();
})();
