# INTO THE KETTLE — design (jam build)

> Tode's morning tea was stolen by the Armabee hive. Fight down through three chambers, take the powers of the bosses you beat, and face the Kettle Tyrant, which is brewed from every blessing you turned down.

A fast isometric **action roguelike** (Hades / Risk of Rain feel) built on the course game *Build a Game with an AI Coding Agent* (JetBrains Academy). The course baseline (scene, `Player.js`, `Camera.js`, `Renderer.js`, `Enemy.js`, chasing spawns from map corners, collisions, attack radius, score, game over/reset, difficulty scaling, checkerboard `Map.js`, `House.js` obstacles) stays and is extended.

## Run structure
| Zone | Rooms | Boss |
|---|---|---|
| 1. The Teagarden (green checkerboard, daylight) | 3 combat rooms | **Queen Armabee** (mini-boss): charge dashes, stinger fans, summons drones |
| 2. The Hollow Village (dusk, houses everywhere) | 3 combat rooms | **The House That Walks** (mini-boss, the course house come alive): stomp shockwaves, chimney mortars, door-chomp lunge |
| 3. The Boiling Pot (dark, ember light) | — | **The Kettle Tyrant** (final boss): spout steam sweeps, boiling bubbles, lid boomerang; phase 2 floods the arena in boiling rings and casts the Bitter Leaves |

After each combat room, **two doors** show their reward (Blessing / Heal / Vigor / Sharpen). You pick one, Hades-style.

## Player (Tode)
WASD move (hop-bob from the course jump arc), mouse aim · **LMB** tongue-lash 3-hit combo · **RMB** seed spit (ranged) or a boss trophy · **Space** dash (i-frames, 2 charges) · **Q** tea-bomb cast · **E** interact / door · **Esc** pause.

## Ideas taken from r/gameideas (scraped 2026-10-23)
- *"An RPG where after every level you pick one of three stats… the boss has every stat you didn't pick"* → **Bitter Leaves**: every blessing you refuse is brewed into the Kettle Tyrant as an extra attack.
- *"Taking enemies' abilities (roguelike)"* + *"a robot that rebuilds itself from enemy parts"* → **Trophies**: beating a mini-boss gives you its signature move as your new right-click.
- *"A Souls-like where you unlock combinable concepts"* → **Duo Blends**: owning blessings from two different tea spirits unlocks a combined effect.
- *"A top-down roguelike where you have 5 minutes before the final boss"* → the **Kettle boils**: the final fight enrages after 150 s.

## Blessings (4 tea spirits)
Chai (fire: burn), Matcha (lightning: chain), Jasmine (frost: slow/freeze), Mint (wind: knockback, faster dash). Each blessing upgrades a slot (attack, special, dash, cast) or is a passive. You pick 1 of 3.

## Feel targets
Hitstop on every hit, screen shake, white hit flash, damage numbers, readable red telegraphs, bloom on fire and lightning, real-time shadows, 60 fps.
