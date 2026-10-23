import * as THREE from 'three';
import { CFG } from '../config.js';
import { Mob } from './Mobs.js';
import { modelInstance } from '../components/Assets.js';
import { angDiff } from '../core/Input.js';

const std = (c, o = {}) => new THREE.MeshStandardMaterial({ color: c, roughness: 0.45, flatShading: true, ...o });
const TAU = Math.PI * 2;

// Boss base: a Mob with a name, phases, an attack picker and a short idle between attacks.
class Boss extends Mob {
  constructor(g, x, y, name, title, hp, r) {
    super(g, 'boss', x, y, false);
    this.isBoss = true; this.name = name; this.title = title; this.r = r;
    this.hp = this.maxHp = Math.round(hp * g.diff.bossHp); this.phase = 1; this.idle = 1.4; this.attack = null;
  }
  get slowK() { return this.frozenT > 0 ? 0.35 : this.slowT > 0 ? 0.75 : 1; } // bosses resist crowd control
  update(dt) {
    if (this.phase === 1 && this.hp < this.maxHp / 2) { this.phase = 2; this.onPhase2(); }
    super.update(dt);
  }
  onPhase2() { this.g.ui.banner(this.name, 'grows furious!', '#ff4d4d'); this.g.audio('bossRoar'); this.g.fx.addShake(16); this.g.fx.ring(this.x, this.y, 0xff3333, 20, 500, 0.6); }
  ai(dt) {
    this.st += dt;
    if (this.attack) { this.attack(dt); return; }
    this.idle -= dt; this.drift(dt);
    if (this.idle <= 0) this.pick();
  }
  drift() {}
  done(idle = 1.1) { this.attack = null; this.idle = idle * (this.phase === 2 ? 0.7 : 1) / (this.g.boilT > CFG.KETTLE_BOIL ? 1.6 : 1); this.st = 0; }
}

// ---------------------------------------------------------------- Queen Armabee (mini-boss 1)
export class QueenArmabee extends Boss {
  constructor(g, x, y) {
    super(g, x, y, 'QUEEN ARMABEE', 'Matriarch of the Hive', 900, 60);
    const m = modelInstance('enemy', 135);
    const piv = new THREE.Group(); piv.rotation.z = -CFG.FACING; if (m) piv.add(m); this.root.add(piv);
    const crown = new THREE.Group();
    for (let i = 0; i < 5; i++) { const c = new THREE.Mesh(new THREE.ConeGeometry(6, 22, 5), std(0xffcf5a, { metalness: 0.8, roughness: 0.25, emissive: 0x332200 })); const a = (i / 5) * TAU; c.position.set(Math.cos(a) * 14, Math.sin(a) * 14, 0); c.rotation.x = Math.PI / 2; crown.add(c); }
    crown.position.set(10, 0, 150); this.root.add(crown); this.crown = crown;
    this.finish(); this.hoverT = 0; this.order = 0;
  }
  drift(dt) {
    const P = this.g.player; this.hoverT += dt;
    const a = Math.atan2(this.y - P.y, this.x - P.x) + dt * 0.6, R = 300;
    this.moveToward(P.x + Math.cos(a) * R, P.y + Math.sin(a) * R, 260, dt);
    this.yaw += angDiff(this.yaw, Math.atan2(P.y - this.y, P.x - this.x)) * Math.min(1, dt * 6);
  }
  sync(dt) { super.sync(dt); this.z = 20 + Math.sin(this.g.t * 3) * 8; this.root.position.z = this.z; this.crown.rotation.z += 0.02; }
  pick() {
    const k = ['dash', 'fan', 'dash', 'summon', 'fan'][this.order++ % 5];
    const g = this.g, P = g.player;
    if (k === 'dash') {
      let n = this.phase === 2 ? 3 : 2;
      const one = () => {
        const a = Math.atan2(P.y - this.y, P.x - this.x); this.yaw = a;
        g.audio('charge'); let t = 0; const L = 900;
        g.fx.telegraph(this.x, this.y, { rect: [L, 90], yaw: a }, 0.7 * g.diff.windup);
        this.attack = (dt) => {
          t += dt; if (t < 0.7 * g.diff.windup) { this.state = 'wind'; return; }
          this.state = 'dash'; const s = 1500 * dt; this.hitWall = false;
          this.x += Math.cos(a) * s; this.y += Math.sin(a) * s; g.resolve(this);
          if (Math.hypot(P.x - this.x, P.y - this.y) < this.r + P.r) g.hurtPlayer(20, this, { knock: [Math.cos(a), Math.sin(a)] });
          g.fx.burst(this.x, this.y, 30, 0xffcf5a, 1, 60, 0.4, 5, 0);
          if (t > 0.7 * g.diff.windup + 0.55 || this.hitWall) { this.state = 'move'; if (--n > 0) one(); else this.done(); }
        };
      };
      one();
    } else if (k === 'fan') {
      let v = this.phase === 2 ? 3 : 2, t = 0;
      const a0 = Math.atan2(P.y - this.y, P.x - this.x);
      g.fx.telegraph(this.x, this.y, { cone: [520, 0.75], yaw: a0 }, 0.6 * g.diff.windup);
      this.state = 'wind';
      this.attack = (dt) => {
        t += dt; if (t < 0.6 * g.diff.windup) return; this.state = 'move';
        if (t > 0.6 * g.diff.windup + (2 - v) * 0.35 + (this.phase === 2 ? 0 : 0) && v > 0) {
          const n = 9, base = Math.atan2(P.y - this.y, P.x - this.x);
          for (let i = 0; i < n; i++) g.shoot({ x: this.x, y: this.y, a: base + (i - (n - 1) / 2) * 0.16 + (v % 2) * 0.08, speed: 480, dmg: 10, team: 'enemy', color: 0xffe066, r: 9, z: 40 });
          g.audio('sting'); v--;
        }
        if (v <= 0) this.done(1.2);
      };
    } else {
      g.audio('bossRoar', { pitch: 1.4 });
      const minions = g.mobs.filter((m) => !m.isBoss && !m.dead).length;
      for (let i = 0; i < (minions < 5 ? 3 : 1); i++) { const a = Math.random() * TAU; g.spawnMob('bee', this.x + Math.cos(a) * 140, this.y + Math.sin(a) * 140, false, 0.6); }
      this.done(1.4);
    }
  }
}

