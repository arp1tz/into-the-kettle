import { chromium } from 'playwright-core';

export const URL = process.env.GAME_URL || 'http://localhost:5175/';

// Chrome with a virtual clock: performance.now, setTimeout and CSS animations follow window.__VT,
// Math.random is seeded, and the render loop is stopped (frames are advanced by the director).
export async function boot({ w = 1920, h = 1080 } = {}) {
  const browser = await chromium.launch({
    executablePath: 'C:/Program Files/Google/Chrome/Application/chrome.exe',
    headless: true,
    args: ['--use-angle=d3d11', '--ignore-gpu-blocklist', '--enable-gpu-rasterization'],
  });
  const ctx = await browser.newContext({ viewport: { width: w, height: h }, deviceScaleFactor: 1 });
  const page = await ctx.newPage();
  const errors = [];
  page.on('pageerror', (e) => errors.push('pageerror: ' + e.message));
  page.on('console', (m) => { if (m.type() === 'error') errors.push('console: ' + m.text()); });
  await page.goto(URL);
  await page.waitForFunction(() => window.__game && window.__game.state === 'TITLE', null, { timeout: 60000 });
  await page.waitForTimeout(800);
  await page.evaluate(() => {
    window.__VT = 0;
    performance.now = () => window.__VT;
    let s = 1;
    window.__seedRandom = (v) => { s = v >>> 0; };
    Math.random = () => { s = (s + 0x6D2B79F5) >>> 0; let t = s; t = Math.imul(t ^ (t >>> 15), t | 1); t ^= t + Math.imul(t ^ (t >>> 7), t | 61); return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
    // virtual timers
    const timers = new Map(); let nid = 1;
    window.setTimeout = (fn, ms = 0, ...a) => { const id = nid++; timers.set(id, { at: window.__VT + ms, fn, a }); return id; };
    window.clearTimeout = (id) => timers.delete(id);
    window.__runTimers = () => {
      for (const [id, tm] of [...timers]) if (tm.at <= window.__VT) { timers.delete(id); try { typeof tm.fn === 'function' && tm.fn(...tm.a); } catch (e) { console.error(e); } }
    };
    const born = new WeakMap();
    window.__syncAnims = () => {
      for (const a of document.getAnimations()) {
        if (!born.has(a)) born.set(a, window.__VT);
        if (a.playState === 'running' || a.playState === 'pending') a.pause();
        a.currentTime = window.__VT - born.get(a);
      }
    };
  });
  return { browser, page, errors };
}
