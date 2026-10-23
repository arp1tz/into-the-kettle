// Usage: node trailer/render.mjs [--shots=0,2-5] [--every=N] [--out=trailer/frames] [--shotsfile=shots.js]
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { boot } from './harness.mjs';

const here = path.dirname(fileURLToPath(import.meta.url));
const args = Object.fromEntries(process.argv.slice(2).map((a) => { const [k, v] = a.replace(/^--/, '').split('='); return [k, v ?? true]; }));
const out = path.resolve(here, args.out || 'frames');
const every = +(args.every || 1);
fs.mkdirSync(out, { recursive: true });
const { browser, page, errors } = await boot({ w: +(args.w || 1920), h: +(args.h || 1080) });
await page.addScriptTag({ path: path.join(here, 'director.js'), type: 'module' });
await page.waitForFunction(() => window.D && window.DIR, null, { timeout: 30000 });
await page.addScriptTag({ path: path.join(here, args.shotsfile || 'shots.js'), type: 'module' });
await page.waitForFunction(() => window.D.shots.length > 0, null, { timeout: 30000 });
const info = await page.evaluate(() => ({ total: window.D.total, shots: window.D.shots.map((s) => ({ i: s.i, id: s.id, t0: s.t0, frames: s.frames })) }));
console.log('timeline', info.total.toFixed(3), 's', info.shots.length, 'shots');
fs.writeFileSync(path.join(here, 'timeline.json'), JSON.stringify(info, null, 1));
const sel = args.shots ? String(args.shots).split(',').flatMap((x) => { const m = x.match(/^(\d+)-(\d+)$/); return m ? Array.from({ length: +m[2] - +m[1] + 1 }, (_, i) => +m[1] + i) : [+x]; }) : info.shots.map((s) => s.i);
const allEvents = []; const t00 = Date.now();
for (const i of sel) {
  const meta = await page.evaluate((i) => window.D.prep(i), i);
  const start = Math.round(meta.t0 * 60);
  for (let f = 0; f < meta.frames; f++) {
    await page.evaluate(() => window.D.step());
    if (f % every === 0) fs.writeFileSync(path.join(out, `${String(start + f).padStart(5, '0')}.jpg`), await page.screenshot({ type: 'jpeg', quality: 94 }));
  }
  allEvents.push(...(await page.evaluate(() => window.D.takeEvents())));
  console.log(`shot ${i} ${meta.id}: ${meta.frames}f (${((Date.now() - t00) / 1000).toFixed(0)}s)`);
}
fs.writeFileSync(path.join(here, args.shots ? 'events_partial.json' : 'events.json'), JSON.stringify(allEvents));
if (errors.length) console.log('ERRORS', [...new Set(errors)].slice(0, 12));
await browser.close();
