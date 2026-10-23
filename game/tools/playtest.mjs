// Headless smoke test: title → room 1 with a scripted bot → each boss. Usage: node tools/playtest.mjs [url]
import { chromium } from 'playwright-core';
import fs from 'node:fs';
const URL = process.argv[2] || 'http://localhost:5175/';
fs.mkdirSync('tools/shots', { recursive: true });
const b = await chromium.launch({ executablePath: 'C:/Program Files/Google/Chrome/Application/chrome.exe', headless: true, args: ['--use-angle=d3d11', '--ignore-gpu-blocklist'] });
const p = await b.newPage({ viewport: { width: 1600, height: 900 } });
const errs = []; p.on('pageerror', (e) => errs.push(e.message)); p.on('console', (m) => { if (m.type() === 'error') errs.push(m.text()); });
await p.goto(URL); await p.waitForFunction(() => window.__game && window.__game.state === 'TITLE', null, { timeout: 60000 });
await p.evaluate(() => {
  const g = window.__game; g.renderer.setAnimationLoop(null);
  // bot: aim at the nearest foe, lash in range, spit at range, dash when hurt, bomb now and then
  g.updateAim = function () { const P = this.player; let best = null, bd = 1e9; for (const m of this.mobs) { if (m.dead) continue; const d = Math.hypot(m.x - P.x, m.y - P.y); if (d < bd) { bd = d; best = m; } } const d0 = this.doors.find((d) => d.open); const t = best || d0 || { x: 0, y: 0 }; this.aim.x = t.x; this.aim.y = t.y; this._bd = bd; };
  window.bot = (i) => { const g = window.__game, I = g.input, P = g.player; I.keys.clear(); if (g.state !== 'PLAY') return; g.updateAim(); const dx = g.aim.x - P.x, dy = g.aim.y - P.y, d = Math.hypot(dx, dy);
    if (d > 90) { if (dx > 20) I.keys.add('KeyD'); if (dx < -20) I.keys.add('KeyA'); if (dy > 20) I.keys.add('KeyW'); if (dy < -20) I.keys.add('KeyS'); }
    if (d < 140 && i % 9 === 0) I.mPressed.add(0); if (d > 200 && i % 20 === 0) I.mPressed.add(2); if (i % 180 === 0) I.pressed.add('KeyQ'); if (P.flashT > 0 && i % 7 === 0) I.pressed.add('Space');
    const dd = g.doors.find((d) => d.open); if (dd && !g.mobs.length && d < 110) I.pressed.add('KeyE'); if (dd && !g.mobs.length && d >= 90) { if (dx > 10) I.keys.add('KeyD'); if (dx < -10) I.keys.add('KeyA'); if (dy > 10) I.keys.add('KeyW'); if (dy < -10) I.keys.add('KeyS'); }
    if (g.state === 'CHOICE') g.pickBoon(g.choices[i % g.choices.length].key); };
  window.run = (n) => { const g = window.__game; for (let i = 0; i < n; i++) { window.bot(i); if (g.state === 'CHOICE') g.pickBoon(g.choices[0].key); g.step(1 / 60); } g.render(); };
});
const shot = (n) => p.screenshot({ path: `tools/shots/${n}.png` });
const st = () => p.evaluate(() => { const g = window.__game; return { state: g.state, room: g.room && g.room.index, hp: Math.round(g.player.hp), mobs: g.mobs.length, left: g.room && g.room.enemiesLeft, boons: g.boons.map((b) => b.key).join(','), boss: g.boss && Math.round(g.boss.hp) }; });
await p.evaluate(() => window.run(30)); await shot('00_title');
await p.evaluate(() => { window.__game.newRun(); window.__game.player.maxHp = 9999; window.__game.player.hp = 9999; });
for (let s = 0; s < 40; s++) { await p.evaluate(() => window.run(600)); if (s % 4 === 0) await shot(`01_run_${s}`); const S = await st(); console.log('run', s, JSON.stringify(S)); if (S.state === 'WIN' || S.state === 'DEAD') break; }
for (const r of []) {
  await p.evaluate((r) => { const g = window.__game; g.routeI = r; g.loadRoom(r); g.player.hp = 9999; }, r);
  for (let s = 0; s < 3; s++) { await p.evaluate(() => window.run(200)); await shot(`02_boss${r}_${s}`); }
  console.log('boss', r, JSON.stringify(await st()));
}
console.log(errs.length ? 'ERRORS:\n' + [...new Set(errs)].slice(0, 15).join('\n') : 'no console errors');
await b.close();
