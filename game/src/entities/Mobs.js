import * as THREE from 'three';
import { CFG } from '../config.js';
import { createEnemyModel } from '../components/Enemy.js';
import { angDiff, clamp } from '../core/Input.js';

const std = (c, o = {}) => new THREE.MeshStandardMaterial({ color: c, roughness: 0.55, flatShading: true, ...o });

// Shared base: health, status effects (burn / slow / freeze), knockback, hit flash, collision-aware movement.
export class Mob {
  constructor(g, type, x, y, elite = false) {
    const T = CFG.MOBS[type] || {};
    this.g = g; this.type = type; this.x = x; this.y = y; this.z = 0; this.yaw = 0;
    this.r = (T.r || 24) * (elite ? CFG.ELITE.scale : 1);
    this.hp = this.maxHp = Math.round((T.hp || 40) * (elite ? CFG.ELITE.hp : 1) * g.diff.hp);
    this.speed = (T.speed || 120) * g.diff.speed; this.T = T; this.elite = elite;
    this.dead = false; this.flashT = 0; this.burnT = 0; this.slowT = 0; this.frozenT = 0; this.kx = 0; this.ky = 0;
    this.state = 'move'; this.st = 0; this.cd = 0.6 + Math.random();
    this.root = new THREE.Group(); g.scene.add(this.root);
    this.mats = [];
  }
  finish(scale = 1) {
    if (this.elite) this.root.scale.setScalar(CFG.ELITE.scale * scale); else this.root.scale.setScalar(scale);
    this.root.traverse((o) => { if (o.isMesh) { o.castShadow = true; if (o.material && o.material.emissive) { this.mats.push(o.material); if (this.elite) o.material.emissive.setHex(0x553300); } } });
    if (this.elite) { const halo = new THREE.Mesh(new THREE.RingGeometry(this.r * 0.9, this.r * 1.1, 32), new THREE.MeshBasicMaterial({ color: 0xffcf5a, transparent: true, opacity: 0.7, depthWrite: false })); halo.position.z = 2; this.root.add(halo); }
  }
  get slowK() { return this.frozenT > 0 ? 0 : this.slowT > 0 ? 0.55 : 1; }
  // move toward a point respecting other mobs, the player and houses (course collision rules)
  moveToward(tx, ty, speed, dt) {
    const dx = tx - this.x, dy = ty - this.y, d = Math.hypot(dx, dy);
    if (d < 1) return d;
    const s = Math.min(d, speed * dt * this.slowK);
    this.tryMove(this.x + (dx / d) * s, this.y + (dy / d) * s);
    this.yaw += angDiff(this.yaw, Math.atan2(dy, dx)) * Math.min(1, dt * 10);
    return d;
  }
  tryMove(nx, ny) {
    const g = this.g, P = g.player;
    const minP = (this.r + P.r) * 0.95;
    if (Math.hypot(nx - P.x, ny - P.y) < minP && Math.hypot(nx - P.x, ny - P.y) < Math.hypot(this.x - P.x, this.y - P.y)) return false;
    for (const o of g.mobs) {
      if (o === this || o.dead) continue;
      const min = (this.r + o.r) * 0.9, dn = Math.hypot(nx - o.x, ny - o.y);
      if (dn < min && dn < Math.hypot(this.x - o.x, this.y - o.y)) { // slide around instead of freezing
        const ax = this.x - o.x, ay = this.y - o.y, al = Math.hypot(ax, ay) || 1;
        nx = this.x + (-ay / al) * 2; ny = this.y + (ax / al) * 2; break;
      }
    }
    this.x = nx; this.y = ny;
    g.resolve(this);
    return true;
  }
  update(dt) {
    const g = this.g;
    this.flashT = Math.max(0, this.flashT - dt); this.slowT = Math.max(0, this.slowT - dt); this.frozenT = Math.max(0, this.frozenT - dt);
    if (this.burnT > 0) { this.burnT -= dt; this.burnTick = (this.burnTick || 0) - dt; if (this.burnTick <= 0) { this.burnTick = 0.5; g.hit(this, 4, { kind: 'burn', silent: true, noStatus: true }); if (Math.random() < 0.5) g.fx.burst(this.x, this.y, 30, 0xff7a2f, 2, 90, 0.4, 4, -200); } }
    // knockback
    if (Math.abs(this.kx) + Math.abs(this.ky) > 1) { this.tryMove(this.x + this.kx * dt, this.y + this.ky * dt); this.kx *= Math.exp(-9 * dt); this.ky *= Math.exp(-9 * dt); }
    if (this.dead) return;
    if (this.frozenT <= 0) this.ai(dt * this.slowK, dt);
    this.sync(dt);
  }
  ai() {}
  sync() {
    this.root.position.set(this.x, this.y, this.z);
    this.root.rotation.z = this.yaw;
    const c = this.flashT > 0 ? 0x666666 : this.frozenT > 0 ? 0x4aa8ff : this.state === 'wind' ? (Math.floor(this.st * 20) % 2 ? 0xff2200 : 0x550000) : this.burnT > 0 ? 0x552200 : this.elite ? 0x553300 : 0x000000;
    for (const m of this.mats) m.emissive.setHex(c);
  }
  remove() { this.g.scene.remove(this.root); this.root.traverse((o) => { if (o.isMesh && o.userData.own) o.geometry.dispose(); }); }
}

