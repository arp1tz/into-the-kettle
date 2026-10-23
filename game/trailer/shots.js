const { g, S, F, rig } = window.DIR;
const D = window.D, PI = Math.PI;
const press = (code) => g.input.pressed.add(code);
const lowBoss = (dur, o = {}) => rig.orbit(F.boss(o.dz ?? 40), { dur, a0: o.a0 ?? -1.95, a1: o.a1 ?? -1.45, r0: o.r0 ?? 560, r1: o.r1 ?? 440, h0: o.h0 ?? 50, h1: o.h1 ?? 90, lookH: o.lookH ?? 110, fov: 42, punch: 2.5 });
const crowd = (type, n, r, i, extra) => (s) => { S.room(i, { noWaves: true, ...extra }); S.place(0, 0, PI / 2); S.ring(type, n, r); };
const quick = (id, setup, o = {}) => ({ id, dur: 0.2, flash: 0.7, pre: o.pre ?? 0.9, find: o.find, setup, cam: rig.game(o.zoom ?? 0.8), ts: o.ts });

const shots = [
  // ---------------- COLD OPEN (0 - 2.4)
  { id: 'kettle_tease', dur: 0.8, flash: 0.9, inv: true, pre: 1.6, setup() { S.room(8, { hud: false, bot: false, noWaves: true }); S.place(0, -560); }, cam: lowBoss(0.8, { r0: 640, r1: 500 }) },
  { id: 'tode_close', dur: 0.8, inv: true, pre: 0.4, setup() { S.room(0, { noWaves: true, hud: false, bot: false }); S.place(0, 0, PI / 2); S.mob('bee', 0, 95); },
    update() { if (D.frameI === 30) { g.aim.x = 0; g.aim.y = 95; press('KeyJ'); } if (D.frameI === 44) press('KeyJ'); },
    cam: rig.orbit(F.hero(20), { dur: 0.8, a0: 1.05, a1: 1.6, r0: 190, r1: 140, h0: 34, h1: 46, lookH: 18, fov: 38 }) },
  { id: 'title_hit', dur: 0.8, flash: 1, find: { ev: ['kill'], nth: 2, lead: 0.12, max: 6 }, setup: crowd('bee', 7, 150, 0, { rate: 7 }),
    ts: (lt) => (lt < 0.12 ? 1 : lt < 0.6 ? 0.25 : 1), cam: rig.game((lt) => 0.62 + lt * 0.15) },

  // ---------------- COMBAT (2.4 - 6.4)
  { id: 'lash_crowd', dur: 0.4, pre: 1.0, setup: crowd('bee', 9, 210, 1, { rate: 6, dash: 50 }), cam: rig.game(0.8) },
  { id: 'dash_charger', dur: 0.4, find: { ev: ['charge'], lead: 0.1, max: 6 }, setup() { S.room(2, { noWaves: true, hold: true, rate: 999 }); S.place(0, -100, PI / 2); S.mob('charger', 0, 260); S.mob('bee', -160, 120); },
    update(lt) { if (lt > 0.18 && !D.dashed) { D.dashed = true; g.input.keys.add('KeyD'); press('Space'); } if (lt < 0.05) D.dashed = false; }, cam: rig.game(0.85) },
  { id: 'tea_bomb', dur: 0.4, find: { ev: ['boom'], lead: 0.12, max: 5 }, setup() { S.room(1, { noWaves: true, hold: true, rate: 999 }); S.place(0, -180, PI / 2); S.ring('bee', 7, 110, 0, 120); D.bot.target = () => ({ x: 0, y: 120 }); },
    update() { if (D.frameI === 20) press('KeyQ'); }, cam: rig.game(0.9, { dy: 120 }) },
  { id: 'static_lash', dur: 0.4, pre: 0.9, setup: crowd('bee', 8, 130, 2, { boons: ['staticLash'], rate: 7 }), cam: rig.game(0.72) },
  { id: 'scorch_dash', dur: 0.4, pre: 0.8, setup: crowd('bee', 8, 200, 2, { boons: ['scorchDash', 'emberLash'], dash: 18, rate: 7 }), cam: rig.game(0.85) },
  { id: 'frozen_bomb', dur: 0.4, find: { ev: ['boom'], lead: 0.1, max: 5 }, setup() { S.room(2, { noWaves: true, hold: true, rate: 999, boons: ['frozenLeaf', 'cyclone'] }); S.place(0, -200, PI / 2); S.ring('bee', 6, 170, 0, 100); S.mob('charger', 0, 100); D.bot.target = () => ({ x: 0, y: 100 }); },
    update() { if (D.frameI === 20) press('KeyQ'); }, cam: rig.game(0.95, { dy: 100 }) },
  { id: 'seed_fan', dur: 0.4, pre: 0.7, setup() { S.room(1, { noWaves: true, hold: true, special: 8, rate: 999, boons: ['whirlSeed', 'moltenSeed'] }); S.place(0, -150, PI / 2); S.ring('spitter', 5, 260, 0, 100, 0.3); }, cam: rig.game(1.0, { dy: 80 }) },
  { id: 'elite_fight', dur: 0.4, pre: 0.8, setup() { S.room(6, { noWaves: true, rate: 6, dash: 30, boons: ['frostLash'] }); S.place(0, 0, PI / 2); S.mob('charger', 0, 200, true); S.mob('bee', -150, 80, true); S.ring('bee', 5, 220, 0, 0, 0.6); }, cam: rig.game(0.85) },
  { id: 'village_spawn', dur: 0.4, pre: 0.95, setup() { S.room(5, { rate: 8 }); }, cam: rig.game(1.1) },
  { id: 'room_clear', dur: 0.4, pre: 1.5, setup() { S.room(2, { noWaves: true }); S.place(0, 300, PI / 2); D.bot.target = () => ({ x: -190, y: 570 }); }, cam: rig.game(1.0, { dy: 160 }) },

  // ---------------- BLESSINGS (6.4 - 7.6)
  { id: 'boon_pick', dur: 0.8, pre: 0.5, setup() { S.room(0, { noWaves: true, bot: false, boons: ['emberLash', 'glacialDash'] }); S.place(0, 200, PI / 2); },
    start() { g.state = 'PLAY'; g.doors = []; g.takeDoor({ reward: 'boon' }); }, cam: rig.game(0.9) },
  { id: 'storm_brew', dur: 0.4, find: { ev: ['boom'], lead: 0.05, max: 5 }, setup() { S.room(1, { noWaves: true, hold: true, rate: 999, boons: ['stormBrew'] }); S.place(0, -180, PI / 2); S.ring('bee', 8, 150, 0, 110); D.bot.target = () => ({ x: 0, y: 110 }); },
    update() { if (D.frameI === 20) press('KeyQ'); }, ts: () => 0.7, cam: rig.game(0.95, { dy: 110 }) },

  // ---------------- MINI-BOSSES (7.6 - 10.8)
  { id: 'queen_reveal', dur: 0.8, flash: 0.9, banner: true, inv: true, pre: 1.05, setup() { S.room(3, { bot: false }); }, cam: lowBoss(0.8, { dz: 60, lookH: 70, r0: 520, r1: 380 }) },
  { id: 'queen_dash', dur: 0.4, find: { ev: ['charge'], lead: 0.15, max: 9 }, setup() { S.room(3, { keep: 200, rate: 8 }); }, cam: rig.game(1.15) },
  { id: 'royal_sting', dur: 0.4, pre: 0.6, setup() { S.room(4, { noWaves: true, hold: true, special: 22, rate: 999, trophy: 'sting' }); S.place(-200, -150, 0.4); for (let i = 0; i < 5; i++) S.mob('bee', -110 + i * 70, -110 + i * 30); D.bot.target = () => ({ x: 200, y: 0 }); }, cam: rig.game(0.85, { dx: 120 }) },
  { id: 'house_reveal', dur: 0.8, flash: 0.9, banner: true, inv: true, pre: 1.05, setup() { S.room(7, { bot: false }); }, cam: lowBoss(0.8, { dz: 80, lookH: 90, r0: 600, r1: 460, h0: 30, h1: 70 }) },
  { id: 'house_stomp', dur: 0.4, find: { ev: ['stomp'], lead: 0.3, max: 10 }, setup() { S.room(7, { keep: 260, rate: 999 }); }, cam: rig.game(1.25) },
  { id: 'groundpound', dur: 0.4, find: { ev: ['stomp'], lead: 0.08, max: 4 }, setup() { S.room(5, { noWaves: true, hold: true, rate: 999, special: 30, trophy: 'pound' }); S.place(0, 0, PI / 2); S.ring('bee', 9, 140); S.ring('spitter', 3, 230, 0, 0, 0.5); }, cam: rig.game(0.95) },

  // ---------------- THE KETTLE TYRANT (10.8 - 14.0)
  { id: 'kettle_reveal', dur: 0.8, flash: 1, banner: true, inv: true, pre: 1.05, setup() { S.room(8, { bot: false, bitter: { chai: 2, matcha: 2, jasmine: 1, mint: 1 } }); }, cam: lowBoss(0.8, { dz: 60, lookH: 130, r0: 640, r1: 470, h0: 20, h1: 60 }) },
  { id: 'kettle_bitter', dur: 0.8, find: { ev: ['bubble'], lead: 0.1, max: 12 }, setup() { S.room(8, { keep: 300, rate: 999, bitter: { chai: 2, matcha: 2 } }); }, cam: rig.game(1.45, { dy: 140 }) },
  { id: 'kettle_steam', dur: 0.4, find: { ev: ['steam'], lead: 0.05, max: 12 }, setup() { S.room(8, { keep: 280, rate: 999 }); }, cam: rig.game(1.35, { dy: 140 }) },
  { id: 'kettle_lid', dur: 0.4, find: { ev: ['lid'], lead: -0.45, max: 14 }, setup() { S.room(8, { keep: 300, rate: 999 }); }, cam: rig.game(1.35, { dy: 120 }) },
  { id: 'kettle_flood', dur: 0.8, find: { test: () => g.hazards.some((h) => h.wave), lead: 0.05, max: 14 }, setup() { S.room(8, { keep: 260, rate: 999, dash: 25 }); },
    update() { if (g.boss && !D.hurtBoss) { D.hurtBoss = true; g.boss.hp = g.boss.maxHp * 0.48; } if (!g.boss) D.hurtBoss = false; }, cam: rig.game(1.4, { dy: 140 }) },

  // ---------------- FRENZY (14.0 - 16.4)
  { id: 'storm_lash', dur: 0.4, pre: 0.9, setup: crowd('bee', 9, 140, 6, { boons: ['staticLash', 'galeLash', 'stormLash'], rate: 6 }), cam: rig.game(0.78) },
  { id: 'thunderbrew', dur: 0.4, pre: 1.1, setup: crowd('bee', 10, 180, 6, { boons: ['emberLash', 'staticLash', 'thunderbrew', 'scorchDash'], rate: 6, dash: 22 }), cam: rig.game(0.85) },
  { id: 'house_rage', dur: 0.4, pre: 1.2, setup() { S.room(7, { keep: 160, rate: 7 }); }, update() { if (g.boss && g.boss.phase === 1) g.boss.hp = g.boss.maxHp * 0.45; }, cam: rig.game(1.2) },
  quick('q1', crowd('charger', 4, 260, 5, { rate: 7, dash: 20 })),
  quick('q2', (s) => { S.room(3, { rate: 7 }); }, { pre: 2.4, zoom: 1.1 }),
  quick('q3', crowd('bee', 10, 160, 6, { boons: ['chaiInferno'], bomb: 25, rate: 7 }), { pre: 1.0 }),
  quick('q4', (s) => { S.room(8, { rate: 8, keep: 220 }); }, { pre: 3.0, zoom: 1.3 }),
  quick('q5', crowd('bee', 8, 120, 2, { boons: ['frostLash', 'galeLash'], rate: 6 }), { pre: 0.9, zoom: 0.7 }),
  quick('q6', (s) => { S.room(7, { rate: 7, keep: 200 }); }, { pre: 3.4, zoom: 1.2 }),

  // ---------------- HYPE (16.4 - 18.0): 0.2 s cuts
  quick('h1', crowd('bee', 8, 150, 4, { boons: ['emberLash'], rate: 6 }), { find: { ev: ['kill'], lead: 0.05 } }),
  quick('h2', (s) => { S.room(8, { keep: 300, rate: 999 }); }, { find: { ev: ['bubble'], lead: -0.6, max: 12 }, zoom: 1.3 }),
  quick('h3', crowd('bee', 7, 120, 1, { boons: ['staticLash'], rate: 6 }), { find: { ev: ['kill'], nth: 2, lead: 0.03 }, zoom: 0.65 }),
  quick('h4', (s) => { S.room(3, { rate: 999, keep: 240 }); }, { find: { ev: ['sting'], lead: 0.05, max: 10 }, zoom: 1.1 }),
  quick('h5', crowd('charger', 4, 240, 6, { boons: ['cyclone'], rate: 7, bomb: 20 }), { find: { ev: ['boom'], lead: 0.03 } }),
  quick('h6', (s) => { S.room(7, { rate: 999, keep: 260 }); }, { find: { ev: ['stomp'], lead: 0.03, max: 10 }, zoom: 1.2 }),
  quick('h7', crowd('bee', 9, 140, 5, { trophy: 'pound', special: 25, rate: 999, hold: true }), { find: { ev: ['stomp'], lead: 0.02 } }),
  quick('h8', (s) => { S.room(8, { keep: 260, rate: 8 }); }, { find: { ev: ['steam'], lead: 0.1, max: 12 }, zoom: 1.3 }),

  // ---------------- END CARD (18.0 - 19.8)
  { id: 'end', dur: 1.8, flash: 1, inv: true, pre: 1.6, setup() { S.room(8, { hud: false, bot: false, noWaves: true }); S.place(0, -260, PI / 2); },
    cam: rig.orbit(F.hero(30), { dur: 1.8, a0: -PI / 2 - 0.35, a1: -PI / 2 - 0.15, r0: 230, r1: 200, h0: 40, h1: 55, lookH: 140, fov: 46, punch: 0.8 }) },
];

