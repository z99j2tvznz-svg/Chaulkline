// The ball finder started twice at once (Nov 2, 16:55: the table found again while the finder was starting): the runtime
// takes the model's bytes over in its background worker, so the second start had nothing left to send ("The object can
// not be cloned" on the iPhone; a hang in Chromium). Both starts must finish, and a later one with another shape too.
const test = require('node:test'), assert = require('node:assert'), path = require('path');
test('the ball finder started twice at once, then again with another shape', { timeout: 120000 }, async () => {
  const { chromium } = require('playwright'), { serve } = require('./lib/serve.js');
  const srv = await serve(path.join(__dirname, '..')), browser = await chromium.launch();
  try {
    const page = await browser.newPage(), errors = []; page.on('pageerror', e => errors.push(String(e)));
    await page.goto(srv.url + '/index.html'); await page.waitForFunction(() => window.crossOriginIsolated === true && window.__v3, null, { timeout: 30000 });
    const r = await page.evaluate(async () => {
      const base = location.href.replace(/[^/]*$/, ''), out = [];
      const go = sh => DET.load({ base, ep: 'wasm', finder: DET.pickShape(...sh) }).then(() => 'ok', e => 'error ' + e.message);
      const timeout = new Promise(res => setTimeout(() => res('timed out'), 60000));
      out.push(...await Promise.race([Promise.all([go([1700, 430]), go([1700, 430])]), timeout.then(t => [t, t])]));
      out.push(await Promise.race([go([1000, 540]), timeout]));
      return out;
    });
    assert.deepStrictEqual(r, ['ok', 'ok', 'ok']); assert.deepStrictEqual(errors, []);
  } finally { await browser.close(); srv.close(); }
});
