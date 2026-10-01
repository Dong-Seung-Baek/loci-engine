// Interaction smoke test: edit/save/reload, WIM jump, drag + recenter, tap-to-edit.
import { chromium } from 'playwright';
import { resolve } from 'path';
// usage: node test/smoke.mjs <html> <storageKey> <example count>
const file = 'file://' + resolve(process.argv[2]);
const KEY = process.argv[3] || 'loci-skewer:v2', EXAMPLES = process.argv[4] || '7';
const browser = await chromium.launch({ args: ['--use-gl=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'] });
const ctx = await browser.newContext({ viewport: { width: 390, height: 780 }, reducedMotion: 'reduce' });
const page = await ctx.newPage();
const errors = []; page.on('pageerror', e => errors.push(e.message));
const ok = (name, cond) => console.log(cond ? 'PASS' : 'FAIL', name);
const ready = () => page.waitForFunction(() => document.getElementById('loading').hidden);

await page.goto(file); await ready();
ok('hint shows on first visit', await page.isVisible('#hint'));
await page.click('#hintOk');
ok('example data counted', (await page.textContent('#fillLabel')) === EXAMPLES);

await page.click('#nextBtn'); await page.click('#nextBtn');
ok('caption follows nav', (await page.textContent('#capNo')) === '03');
await page.click('#caption');
await page.fill('#edItem', '테스트 항목'); await page.fill('#edImg', '테스트 연상');
await page.click('#editForm button[type=submit]');
await page.reload(); await ready();
ok('hint stays dismissed', !(await page.isVisible('#hint')));
const saved = await page.evaluate(k => JSON.parse(localStorage.getItem(k))[2], KEY);
ok('saved under storageKey', saved && saved.item === '테스트 항목' && saved.img === '테스트 연상');

// WIM: open, then tap the projected spot of place 15
await page.click('#wim'); await page.waitForTimeout(200);
ok('wim expands', await page.evaluate(() => document.getElementById('wim').classList.contains('big')));
const r = await page.locator('#wim').boundingBox();
// sweep a grid inside the big map until the caption jumps somewhere other than 01
let jumped = false;
for (let y = .3; y < .8 && !jumped; y += .05) for (let x = .3; x < .8 && !jumped; x += .05) {
  if (!(await page.evaluate(() => document.getElementById('wim').classList.contains('big')))) await page.click('#wim');
  await page.mouse.click(r.x + r.width * x, r.y + r.height * y); await page.waitForTimeout(60);
  jumped = (await page.textContent('#capNo')) !== '01';
}
ok('wim tap flies to a place', jumped);

// drag turns the head, recenter brings it back
await page.waitForTimeout(300);
await page.mouse.move(200, 400); await page.mouse.down(); await page.mouse.move(320, 380, { steps: 8 }); await page.mouse.up();
await page.waitForTimeout(100);
ok('drag shows 정면 button', await page.evaluate(() => getComputedStyle(document.getElementById('recenterBtn')).visibility === 'visible'));
await page.click('#recenterBtn');
// swiftshader runs at a few fps and dt is clamped to 50ms, so give the ease-back real time
await page.waitForFunction(() => getComputedStyle(document.getElementById('recenterBtn')).visibility === 'hidden', null, { timeout: 15000 }).catch(() => {});
ok('recenter hides it again', await page.evaluate(() => getComputedStyle(document.getElementById('recenterBtn')).visibility === 'hidden'));

// list sheet jump
await page.click('#listBtn'); await page.locator('.list-row').nth(9).click();
ok('list jump to 10', (await page.textContent('#capNo')) === '10');

ok('no page errors', errors.length === 0);
if (errors.length) console.log(errors);
await browser.close();
