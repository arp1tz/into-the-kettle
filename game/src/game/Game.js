import * as THREE from 'three';
import { CFG } from '../config.js';
import { createRenderer } from '../components/Renderer.js';
import { createCamera, CAMERA_OFFSET } from '../components/Camera.js';
import { createMap } from '../components/Map.js';
import { createHouses, resolveObstacles } from '../components/House.js';
import { cornerSpawns } from '../components/Enemy.js';
import { loadModels } from '../components/Assets.js';
import { Input, rng, clamp, angDiff } from '../core/Input.js';
import { Audio } from '../core/Audio.js';
import { Fx } from '../fx/Fx.js';
import { Post } from '../fx/Post.js';
import { Hero } from '../entities/Hero.js';
import { makeMob } from '../entities/Mobs.js';
import { QueenArmabee, WalkingHouse, KettleTyrant } from '../entities/Bosses.js';
import { BOONS, DUOS, SPIRITS, freshMods, rollChoices } from './Boons.js';
import { Ui } from '../ui/Ui.js';
import { RoomEnvironment } from 'three/addons/environments/RoomEnvironment.js';

const REWARDS = {
  boon: { label: 'BLESSING', color: 0xe48bff },
  heal: { label: 'HEAL +30', color: 0x6dff8a },
  vigor: { label: 'VIGOR +20 MAX HP', color: 0xff5a6a },
  sharpen: { label: 'SHARPEN +15% DMG', color: 0xffcf5a },
};

export class Game {
  constructor() {
    this.renderer = createRenderer();
    this.scene = new THREE.Scene();
    this.camera = createCamera();
    // course lighting: ambient 1.5 + directional sun; extended with a hemisphere fill and shadows that follow the player
    this.ambient = new THREE.AmbientLight(0xffffff, 1.5); this.scene.add(this.ambient);
    this.hemi = new THREE.HemisphereLight(0xffffff, 0x334422, 0.6); this.scene.add(this.hemi);
    this.sun = new THREE.DirectionalLight(0xffffff, 1.5); this.sun.position.set(-100, -100, 200);
    this.sun.castShadow = true; this.sun.shadow.mapSize.set(2048, 2048);
    const sc = this.sun.shadow.camera; sc.left = -900; sc.right = 900; sc.top = 900; sc.bottom = -900; sc.near = 10; sc.far = 3000; this.sun.shadow.bias = -0.0008;
    this.scene.add(this.sun, this.sun.target);
    // soft studio reflections so the copper kettle, crowns and shells read as metal
    const pmrem = new THREE.PMREMGenerator(this.renderer);
    this.scene.environment = pmrem.fromScene(new RoomEnvironment(), 0.04).texture; this.scene.environmentIntensity = 0.12;
    this.fx = new Fx(this.scene);
    this.post = new Post(this.renderer, this.scene, this.camera);
    this.post.bloom.threshold = 0.93; this.post.bloom.strength = 0.42;
    this.input = new Input(this.renderer.domElement);
    this.ui = new Ui(document.getElementById('ui'), this);
    this.raycaster = new THREE.Raycaster(); this.ground = new THREE.Plane(new THREE.Vector3(0, 0, 1), -20);
    this.aim = { x: 0, y: 0 };
    this.room = null; this.boss = null; this.doors = []; this.mobs = []; this.shots = []; this.hazards = []; this.waves = []; this.timers = []; this.waveQueue = [];
    this.roomGroup = new THREE.Group(); this.scene.add(this.roomGroup);
    this.obstacles = []; this.mods = freshMods(); this.boons = []; this.bitter = { chai: 0, matcha: 0, jasmine: 0, mint: 0 };
    this.trophy = null; this.score = 0; this.t = 0; this.hitstopT = 0; this.state = 'LOADING'; this.boilT = 0;
    this.stats = this.freshStats();
    this.diff = { hp: 1, speed: 1, dmg: 1, windup: 1, bossHp: 1 };
    this.clock = new THREE.Clock();
    const wake = () => { Audio.init(); this.syncMusic(true); };
    window.addEventListener('pointerdown', wake); window.addEventListener('keydown', wake);
    window.addEventListener('resize', () => { this.camera.aspect = window.innerWidth / window.innerHeight; this.camera.updateProjectionMatrix(); this.renderer.setSize(window.innerWidth, window.innerHeight); });
  }
  freshStats() { return { kills: 0, rooms: 0, time: 0, damageDealt: 0, damageTaken: 0, boonsTaken: 0, boonsRefused: 0, score: 0 }; }
  audio(name, o) { Audio.play(name, o); }

  async start() {
    await loadModels();
    this.player = new Hero(this);
    this.buildRoom(1, 'title');
    this.toTitle();
    this.renderer.setAnimationLoop(() => this.frame());
  }
  frame() { const dt = Math.min(0.05, this.clock.getDelta()); this.step(dt); this.render(); }
  render() { this.post.render(this.lastDt || 1 / 60, this.flashK || 0); }

  // ------------------------------------------------------------------ flow
  toTitle() {
    this.state = 'TITLE'; this.clearRoom(); this.buildRoom(1, 'title'); this.player.place(0, 0); this.player.root.visible = true;
    this.ui.showHud(false); this.ui.hideScreens(); this.ui.showTitle(); this.syncMusic();
  }
  quitToTitle() { this.toTitle(); }
  newRun() {
    this.mods = freshMods(); this.boons = []; this.bitter = { chai: 0, matcha: 0, jasmine: 0, mint: 0 }; this.trophy = null;
    this.score = 0; this.stats = this.freshStats(); this.routeI = 0; this.boilT = 0;
    this.player.reset(); this.rnd = rng((Math.random() * 1e9) | 0);
    this.ui.hideScreens(); this.ui.showHud(true);
    this.loadRoom(0);
  }
  resume() { if (this.state === 'PAUSE') { this.state = this.prevState || 'PLAY'; this.ui.hideScreens(); } }
  pause() { if (this.state === 'PLAY') { this.prevState = 'PLAY'; this.state = 'PAUSE'; this.ui.showPause(); } }