// ---------------------------------------------------------------- The House That Walks (mini-boss 2): the course house, alive
export class WalkingHouse extends Boss {
  constructor(g, x, y) {
    super(g, x, y, 'THE HOUSE THAT WALKS', 'Hollow Village Landlord', 1300, 85);
    this.top = new THREE.Group(); this.root.add(this.top);
    const m = modelInstance('small_house', 190);
    if (m) this.top.add(m); else { const b = new THREE.Mesh(new THREE.BoxGeometry(150, 150, 130), std(0xd7b98e)); b.position.z = 65; this.top.add(b); }
    this.top.position.z = 60;
    this.legs = [];
    for (const [lx, ly] of [[-45, -45], [45, -45], [-45, 45], [45, 45]]) {
      const leg = new THREE.Mesh(new THREE.CylinderGeometry(9, 12, 70, 6), std(0x4a3020)); leg.rotation.x = Math.PI / 2; leg.position.set(lx, ly, 35); this.root.add(leg); this.legs.push(leg);
      const foot = new THREE.Mesh(new THREE.SphereGeometry(16, 8, 6), std(0x2a1a10)); foot.scale.z = 0.5; foot.position.set(lx, ly, 4); this.root.add(foot);
    }
    this.eyes = [];
    for (const s of [-1, 1]) { const e = new THREE.Mesh(new THREE.SphereGeometry(10, 10, 8), new THREE.MeshBasicMaterial({ color: 0xffa040 })); e.position.set(70, s * 28, 120); this.root.add(e); this.eyes.push(e); }
    this.finish(); this.order = 0; this.walkT = 0;
  }
  drift(dt) {
    const P = this.g.player; this.walkT += dt;
    this.moveToward(P.x, P.y, 95, dt);
    this.top.position.z = 60 + Math.abs(Math.sin(this.walkT * 5)) * 10;
    this.legs.forEach((l, i) => { l.position.z = 35 + Math.sin(this.walkT * 5 + i * Math.PI / 2) * 8; });
  }
  pick() {
    const g = this.g, P = g.player;
    const k = ['stomp', 'mortar', 'chomp', 'stomp', 'mortar'][this.order++ % 5];
    if (k === 'stomp') {
      const tx = P.x, ty = P.y, x0 = this.x, y0 = this.y, R = 190, warn = 1.0 * g.diff.windup;
      g.fx.telegraph(tx, ty, { circle: R }, warn); g.audio('charge', { pitch: 0.6 });
      let t = 0;
      this.attack = (dt) => {
        t += dt; const k2 = Math.min(1, t / warn);
        this.x = x0 + (tx - x0) * k2; this.y = y0 + (ty - y0) * k2; this.z = Math.sin(k2 * Math.PI) * 260;
        if (t >= warn && !this.landed) {
          this.landed = true; this.z = 0; g.resolve(this);
          g.circleHit(this.x, this.y, R, 24, this); g.fx.addShake(22); g.audio('stomp');
          g.fx.ring(this.x, this.y, 0xffd0a0, 20, R * 1.3, 0.45); g.fx.burst(this.x, this.y, 10, 0xb08a60, 26, 420, 0.6, 9);
          if (this.phase === 2) g.shockwave(this.x, this.y, 900, 520, 16);
        }
        if (t > warn + 0.45) { this.landed = false; this.done(1.0); }
      };
    } else if (k === 'mortar') {
      const n = this.phase === 2 ? 7 : 5; g.audio('boom', { pitch: 1.6, vol: 0.5 });
      for (let i = 0; i < n; i++) {
        const a = Math.random() * TAU, d = i === 0 ? 0 : 60 + Math.random() * 240, x = P.x + Math.cos(a) * d, y = P.y + Math.sin(a) * d;
        g.fx.telegraph(x, y, { circle: 85 }, 1.1 * g.diff.windup + i * 0.08, 0xff5a1a, () => { g.circleHit(x, y, 85, 14, this); g.fx.burst(x, y, 10, 0xff8a3d, 14, 300, 0.5, 7); g.fx.ring(x, y, 0xffaa55, 10, 110, 0.35); g.audio('boom', { vol: 0.4 }); g.fx.addShake(5); });
        g.fx.burst(this.x - 30, this.y + 40, 190, 0x444444, 2, 160, 0.8, 9, 300); // smoke from the chimney
      }
      this.done(1.6);
    } else {
      const a = Math.atan2(P.y - this.y, P.x - this.x); this.yaw = a; const warn = 0.7 * g.diff.windup; let t = 0;
      g.fx.telegraph(this.x, this.y, { rect: [620, 170], yaw: a }, warn); g.audio('charge');
      this.attack = (dt) => {
        t += dt; if (t < warn) { this.state = 'wind'; return; } this.state = 'dash';
        const s = 1050 * dt; this.hitWall = false; this.x += Math.cos(a) * s; this.y += Math.sin(a) * s; g.resolve(this);
        if (Math.hypot(P.x - this.x, P.y - this.y) < this.r + P.r) g.hurtPlayer(22, this, { knock: [Math.cos(a), Math.sin(a)] });
        if (t > warn + 0.55 || this.hitWall) { this.state = 'move'; if (this.hitWall) { g.fx.addShake(12); g.audio('stomp'); } this.done(this.hitWall ? 1.8 : 0.9); }
      };
    }
  }
  sync(dt) { super.sync(dt); this.eyes.forEach((e) => e.material.color.setHex(this.state === 'wind' ? 0xff2200 : 0xffa040)); }
}