D.define({
  shots,
  texts: [
    { t0: 0.8, t1: 1.6, text: "TODE'S TEA WAS STOLEN", size: 64, y: 82, anim: 'rise' },
    { t0: 1.6, t1: 2.4, text: 'INTO THE KETTLE', size: 170, y: 46 },
    { t0: 4.0, t1: 4.8, text: 'FOUR TEA SPIRITS', sub: 'FIRE · LIGHTNING · FROST · WIND', size: 92, y: 80 },
    { t0: 6.4, t1: 7.2, text: 'CHOOSE YOUR BLESSINGS', size: 64, y: 90 },
    { t0: 8.4, t1: 9.2, text: 'STEAL THEIR POWERS', size: 92, y: 82 },
    { t0: 11.6, t1: 12.4, text: 'BREWED FROM EVERY BLESSING YOU REFUSED', size: 58, y: 84 },
    { t0: 18.0, t1: 19.75, text: 'INTO THE KETTLE', sub: "TODE'S TEA WAS STOLEN. TAKE IT BACK.", size: 150, y: 30 },
  ],
  bars: [{ t0: 0, t1: 1.6, h: 0.1 }, { t0: 7.6, t1: 8.4, h: 0.1 }, { t0: 9.2, t1: 10.0, h: 0.1 }, { t0: 10.8, t1: 11.6, h: 0.1 }],
  blacks: [{ t0: 19.5, t1: 19.8, a0: 0, a1: 1 }],
});