  zoneOf(i) { return i < 4 ? 1 : i < 8 ? 2 : 3; }
  loadRoom(i) {
    const kind = CFG.ROUTE[i], zone = this.zoneOf(i), Z = CFG.ZONES[zone];
    this.clearRoom();
    // course "increasing complexity", driven by depth instead of score
    const k = i * CFG.COMPLEXITY_GROWTH;
    this.diff = { hp: 1 + k, speed: 1 + k * 0.35, dmg: 1 + k * 0.5, windup: Math.max(0.72, 1 - k * 0.3), bossHp: 1 };
    this.buildRoom(zone, kind);
    this.room = { zone, zoneName: Z.name, index: i + 1, total: CFG.ROUTE.length, kind: kind === 'c' ? 'combat' : kind === 'K' ? 'final' : 'boss', cleared: false, enemiesLeft: 0 };
    this.player.place(0, -CFG.ARENA * 0.62); this.player.yaw = Math.PI / 2; this.player.iframes = 1;
    this.camPos = null; this.state = 'PLAY';
    const first = i === 0 || this.zoneOf(i - 1) !== zone;
    if (kind === 'c') {
      this.planWaves(i);
      this.ui.banner(first ? Z.name : `ROOM ${i + 1}`, first ? `Zone ${zone} of 3` : 'Clear the room', first ? '#ffcf5a' : '#f3e3c3');
    } else {
      const B = kind === 'Q' ? QueenArmabee : kind === 'H' ? WalkingHouse : KettleTyrant;
      this.later(0.9, () => {
        const b = kind === 'K' ? new B(this, 0, CFG.ARENA * 0.35, { ...this.bitter }) : new B(this, 0, CFG.ARENA * 0.3);
        this.mobs.push(b); this.boss = b; this.audio('bossRoar'); this.fx.addShake(14);
        this.ui.banner(b.name, b.title, kind === 'K' ? '#ff4d4d' : '#ffcf5a');
        if (kind === 'K') { const n = Object.values(this.bitter).reduce((a, b2) => a + b2, 0); if (n) this.later(2.4, () => this.ui.toast(`It steeped ${n} refused blessing${n > 1 ? 's' : ''} into its brew...`, '#ff8a3d')); }
      });
      if (first) this.ui.toast(Z.name, '#ffcf5a');
    }
    this.syncMusic();
  }
  nextRoom() {
    this.stats.rooms++;
    this.routeI++;
    if (this.routeI >= CFG.ROUTE.length) return this.win();
    this.fx.clear();
    this.loadRoom(this.routeI);
  }
  win() { this.state = 'WIN'; this.audio('win'); this.finishStats(); this.ui.showHud(false); this.ui.showEnd(true, this.stats); this.syncMusic(); }
  lose() { this.state = 'DEAD'; this.audio('lose'); this.finishStats(); this.later(1.6, () => { this.ui.showHud(false); this.ui.showEnd(false, this.stats); }); this.syncMusic(); }
  finishStats() { this.stats.score = Math.floor(this.score); this.stats.time = Math.round(this.stats.time); }
  syncMusic() {
    const s = this.state, kind = this.room && this.room.kind;
    Audio.music(s === 'TITLE' ? 'title' : s === 'WIN' || s === 'DEAD' ? 'none' : kind === 'final' ? 'final' : kind === 'boss' ? 'boss' : 'combat');
  }