// Armabee grunt: the course enemy. Chases (course behavior), winds up, then lunges with its stinger.
export class Bee extends Mob {
  constructor(g, x, y, elite) {
    super(g, 'bee', x, y, elite);
    const m = createEnemyModel(46);
    m.userData.pivot.rotation.z = -CFG.FACING;
    this.root.add(m); this.bob = Math.random() * 6;
    this.finish();
  }
  ai(dt) {
    const g = this.g, P = g.player, T = this.T;
    this.st += dt; this.bob += dt * 8;
    const d = Math.hypot(P.x - this.x, P.y - this.y);
    if (this.state === 'move') {
      this.moveToward(P.x, P.y, this.speed, dt);
      this.cd -= dt;
      if (d < T.reach + this.r + P.r && this.cd <= 0) { this.state = 'wind'; this.st = 0; this.lx = P.x; this.ly = P.y; }
    } else if (this.state === 'wind') {
      this.yaw += angDiff(this.yaw, Math.atan2(P.y - this.y, P.x - this.x)) * Math.min(1, dt * 12);
      if (this.st > T.windup * g.diff.windup) { this.state = 'lunge'; this.st = 0; this.g.audio('sting', { vol: 0.5 }); }
    } else if (this.state === 'lunge') {
      const s = 520 * dt; this.tryMove(this.x + Math.cos(this.yaw) * s, this.y + Math.sin(this.yaw) * s);
      if (!this.hitDone && Math.hypot(P.x - this.x, P.y - this.y) < this.r + P.r + 18) { this.hitDone = true; g.hurtPlayer(T.dmg * g.diff.dmg, this); }
      if (this.st > 0.16) { this.state = 'move'; this.cd = 0.9 + Math.random() * 0.6; this.hitDone = false; }
    }
    this.z = 4 + Math.sin(this.bob) * 3;
  }
}

// Spitter beetle: keeps its distance and lobs boiling spit.
export class Spitter extends Mob {
  constructor(g, x, y, elite) {
    super(g, 'spitter', x, y, elite);
    const body = new THREE.Mesh(new THREE.IcosahedronGeometry(20, 1), std(0x6b3fa0)); body.scale.set(1.3, 1, 0.8); body.position.z = 18;
    const head = new THREE.Mesh(new THREE.IcosahedronGeometry(11, 1), std(0x2a1840)); head.position.set(22, 0, 20);
    const sac = new THREE.Mesh(new THREE.SphereGeometry(9, 10, 8), std(0xff9a3a, { emissive: 0x552200 })); sac.position.set(-6, 0, 34); this.sac = sac;
    for (const s of [-1, 1]) for (const k of [-1, 0, 1]) { const leg = new THREE.Mesh(new THREE.CylinderGeometry(1.6, 1.6, 22, 4), std(0x22112e)); leg.rotation.x = Math.PI / 2 + s * 0.9; leg.position.set(k * 10, s * 18, 8); this.root.add(leg); }
    for (const sx of [-1, 1]) { const e = new THREE.Mesh(new THREE.SphereGeometry(3, 6, 5), new THREE.MeshBasicMaterial({ color: 0xffe066 })); e.position.set(30, sx * 6, 24); this.root.add(e); }
    this.root.add(body, head, sac);
    this.finish();
  }
  ai(dt) {
    const g = this.g, P = g.player, T = this.T; this.st += dt;
    const d = Math.hypot(P.x - this.x, P.y - this.y), a = Math.atan2(P.y - this.y, P.x - this.x);
    if (this.state === 'move') {
      if (d > T.keep + 60) this.moveToward(P.x, P.y, this.speed, dt);
      else if (d < T.keep - 80) this.moveToward(this.x - Math.cos(a) * 100, this.y - Math.sin(a) * 100, this.speed, dt);
      else { const sx = this.x + Math.cos(a + Math.PI / 2) * 60, sy = this.y + Math.sin(a + Math.PI / 2) * 60; this.moveToward(sx, sy, this.speed * 0.6, dt); }
      this.yaw += angDiff(this.yaw, a) * Math.min(1, dt * 8);
      this.cd -= dt;
      if (this.cd <= 0 && d < 900) { this.state = 'wind'; this.st = 0; }
    } else if (this.state === 'wind') {
      this.sac.scale.setScalar(1 + this.st * 1.4);
      this.yaw += angDiff(this.yaw, a) * Math.min(1, dt * 10);
      if (this.st > 0.5 * g.diff.windup) {
        this.sac.scale.setScalar(1);
        const n = this.elite ? 3 : 1;
        for (let i = 0; i < n; i++) g.shoot({ x: this.x + Math.cos(this.yaw) * 30, y: this.y + Math.sin(this.yaw) * 30, a: this.yaw + (i - (n - 1) / 2) * 0.22, speed: T.shot * g.diff.speed, dmg: T.dmg * g.diff.dmg, team: 'enemy', color: 0xff8a2a, r: 11 });
        g.audio('spit', { pitch: 0.7 });
        this.state = 'move'; this.cd = T.cd * (0.8 + Math.random() * 0.4) / g.diff.speed;
      }
    }
  }
}

