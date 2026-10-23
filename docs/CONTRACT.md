# Contracts between modules (Game, Ui, Audio)

World: **Z-up**, ground = XY plane at z = 0 (course convention). Units: course scale (Tode is about 46 tall). `game` is `window.__game`.

## Game fields read by the UI
| Field | Meaning |
|---|---|
| `game.state` | `TITLE` `PLAY` `CHOICE` (blessing modal) `DEAD` `WIN` `PAUSE` |
| `game.player` | `hp, maxHp, dash, maxDash, dashRecharge (0..1 progress of next charge), castCd, castMax, specialCd, specialMax, specialName, x, y, z` |
| `game.boons` | array of owned blessing objects `{ key, label, desc, spirit, slot }` (spirit: `chai` `matcha` `jasmine` `mint` `trophy` `duo`) |
| `game.room` | `{ zone: 1..3, zoneName, index (room # in run, 1-based), total, kind: 'combat'|'boss'|'final', cleared, enemiesLeft }` |
| `game.boss` | `null` or `{ name, title, hp, maxHp, phase }` |
| `game.doors` | array `{ x, y, z, reward: 'boon'|'heal'|'vigor'|'sharpen', label, open }`; world positions, the UI draws a label over each |
| `game.stats` | `{ kills, rooms, time, damageDealt, damageTaken, boonsTaken, boonsRefused, score }` |
| `game.score` | number (course score: survival time + kills) |

## Game methods the UI calls
`game.newRun()` (title / restart) · `game.pickBoon(key)` · `game.resume()` · `game.quitToTitle()` · `game.project(x, y, z)` → `{ x, y, visible }` in CSS pixels (for door labels and damage numbers).

## Ui API (src/ui/Ui.js, `export class Ui`)
```js
const ui = new Ui(document.getElementById('ui'), game);
ui.update(dt)                  // every frame: HUD, door labels
ui.showHud(bool)
ui.toast(text, color)          // small message, top-center queue
ui.banner(title, sub, color)   // big centered title card ~2.2 s ("THE TEAGARDEN", "QUEEN ARMABEE" ...)
ui.hurt()                      // red vignette pulse
ui.flash(a)                    // white screen flash 0..1
ui.prompt(text|null)           // bottom-center pill, e.g. "E  Enter: Blessing"
ui.dmg(x, y, z, amount, kind)  // floating damage number at a world point; kind: '' | 'crit' | 'burn' | 'player' | 'heal'
ui.showTitle()                 // title screen: Start (game.newRun()), controls card
ui.showBoons(choices)          // 3 cards {key,label,desc,spirit,slot,rarity}; click or 1/2/3 → game.pickBoon(key)
ui.showEnd(win, stats)         // death or victory screen, "Try again" → game.newRun()
ui.showPause()                 // Resume → game.resume(), Quit → game.quitToTitle()
ui.hideScreens()
ui.modalOpen                   // getter
```

## Audio API (src/core/Audio.js, `export const Audio`)
```js
Audio.init()                        // on first user gesture
Audio.play(name, { pitch = 1, vol = 1 } = {})
Audio.music(kind)                   // 'title' | 'combat' | 'boss' | 'final' | 'none' (cross-fade)
Audio.toggleMute()
```
Sound names: `swing swing3 hit crit kill spit spitHit dash cast boom hurt heal pickup door boon roomClear spawn bossRoar charge stomp sting steam bubble lid enrage win lose ui`.
