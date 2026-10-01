// Screenshot every place of a palace at phone size, with time and randomness pinned.
// usage: node test/shots.mjs <html> <outdir>
import { chromium } from 'playwright';
import { mkdirSync } from 'fs';
import { resolve, dirname } from 'path';
import { fileURLToPath } from 'url';

const [file, out] = process.argv.slice(2);
mkdirSync(out, { recursive: true });
const browser = await chromium.launch({ args: ['--use-gl=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'] });
const page = await browser.newPage({ viewport: { width: 390, height: 780 }, deviceScaleFactor: 1, reducedMotion: 'reduce' });
// palaces pinned to a jsDelivr tag get this checkout's dist instead, so unreleased engine changes can be tested
const DIST = resolve(dirname(fileURLToPath(import.meta.url)), '../dist/loci-engine.iife.js');
await page.route(/cdn\.jsdelivr\.net\/gh\/[^/]+\/loci-engine@[^/]+\/dist\/loci-engine\.iife\.js/, r => r.fulfill({ path: DIST, contentType: 'text/javascript' }));
const errors = [];
page.on('pageerror', e => errors.push(e.message));
page.on('console', m => { if (m.type() === 'error') errors.push(m.text()); });
await page.addInitScript(() => {
  // three's UUIDs also eat Math.random, so a seeded stream would drift between builds; pin it instead
  Math.random = () => .37;
  window.__t = 1000; performance.now = () => window.__t;
  for (const k of ['skewer', 'desk', 'cat']) localStorage.setItem(`loci-${k}:hint`, '1');
});
await page.goto('file://' + resolve(file));
await page.waitForFunction(() => document.getElementById('loading')?.hidden === true, null, { timeout: 20000 });
await page.evaluate(() => document.fonts.ready);
const tick = async () => {
  await page.evaluate(() => { window.__t += 16; });
  await page.evaluate(() => new Promise(r => requestAnimationFrame(() => requestAnimationFrame(r))));
};
const n = await page.evaluate(() => Number(document.querySelector('#count span').textContent.replace(/\D/g, '')));
await page.mouse.move(5, 300);
for (let i = 0; i < n; i++) {
  if (i) await page.keyboard.press('ArrowRight');
  await tick(); await tick();
  await page.screenshot({ path: `${out}/${String(i + 1).padStart(2, '0')}.png` });
}
console.log(JSON.stringify({ places: n, errors }));
await browser.close();
