import * as THREE from 'three';
import { CFG } from '../config.js';
import { createPlayer } from '../components/Player.js';
import { angDiff, clamp } from '../core/Input.js';

// Tode: twin-stick movement with the course hop arc, 3-hit tongue lash, seed spit / trophy, dash, tea bomb.
export class Hero {
  constructor(g) {
    this.g = g;
    this.root = createPlayer();
    g.scene.add(this.root);
    const ud = this.root.userData; this.pivot = ud.pivot; this.body = ud.body;
    // tongue: a pink stretchy cylinder from the mouth
    this.tongue = new THREE.Mesh(new THREE.CylinderGeometry(3.2, 3.2, 1, 6).rotateZ(Math.PI / 2).translate(0.5, 0, 0), new THREE.MeshStandardMaterial({ color: 0xff6f91, emissive: 0x551122 }));
    this.tongue.visible = false; this.root.add(this.tongue);
    this.tip = new THREE.Mesh(new THREE.SphereGeometry(6, 8, 6), new THREE.MeshStandardMaterial({ color: 0xff8fab, emissive: 0x551122 })); this.tip.visible = false; this.root.add(this.tip);
    this.reset();
  }
  reset() {
    const P = CFG.PLAYER;
    this.x = 0; this.y = -CFG.ARENA * 0.55; this.z = 0; this.yaw = Math.PI / 2; this.r = P.radius;
    this.maxHp = P.hp; this.hp = P.hp; this.dead = false; this.iframes = 0; this.flashT = 0;
    this.vx = 0; this.vy = 0; this.moving = false; this.t = 0;
    this.dashT = 0; this.dashDir = 0; this.dash = CFG.DASH.charges; this.dashRecharge = 0;
    this.swing = null; this.combo = 0; this.comboT = 9; this.buffer = 0;
    this.castCd = 0; this.specialCd = 0; this.kx = 0; this.ky = 0;
    this.root.visible = true;
  }
  get mods() { return this.g.mods; }
  get maxDash() { return CFG.DASH.charges + this.mods.extraDash; }
  get castMax() { return CFG.BOMB.cd; }
  get specialMax() { const t = this.g.trophy; return t === 'sting' ? CFG.TROPHY.sting.cd : t === 'pound' ? CFG.TROPHY.pound.cd : CFG.SEED.cd; }
  get specialName() { const t = this.g.trophy; return t === 'sting' ? 'Royal Sting' : t === 'pound' ? 'Groundpound' : 'Seed Spit'; }

  place(x, y) { this.x = x; this.y = y; this.vx = this.vy = 0; this.sync(); }

  update(dt, I, aim) {
    const g = this.g, D = CFG.DASH;
    this.t += dt;
    this.iframes = Math.max(0, this.iframes - dt); this.flashT = Math.max(0, this.flashT - dt);
    this.castCd = Math.max(0, this.castCd - dt); this.specialCd = Math.max(0, this.specialCd - dt);
    this.comboT += dt; this.buffer = Math.max(0, this.buffer - dt);
    // dash charges recharge one at a time
    if (this.dash < this.maxDash) { this.dashRecharge += dt / (D.recharge * this.mods.dashRecharge); if (this.dashRecharge >= 1) { this.dash++; this.dashRecharge = 0; } } else this.dashRecharge = 0;

    // input → world direction (camera looks toward +Y, so W is +Y)
    let mx = (I.down('KeyD') || I.down('ArrowRight') ? 1 : 0) - (I.down('KeyA') || I.down('ArrowLeft') ? 1 : 0);
    let my = (I.down('KeyW') || I.down('ArrowUp') ? 1 : 0) - (I.down('KeyS') || I.down('ArrowDown') ? 1 : 0);
    const ml = Math.hypot(mx, my); if (ml) { mx /= ml; my /= ml; }
    this.moving = ml > 0;
    const aimA = Math.atan2(aim.y - this.y, aim.x - this.x);

    // actions
    if (I.mHit(0) || I.hit('KeyJ')) this.buffer = 0.25;
    if (this.buffer > 0 && this.dashT <= 0 && (!this.swing || this.swing.t > CFG.LASH.dur[this.swing.step] * 0.6)) this.startSwing(aimA);
    if ((I.mHit(2) || I.mDown(2) || I.hit('KeyK')) && this.specialCd <= 0 && this.dashT <= 0) { this.specialCd = this.specialMax; this.yaw = aimA; g.special(aimA); }
    if (I.hit('KeyQ') && this.castCd <= 0) { this.castCd = CFG.BOMB.cd; g.throwBomb(aim.x, aim.y); }
    if (I.hit('Space') && this.dash > 0 && this.dashT <= 0) {
      this.dash--; this.dashT = D.time; this.iframes = Math.max(this.iframes, D.iframes);
      this.dashDir = this.moving ? Math.atan2(my, mx) : this.yaw; this.swing = null;
      g.onDash('start', this);
    }

    // movement
    const P = CFG.PLAYER;
    let tvx = mx * P.speed, tvy = my * P.speed;
    if (this.swing) { tvx *= 0.35; tvy *= 0.35; }
    if (this.dashT > 0) {
      this.dashT -= dt; tvx = Math.cos(this.dashDir) * D.speed; tvy = Math.sin(this.dashDir) * D.speed; this.vx = tvx; this.vy = tvy;
      g.onDash('mid', this);
      if (this.dashT <= 0) g.onDash('end', this);
    } else { const k = 1 - Math.exp(-18 * dt); this.vx += (tvx - this.vx) * k; this.vy += (tvy - this.vy) * k; }
    this.x += (this.vx + this.kx) * dt; this.y += (this.vy + this.ky) * dt;
    this.kx *= Math.exp(-8 * dt); this.ky *= Math.exp(-8 * dt);
    g.resolve(this);
    // face the aim while fighting, the walking direction otherwise
    const want = this.swing || g.input.mDown(0) || g.input.mDown(2) ? aimA : this.moving ? Math.atan2(my, mx) : this.yaw;
    if (this.dashT <= 0) this.yaw += angDiff(this.yaw, want) * Math.min(1, dt * 22);
    this.updateSwing(dt);
    this.sync();
  }

