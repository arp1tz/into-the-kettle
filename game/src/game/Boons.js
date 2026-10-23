// Blessings from four tea spirits. Each one sets flags on game.mods that the combat code reads.
// Refused blessings are remembered: the Kettle Tyrant brews them into extra attacks (Bitter Leaves).
export const SPIRITS = {
  chai: { label: 'Chai', color: 0xff7a2f, element: 'fire' },
  matcha: { label: 'Matcha', color: 0x9dff5a, element: 'lightning' },
  jasmine: { label: 'Jasmine', color: 0x8fd8ff, element: 'frost' },
  mint: { label: 'Mint', color: 0x5affc8, element: 'wind' },
  trophy: { label: 'Trophy', color: 0xffcf5a },
  duo: { label: 'Duo', color: 0xe48bff },
};

export const BOONS = [
  { key: 'emberLash', spirit: 'chai', slot: 'attack', label: 'Ember Lash', desc: 'Lash hits set foes ablaze (burn 8/s for 3 s).', apply: (m) => { m.burnOnHit = true; } },
  { key: 'moltenSeed', spirit: 'chai', slot: 'special', label: 'Molten Seed', desc: 'Seeds explode in a small fiery blast.', apply: (m) => { m.seedBlast = true; } },
  { key: 'scorchDash', spirit: 'chai', slot: 'dash', label: 'Scorch Dash', desc: 'Dashing leaves a trail of fire.', apply: (m) => { m.dashFire = true; } },
  { key: 'chaiInferno', spirit: 'chai', slot: 'cast', label: 'Chai Inferno', desc: 'Tea bombs leave a burning pool.', apply: (m) => { m.castFire = true; } },
  { key: 'staticLash', spirit: 'matcha', slot: 'attack', label: 'Static Lash', desc: 'Lash hits arc lightning to 2 nearby foes.', apply: (m) => { m.chainOnHit = 2; } },
  { key: 'voltSeed', spirit: 'matcha', slot: 'special', label: 'Volt Seed', desc: 'Seeds chain to another foe on hit.', apply: (m) => { m.seedChain = true; } },
  { key: 'thunderStep', spirit: 'matcha', slot: 'dash', label: 'Thunder Step', desc: 'A dash ends with a lightning burst.', apply: (m) => { m.dashZap = true; } },
  { key: 'stormBrew', spirit: 'matcha', slot: 'cast', label: 'Storm Brew', desc: 'Tea bombs call down 3 lightning strikes.', apply: (m) => { m.castStorm = true; } },
  { key: 'frostLash', spirit: 'jasmine', slot: 'attack', label: 'Frost Lash', desc: 'Lash hits slow foes by 45% for 2 s.', apply: (m) => { m.slowOnHit = true; } },
  { key: 'icicleSeed', spirit: 'jasmine', slot: 'special', label: 'Icicle Seed', desc: 'Seeds pierce through foes and chill them.', apply: (m) => { m.seedPierce = true; } },
  { key: 'glacialDash', spirit: 'jasmine', slot: 'dash', label: 'Glacial Dash', desc: '+1 dash charge; dashing frosts nearby foes.', apply: (m) => { m.extraDash += 1; m.dashFrost = true; } },
  { key: 'frozenLeaf', spirit: 'jasmine', slot: 'cast', label: 'Frozen Leaf', desc: 'Tea bombs freeze foes solid for 2 s.', apply: (m) => { m.castFreeze = true; } },
  { key: 'galeLash', spirit: 'mint', slot: 'attack', label: 'Gale Lash', desc: '+25% lash reach and heavy knockback.', apply: (m) => { m.rangeMult *= 1.25; m.knockMult *= 2.2; } },
  { key: 'whirlSeed', spirit: 'mint', slot: 'special', label: 'Whirl Seed', desc: 'Spit 3 seeds in a fan.', apply: (m) => { m.seedSpread = true; } },
  { key: 'tailwind', spirit: 'mint', slot: 'dash', label: 'Tailwind', desc: '+1 dash charge, 40% faster recharge.', apply: (m) => { m.extraDash += 1; m.dashRecharge *= 0.6; } },
  { key: 'cyclone', spirit: 'mint', slot: 'cast', label: 'Cyclone', desc: 'Tea bombs pull foes into the blast.', apply: (m) => { m.castPull = true; } },
];

// Duo Blends (r/gameideas: combinable concepts). Offered once you own blessings from both spirits.
export const DUOS = [
  { key: 'thunderbrew', spirit: 'duo', pair: ['chai', 'matcha'], slot: 'passive', label: 'Thunderbrew', desc: 'Burning foes crackle: lightning jumps from them every second.', apply: (m) => { m.thunderbrew = true; } },
  { key: 'blizzard', spirit: 'duo', pair: ['jasmine', 'mint'], slot: 'passive', label: 'Blizzard Step', desc: 'Every dash fires a ring of icicles.', apply: (m) => { m.blizzard = true; } },
  { key: 'steamBurst', spirit: 'duo', pair: ['chai', 'jasmine'], slot: 'passive', label: 'Steam Burst', desc: 'Hitting a slowed foe with fire bursts into scalding steam (+20 dmg).', apply: (m) => { m.steamBurst = true; } },
  { key: 'stormLash', spirit: 'duo', pair: ['matcha', 'mint'], slot: 'passive', label: 'Storm Lash', desc: 'The 3rd lash hit fires a lightning wave forward.', apply: (m) => { m.stormLash = true; } },
];

export function freshMods() {
  return { burnOnHit: false, seedBlast: false, dashFire: false, castFire: false, chainOnHit: 0, seedChain: false, dashZap: false, castStorm: false,
    slowOnHit: false, seedPierce: false, extraDash: 0, dashFrost: false, castFreeze: false, rangeMult: 1, knockMult: 1, seedSpread: false,
    dashRecharge: 1, castPull: false, thunderbrew: false, blizzard: false, steamBurst: false, stormLash: false, dmgMult: 1 };
}

// Three choices: never owned ones; a Duo is offered when eligible; prefer three different spirits.
export function rollChoices(owned, rnd) {
  const have = new Set(owned.map((b) => b.key));
  const spirits = new Set(owned.map((b) => b.spirit));
  const duo = DUOS.find((d) => !have.has(d.key) && d.pair.every((p) => spirits.has(p)));
  const pool = BOONS.filter((b) => !have.has(b.key)).sort(() => rnd() - 0.5);
  const out = [], used = new Set();
  if (duo && rnd() < 0.6) out.push(duo);
  for (const b of pool) { if (out.length >= 3) break; if (used.has(b.spirit) && pool.length > 6) continue; used.add(b.spirit); out.push(b); }
  for (const b of pool) { if (out.length >= 3) break; if (!out.includes(b)) out.push(b); }
  return out.map((b) => ({ ...b, rarity: b.spirit === 'duo' ? 'epic' : rnd() < 0.25 ? 'rare' : 'common' }));
}