  // ------------------------------------------------------------------ room building
  clearRoom() {
    for (const m of this.mobs) m.remove(); this.mobs = []; this.boss = null;
    for (const s of this.shots) this.scene.remove(s.mesh); this.shots = [];
    for (const h of this.hazards) this.scene.remove(h.mesh); this.hazards = [];
    this.doors = []; this.timers = []; this.waveQueue = [];
    this.scene.remove(this.roomGroup);
    this.roomGroup.traverse((o) => { if (o.geometry && o.userData.own !== false) o.geometry.dispose(); });
    this.roomGroup = new THREE.Group(); this.scene.add(this.roomGroup);
    this.obstacles = [];
  }
  buildRoom(zone, kind) {
    const Z = CFG.ZONES[zone], A = CFG.ARENA, r = rng(zone * 1000 + (this.routeI || 0) * 17 + 3);
    this.roomGroup.add(createMap(A, Z.c1, Z.c2));
    this.scene.background = new THREE.Color(Z.sky); this.scene.fog = new THREE.Fog(Z.fog, 900, 2600);
    this.ambient.intensity = Z.amb; this.sun.color.setHex(Z.sun); this.sun.intensity = Z.sunI;
    this.hemi.color.setHex(Z.sky); this.hemi.groundColor.setHex(zone === 3 ? 0x441100 : 0x223311);
    // course houses as obstacles (combat rooms only, kept away from the entry and the doors)
    if (kind === 'c' || kind === 'title') {
      const { group, obstacles } = createHouses(kind === 'title' ? 3 : Z.houses, A, r, [[0, -A * 0.62, 260], [0, A * 0.75, 320], [0, 0, 160]]);
      this.roomGroup.add(group); this.obstacles.push(...obstacles);
    }
    this.decor(zone, r);
  }
  decor(zone, r) {
    const A = CFG.ARENA, g = this.roomGroup;
    // a low wall of stones / hedges around the room
    const wallMat = new THREE.MeshStandardMaterial({ color: zone === 1 ? 0x2f6b2a : zone === 2 ? 0x3a3048 : 0x3a1a10, roughness: 0.9, flatShading: true });
    const n = 64, wallGeo = new THREE.DodecahedronGeometry(1, 0);
    const wall = new THREE.InstancedMesh(wallGeo, wallMat, n * 4); const o = new THREE.Object3D(); let c = 0;
    for (let s = 0; s < 4; s++) for (let i = 0; i < n; i++) {
      const t = -A + (i / (n - 1)) * A * 2, x = s < 2 ? t : (s === 2 ? -A - 30 : A + 30), y = s < 2 ? (s === 0 ? -A - 30 : A + 30) : t;
      o.position.set(x + (r() - 0.5) * 20, y + (r() - 0.5) * 20, 10); o.scale.set(30 + r() * 25, 30 + r() * 25, 30 + r() * 40); o.rotation.set(r() * 3, r() * 3, r() * 3); o.updateMatrix(); wall.setMatrixAt(c++, o.matrix);
    }
    wall.castShadow = true; wall.receiveShadow = true; g.add(wall);
    if (zone === 1) {
      // flowers and grass tufts
      const fl = new THREE.InstancedMesh(new THREE.IcosahedronGeometry(5, 0), new THREE.MeshStandardMaterial({ color: 0xffffff, flatShading: true }), 220);
      const cols = [0xff6f91, 0xffd23f, 0xb48cff, 0xffffff];
      for (let i = 0; i < 220; i++) { o.position.set((r() * 2 - 1) * (A - 30), (r() * 2 - 1) * (A - 30), 6); o.scale.setScalar(0.6 + r()); o.rotation.set(0, 0, 0); o.updateMatrix(); fl.setMatrixAt(i, o.matrix); fl.setColorAt(i, new THREE.Color(cols[i % 4])); }
      g.add(fl);
      const gr = new THREE.InstancedMesh(new THREE.ConeGeometry(3, 18, 4).rotateX(Math.PI / 2).translate(0, 0, 9), new THREE.MeshStandardMaterial({ color: 0x2f8a2f, flatShading: true }), 500);
      for (let i = 0; i < 500; i++) { o.position.set((r() * 2 - 1) * (A - 20), (r() * 2 - 1) * (A - 20), 0); o.scale.setScalar(0.6 + r() * 0.9); o.rotation.set(r() * 0.3, r() * 0.3, r() * 6); o.updateMatrix(); gr.setMatrixAt(i, o.matrix); }
      g.add(gr);
    } else if (zone === 2) {
      // paper lanterns on posts: warm points of light at dusk
      for (let i = 0; i < 8; i++) {
        const a = (i / 8) * Math.PI * 2 + 0.3, x = Math.cos(a) * (A - 80), y = Math.sin(a) * (A - 80);
        const post = new THREE.Mesh(new THREE.CylinderGeometry(3, 4, 90, 6).rotateX(Math.PI / 2).translate(0, 0, 45), new THREE.MeshStandardMaterial({ color: 0x2a1a10 }));
        const lan = new THREE.Mesh(new THREE.SphereGeometry(13, 10, 8), new THREE.MeshBasicMaterial({ color: 0xffb35a })); lan.position.z = 96; lan.scale.z = 1.3;
        post.position.set(x, y, 0); post.add(lan); post.castShadow = true; g.add(post);
        if (i % 2 === 0) { const l = new THREE.PointLight(0xff9a4a, 160, 420, 1.4); l.position.set(x, y, 110); g.add(l); }
      }
    } else if (zone === 3) {
      // glowing cracks of boiling tea and rising embers
      const cr = new THREE.InstancedMesh(new THREE.PlaneGeometry(1, 1), new THREE.MeshBasicMaterial({ color: 0xff6a1a }), 60);
      for (let i = 0; i < 60; i++) { o.position.set((r() * 2 - 1) * (A - 40), (r() * 2 - 1) * (A - 40), 1); o.scale.set(20 + r() * 80, 4 + r() * 6, 1); o.rotation.set(0, 0, r() * 6); o.updateMatrix(); cr.setMatrixAt(i, o.matrix); }
      g.add(cr);
      for (let i = 0; i < 4; i++) { const a = (i / 4) * Math.PI * 2 + Math.PI / 4, l = new THREE.PointLight(0xff5a1a, 220, 600, 1.4); l.position.set(Math.cos(a) * 450, Math.sin(a) * 450, 80); g.add(l); }
    }
  }

  // ------------------------------------------------------------------ waves (course: spawn at the four corners on a timer)
  planWaves(i) {
    const W = CFG.WAVES, total = Math.round(W.base + W.perRoom * i), types = ['bee'];
    if (i >= 1) types.push('spitter'); if (i >= 2) types.push('charger', 'bee'); if (i >= 4) types.push('spitter', 'charger');
    const list = [];
    for (let k = 0; k < total; k++) list.push({ type: types[Math.floor(this.rnd() * types.length)], elite: this.rnd() < CFG.ELITE.chance * (1 + i * 0.15) });
    const per = Math.ceil(list.length / W.waves);
    for (let w = 0; w < W.waves; w++) this.waveQueue.push(list.slice(w * per, (w + 1) * per));
    this.waveT = 0.9; this.room && (this.room.enemiesLeft = list.length);
    this.pendingSpawns = list.length;
  }
  spawnWave(list) {
    const corners = cornerSpawns(CFG.ARENA);
    list.forEach((s, j) => {
      const c = corners[j % 4], x = c[0] + (this.rnd() - 0.5) * 160, y = c[1] + (this.rnd() - 0.5) * 160;
      this.spawnMob(s.type, x, y, s.elite, CFG.WAVES.spawnWarn + j * 0.05);
    });
    this.audio('spawn');
  }
  spawnMob(type, x, y, elite = false, warn = 0.6) {
    x = clamp(x, -CFG.ARENA + 60, CFG.ARENA - 60); y = clamp(y, -CFG.ARENA + 60, CFG.ARENA - 60);
    this.fx.telegraph(x, y, { circle: 45 }, warn, elite ? 0xffcf5a : 0xb06aff, () => {
      if (this.state === 'TITLE') return;
      const m = makeMob(this, type, x, y, elite); this.mobs.push(m);
      this.fx.ring(x, y, elite ? 0xffcf5a : 0xc89bff, 10, 80, 0.35); this.fx.burst(x, y, 20, 0xc89bff, 8, 200, 0.4, 5);
      if (this.pendingSpawns) this.pendingSpawns--;
    });
  }