// Horned charger: telegraphs a straight red lane, then rams. Stunned when it hits a wall.
export class Charger extends Mob {
  constructor(g, x, y, elite) {
    super(g, 'charger', x, y, elite);
    const shell = new THREE.Mesh(new THREE.SphereGeometry(30, 14, 10, 0, Math.PI * 2, 0, Math.PI / 2), std(0x7a2a1a, { metalness: 0.3 })); shell.scale.set(1.3, 1, 0.9); shell.position.z = 8;
    const head = new THREE.Mesh(new THREE.IcosahedronGeometry(14, 1), std(0x2a120c)); head.position.set(34, 0, 16);
    const horn = new THREE.Mesh(new THREE.ConeGeometry(6, 30, 6), std(0xeee3c0)); horn.rotation.z = -Math.PI / 2; horn.position.set(52, 0, 24);
    for (const s of [-1, 1]) for (const k of [-1, 0, 1]) { const leg = new THREE.Mesh(new THREE.CylinderGeometry(2.2, 2.2, 26, 4), std(0x1a0a08)); leg.rotation.x = Math.PI / 2 + s * 0.9; leg.position.set(k * 14, s * 26, 8); this.root.add(leg); }
    this.root.add(shell, head, horn);
    this.finish();
  }
  ai(dt) {
    const g = this.g, P = g.player, T = this.T; this.st += dt;
    const d = Math.hypot(P.x - this.x, P.y - this.y), a = Math.atan2(P.y - this.y, P.x - this.x);
    if (this.state === 'move') {
      this.moveToward(P.x, P.y, this.speed, dt); this.cd -= dt;
      if (this.cd <= 0 && d < 520) { this.state = 'wind'; this.st = 0; this.ca = a; this.tele = g.fx.telegraph(this.x, this.y, { rect: [560, this.r * 2.2], yaw: a }, T.windup * g.diff.windup); g.audio('charge', { vol: 0.6 }); }
    } else if (this.state === 'wind') {
      this.yaw = this.ca;
      if (this.st > T.windup * g.diff.windup) { this.state = 'charge'; this.st = 0; this.hitDone = false; }
    } else if (this.state === 'charge') {
      const s = T.charge * dt; const ox = this.x, oy = this.y;
      this.hitWall = false;
      this.x += Math.cos(this.ca) * s; this.y += Math.sin(this.ca) * s; g.resolve(this);
      if (!this.hitDone && Math.hypot(P.x - this.x, P.y - this.y) < this.r + P.r + 10) { this.hitDone = true; g.hurtPlayer(T.dmg * g.diff.dmg, this, { knock: [Math.cos(this.ca), Math.sin(this.ca)] }); }
      if (Math.random() < 0.6) g.fx.burst(ox, oy, 4, 0x9a8a6a, 1, 80, 0.4, 5);
      if (this.hitWall || this.st > T.chargeT) {
        if (this.hitWall) { this.state = 'stun'; this.st = 0; g.fx.addShake(6); g.audio('stomp', { vol: 0.5 }); g.fx.ring(this.x, this.y, 0xffffff, 10, 90, 0.3); } else { this.state = 'move'; this.cd = 1.6 + Math.random(); }
      }
    } else if (this.state === 'stun') {
      if (this.st > 1.1) { this.state = 'move'; this.cd = 1.2; }
    }
  }
}

export function makeMob(g, type, x, y, elite) {
  if (type === 'spitter') return new Spitter(g, x, y, elite);
  if (type === 'charger') return new Charger(g, x, y, elite);
  return new Bee(g, x, y, elite);
}
export { clamp };