// ---------------------------------------------------------------- The Kettle Tyrant (final boss)
// Brewed from the blessings you refused (Bitter Leaves): each refused spirit adds its attack to the rotation.
export class KettleTyrant extends Boss {
  constructor(g, x, y, bitter) {
    super(g, x, y, 'THE KETTLE TYRANT', 'Brewed from what you refused', 2600, 115);
    this.bitter = bitter; // { chai: n, matcha: n, jasmine: n, mint: n }
    const copper = std(0xb8643a, { metalness: 0.85, roughness: 0.3 }), dark = std(0x2a140c, { metalness: 0.6, roughness: 0.4 });
    const pts = []; for (let i = 0; i <= 14; i++) { const k = i / 14; pts.push(new THREE.Vector2(Math.sin(k * Math.PI * 0.92 + 0.1) * 120 + 18, k * 210)); }
    const body = new THREE.Mesh(new THREE.LatheGeometry(pts, 28), copper); body.rotation.x = Math.PI / 2; this.body = body;
    const lid = new THREE.Group();
    const lidM = new THREE.Mesh(new THREE.CylinderGeometry(78, 92, 22, 28), dark); lidM.rotation.x = Math.PI / 2; lid.add(lidM);
    const knob = new THREE.Mesh(new THREE.SphereGeometry(20, 12, 10), copper); knob.position.z = 22; lid.add(knob);
    lid.position.z = 214; this.lid = lid;
    const spout = new THREE.Mesh(new THREE.CylinderGeometry(14, 36, 150, 12, 1, true), copper); spout.rotation.z = -Math.PI / 2; spout.rotation.y = -0.7; spout.position.set(150, 0, 120); this.spout = spout;
    const handle = new THREE.Mesh(new THREE.TorusGeometry(70, 12, 8, 20, Math.PI * 1.1), dark); handle.rotation.y = Math.PI / 2; handle.position.set(-110, 0, 140);
    this.eyes = [];
    for (const s of [-1, 1]) { const e = new THREE.Mesh(new THREE.SphereGeometry(16, 10, 8), new THREE.MeshBasicMaterial({ color: 0xffd060 })); e.position.set(118, s * 40, 150); e.scale.set(0.6, 1, 0.7); this.eyes.push(e); }
    const glow = new THREE.PointLight(0xff6a2a, 300, 900, 1.5); glow.position.set(0, 0, 260); this.glow = glow;
    this.spin = new THREE.Group(); this.spin.add(body, lid, spout, handle, ...this.eyes); this.root.add(this.spin, glow);
    this.finish(); this.order = 0; this.lidOut = false;
    const rot = ['steam', 'bubbles', 'lid', 'steam', 'bubbles'];
    for (const [sp, n] of Object.entries(bitter)) for (let i = 0; i < Math.min(2, n); i++) rot.splice(1 + ((i * 2 + sp.length) % rot.length), 0, sp);
    this.rotation = rot;
  }
  drift(dt) {
    const P = this.g.player;
    this.yaw += angDiff(this.yaw, Math.atan2(P.y - this.y, P.x - this.x)) * Math.min(1, dt * 2.5);
    if (Math.random() < 0.3) this.g.fx.burst(this.x + (Math.random() - 0.5) * 60, this.y + (Math.random() - 0.5) * 60, 250, 0xdddddd, 1, 60, 1.2, 10, -60);
  }
  sync(dt) { super.sync(dt); this.glow.intensity = 260 + Math.sin(this.g.t * 8) * 60 + (this.phase === 2 ? 200 : 0); this.spin.position.z = Math.abs(Math.sin(this.g.t * 6)) * (this.phase === 2 ? 10 : 4); }
  onPhase2() { super.onPhase2(); this.rotation.splice(1, 0, 'flood'); this.rotation.push('flood'); }
  pick() {
    const g = this.g, P = g.player, k = this.rotation[this.order++ % this.rotation.length];
    const aim = () => Math.atan2(P.y - this.y, P.x - this.x);
    if (k === 'steam') {
      const a = aim(), warn = 0.85 * g.diff.windup; this.yaw = a; let t = 0;
      g.fx.telegraph(this.x, this.y, { cone: [620, 0.42], yaw: a }, warn); g.audio('charge', { pitch: 0.8 });
      this.attack = (dt) => {
        t += dt; this.yaw = a; if (t < warn) { this.state = 'wind'; return; } this.state = 'move';
        if (!this.hissed) { this.hissed = true; g.audio('steam'); }
        for (let i = 0; i < 4; i++) { const r = 150 + Math.random() * 470, aa = a + (Math.random() - 0.5) * 0.8; g.fx.burst(this.x + Math.cos(aa) * r, this.y + Math.sin(aa) * r, 30, 0xf0f0f0, 1, 80, 0.5, 18, -100); }
        const d = Math.hypot(P.x - this.x, P.y - this.y), pa = Math.abs(angDiff(a, aim()));
        if (d < 640 && pa < 0.42) g.hurtPlayer(16, this);
        if (t > warn + 1.0) { this.hissed = false; this.done(); }
      };
    } else if (k === 'bubbles') {
      const n = this.phase === 2 ? 10 : 7; g.audio('bubble');
      for (let i = 0; i < n; i++) {
        const a = Math.random() * TAU, d = i < 2 ? i * 40 : 80 + Math.random() * 300, x = P.x + Math.cos(a) * d, y = P.y + Math.sin(a) * d;
        g.fx.telegraph(x, y, { circle: 80 }, 0.95 * g.diff.windup + i * 0.07, 0xff6a2a, () => { g.circleHit(x, y, 80, 15, this); g.fx.burst(x, y, 6, 0xff9a5a, 12, 260, 0.55, 8); g.fx.ring(x, y, 0xffffff, 10, 100, 0.3); g.audio('bubble', { pitch: 0.7 }); });
      }
      this.done(1.4);
    } else if (k === 'lid') {
      const a = aim(), lid = this.lid, dist = 650; let t = 0; g.audio('lid');
      g.fx.telegraph(this.x, this.y, { rect: [dist, 120], yaw: a }, 0.55);
      this.attack = (dt) => {
        t += dt; if (t < 0.55) return;
        const k2 = Math.min(1, (t - 0.55) / 1.4), out = Math.sin(k2 * Math.PI) * dist;
        const lx = this.x + Math.cos(a) * out, ly = this.y + Math.sin(a) * out;
        lid.position.set(Math.cos(a - this.yaw) * out, Math.sin(a - this.yaw) * out, 214 - Math.sin(k2 * Math.PI) * 170); lid.rotation.z += dt * 18;
        if (Math.hypot(P.x - lx, P.y - ly) < 95) g.hurtPlayer(18, this);
        if (k2 >= 1) { lid.position.set(0, 0, 214); this.done(0.9); }
      };
    } else if (k === 'flood') {
      g.audio('steam', { pitch: 0.6 }); g.ui.toast('The kettle boils over! Dash through the waves', '#ff8a3d');
      let t = 0, rings = 0;
      this.attack = (dt) => { t += dt; if (t > rings * 0.9 && rings < 3) { g.shockwave(this.x, this.y, 1100, 420, 15, 0xff6a2a); rings++; } if (t > 3.2) this.done(1); };
    } else if (k === 'chai') {
      for (let i = 0; i < 6; i++) { const a = Math.random() * TAU, d = Math.random() * 380, x = P.x + Math.cos(a) * d, y = P.y + Math.sin(a) * d; g.fx.telegraph(x, y, { circle: 95 }, 0.8, 0xff7a2f, () => g.hazard({ x, y, r: 95, dps: 14, life: 4, color: 0xff6a1a, team: 'enemy' })); }
      g.ui.toast('Bitter Chai: the floor burns', '#ff7a2f'); this.done(1.2);
    } else if (k === 'matcha') {
      let n = 5 + this.bitter.matcha * 2, t = 0;
      this.attack = (dt) => { t += dt; if (t > 0.28 && n > 0) { t = 0; n--; const x = P.x + P.vx * 0.3, y = P.y + P.vy * 0.3; g.fx.telegraph(x, y, { circle: 75 }, 0.7, 0xb6ff5a, () => { g.circleHit(x, y, 75, 14, this); g.fx.zap(x, y - 10, x, y + 10, 0xd6ff8a, 400); g.fx.ring(x, y, 0xb6ff5a, 10, 110, 0.3); g.audio('crit', { pitch: 0.6 }); g.ui.flash(0.25); }); } if (n <= 0 && t > 0.8) this.done(1); };
      g.ui.toast('Bitter Matcha: lightning hunts you', '#9dff5a');
    } else if (k === 'jasmine') {
      for (let w = 0; w < 2; w++) for (let i = 0; i < 16; i++) { const a = (i / 16) * TAU + w * 0.2; setTimeoutSafe(g, w * 0.5, () => g.shoot({ x: this.x, y: this.y, a, speed: 360, dmg: 9, team: 'enemy', color: 0x8fd8ff, r: 12, z: 60, slow: true })); }
      g.audio('sting', { pitch: 0.6 }); g.ui.toast('Bitter Jasmine: frost shards', '#8fd8ff'); this.done(1.5);
    } else if (k === 'mint') {
      let t = 0; g.audio('dash', { pitch: 0.5, vol: 1.5 });
      this.attack = (dt) => { t += dt; const a = Math.atan2(P.y - this.y, P.x - this.x); P.kx += Math.cos(a) * 900 * dt; P.ky += Math.sin(a) * 900 * dt; if (Math.random() < 0.6) g.fx.burst(P.x + (Math.random() - 0.5) * 300, P.y + (Math.random() - 0.5) * 300, 20, 0x5affc8, 1, 400, 0.4, 5, 0); if (t > 1.8) this.done(1); };
      g.ui.toast('Bitter Mint: a gale pushes you out', '#5affc8');
    } else this.done(0.5);
  }
}

// small scheduler that runs on game time (keeps capture deterministic)
function setTimeoutSafe(g, delay, fn) { g.later(delay, fn); }