  // ------------------------------------------------------------------ doors and rewards (Hades: choose the next room's reward)
  openDoors() {
    const isBoss = this.room.kind !== 'combat';
    const pool = isBoss ? ['heal', 'boon'] : ['boon', 'boon', 'heal', 'vigor', 'sharpen', 'boon'];
    const a = pool[Math.floor(this.rnd() * pool.length)]; let b = pool[Math.floor(this.rnd() * pool.length)];
    if (b === a && a !== 'boon') b = 'boon';
    const A = CFG.ARENA;
    [[-190, a], [190, b]].forEach(([x, reward]) => {
      const y = A - 70, grp = new THREE.Group(); grp.position.set(x, y, 0);
      const stone = new THREE.MeshStandardMaterial({ color: 0x8a7a66, roughness: 0.9, flatShading: true });
      for (const s of [-1, 1]) { const p = new THREE.Mesh(new THREE.BoxGeometry(22, 22, 150), stone); p.position.set(s * 55, 0, 75); p.castShadow = true; grp.add(p); }
      const top = new THREE.Mesh(new THREE.BoxGeometry(150, 26, 24), stone); top.position.z = 160; top.castShadow = true; grp.add(top);
      const col = REWARDS[reward].color;
      const portal = new THREE.Mesh(new THREE.PlaneGeometry(88, 140), new THREE.MeshBasicMaterial({ color: col, transparent: true, opacity: 0.75, side: THREE.DoubleSide })); portal.rotation.x = Math.PI / 2; portal.position.z = 75; grp.add(portal);
      const orb = new THREE.Mesh(new THREE.IcosahedronGeometry(16, 1), new THREE.MeshBasicMaterial({ color: col })); orb.position.z = 200; grp.add(orb);
      const light = new THREE.PointLight(col, 220, 380, 1.5); light.position.set(0, -40, 90); grp.add(light);
      this.roomGroup.add(grp);
      this.doors.push({ x, y, z: 160, reward, label: REWARDS[reward].label, open: true, grp, orb, portal });
    });
    this.audio('door');
  }
  takeDoor(d) {
    this.doors.forEach((x) => { x.open = false; });
    this.audio('pickup');
    const P = this.player;
    if (d.reward === 'heal') { P.hp = Math.min(P.maxHp, P.hp + 30); this.ui.dmg(P.x, P.y, 60, 30, 'heal'); this.audio('heal'); }
    if (d.reward === 'vigor') { P.maxHp += 20; P.hp += 20; this.audio('heal'); }
    if (d.reward === 'sharpen') { this.mods.dmgMult *= 1.15; }
    if (d.reward === 'boon') {
      this.choices = rollChoices(this.boons, this.rnd);
      this.state = 'CHOICE'; this.ui.showBoons(this.choices.map(({ key, label, desc, spirit, slot, rarity }) => ({ key, label, desc, spirit, slot, rarity })));
      this.audio('boon');
      return;
    }
    this.transition();
  }
  pickBoon(key) {
    if (this.state !== 'CHOICE') return;
    const b = this.choices.find((c) => c.key === key) || this.choices[0];
    this.grantBoon(b);
    // r/gameideas: the boss gets every stat you didn't pick → refused blessings steep into the Kettle Tyrant
    for (const c of this.choices) if (c !== b && this.bitter[c.spirit] != null) { this.bitter[c.spirit]++; this.stats.boonsRefused++; }
    this.ui.hideScreens(); this.state = 'PLAY';
    this.transition();
  }
  grantBoon(b) {
    const def = [...BOONS, ...DUOS].find((x) => x.key === b.key) || b;
    if (def.apply) def.apply(this.mods);
    this.boons.push({ key: def.key, label: def.label, desc: def.desc, spirit: def.spirit, slot: def.slot });
    this.stats.boonsTaken++;
    this.player.dash = Math.min(this.player.maxDash, this.player.dash + (this.mods.extraDash ? 1 : 0));
    const col = '#' + (SPIRITS[def.spirit] ? SPIRITS[def.spirit].color : 0xffffff).toString(16).padStart(6, '0');
    this.ui.toast(`${def.label}: ${def.desc}`, col);
    this.fx.ring(this.player.x, this.player.y, SPIRITS[def.spirit] ? SPIRITS[def.spirit].color : 0xffffff, 10, 200, 0.5);
  }
  transition() {
    this.state = 'PLAY';
    this.ui.flash(0.6);
    this.later(0.25, () => this.nextRoom());
    this.transitioning = true;
  }

