# AI tools disclosure

| Tool | Used for |
|---|---|
| Claude (Anthropic) via Claude Code, **Opus 5.5** | Research (collecting ideas from r/gameideas), game design (`docs/DESIGN.md`) and the module contracts; writing the core game code (course baseline components, combat, rooms, enemies, bosses, blessings, effects, camera); visual tuning; the headless playtest; the trailer capture pipeline, soundtrack synthesis and encode; README and docs |
| Claude (Anthropic) via Claude Code, **Sonnet 5.5** (subagents) | Implementing the DOM UI (`game/src/ui/`) and the synthesized audio engine (`game/src/core/Audio.js`) from Opus-written specifications; Opus reviewed and integrated the results |
| Local headless Chrome via `playwright-core` (driven by Claude Code) | Automated playtests (a bot plays full runs to check for errors and soft-locks) and frame-by-frame trailer capture. A development tool, not part of the game |

No generative image, video, 3D or audio models were used. Models are from the course (see `THIRD_PARTY_ASSETS.md`); everything else is drawn or synthesized in code.

Human direction: the concept, the choice of features and the review and testing decisions came from the project author.
