const { chromium } = require('playwright');
const fs = require('fs');
const path = require('path');

async function renderDirectory(page, dir) {
  if (!fs.existsSync(dir)) return 0;
  let count = 0;
  for (const f of fs.readdirSync(dir).filter(x => x.endsWith('.html')).sort()) {
    await page.setViewportSize({ width: 1080, height: 1350 });
    await page.goto('file://' + path.join(dir, f), { waitUntil: 'networkidle' });
    await page.screenshot({
      path: path.join(dir, f.replace(/\.html$/, '.png')),
      fullPage: false
    });
    count += 1;
  }
  return count;
}

(async()=>{
  const root=process.cwd();
  const out=path.join(root,'dist/events-weekly');
  const browser=await chromium.launch({headless:true});
  const page=await browser.newPage();
  let rendered=0;

  // build_weekly.py is the only producer of weekly.html. The Sunday social
  // job runs build_social.py alone; requiring the A4 digest here used to abort
  // the job before Instagram screenshots and the Telegram send.
  const weeklyPath=path.join(out,'weekly.html');
  if (fs.existsSync(weeklyPath)) {
    const weeklyUrl='file://'+weeklyPath;
    await page.goto(weeklyUrl,{waitUntil:'networkidle'});
    await page.pdf({
      path:path.join(out,'events-weekly.pdf'),
      format:'A4',
      printBackground:true,
      preferCSSPageSize:true
    });
    rendered += 1;
  } else {
    console.log('weekly.html is absent; skipping the A4 digest. Social slides do not depend on it.');
  }

  rendered += await renderDirectory(page, path.join(out,'carousel'));
  rendered += await renderDirectory(page, path.join(out,'social','instagram'));

  const telegramHtml=path.join(out,'social','telegram-week.html');
  if (fs.existsSync(telegramHtml)) {
    await page.goto('file://'+telegramHtml,{waitUntil:'networkidle'});
    const height = await page.evaluate(() => Math.max(
      document.documentElement.scrollHeight,
      document.body ? document.body.scrollHeight : 0
    ));
    await page.pdf({
      path:path.join(out,'social','telegram-week.pdf'),
      width:'1080px',
      height:Math.max(1350,height)+'px',
      printBackground:true,
      margin:{top:'0',right:'0',bottom:'0',left:'0'}
    });
    rendered += 1;
  }

  await browser.close();
  if (!rendered) {
    console.error('Nothing to render: no weekly.html and no social HTML under dist/events-weekly');
    process.exit(1);
  }
  console.log(`Rendered ${rendered} weekly/social files`);
})();