  // ------------------------------------------------------------------ combat API (used by Hero, Mobs and Bosses)
  resolve(e) {
    resolveObstacles(e, this.obstacles);
    const A = CFG.ARENA - (e.r || 20);
    if (e.x < -A || e.x > A || e.y < -A || e.y > A) e.hitWall = true;
    e.x = clamp(e.x, -A, A); e.y = clamp(e.y, -A, A);
  }
  later(delay, fn) { this.timers.push({ t: delay, fn }); }
  targets() { return this.mobs.filter((m) => !m.dead); }
  lash(step, yaw) {
    const L = CFG.LASH, P = this.player, m = this.mods;
    const range = L.range[step] * m.rangeMult, half = L.arc[step] / 2 + 0.35;
    this.fx.slash(P.x, P.y, yaw, range + 20, half, step === 2 ? 0xffe0a0 : 0xffffff);
    let hits = 0;
    for (const t of this.targets()) {
      const d = Math.hypot(t.x - P.x, t.y - P.y);
      if (d - t.r > range) continue;
      if (d > t.r + 25 && Math.abs(angDiff(yaw, Math.atan2(t.y - P.y, t.x - P.x))) > half) continue;
      this.hit(t, L.dmg[step], { knock: L.knock * m.knockMult * (step === 2 ? 1.8 : 1), ang: Math.atan2(t.y - P.y, t.x - P.x), lash: true });
      hits++;
    }
    if (step === 2 && m.stormLash) this.lightningWave(P.x, P.y, yaw);
    if (hits) { this.hitstopT = CFG.HITSTOP * (step === 2 ? 1.8 : 1); this.fx.addShake(step === 2 ? 9 : 4); }
  }
  // damage dealt to mobs / bosses; applies blessing on-hit effects
  hit(t, dmg, o = {}) {
    if (t.dead) return;
    const m = this.mods;
    let crit = false;
    if (!o.noMult) dmg *= m.dmgMult;
    if (!o.silent && Math.random() < 0.1) { dmg *= 2; crit = true; }
    if (m.steamBurst && o.fire && t.slowT > 0) { dmg += 20; this.fx.burst(t.x, t.y, 40, 0xffffff, 10, 240, 0.6, 12, -200); }
    t.hp -= dmg; t.flashT = 0.1; this.stats.damageDealt += dmg;
    this.ui.dmg(t.x, t.y, (t.z || 0) + 70, Math.round(dmg), o.kind || (crit ? 'crit' : ''));
    if (!o.silent) { this.audio(crit ? 'crit' : 'hit'); this.fx.burst(t.x, t.y, 30, crit ? 0xffcf5a : 0xffffff, crit ? 10 : 5, 260, 0.3, 5); }
    if (o.knock && !t.isBoss) { t.kx += Math.cos(o.ang) * o.knock * 6; t.ky += Math.sin(o.ang) * o.knock * 6; }
    if (!o.noStatus && o.lash) {
      if (m.burnOnHit) { t.burnT = 3; if (m.steamBurst && t.slowT > 0) this.hit(t, 20, { kind: 'burn', silent: true, noStatus: true }); }
      if (m.slowOnHit) t.slowT = 2;
      if (m.chainOnHit) this.chain(t, m.chainOnHit, 9);
    }
    if (t.hp <= 0) this.kill(t);
  }
  chain(from, n, dmg) {
    let cur = from; const hitSet = new Set([from]);
    for (let i = 0; i < n; i++) {
      let best = null, bd = 260;
      for (const m of this.targets()) { if (hitSet.has(m)) continue; const d = Math.hypot(m.x - cur.x, m.y - cur.y); if (d < bd) { bd = d; best = m; } }
      if (!best) break;
      this.fx.zap(cur.x, cur.y, best.x, best.y, 0xb6ff5a, 34); hitSet.add(best);
      this.hit(best, dmg, { kind: 'crit', silent: true, noStatus: true }); cur = best;
    }
  }
  lightningWave(x, y, yaw) {
    for (let i = 1; i <= 5; i++) this.later(i * 0.05, () => { const px = x + Math.cos(yaw) * i * 70, py = y + Math.sin(yaw) * i * 70; this.fx.zap(px, py - 20, px, py + 20, 0xb6ff5a, 30); for (const t of this.targets()) if (Math.hypot(t.x - px, t.y - py) < t.r + 40) this.hit(t, 10, { silent: true, noStatus: true }); });
  }
  kill(t) {
    t.dead = true; t.remove();
    this.fx.burst(t.x, t.y, 30, t.isBoss ? 0xffcf5a : 0x9aff5a, t.isBoss ? 60 : 16, t.isBoss ? 600 : 340, 0.7, t.isBoss ? 12 : 6);
    this.fx.ring(t.x, t.y, 0xffffff, 10, t.isBoss ? 500 : 110, 0.35);
    this.audio('kill');
    if (t.isBoss) return this.bossDefeated(t);
    this.stats.kills++; this.score += CFG.SCORE_PER_KILL * (t.elite ? 2 : 1);
    if (t.elite && Math.random() < 0.6) this.healOrb(t.x, t.y);
  }
  healOrb(x, y) {
    const mesh = new THREE.Mesh(new THREE.IcosahedronGeometry(10, 1), new THREE.MeshBasicMaterial({ color: 0x6dff8a })); mesh.position.set(x, y, 20); this.scene.add(mesh);
    this.hazards.push({ x, y, r: 40, life: 12, t: 0, mesh, heal: 12 });
  }
  bossDefeated(b) {
    this.boss = null; this.fx.addShake(26); this.hitstopT = 0.25; this.ui.flash(0.9);
    this.ui.banner(b.name, b.isFinal ? 'has been defeated' : 'is defeated!', '#ffcf5a');
    for (const m of this.mobs) if (!m.dead) this.kill(m);
    if (b instanceof KettleTyrant) { this.later(2.2, () => this.win()); return; }
    // r/gameideas: take the defeated boss's signature move as your new special
    this.trophy = b instanceof QueenArmabee ? 'sting' : 'pound';
    const tro = b instanceof QueenArmabee ? { key: 'royalSting', label: 'Royal Sting', desc: 'Right-click: dash-stab through foes (trophy from the Queen).' } : { key: 'groundpound', label: 'Groundpound', desc: 'Right-click: leap and slam a shockwave (trophy from the House).' };
    this.boons.push({ ...tro, spirit: 'trophy', slot: 'special' });
    this.later(1.4, () => this.ui.toast(`Trophy claimed: ${tro.label}`, '#ffcf5a'));
    this.player.hp = Math.min(this.player.maxHp, this.player.hp + 25);
    this.room.cleared = true; this.later(1.8, () => this.openDoors());
  }
  hurtPlayer(dmg, src, o = {}) {
    const P = this.player;
    if (P.dead || P.iframes > 0 || P.dashT > 0 || this.state !== 'PLAY') return;
    dmg = Math.round(dmg);
    P.hp -= dmg; P.iframes = CFG.PLAYER.iframes; P.flashT = 0.2; this.stats.damageTaken += dmg;
    if (o.knock) { P.kx += o.knock[0] * 500; P.ky += o.knock[1] * 500; }
    this.ui.hurt(); this.post.pulseHurt(); this.fx.addShake(10); this.hitstopT = 0.06; this.audio('hurt');
    this.ui.dmg(P.x, P.y, 70, dmg, 'player');
    if (P.hp <= 0) { P.hp = 0; P.dead = true; P.root.visible = false; this.fx.burst(P.x, P.y, 30, 0x4caf50, 40, 420, 1, 8); this.lose(); }
  }
  circleHit(x, y, r, dmg, src) { const P = this.player; if (Math.hypot(P.x - x, P.y - y) < r + P.r * 0.5) this.hurtPlayer(dmg, src); }
  shockwave(x, y, maxR, speed, dmg, color = 0xffd0a0) {
    const mesh = new THREE.Mesh(new THREE.RingGeometry(0.9, 1, 64), new THREE.MeshBasicMaterial({ color, transparent: true, opacity: 0.9, side: THREE.DoubleSide, blending: THREE.AdditiveBlending, depthWrite: false }));
    mesh.position.set(x, y, 4); this.scene.add(mesh);
    this.hazards.push({ wave: true, x, y, R: 20, maxR, speed, dmg, mesh, hit: false, t: 0, life: maxR / speed });
  }
  hazard(h) {
    const mesh = new THREE.Mesh(new THREE.CircleGeometry(h.r, 32), new THREE.MeshBasicMaterial({ color: h.color, transparent: true, opacity: 0.5, blending: THREE.AdditiveBlending, depthWrite: false }));
    mesh.position.set(h.x, h.y, 2); this.scene.add(mesh);
    this.hazards.push({ ...h, mesh, t: 0, tick: 0 });
  }
  shoot(o) {
    const mesh = new THREE.Mesh(new THREE.SphereGeometry(o.r || 9, 10, 8), new THREE.MeshBasicMaterial({ color: o.color || 0xffffff }));
    mesh.position.set(o.x, o.y, o.z || 26); this.scene.add(mesh);
    this.shots.push({ ...o, vx: Math.cos(o.a) * o.speed, vy: Math.sin(o.a) * o.speed, mesh, life: o.life || 2.2, hitSet: new Set() });
  }
  special(a) {
    const P = this.player, m = this.mods;
    if (this.trophy === 'sting') {
      const T = CFG.TROPHY.sting; this.audio('sting');
      P.dashT = 0.18; P.dashDir = a; P.iframes = 0.3;
      this.fx.telegraph(P.x, P.y, { rect: [T.dist, 70], yaw: a }, 0.12, 0xffcf5a);
      for (const t of this.targets()) {
        const dx = t.x - P.x, dy = t.y - P.y, along = dx * Math.cos(a) + dy * Math.sin(a), perp = Math.abs(-dx * Math.sin(a) + dy * Math.cos(a));
        if (along > 0 && along < T.dist && perp < t.r + 40) this.hit(t, T.dmg, { knock: 60, ang: a, lash: true });
      }
      return;
    }
    if (this.trophy === 'pound') {
      const T = CFG.TROPHY.pound; P.vy = 0; P.iframes = 0.4;
      this.audio('stomp'); this.fx.addShake(14); this.fx.ring(P.x, P.y, 0xffd0a0, 20, T.radius, 0.4); this.fx.burst(P.x, P.y, 8, 0xb08a60, 20, 380, 0.5, 8);
      for (const t of this.targets()) if (Math.hypot(t.x - P.x, t.y - P.y) < T.radius + t.r) this.hit(t, T.dmg, { knock: 140, ang: Math.atan2(t.y - P.y, t.x - P.x), lash: true });
      this.hitstopT = 0.08; return;
    }
    const S = CFG.SEED, angles = m.seedSpread ? [a - 0.22, a, a + 0.22] : [a];
    for (const aa of angles) this.shoot({ x: P.x + Math.cos(aa) * 28, y: P.y + Math.sin(aa) * 28, a: aa, speed: S.speed, dmg: S.dmg, team: 'player', color: m.seedBlast ? 0xff7a2f : m.seedChain ? 0xb6ff5a : m.seedPierce ? 0x8fd8ff : 0xfff2b0, r: S.radius, pierce: m.seedPierce ? 3 : 0 });
    this.audio('spit');
  }
  throwBomb(tx, ty) {
    const P = this.player, B = CFG.BOMB, m = this.mods;
    const dx = tx - P.x, dy = ty - P.y, d = Math.hypot(dx, dy), k = d > B.maxRange ? B.maxRange / d : 1;
    const x = P.x + dx * k, y = P.y + dy * k, x0 = P.x, y0 = P.y;
    const mesh = new THREE.Mesh(new THREE.SphereGeometry(13, 12, 10), new THREE.MeshStandardMaterial({ color: 0xc87a3a, emissive: 0x552200 })); this.scene.add(mesh);
    this.fx.telegraph(x, y, { circle: B.radius }, B.flight, 0xffcf5a);
    this.audio('cast');
    let t = 0;
    const tick = { t: 0, fn: null };
    const fly = (dt) => { t += dt; const kk = Math.min(1, t / B.flight); mesh.position.set(x0 + (x - x0) * kk, y0 + (y - y0) * kk, 30 + Math.sin(kk * Math.PI) * 160); return kk >= 1; };
    this.flying = this.flying || []; this.flying.push({ fly, done: () => {
      this.scene.remove(mesh);
      if (m.castPull) for (const e of this.targets()) { const dd = Math.hypot(e.x - x, e.y - y); if (dd < B.radius * 2 && !e.isBoss) { e.x += (x - e.x) * 0.6; e.y += (y - e.y) * 0.6; this.resolve(e); } }
      this.fx.addShake(12); this.audio('boom'); this.hitstopT = 0.05;
      this.fx.ring(x, y, 0xffcf5a, 10, B.radius * 1.2, 0.4); this.fx.disc(x, y, 0xffe0a0, B.radius, 0.2, 2, 0.6);
      this.fx.burst(x, y, 20, m.castFire ? 0xff6a1a : m.castFreeze ? 0x8fd8ff : 0xffcf5a, 26, 480, 0.6, 8);
      for (const e of this.targets()) if (Math.hypot(e.x - x, e.y - y) < B.radius + e.r) {
        this.hit(e, B.dmg, { knock: 120, ang: Math.atan2(e.y - y, e.x - x), fire: m.castFire });
        if (m.castFreeze) e.frozenT = 2; if (m.castFire) e.burnT = 3;
      }
      if (m.castFire) this.hazard({ x, y, r: B.radius * 0.8, dps: 12, life: 4, color: 0xff5a1a, team: 'player' });
      if (m.castStorm) for (let i = 0; i < 3; i++) this.later(0.2 + i * 0.22, () => { const ts = this.targets(); if (!ts.length) return; const e = ts[Math.floor(Math.random() * ts.length)]; this.fx.zap(e.x, e.y - 5, e.x, e.y + 5, 0xd6ff8a, 320); this.fx.ring(e.x, e.y, 0xb6ff5a, 10, 90, 0.3); this.hit(e, 22, { kind: 'crit', silent: true }); this.audio('crit', { pitch: 0.7 }); });
    } });
    void tick;
  }
  onDash(phase, P) {
    const m = this.mods;
    if (phase === 'start') {
      this.audio('dash'); this.fx.burst(P.x, P.y, 10, 0xffffff, 6, 160, 0.3, 4);
      if (m.dashFrost) for (const t of this.targets()) if (Math.hypot(t.x - P.x, t.y - P.y) < 170) { t.slowT = 2.5; this.fx.burst(t.x, t.y, 20, 0x8fd8ff, 4, 120, 0.4, 4); }
      if (m.blizzard) for (let i = 0; i < 8; i++) this.shoot({ x: P.x, y: P.y, a: (i / 8) * Math.PI * 2, speed: 700, dmg: 8, team: 'player', color: 0x8fd8ff, r: 8, pierce: 1, slowHit: true, life: 0.6 });
      this.lastFire = { x: P.x, y: P.y };
    } else if (phase === 'mid') {
      if (Math.random() < 0.7) this.fx.disc(P.x, P.y, 0xffffff, 18, 0.2, 3, 0.25);
      if (m.dashFire && Math.hypot(P.x - this.lastFire.x, P.y - this.lastFire.y) > 50) { this.lastFire = { x: P.x, y: P.y }; this.hazard({ x: P.x, y: P.y, r: 45, dps: 14, life: 2.5, color: 0xff6a1a, team: 'player' }); }
    } else if (phase === 'end' && m.dashZap) {
      const ts = this.targets().filter((t) => Math.hypot(t.x - P.x, t.y - P.y) < 230).slice(0, 3);
      for (const t of ts) { this.fx.zap(P.x, P.y, t.x, t.y, 0xb6ff5a, 30); this.hit(t, 16, { kind: 'crit', silent: true }); }
      if (ts.length) this.audio('crit', { pitch: 0.8 });
    }
  }

