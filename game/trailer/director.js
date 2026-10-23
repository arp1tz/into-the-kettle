// Page-side trailer director for Into the Kettle (Z-up). Deterministic stepping, a combat bot, camera overrides, title overlays.
import { CFG } from '/src/config.js';
import { Audio } from '/src/core/Audio.js';
import { makeMob } from '/src/entities/Mobs.js';
import { BOONS, DUOS } from '/src/game/Boons.js';

const g = window.__game;
const BEAT = 0.4, DT = 1 / 60;
const D = (window.D = { g, events: [], T: 0, shots: [], texts: [], flashes: [], bars: [], blacks: [] });
const cam = g.camera;
g.renderer.setAnimationLoop(null);
{ const play = Audio.play.bind(Audio); Audio.play = (n, o) => { D.events.push({ t: D.T, n }); return play(n, o); }; }
// the hero can be hit (flash, numbers) but never dies on camera
{ const hurt = g.hurtPlayer.bind(g); g.hurtPlayer = (dmg, src, o) => { const P = g.player; if (P.hp - dmg < 38) dmg = Math.max(0, P.hp - 38); return hurt(dmg, src, o); }; }

const css = document.createElement('style');
css.textContent = `
.ui-hint,[class*="hint"]{display:none!important}
.toasts{display:none!important}
.trl-nobanner .banner{display:none!important}
#trl{position:fixed;inset:0;pointer-events:none;z-index:99999;overflow:hidden}
#trl>*{position:absolute}
#trl .flash{inset:0;background:#fff;opacity:0}#trl .black{inset:0;background:#000;opacity:0}
#trl .lb{left:0;right:0;background:#000;height:0}#trl .lb.t{top:0}#trl .lb.b{bottom:0}
#trl .tx{left:50%;top:50%;white-space:nowrap;font:italic 900 1em Georgia,"Palatino Linotype",serif;font-variant:small-caps;letter-spacing:.06em;color:#f8e7c4;
 text-shadow:0 0 30px rgba(255,140,60,.75),0 0 6px rgba(255,200,120,.7),0 5px 0 #2a1a10,0 9px 18px rgba(0,0,0,.6);transform-origin:50% 50%}
#trl .tx small{display:block;font:800 .2em "Trebuchet MS",sans-serif;letter-spacing:.45em;margin-top:.5em;text-align:center;color:#ffcf5a;font-style:normal;text-shadow:0 2px 0 #2a1a10,0 0 12px rgba(255,140,60,.6)}
`;
document.head.appendChild(css);
const root = document.createElement('div'); root.id = 'trl'; document.body.appendChild(root);
const mk = (c) => { const d = document.createElement('div'); d.className = c; root.appendChild(d); return d; };
const el = { lbt: mk('lb t'), lbb: mk('lb b'), flash: mk('flash'), black: mk('black') };
const txs = []; const tx = (i) => { while (txs.length <= i) { const d = document.createElement('div'); d.className = 'tx'; d.style.display = 'none'; root.insertBefore(d, el.flash); txs.push(d); } return txs[i]; };
const c01 = (x) => Math.min(1, Math.max(0, x)), ease = (x) => 1 - Math.pow(1 - c01(x), 3);
function overlay(T) {
  let fl = 0; for (const f of D.flashes) { const a = T - f.t; if (a >= 0 && a < f.dur) fl = Math.max(fl, f.a * Math.pow(1 - a / f.dur, 2)); } el.flash.style.opacity = fl;
  let bl = 0; for (const b of D.blacks) if (T >= b.t0 && T <= b.t1) bl = Math.max(bl, b.a0 + (b.a1 - b.a0) * c01((T - b.t0) / (b.t1 - b.t0))); el.black.style.opacity = bl;
  let lb = 0; for (const b of D.bars) if (T >= b.t0 && T <= b.t1) lb = Math.max(lb, b.h * ease((T - b.t0) / 0.1)); el.lbt.style.height = el.lbb.style.height = `${lb * 100}%`;
  let n = 0;
  for (const t of D.texts) {
    if (T < t.t0 || T > t.t1) continue;
    const e = tx(n++); e.style.display = 'block';
    const age = T - t.t0, left = t.t1 - T, html = t.sub ? `${t.text}<small>${t.sub}</small>` : t.text;
    if (e.dataset.h !== html) { e.innerHTML = html; e.dataset.h = html; }
    e.style.fontSize = `${t.size || 110}px`;
    let sc = 1 + 1.25 * Math.exp(-age * 30), op = c01(age / 0.03);
    if (t.anim === 'rise') { sc = 1 + 0.04 * age; op = c01(age / 0.1); }
    if (left < 0.07) op *= left / 0.07;
    e.style.left = `${t.x ?? 50}%`; e.style.top = `${t.y ?? 50}%`; e.style.opacity = op;
    e.style.transform = `translate(-50%,-50%) rotate(${t.rot ?? -2}deg) scale(${sc})`;
  }
  for (let i = n; i < txs.length; i++) txs[i].style.display = 'none';
}
function applyCam(c) {
  const sh = g.fx.shake * (c.shake ?? 1);
  cam.position.set(c.p[0] + (Math.random() - 0.5) * sh, c.p[1] + (Math.random() - 0.5) * sh, c.p[2] + (Math.random() - 0.5) * sh);
  cam.up.set(0, 0, 1); cam.lookAt(c.l[0], c.l[1], c.l[2]);
  const ph = (D.T % BEAT) / BEAT, fov = (c.fov ?? 36) - (c.punch ?? 1.6) * Math.exp(-ph * 7);
  if (cam.fov !== fov) { cam.fov = fov; cam.updateProjectionMatrix(); }
}
const L = (a, b, k) => a + (b - a) * k;
const rig = {
  orbit(focus, o) { return (lt) => { const k = ease(lt / o.dur), f = focus(), a = L(o.a0, o.a1, k), r = L(o.r0 ?? o.r, o.r1 ?? o.r, k), h = L(o.h0 ?? o.h, o.h1 ?? o.h, k); return { p: [f[0] + Math.cos(a) * r, f[1] + Math.sin(a) * r, f[2] + h], l: [f[0], f[1], f[2] + (o.lookH ?? 30)], fov: L(o.fov0 ?? o.fov ?? 40, o.fov1 ?? o.fov ?? 40, k), shake: o.shake, punch: o.punch }; }; },
  // the game's own Hades camera with a zoom factor (1 = gameplay framing)
  game(zoom = 1, o = {}) { return (lt) => { const P = g.player, z = typeof zoom === 'function' ? zoom(lt) : zoom; const off = [0, -380 * z, 520 * z]; const fx = P.x + (o.dx || 0), fy = P.y + (o.dy || 0); return { p: [fx + off[0], fy + off[1], off[2]], l: [fx, fy, 20], fov: 36, shake: 1 }; }; },
};
const F = { hero: (dz = 25) => () => [g.player.x, g.player.y, dz], boss: (dz = 60) => () => g.boss ? [g.boss.x, g.boss.y, dz] : [0, 200, dz], at: (x, y, z) => () => [x, y, z] };

