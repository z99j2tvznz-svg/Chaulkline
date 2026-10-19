// Phone-width and desktop check of a built viewer folder: no sideways scroll, no script errors, screenshots.
//   node tools/viewer/check-phone.js <viewer folder> <screenshot folder>
const { chromium } = require('playwright');
const { serve } = require('../../tests/lib/serve.js');
const fs = require('fs'), path = require('path');
(async () => {
  const dir = process.argv[2], out = process.argv[3];
  const html = fs.readFileSync(path.join(dir, 'index.html'), 'utf8');
  fs.writeFileSync(path.join(dir, 'check.html'), '<!doctype html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover"><style>:root{color-scheme:light}body{margin:0}[hidden]{display:none!important}</style></head><body>' + html + '</body></html>');
  const srv = await serve(dir), b = await chromium.launch();
  const res = [];
  for (const [w, h, scheme] of [[390, 844, 'light'], [390, 844, 'dark'], [1280, 900, 'light']]) {
    const p = await b.newPage({ viewport: { width: w, height: h }, colorScheme: scheme, deviceScaleFactor: 2 }); const errs = [];
    p.on('console', m => { if (m.type() === 'error') errs.push(m.text()); }); p.on('pageerror', e => errs.push(e.message));
    await p.goto(srv.url + '/check.html#clip026'); await p.waitForSelector('.ev'); 
    await p.evaluate(() => { const s = document.getElementById('scrub'); s.value = 330; s.dispatchEvent(new Event('input')); });
    await p.waitForTimeout(500);
    const over = await p.evaluate(() => document.documentElement.scrollWidth - innerWidth);
    await p.screenshot({ path: `${out}/v-${w}-${scheme}.png`, fullPage: w > 400 ? false : false });
    await p.evaluate(() => scrollTo(0, 1100)); await p.screenshot({ path: `${out}/v-${w}-${scheme}-b.png` });
    res.push({ w, scheme, overflowPx: over, errors: errs.filter(e => !/favicon|fonts|net::ERR/.test(e)) });
    await p.close();
  }
  console.log(JSON.stringify(res)); await b.close(); srv.close(); fs.unlinkSync(path.join(dir, 'check.html'));
})();
