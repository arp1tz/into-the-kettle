# Into the Kettle

**Tode's tea was stolen. Take it back.**

A fast isometric **action roguelike** for the browser (Hades / Risk of Rain feel), built on top of the JetBrains Academy course project *Build a Game with an AI Coding Agent*. Tode the frog fights down through an Armabee hive: three zones, two mini-bosses whose moves you can steal, and a final boss brewed from every blessing you turned down.

🎬 Trailer (19.8 s): [`game/trailer/into-the-kettle-trailer.mp4`](game/trailer/into-the-kettle-trailer.mp4)

## Build and run
Requires Node 18+ (tested on Node 22).
```bash
cd game
npm install
npm run dev        # open http://localhost:5173
npm run build      # production build in game/dist
npm run preview    # serve the production build
```
In WebStorm: open `game/package.json` and press the run icon next to `dev`.

## Controls
| Action | Input |
|---|---|
| Move | WASD / arrow keys |
| Aim | Mouse |
| Tongue lash (3-hit combo) | Left mouse / J |
| Special: seed spit, or a stolen boss move | Right mouse / K |
| Dash (i-frames, 2 charges) | Space |
| Tea bomb | Q |
| Enter a door | E (or walk into it) |
| Pause / mute | Esc / M |

## What I added to the course game
The course baseline (scene and lights, `Player.js` with `tode.glb`, `Camera.js`, `Renderer.js`, `Enemy.js` spawning at the four map corners and chasing Tode, collision distance rules, the attack radius, score, game over and reset, difficulty that grows with progress, the checkerboard `Map.js`, and `House.js` obstacles) is still in `game/src/components/` and is extended into a full roguelike:

- **Run structure:** 9 rooms across 3 zones (The Teagarden, The Hollow Village, The Boiling Pot). After each room you choose between two doors showing their rewards: Blessing, Heal, Vigor or Sharpen.
- **Combat:** twin-stick movement keeping the course hop arc, a 3-hit tongue-lash combo, seed spit, dash with invulnerability frames, a lobbed tea bomb, hitstop, screen shake, damage numbers, crits and knockback.
- **Enemies:** the course Armabee (melee lunges with a wind-up), plus a spitter beetle (ranged), a horned charger (telegraphed charge, stunned by walls), and golden elite variants.
- **Bosses:**
  - **Queen Armabee:** charge dashes, stinger fans, summons.
  - **The House That Walks:** the course house come alive, with leap stomps, chimney mortars and a door-chomp charge.
  - **The Kettle Tyrant** (final): steam cone, boiling bubbles, lid boomerang, boiling flood waves in phase 2, and an enrage timer.
- **16 blessings from 4 tea spirits** (Chai fire, Matcha lightning, Jasmine frost, Mint wind), each upgrading attack, special, dash or cast. There are also **4 Duo Blends**.
- **Presentation:** real-time shadows, bloom and filmic tone mapping, per-zone lighting and decor, telegraphs for every enemy attack, a styled HUD, title, blessing, pause and end screens, and synthesized SFX with adaptive music.

### Ideas taken from r/gameideas
The design merges ideas from the subreddit's top posts:
- *"An RPG where… the boss has every stat you didn't pick"* becomes **Bitter Leaves**: every blessing you refuse is brewed into the Kettle Tyrant as an extra attack (fire pools, lightning hunt, frost shards, gales).
- *"Taking enemies' abilities (roguelike)"* becomes **Trophies**: beating a mini-boss gives you its move as your right-click (Royal Sting, Groundpound).
- *"A Souls-like where you unlock combinable concepts"* becomes **Duo Blends**: own blessings from two spirits to unlock a combined power.
- *"A top-down roguelike where you have 5 minutes for the final boss"* becomes **the Kettle boils**: the final fight enrages after 150 s.

## Project layout
```
game/
  src/components/   course baseline components (Player, Camera, Renderer, Enemy, Map, House) + model loader
  src/game/         Game.js (rooms, waves, combat, rewards, camera), Boons.js (blessings, duos)
  src/entities/     Hero.js, Mobs.js (bee / spitter / charger), Bosses.js (3 bosses)
  src/fx/           Fx.js (particles, telegraphs), Post.js (bloom, grade)
  src/ui/           Ui.js + ui.css (HUD and screens)
  src/core/         Input.js, Audio.js (synthesized SFX + music)
  tools/            headless playtest (playwright-core + system Chrome)
  trailer/          deterministic trailer capture, soundtrack synthesis and encode scripts + the trailer
docs/               DESIGN.md, CONTRACT.md
```

## Credits, assets, AI and license
- Course baseline and models: JetBrains Academy, *Build a Game with an AI Coding Agent* (MIT). See [THIRD_PARTY_ASSETS.md](THIRD_PARTY_ASSETS.md) for every asset, its source and license.
- AI tools used and what for: [AI_DISCLOSURE.md](AI_DISCLOSURE.md).
- License and attribution notice: [LICENSE](LICENSE).
