import './style.css';
import { Game } from './game/Game.js';

// Course entry point, extended: the whole game lives in Game (scene, player, enemies, rooms, bosses).
const game = new Game();
window.__game = game;
game.start().then(() => { const b = document.getElementById('boot'); if (b) b.remove(); });