// ------------------------------------------------------------------ scenario helpers + bot
const S = {
  room(i, o = {}) {
    g.newRun();
    for (const k of o.boons || []) { const b = [...BOONS, ...DUOS].find((x) => x.key === k); if (b) g.grantBoon(b); }
    if (o.trophy) g.trophy = o.trophy;
    if (o.bitter) Object.assign(g.bitter, o.bitter);
    g.routeI = i; g.loadRoom(i); g.ui.hideScreens(); g.ui.showHud(o.hud !== false);
    g.ui.clearBanner?.();
    if (o.noWaves) { g.waveQueue = []; g.pendingSpawns = 0; }
    g.player.maxHp = 100; g.player.hp = o.hp ?? 100;
    D.bot = { on: o.bot !== false, rate: o.rate ?? 9, bomb: o.bomb ?? 0, dash: o.dash ?? 0, special: o.special ?? 0, hold: o.hold, keep: o.keep ?? 90 };
    return g;
  },
  mob(type, x, y, elite) { const m = makeMob(g, type, x, y, elite); g.mobs.push(m); return m; },
  ring(type, n, r, cx = 0, cy = 0, a0 = 0) { for (let i = 0; i < n; i++) { const a = a0 + (i / n) * Math.PI * 2; S.mob(type, cx + Math.cos(a) * r, cy + Math.sin(a) * r); } },
  place(x, y, yaw) { g.player.place(x, y); if (yaw != null) g.player.yaw = yaw; g.camPos = null; },
};
function botTick(i) {
  const B = D.bot; const I = g.input; I.keys.clear();
  if (!B || !B.on || g.state !== 'PLAY') return;
  const P = g.player; let best = null, bd = 1e9;
  for (const m of g.mobs) { if (m.dead) continue; const d = Math.hypot(m.x - P.x, m.y - P.y) - m.r; if (d < bd) { bd = d; best = m; } }
  const t = B.target ? B.target() : best || { x: P.x, y: P.y + 100 };
  g.aim.x = t.x; g.aim.y = t.y;
  const dx = t.x - P.x, dy = t.y - P.y, d = Math.hypot(dx, dy) - (t.r || 0);
  if (!B.hold && d > B.keep) { if (dx > 15) I.keys.add('KeyD'); if (dx < -15) I.keys.add('KeyA'); if (dy > 15) I.keys.add('KeyW'); if (dy < -15) I.keys.add('KeyS'); }
  if (d < 130 && i % B.rate === 0) I.mPressed.add(0);
  if (B.special && i % B.special === 0) I.mPressed.add(2);
  if (B.bomb && i % B.bomb === 0) I.pressed.add('KeyQ');
  if (B.dash && i % B.dash === 0) I.pressed.add('Space');
}
// aim is driven by the bot, not the (absent) mouse
g.updateAim = function () {};