  startSwing(aimA) {
    this.combo = this.comboT < CFG.LASH.combo ? (this.combo + 1) % 3 : 0;
    this.swing = { step: this.combo, t: 0, hit: false, yaw: aimA };
    this.yaw = aimA; this.comboT = 0; this.buffer = 0;
    this.g.audio(this.combo === 2 ? 'swing3' : 'swing');
  }
  updateSwing(dt) {
    const s = this.swing; if (!s) { this.tongue.visible = this.tip.visible = false; return; }
    const L = CFG.LASH, dur = L.dur[s.step];
    s.t += dt;
    if (!s.hit && s.t >= dur * L.hitAt) { s.hit = true; this.g.lash(s.step, s.yaw); }
    // tongue whips out and back
    const k = s.t / dur, ext = Math.sin(Math.min(1, k) * Math.PI);
    const range = L.range[s.step] * this.mods.rangeMult * ext;
    const sweep = (s.step === 1 ? -1 : 1) * (k - 0.5) * L.arc[s.step] * 1.2;
    const a = s.yaw + (s.step === 2 ? 0 : sweep) - this.yaw;
    this.tongue.visible = this.tip.visible = range > 4;
    this.tongue.position.set(Math.cos(this.yaw) * 14, Math.sin(this.yaw) * 14, 26);
    this.tongue.rotation.set(0, 0, this.yaw + a); this.tongue.scale.set(Math.max(1, range), 1, 1);
    this.tip.position.set(this.tongue.position.x + Math.cos(this.yaw + a) * range, this.tongue.position.y + Math.sin(this.yaw + a) * range, 26);
    if (s.t >= dur) { this.swing = null; this.comboT = 0; }
  }
  sync() {
    const P = CFG.PLAYER;
    // course hop: |sin| arc while moving, squash on landing
    const hop = this.moving && this.dashT <= 0 ? Math.abs(Math.sin(this.t * P.hopFreq)) : 0;
    this.root.position.set(this.x, this.y, this.z);
    this.body.position.z = hop * P.hopH;
    const sq = this.dashT > 0 ? 0.7 : 1 - (1 - hop) * (this.moving ? 0.12 : 0) + Math.sin(this.t * 3) * 0.015;
    this.body.scale.set(this.dashT > 0 ? 1.35 : 1 / Math.sqrt(sq), 1 / Math.sqrt(sq), sq);
    this.pivot.rotation.z = this.yaw - CFG.FACING;
    const blink = this.iframes > 0 && this.dashT <= 0 && Math.floor(this.t * 20) % 2 === 0;
    this.body.visible = !blink;
    this.body.traverse((o) => { if (o.isMesh && o.material.emissive) o.material.emissive.setHex(this.flashT > 0 ? 0xff2222 : 0x000000); });
  }
}
export { clamp };
