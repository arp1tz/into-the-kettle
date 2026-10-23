// Keyboard + mouse (buttons, screen position). `pressed` sets are cleared at the end of every frame.
export class Input {
  constructor(canvas) {
    this.keys = new Set(); this.pressed = new Set();
    this.mouse = new Set(); this.mPressed = new Set();
    this.mx = window.innerWidth / 2; this.my = window.innerHeight / 2;
    window.addEventListener('keydown', (e) => {
      if (['Space', 'Tab', 'ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight'].includes(e.code)) e.preventDefault();
      if (!e.repeat) this.pressed.add(e.code);
      this.keys.add(e.code);
    });
    window.addEventListener('keyup', (e) => this.keys.delete(e.code));
    window.addEventListener('blur', () => { this.keys.clear(); this.mouse.clear(); });
    canvas.addEventListener('mousedown', (e) => { this.mouse.add(e.button); this.mPressed.add(e.button); });
    window.addEventListener('mouseup', (e) => this.mouse.delete(e.button));
    window.addEventListener('mousemove', (e) => { this.mx = e.clientX; this.my = e.clientY; });
    window.addEventListener('contextmenu', (e) => e.preventDefault());
  }
  down(c) { return this.keys.has(c); }
  hit(c) { return this.pressed.has(c); }
  mDown(b) { return this.mouse.has(b); }
  mHit(b) { return this.mPressed.has(b); }
  endFrame() { this.pressed.clear(); this.mPressed.clear(); }
  clear() { this.keys.clear(); this.pressed.clear(); this.mouse.clear(); this.mPressed.clear(); }
}

export function rng(seed) {
  let a = seed >>> 0 || 1;
  return () => { a = (a + 0x6d2b79f5) | 0; let t = Math.imul(a ^ (a >>> 15), 1 | a); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
}
export const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
export const lerp = (a, b, k) => a + (b - a) * k;
export const angDiff = (a, b) => { let d = b - a; while (d > Math.PI) d -= Math.PI * 2; while (d < -Math.PI) d += Math.PI * 2; return d; };
