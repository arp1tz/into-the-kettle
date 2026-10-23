// All tunables. Z-up world, course scale (Tode is about 46 units tall).
export const CFG = {
  ARENA: 640,               // half size of a room
  FACING: Math.PI / 2,      // course models face -Y after rotation.x = PI/2; this turns them to our +X forward
  // course baseline constants (kept, then extended)
  COLLISION_DISTANCE: 38,
  SCORE_PER_SECOND: 0.1,
  SCORE_PER_KILL: 10,
  COMPLEXITY_GROWTH: 0.12,  // difficulty factor per room depth

  PLAYER: { hp: 100, speed: 330, radius: 20, iframes: 0.5, hopFreq: 11, hopH: 7 },
  DASH: { speed: 1250, time: 0.15, iframes: 0.28, charges: 2, recharge: 1.0 },
  LASH: { dmg: [12, 13, 26], range: [110, 110, 135], arc: [1.0, 1.0, 1.35], dur: [0.2, 0.2, 0.3], hitAt: 0.35, combo: 0.45, knock: 70 },
  SEED: { dmg: 9, speed: 980, cd: 0.32, radius: 9 },
  BOMB: { dmg: 42, radius: 135, cd: 5.5, flight: 0.55, maxRange: 420 },
  TROPHY: { sting: { dmg: 34, dist: 330, cd: 2.4 }, pound: { dmg: 46, radius: 210, cd: 4 } },

  MOBS: {
    bee:     { hp: 30, speed: 175, r: 22, dmg: 10, windup: 0.45, reach: 60, score: 10 },
    spitter: { hp: 24, speed: 120, r: 20, dmg: 9, keep: 360, cd: 1.9, shot: 420, score: 10 },
    charger: { hp: 60, speed: 115, r: 28, dmg: 18, windup: 0.75, charge: 950, chargeT: 0.55, score: 15 },
  },
  ELITE: { chance: 0.1, hp: 1.9, scale: 1.3 },
  WAVES: { base: 6, perRoom: 2.5, waves: 3, gap: 1.6, spawnWarn: 0.8 },

  // run layout: c = combat room, Q / H / K = bosses
  ROUTE: ['c', 'c', 'c', 'Q', 'c', 'c', 'c', 'H', 'K'],
  ZONES: {
    1: { name: 'THE TEAGARDEN', c1: '#228B22', c2: '#90EE90', sky: 0xa8d8ff, fog: 0xbfe6ff, sun: 0xfff2d8, sunI: 1.8, amb: 0.4, houses: 2 },
    2: { name: 'THE HOLLOW VILLAGE', c1: '#3a3355', c2: '#5d5478', sky: 0x2a2140, fog: 0x3b2f55, sun: 0xffb27a, sunI: 1.9, amb: 0.4, houses: 5 },
    3: { name: 'THE BOILING POT', c1: '#2a1410', c2: '#40201a', sky: 0x140806, fog: 0x2a0c06, sun: 0xff7a3a, sunI: 1.4, amb: 0.35, houses: 0 },
  },
  KETTLE_BOIL: 150,          // final boss enrages after this many seconds (r/gameideas: the 5-minute boss)
  HITSTOP: 0.045,
};
