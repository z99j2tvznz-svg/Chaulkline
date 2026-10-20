// Browser smoke test: the built index.html loads in headless Chromium with a fake camera, shows the right version,
// and each home-screen mode starts without a JavaScript error.
// Run: node --test "tests/*.test.js"   (needs Playwright: npm install)
const test = require('node:test');
const assert = require('node:assert');
const fs = require('node:fs'), path = require('node:path');
const { chromium } = require('playwright');
const { serve } = require('./lib/serve.js');

const ROOT = path.join(__dirname, '..');
const VERSION = fs.readFileSync(path.join(ROOT, 'src/app.js'), 'utf8').match(/const VERSION = '([^']+)'/)[1];

test('index.html loads, shows its version, and every mode starts cleanly', async () => {
  const srv = await serve(ROOT);
  const browser = await chromium.launch({ args: ['--use-fake-ui-for-media-stream', '--use-fake-device-for-media-stream', '--autoplay-policy=no-user-gesture-required'] });
  try {
    const ctx = await browser.newContext({ viewport: { width: 956, height: 440 }, permissions: ['camera', 'microphone'] });
    const page = await ctx.newPage(), errors = [];
    page.on('pageerror', e => errors.push(String(e)));
    await page.goto(srv.url + '/index.html');
    await page.waitForFunction(() => window.__chalk && window.__chalk.S);
    assert.strictEqual((await page.textContent('#verTag')).trim(), VERSION);
    for (const mode of ['watch', 'quick', 'drill']) {
      await page.evaluate(m => window.__chalk.startMode(m), mode);
      await page.waitForTimeout(1500);
      assert.ok(await page.evaluate(() => window.__chalk.S.live), `${mode}: camera running`);
      await page.goto(srv.url + '/index.html');
      await page.waitForFunction(() => window.__chalk && window.__chalk.S);
    }
    assert.deepStrictEqual(errors, []);
  } finally { await browser.close(); srv.close(); }
});