  // ------------------------------------------------------------------ main loop
  project(x, y, z) {
    const v = new THREE.Vector3(x, y, z).project(this.camera);
    return { x: (v.x * 0.5 + 0.5) * window.innerWidth, y: (-v.y * 0.5 + 0.5) * window.innerHeight, visible: v.z < 1 && Math.abs(v.x) < 1.1 && Math.abs(v.y) < 1.1 };
  }
  updateAim() {
    const I = this.input, nd = new THREE.Vector2((I.mx / window.innerWidth) * 2 - 1, -(I.my / window.innerHeight) * 2 + 1);
    this.raycaster.setFromCamera(nd, this.camera);
    const p = new THREE.Vector3();
    if (this.raycaster.ray.intersectPlane(this.ground, p)) { this.aim.x = p.x; this.aim.y = p.y; }
  }
  step(dt) {
    this.t += dt; this.lastDt = dt;
    const I = this.input;
    if (I.hit('KeyM')) Audio.toggleMute();
    if ((I.hit('Escape') || I.hit('KeyP')) && this.state === 'PLAY') this.pause();
    let gdt = dt;
    if (this.hitstopT > 0) { this.hitstopT -= dt; gdt = dt * 0.05; }
    this.flashK = Math.max(0, (this.flashK || 0) - dt * 4);
    if (this.state === 'PLAY' || this.state === 'DEAD') this.play(gdt, dt);
    else if (this.state === 'TITLE') { this.titleCam(dt); this.fx.update(dt); }
    else if (this.state === 'WIN') { this.titleCam(dt); this.fx.update(dt); }
    this.ui.update(dt);
    I.endFrame();
  }
  titleCam(dt) {
    this.orbit = (this.orbit || 0) + dt * 0.12;
    const P = this.player; P.t += dt; P.moving = false; P.sync();
    this.camera.position.set(Math.cos(this.orbit) * 360, Math.sin(this.orbit) * 360 - 120, 200);
    this.camera.lookAt(0, 0, 40);
    this.sun.position.set(-300, -300, 700); this.sun.target.position.set(0, 0, 0);
  }
  play(dt, raw) {
    const P = this.player;
    if (this.state === 'PLAY') { this.stats.time += dt; this.score += CFG.SCORE_PER_SECOND * dt; }
    this.updateAim();
    for (let i = this.timers.length - 1; i >= 0; i--) { const tm = this.timers[i]; tm.t -= dt; if (tm.t <= 0) { this.timers.splice(i, 1); tm.fn(); } }
    if (this.flying) for (let i = this.flying.length - 1; i >= 0; i--) if (this.flying[i].fly(dt)) { const f = this.flying.splice(i, 1)[0]; f.done(); }
    if (!P.dead && this.state === 'PLAY') P.update(dt, this.input, this.aim);
    if (this.room && this.room.kind === 'final' && this.boss) { const was = this.boilT; this.boilT += dt; if (was < CFG.KETTLE_BOIL && this.boilT >= CFG.KETTLE_BOIL) { this.ui.banner('THE KETTLE BOILS', 'It is enraged!', '#ff4d4d'); this.audio('enrage'); } }
    // waves
    if (this.room && this.room.kind === 'combat' && !this.room.cleared) {
      const alive = this.mobs.filter((m) => !m.dead).length;
      this.waveT -= dt;
      if (this.waveQueue.length && (this.waveT <= 0 || (alive === 0 && !this.pendingSpawns))) { this.spawnWave(this.waveQueue.shift()); this.waveT = 6; }
      this.room.enemiesLeft = alive + this.waveQueue.reduce((a, w) => a + w.length, 0) + (this.pendingSpawns || 0);
      if (!this.waveQueue.length && alive === 0 && !this.pendingSpawns && this.state === 'PLAY') {
        this.room.cleared = true; this.audio('roomClear'); this.ui.banner('ROOM CLEARED', 'Choose a door', '#ffcf5a'); this.later(0.6, () => this.openDoors());
      }
    }
    for (const m of this.mobs) if (!m.dead) m.update(dt);
    this.mobs = this.mobs.filter((m) => !m.dead);
    // thunderbrew duo: burning foes arc lightning
    if (this.mods.thunderbrew) { this.tbT = (this.tbT || 0) - dt; if (this.tbT <= 0) { this.tbT = 1; for (const m of this.mobs) if (m.burnT > 0) this.chain(m, 1, 8); } }
    this.updateShots(dt); this.updateHazards(dt);
    // doors
    let prompt = null;
    for (const d of this.doors) {
      d.orb.position.z = 200 + Math.sin(this.t * 3) * 8; d.orb.rotation.z += dt * 2; d.portal.material.opacity = 0.55 + Math.sin(this.t * 4) * 0.2;
      if (d.open && Math.hypot(P.x - d.x, P.y - d.y) < 110) { prompt = `E  Enter: ${d.label}`; if (this.input.hit('KeyE') || Math.hypot(P.x - d.x, P.y - d.y) < 60) { this.takeDoor(d); break; } }
    }
    if (prompt !== this._prompt) { this._prompt = prompt; this.ui.prompt(prompt); }
    this.fx.update(dt);
    this.followCam(raw);
  }
  updateShots(dt) {
    const P = this.player;
    for (let i = this.shots.length - 1; i >= 0; i--) {
      const s = this.shots[i]; s.life -= dt;
      s.x += s.vx * dt; s.y += s.vy * dt; s.mesh.position.set(s.x, s.y, s.z || 26);
      let dead = s.life <= 0 || Math.abs(s.x) > CFG.ARENA || Math.abs(s.y) > CFG.ARENA || this.obstacles.some((o) => Math.hypot(o.x - s.x, o.y - s.y) < o.r);
      if (!dead && s.team === 'enemy') {
        if (Math.hypot(P.x - s.x, P.y - s.y) < P.r + s.r) { this.hurtPlayer(s.dmg, s); if (s.slow) P.kx *= 0.2; dead = true; }
      } else if (!dead) {
        for (const t of this.targets()) {
          if (s.hitSet.has(t) || Math.hypot(t.x - s.x, t.y - s.y) > t.r + s.r) continue;
          s.hitSet.add(t);
          this.hit(t, s.dmg, { knock: 30, ang: Math.atan2(s.vy, s.vx), fire: this.mods.seedBlast });
          if (this.mods.seedChain && s.team === 'player') this.chain(t, 1, 7);
          if (this.mods.seedPierce || s.slowHit) t.slowT = 2;
          if (this.mods.seedBlast && !s.slowHit) { this.fx.ring(s.x, s.y, 0xff7a2f, 5, 70, 0.25); for (const e of this.targets()) if (e !== t && Math.hypot(e.x - s.x, e.y - s.y) < 70) this.hit(e, 6, { silent: true, noStatus: true }); }
          this.audio('spitHit', { vol: 0.5 });
          if (s.pierce > 0) s.pierce--; else { dead = true; break; }
        }
      }
      if (dead) { this.scene.remove(s.mesh); s.mesh.geometry.dispose(); this.shots.splice(i, 1); this.fx.burst(s.x, s.y, s.z || 26, s.color, 4, 120, 0.25, 3); }
    }
  }
  updateHazards(dt) {
    const P = this.player;
    for (let i = this.hazards.length - 1; i >= 0; i--) {
      const h = this.hazards[i]; h.t += dt;
      if (h.wave) {
        h.R += h.speed * dt; h.mesh.scale.setScalar(h.R); h.mesh.material.opacity = 0.9 * (1 - h.R / h.maxR);
        const d = Math.hypot(P.x - h.x, P.y - h.y);
        if (!h.hit && Math.abs(d - h.R) < 26) { h.hit = true; this.hurtPlayer(h.dmg, h); }
      } else if (h.heal) {
        h.mesh.position.z = 20 + Math.sin(this.t * 4) * 5;
        if (Math.hypot(P.x - h.x, P.y - h.y) < h.r + P.r) { P.hp = Math.min(P.maxHp, P.hp + h.heal); this.ui.dmg(P.x, P.y, 60, h.heal, 'heal'); this.audio('heal'); h.t = h.life; }
      } else {
        h.tick -= dt; h.mesh.material.opacity = 0.5 * Math.min(1, (h.life - h.t) * 2) * (0.8 + Math.sin(this.t * 12) * 0.2);
        if (h.tick <= 0) {
          h.tick = 0.5;
          if (h.team === 'enemy' && Math.hypot(P.x - h.x, P.y - h.y) < h.r) this.hurtPlayer(h.dps * 0.5, h);
          if (h.team === 'player') for (const t of this.targets()) if (Math.hypot(t.x - h.x, t.y - h.y) < h.r + t.r) { t.burnT = Math.max(t.burnT, 1.5); this.hit(t, h.dps * 0.5, { kind: 'burn', silent: true, noStatus: true }); }
          if (Math.random() < 0.5) this.fx.burst(h.x + (Math.random() - 0.5) * h.r, h.y + (Math.random() - 0.5) * h.r, 4, h.color, 2, 60, 0.6, 5, -150);
        }
      }
      if (h.t >= h.life) { this.scene.remove(h.mesh); h.mesh.geometry.dispose(); this.hazards.splice(i, 1); }
    }
  }
  followCam(dt) {
    const P = this.player;
    const lead = { x: (this.aim.x - P.x) * 0.12, y: (this.aim.y - P.y) * 0.12 };
    const want = new THREE.Vector3(P.x + lead.x, P.y + lead.y, 0).add(CAMERA_OFFSET);
    if (!this.camPos) this.camPos = want.clone();
    this.camPos.lerp(want, 1 - Math.exp(-8 * dt));
    const sh = this.fx.shake;
    this.camera.position.set(this.camPos.x + (Math.random() - 0.5) * sh, this.camPos.y + (Math.random() - 0.5) * sh, this.camPos.z + (Math.random() - 0.5) * sh);
    this.camera.lookAt(this.camPos.x - CAMERA_OFFSET.x, this.camPos.y - CAMERA_OFFSET.y, 20);
    this.sun.position.set(P.x - 300, P.y - 400, 900); this.sun.target.position.set(P.x, P.y, 0);
  }
}