function tick(dt, gdt) { window.__VT += dt * 1000; window.__runTimers(); g.step(gdt); window.__syncAnims(); }
function simFrame(lt) {
  const sh = D.cur; D.frameI = (D.frameI || 0) + 1;
  botTick(D.frameI);
  if (D.inv) { g.player.iframes = 9; g.post.hurt = 0; }
  sh.update && sh.update(lt, S);
  tick(DT, DT * (sh.ts ? sh.ts(lt) : 1));
}
D.define = (def) => {
  let t = 0;
  D.shots = def.shots.map((s, i) => { const o = { ...s, i, t0: t, frames: Math.round(s.dur / DT) }; t += o.frames * DT; return o; });
  D.total = t; D.texts = def.texts || []; D.bars = def.bars || []; D.blacks = def.blacks || []; D.flashes = [...(def.flashes || [])];
  for (const s of D.shots) if (s.flash !== 0) D.flashes.push({ t: s.t0, a: (s.flash ?? 0.45) * 0.5, dur: 0.07 });
};
function startShot(sh) { document.body.classList.toggle('trl-nobanner', !sh.banner); D.inv = !!sh.inv; D.cur = sh; D.camFn = null; D.events.length = 0; D.frameI = 0; window.__seedRandom(sh.seed ?? (1000 + sh.i * 7919)); g.input.clear(); g.fx.clear(); sh.setup(S); }
D.prep = (i) => {
  const sh = D.shots[i]; let pre = Math.round((sh.pre ?? 0) / DT);
  if (sh.find) {
    startShot(sh); let hit = -1; const maxF = Math.round((sh.find.max ?? 8) / DT);
    for (let f = 0; f < maxF && hit < 0; f++) { D.T = -100; simFrame(f * DT - 100); let n = 0; for (const e of D.events) if ((sh.find.ev || []).includes(e.n)) n++; if (sh.find.test && sh.find.test()) n++; if (n >= (sh.find.nth ?? 1)) hit = f; }
    if (hit < 0) hit = maxF - 1;
    pre = Math.max(0, hit - Math.round((sh.find.lead ?? 0.2) / DT));
  }
  startShot(sh); D.local = -pre * DT;
  for (let f = 0; f < pre; f++) { D.T = sh.t0 - (pre - f) * DT; simFrame(D.local); D.local += DT; }
  D.local = 0; D.events.length = 0; D.fi = 0;
  D.camFn = sh.cam ? () => sh.cam(D.local, S) : null;
  sh.start && sh.start(S);
  return { t0: sh.t0, frames: sh.frames, id: sh.id };
};
D.step = () => {
  const sh = D.cur, T = sh.t0 + D.fi * DT; D.T = T;
  simFrame(D.local); D.local += DT; D.fi++;
  if (D.camFn) applyCam(D.camFn());
  if (D.inv) { g.post.hurt = 0; document.querySelectorAll('.vignette').forEach((v) => v.classList.remove('go')); }
  g.render(); overlay(T);
};
D.takeEvents = () => { const e = D.events.slice(); D.events.length = 0; return e; };
window.DIR = { g, S, F, rig, CFG };
