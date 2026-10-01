// Backup round trip: export a file, wipe storage, import it back; reject foreign and broken files.
// usage: node test/backup.mjs <html> <storageKey>
import { chromium } from 'playwright';
import { resolve, dirname } from 'path';
import { fileURLToPath } from 'url';
import { readFileSync, writeFileSync, mkdirSync } from 'fs';

const file = 'file://' + resolve(process.argv[2]);
const KEY = process.argv[3] || 'loci-skewer:v2';
const OUT = resolve(dirname(fileURLToPath(import.meta.url)), 'out/backup'); mkdirSync(OUT, { recursive: true });
const browser = await chromium.launch({ args: ['--use-gl=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'] });
const ctx = await browser.newContext({ viewport: { width: 390, height: 780 }, reducedMotion: 'reduce', acceptDownloads: true });
const page = await ctx.newPage();
const DIST = resolve(dirname(fileURLToPath(import.meta.url)), '../dist/loci-engine.iife.js');
await page.route(/cdn\.jsdelivr\.net\/gh\/[^/]+\/loci-engine@[^/]+\/dist\/loci-engine\.iife\.js/, r => r.fulfill({ path: DIST, contentType: 'text/javascript' }));
const errors = []; page.on('pageerror', e => errors.push(e.message));
const ok = (name, cond) => console.log(cond ? 'PASS' : 'FAIL', name);
const ready = () => page.waitForFunction(() => document.getElementById('loading').hidden);
const prefix = KEY.split(':')[0];
// reading the file is async; wait until the page shows either an error or the overwrite prompt
const pick = async f => {
  await page.evaluate(() => { const e = document.getElementById('importError'); e.textContent = ''; e.hidden = true; document.getElementById('importConfirm').hidden = true; });
  await page.setInputFiles('#importFile', f);
  await page.waitForFunction(() => !document.getElementById('importError').hidden || !document.getElementById('importConfirm').hidden, null, { timeout: 20000 });
};

await page.addInitScript(p => localStorage.setItem(p + ':hint', '1'), prefix);
await page.goto(file); await ready();

// add one of our own entries so the backup has user data, not just examples
await page.click('#caption'); await page.fill('#edItem', '백업 테스트'); await page.fill('#edImg', '파일로 갔다가 돌아온다');
await page.click('#editForm button[type=submit]');
const before = await page.evaluate(k => localStorage.getItem(k), KEY);

await page.click('#listBtn');
ok('note says never exported', (await page.textContent('#backupNote')).includes('내보낸 적 없어'));
const [dl] = await Promise.all([page.waitForEvent('download'), page.click('#exportBtn')]);
const path = `${OUT}/${dl.suggestedFilename()}`; await dl.saveAs(path);
ok('filename has palace prefix and date', /^[a-z-]+-\d{4}-\d{2}-\d{2}\.json$/.test(dl.suggestedFilename()) && dl.suggestedFilename().startsWith(prefix));
const backup = JSON.parse(readFileSync(path, 'utf8'));
ok('backup carries format, key and data', backup.format === 'loci-palace-backup' && backup.storageKey === KEY && JSON.stringify(backup.data) === before);
ok('note shows last export', (await page.textContent('#backupNote')).includes('마지막 내보내기'));

// wipe and reload: examples come back, our entry is gone
await page.evaluate(k => localStorage.removeItem(k), KEY);
await page.reload(); await ready();
ok('wiped storage lost the entry', !(await page.textContent('#capItem')).includes('백업 테스트'));

// foreign palace
writeFileSync(`${OUT}/foreign.json`, JSON.stringify({ ...backup, storageKey: 'loci-other:v1', title: '다른 궁전' }));
await page.click('#listBtn');
await pick(`${OUT}/foreign.json`);
ok('foreign backup rejected', (await page.isVisible('#importError')) && (await page.textContent('#importError')).includes('다른 궁전'));
// broken JSON
writeFileSync(`${OUT}/broken.json`, '{ not json');
await pick(`${OUT}/broken.json`);
ok('broken file rejected', (await page.textContent('#importError')).includes('JSON'));
// out-of-range place
writeFileSync(`${OUT}/range.json`, JSON.stringify({ ...backup, data: { 99: { item: 'x', img: '' } } }));
await pick(`${OUT}/range.json`);
ok('out-of-range place rejected', (await page.textContent('#importError')).includes('100번'));
ok('nothing written by rejected imports', (await page.evaluate(k => localStorage.getItem(k), KEY)) === null);

// real import, cancel first, then confirm
await pick(path);
ok('confirm shown with counts', (await page.isVisible('#importConfirm')) && /\d+곳이 채워져/.test(await page.textContent('#importMsg')));
await page.click('#importNo');
ok('cancel writes nothing', (await page.evaluate(k => localStorage.getItem(k), KEY)) === null);
await pick(path);
await page.click('#importYes');
ok('import restores storage exactly', (await page.evaluate(k => localStorage.getItem(k), KEY)) === before);
ok('caption shows restored entry', (await page.textContent('#capItem')).includes('백업 테스트'));
ok('list shows restored entry', (await page.textContent('#listBody')).includes('백업 테스트'));
await page.reload(); await ready();
ok('restored entry survives reload', (await page.textContent('#capItem')).includes('백업 테스트'));
ok('no page errors', errors.length === 0); if (errors.length) console.log(errors);
await browser.close();
