// INTO THE KETTLE - DOM user interface (HUD + screens). See docs/CONTRACT.md.
import './ui.css';

const SPIRITS = {
  chai: { name: 'Chai', c: '#ff7a2f' },
  matcha: { name: 'Matcha', c: '#9dff5a' },
  jasmine: { name: 'Jasmine', c: '#8fd8ff' },
  mint: { name: 'Mint', c: '#5affc8' },
  trophy: { name: 'Trophy', c: '#ffcf5a' },
  duo: { name: 'Duo Blend', c: '#e48bff' },
};
const spirit = (k) => SPIRITS[k] || { name: k || 'Spirit', c: '#f3e3c3' };

const REWARDS = {
  boon: { c: '#ffcf5a', svg: '<path d="M12 2l8 4.5v9L12 22l-8-6.5v-9z" fill="none" stroke="currentColor" stroke-width="2"/><circle cx="12" cy="12" r="3.2" fill="currentColor"/>' },
  heal: { c: '#7dff8c', svg: '<path d="M9 3h6v6h6v6h-6v6H9v-6H3V9h6z" fill="currentColor"/>' },
  vigor: { c: '#ff4d4d', svg: '<path d="M12 21C4 15 2 10 2 7a5 5 0 0 1 10-1 5 5 0 0 1 10 1c0 3-2 8-10 14z" fill="currentColor"/><path d="M12 8v6M9 11h6" stroke="#2a1a10" stroke-width="2"/>' },
  sharpen: { c: '#ff8a3d', svg: '<path d="M4 20L16 8l-1-5 6 6-5-1L4 20z" fill="currentColor"/><path d="M3 21l3-1-2-2z" fill="currentColor"/>' },
};

const ICON_CAST = '<svg viewBox="0 0 24 24"><circle cx="12" cy="14" r="7" fill="#ff8a3d"/><circle cx="12" cy="14" r="7" fill="none" stroke="#ffcf5a" stroke-width="1.5"/><path d="M12 7V3m0 0l3 2" stroke="#ffcf5a" stroke-width="2" fill="none"/><circle cx="9.5" cy="12" r="2" fill="#fff" opacity=".5"/></svg>';
const ICON_SPECIAL = '<svg viewBox="0 0 24 24"><path d="M12 2c4 5 6 8 6 12a6 6 0 0 1-12 0c0-4 2-7 6-12z" fill="#9dff5a"/><path d="M12 8v10" stroke="#2a1a10" stroke-width="1.5"/></svg>';
const KETTLE_SVG = '<svg class="kettle" viewBox="0 0 160 140"><defs><linearGradient id="kg" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#6b4020"/><stop offset="1" stop-color="#1c0f08"/></linearGradient></defs>' +
  '<path d="M46 40 C60 14 100 14 114 40" fill="none" stroke="#7a5426" stroke-width="7" stroke-linecap="round"/>' +
  '<path d="M30 60 C26 100 40 128 80 128 C120 128 134 100 130 60 C126 44 100 38 80 38 C60 38 34 44 30 60z" fill="url(#kg)" stroke="#ffcf5a" stroke-width="3"/>' +
  '<path d="M128 70 C146 62 152 46 148 34 L136 40 C140 48 136 56 124 60z" fill="url(#kg)" stroke="#ffcf5a" stroke-width="3"/>' +
  '<path d="M32 76 C14 80 10 96 22 104" fill="none" stroke="#ffcf5a" stroke-width="5" stroke-linecap="round"/>' +
  '<ellipse cx="80" cy="36" rx="22" ry="6" fill="#2a1a10" stroke="#ffcf5a" stroke-width="2.5"/><circle cx="80" cy="28" r="5" fill="#ffcf5a"/>' +
  '<path d="M48 62c4-8 14-12 26-13" stroke="#fff" stroke-opacity=".25" stroke-width="4" fill="none" stroke-linecap="round"/>' +
  '<path d="M60 108 C64 116 96 116 100 108" fill="none" stroke="#ff8a3d" stroke-width="3" opacity=".8"/></svg>';

function el(tag, cls, parent, text) {
  const e = document.createElement(tag);
  if (cls) e.className = cls;
  if (text != null) e.textContent = text;
  if (parent) parent.appendChild(e);
  return e;
}
const svg = (inner, cls) => `<svg class="${cls || ''}" viewBox="0 0 24 24">${inner}</svg>`;
const fmtTime = (s) => { s = Math.max(0, Math.floor(s || 0)); return String(Math.floor(s / 60)).padStart(2, '0') + ':' + String(s % 60).padStart(2, '0'); };
const initials = (b) => {
  const words = String(b.label || b.key || '?').replace(/[^A-Za-z0-9 ]/g, ' ').trim().split(/\s+/);
  return (words.length > 1 ? words[0][0] + words[1][0] : words[0].slice(0, 2)).toUpperCase();
};

export class Ui {
  constructor(root, game) {
    this.game = game;
    this.root = root;
    root.classList.add('ui-root');
    this._screen = null;     // current screen kind
    this._screenEl = null;
    this._token = 0;
    this._hudOn = false;
    this._c = {};            // last-written value cache
    this._dmgPool = [];
    this._doorEls = [];
    this._pips = [];
    this._chipSig = '';
    this._buildHud();
    this._buildOverlays();
    this._onKey = (e) => this._key(e);
    window.addEventListener('keydown', this._onKey, true);
    this.showHud(false);
  }

  get modalOpen() { return this._screen !== null; }

  // ---------- construction ----------
  _buildHud() {
    const hud = (this.hud = el('div', 'hud hidden', this.root));
    // top-left
    const tl = el('div', 'hud-tl ui-panel', hud);
    this.eZone = el('div', 'hud-zone ui-h', tl);
    this.eLeft = el('div', 'hud-left', tl);
    this.eScore = el('div', 'hud-score', tl);
    // bottom-left
    const bl = el('div', 'hud-bl', hud);
    const hp = (this.eHp = el('div', 'hp', bl));
    this.eHpTrail = el('div', 'hp-trail', hp);
    this.eHpFill = el('div', 'hp-fill', hp);
    this.eHpNum = el('div', 'hp-num', hp);
    const row = el('div', 'hud-row', bl);
    this.eDash = el('div', 'dash', row);
    const mk = (icon, key) => {
      const w = el('div', 'abil-wrap', row);
      const a = el('div', 'abil', w);
      a.innerHTML = icon + '<div class="cd"></div>';
      const kc = el('div', 'kc', w);
      el('span', 'key', kc, key);
      const nm = el('div', 'abil-name', w);
      return { a, nm, cd: a.querySelector('.cd') };
    };
    this.aCast = mk(ICON_CAST, 'Q');
    this.aCast.nm.textContent = 'Tea Bomb';
    this.aSpec = mk(ICON_SPECIAL, 'RMB');
    // bottom-right
    this.eChips = el('div', 'hud-br', hud);
    // boss
    const boss = (this.eBoss = el('div', 'boss hidden', hud));
    this.eBossName = el('div', 'boss-name ui-h', boss);
    this.eBossTitle = el('div', 'boss-title', boss);
    const bb = el('div', 'boss-bar', boss);
    this.eBossTrail = el('div', 'boss-trail', bb);
    this.eBossFill = el('div', 'boss-fill', bb);
    el('div', 'boss-notch', bb);
    this.eToasts = el('div', 'toasts', hud);
    this.eDoors = el('div', 'doors', hud);
    this.ePrompt = el('div', 'prompt hidden', hud);
    this.eHint = el('div', 'hint', hud, 'WASD move · Mouse aim · LMB lash · RMB special · Space dash · Q tea bomb · E doors · Esc pause');
  }

  _buildOverlays() {
    this.eDmgs = el('div', 'dmgs', this.root);
    this.eVig = el('div', 'vignette', this.root);
    this.eFlash = el('div', 'flash', this.root);
    this.eFlash.style.transition = 'opacity .35s ease-out';
    this.eBannerHost = el('div', '', this.root);
    this.eScreenHost = el('div', '', this.root);
  }

  // ---------- public API ----------
  showHud(on) {
    this._hudOn = !!on;
    this.hud.classList.toggle('hidden', !on);
  }

  setHint(on) { this.root.classList.toggle('ui-nohint', !on); }

  toast(text, color) {
    const t = el('div', 'toast', this.eToasts, text);
    if (color) t.style.setProperty('--c', color);
    while (this.eToasts.children.length > 4) this.eToasts.firstChild.remove();
    setTimeout(() => t.remove(), 2600);
  }

  banner(title, sub, color) {
    this.eBannerHost.textContent = '';
    const b = el('div', 'banner', this.eBannerHost);
    if (color) b.style.setProperty('--c', color);
    el('div', 'banner-t ui-h', b, title);
    if (sub) el('div', 'banner-s', b, sub);
    el('div', 'banner-rule', b);
    clearTimeout(this._bannerT);
    this._bannerT = setTimeout(() => { b.remove(); }, 2300);
  }

  hurt() {
    const v = this.eVig;
    v.classList.remove('go');
    void v.offsetWidth;
    v.classList.add('go');
  }

  flash(a = 1) {
    const f = this.eFlash;
    f.style.transition = 'none';
    f.style.opacity = String(Math.max(0, Math.min(1, a)));
    void f.offsetWidth;
    f.style.transition = 'opacity .35s ease-out';
    f.style.opacity = '0';
  }

  prompt(text) {
    const p = this.ePrompt;
    if (!text) { if (this._c.prompt != null) { this._c.prompt = null; p.classList.add('hidden'); } return; }
    if (this._c.prompt === text) return;
    this._c.prompt = text;
    p.textContent = '';
    const m = /^(\S+)\s+(.*)$/.exec(text);
    if (m) { el('span', 'key', p, m[1]); p.appendChild(document.createTextNode(m[2])); } else p.textContent = text;
    p.classList.remove('hidden');
    p.style.animation = 'none'; void p.offsetWidth; p.style.animation = '';
  }

  dmg(x, y, z, amount, kind) {
    let d = this._dmgPool.find((o) => !o.live);
    if (!d) {
      if (this._dmgPool.length >= 48) d = this._dmgPool.reduce((a, b) => (a.age > b.age ? a : b));
      else {
        const e = el('div', 'dmg', this.eDmgs);
        d = { e, s: el('span', '', e), live: false, age: 0, x: 0, y: 0, z: 0 };
        this._dmgPool.push(d);
      }
    }
    d.live = true; d.age = 0; d.x = x; d.y = y; d.z = z;
    const k = kind || '';
    d.e.className = 'dmg' + (k ? ' ' + k : '');
    const n = Math.round(amount);
    d.s.textContent = k === 'heal' ? '+' + n : k === 'crit' ? n + '!' : String(n);
    d.s.style.animation = 'none'; void d.s.offsetWidth; d.s.style.animation = '';
    d.e.style.display = '';
    this._placeDmg(d);
  }

  _placeDmg(d) {
    const p = this.game.project ? this.game.project(d.x, d.y, d.z) : null;
    if (!p || p.visible === false) { d.e.style.visibility = 'hidden'; return; }
    d.e.style.visibility = '';
    d.e.style.transform = `translate(${p.x.toFixed(1)}px,${p.y.toFixed(1)}px)`;
  }

  update(dt) {
    // damage numbers
    for (const d of this._dmgPool) {
      if (!d.live) continue;
      d.age += dt;
      if (d.age > 0.95) { d.live = false; d.e.style.display = 'none'; continue; }
      this._placeDmg(d);
    }
    if (!this._hudOn) return;
    const g = this.game, p = g.player, room = g.room, boss = g.boss, c = this._c;
    // top-left
    let zone = '';
    if (room) zone = `${String(room.zoneName || '').toUpperCase()} · ROOM ${room.index}/${room.total}`;
    if (c.zone !== zone) { c.zone = zone; this.eZone.textContent = zone; }
    const left = room && room.enemiesLeft > 0 ? room.enemiesLeft : 0;
    if (c.left !== left) {
      c.left = left;
      this.eLeft.textContent = '';
      this.eLeft.classList.toggle('hidden', !left);
      if (left) { this.eLeft.append('Enemies left: '); el('b', '', this.eLeft, String(left)); }
    }
    const sc = Math.floor(g.score || 0);
    if (c.score !== sc) { c.score = sc; this.eScore.textContent = ''; this.eScore.append('SCORE '); el('span', '', this.eScore, String(sc)); }

    if (p) this._updatePlayer(p);
    this._updateBlessings(g.boons || []);
    this._updateBoss(boss);
    this._updateDoors(g.doors || []);
  }

  _updatePlayer(p) {
    const c = this._c;
    const max = Math.max(1, p.maxHp || 1), hp = Math.max(0, p.hp || 0);
    const pct = Math.min(100, (hp / max) * 100);
    if (c.hp !== pct) {
      const up = c.hp != null && pct > c.hp;
      if (up || c.hp == null) {
        this.eHpTrail.classList.add('snap');
        requestAnimationFrame(() => this.eHpTrail.classList.remove('snap'));
      }
      c.hp = pct;
      this.eHpFill.style.width = pct + '%';
      this.eHpTrail.style.width = pct + '%';
      this.eHp.classList.toggle('low', pct < 30);
    }
    const hpTxt = `${Math.ceil(hp)} / ${Math.ceil(max)}`;
    if (c.hpTxt !== hpTxt) { c.hpTxt = hpTxt; this.eHpNum.textContent = hpTxt; }
    // dash pips
    const md = p.maxDash || 0;
    if (this._pips.length !== md) {
      this.eDash.textContent = ''; this._pips = [];
      for (let i = 0; i < md; i++) { const pip = el('div', 'pip', this.eDash); this._pips.push({ pip, i: el('i', '', pip), v: -1 }); }
    }
    for (let i = 0; i < md; i++) {
      const o = this._pips[i];
      let v = 0;
      if (i < p.dash) v = 1; else if (i === p.dash) v = Math.round(Math.max(0, Math.min(1, p.dashRecharge || 0)) * 50) / 50;
      if (o.v !== v) {
        o.v = v;
        o.pip.classList.toggle('full', v === 1);
        o.i.style.transform = v === 1 ? '' : `scaleX(${v})`;
      }
    }
    // abilities
    this._cd(this.aCast, p.castCd, p.castMax);
    this._cd(this.aSpec, p.specialCd, p.specialMax);
    const sn = p.specialName || 'Seed Spit';
    if (c.sn !== sn) { c.sn = sn; this.aSpec.nm.textContent = sn; }
  }

  _cd(a, cd, max) {
    const f = cd > 0 && max > 0 ? Math.min(1, cd / max) : 0;
    const q = Math.round(f * 100) / 100;
    if (a.v !== q) {
      a.v = q;
      a.cd.style.setProperty('--cd', q);
      a.a.classList.toggle('ready', q === 0);
    }
  }

  _updateBlessings(boons) {
    const sig = boons.map((b) => b.key).join('|');
    if (sig === this._chipSig) return;
    this._chipSig = sig;
    this.eChips.textContent = '';
    const shown = boons.slice(-10);
    // wrap-reverse + row-reverse keeps newest at the end visually; render in order
    for (const b of shown) {
      const s = spirit(b.spirit);
      const chip = el('div', 'chip' + (b.spirit === 'trophy' ? ' trophy' : b.spirit === 'duo' ? ' duo' : ''), this.eChips);
      chip.style.setProperty('--c', s.c);
      el('span', '', chip, initials(b));
    }
  }

  _updateBoss(boss) {
    const c = this._c;
    const on = !!boss;
    if (c.boss !== on) { c.boss = on; this.eBoss.classList.toggle('hidden', !on); this.hud.classList.toggle('has-boss', on); }
    if (!boss) return;
    if (c.bn !== boss.name) { c.bn = boss.name; this.eBossName.textContent = boss.name || ''; }
    if (c.bt !== boss.title) { c.bt = boss.title; this.eBossTitle.textContent = boss.title || ''; }
    const pct = Math.max(0, Math.min(100, (boss.hp / Math.max(1, boss.maxHp)) * 100));
    if (c.bp !== pct) {
      if (c.bp != null && pct > c.bp) { this.eBossTrail.style.transition = 'none'; requestAnimationFrame(() => { this.eBossTrail.style.transition = ''; }); }
      c.bp = pct;
      this.eBossFill.style.width = pct + '%';
      this.eBossTrail.style.width = pct + '%';
    }
    const p2 = pct <= 50 || boss.phase >= 2;
    if (c.p2 !== p2) { c.p2 = p2; this.eBoss.classList.toggle('p2', p2); }
  }

  _updateDoors(doors) {
    while (this._doorEls.length < doors.length) {
      const e = el('div', 'door ui-panel hidden', this.eDoors);
      this._doorEls.push({ e, ic: el('div', 'di', e), lb: el('div', 'dl', e), reward: null, label: null, open: null, vis: true, tx: NaN, ty: NaN });
    }
    for (let i = 0; i < this._doorEls.length; i++) {
      const o = this._doorEls[i], d = doors[i];
      if (!d) { if (o.vis !== false) { o.vis = false; o.e.classList.add('hidden'); } continue; }
      if (o.reward !== d.reward) {
        o.reward = d.reward;
        const r = REWARDS[d.reward] || REWARDS.boon;
        o.e.style.setProperty('--c', r.c);
        o.ic.style.color = r.c;
        o.ic.innerHTML = svg(r.svg);
      }
      if (o.label !== d.label) { o.label = d.label; o.lb.textContent = String(d.label || '').toUpperCase(); }
      const open = !!d.open;
      if (o.open !== open) { o.open = open; o.e.classList.toggle('open', open); }
      const pr = this.game.project ? this.game.project(d.x, d.y, (d.z || 0) + 90) : null;
      const vis = !!pr && pr.visible !== false;
      if (o.vis !== vis) { o.vis = vis; o.e.classList.toggle('hidden', !vis); }
      if (vis) {
        const w = o.e.offsetWidth, tx = Math.round(pr.x - w / 2), ty = Math.round(pr.y - o.e.offsetHeight);
        if (tx !== o.tx || ty !== o.ty) { o.tx = tx; o.ty = ty; o.e.style.transform = `translate(${tx}px,${ty}px)`; }
      }
    }
  }

  // ---------- screens ----------
  _open(kind, cls) {
    this._token++;
    this.eScreenHost.textContent = '';
    this._screen = kind;
    const s = (this._screenEl = el('div', 'screen ' + (cls || kind), this.eScreenHost));
    return s;
  }

  hideScreens() {
    this._screen = null;
    this._screenEl = null;
    this.eScreenHost.textContent = '';
    this._token++;
  }

  // run a game method, then close the screen unless it opened another one
  _act(fn) {
    const t = this._token;
    fn();
    if (this._token === t) this.hideScreens();
  }

  showTitle() {
    const s = this._open('title');
    const wrap = el('div', 't-wrap', s);
    const steam = el('div', 'steam', wrap);
    for (let i = 0; i < 7; i++) {
      const w = el('div', 'wisp', steam);
      w.style.left = (10 + i * 12) + '%';
      w.style.animationDelay = (-i * 0.9) + 's';
      w.style.setProperty('--dx', ((i % 2 ? 1 : -1) * (1 + i % 3)) + 'em');
    }
    wrap.insertAdjacentHTML('beforeend', KETTLE_SVG);
    el('h1', 't-title ui-h', wrap, 'INTO THE KETTLE');
    el('div', 't-sub', wrap, "Tode's tea was stolen. Take it back.");
    const btns = el('div', 'btns', s);
    const start = el('button', 'btn', btns, 'Begin the Descent');
    start.onclick = () => this._act(() => this.game.newRun());
    const how = el('button', 'btn sec', btns, 'How to play');
    let card = null;
    how.onclick = () => {
      if (card) { card.remove(); card = null; return; }
      card = el('div', 'how ui-panel', s);
      card.innerHTML =
        '<h3 class="ui-h">Controls</h3><ul>' +
        '<li><b>WASD</b> move &middot; <b>Mouse</b> aim &middot; <b>LMB</b> tongue-lash combo &middot; <b>RMB</b> special (seed spit or boss trophy)</li>' +
        '<li><b>Space</b> dash (invulnerable, 2 charges) &middot; <b>Q</b> tea bomb &middot; <b>E</b> doors &middot; <b>Esc</b> pause</li></ul>' +
        '<h3 class="ui-h">Three twists</h3><ul>' +
        '<li><b>Refused blessings</b> are brewed into the final boss as its powers.</li>' +
        '<li><b>Beat a mini-boss</b> to take its signature move as your own.</li>' +
        '<li><b>Two spirits combine</b> into a Duo blend with a new effect.</li></ul>';
    };
    start.focus();
  }

  showBoons(choices) {
    const s = this._open('boons');
    el('h2', 'screen-h ui-h', s, 'CHOOSE A BLESSING');
    const cards = el('div', 'cards', s);
    this._choices = choices || [];
    this._choices.slice(0, 3).forEach((b, i) => {
      const sp = spirit(b.spirit);
      const c = el('div', 'card', cards);
      c.tabIndex = 0;
      c.style.setProperty('--c', sp.c);
      c.style.setProperty('--i', i);
      const num = el('div', 'num', c); el('span', 'key', num, String(i + 1));
      el('div', 'sp', c, sp.name);
      el('div', 'orb', c);
      el('div', 'slot', c, String(b.slot || 'passive').toUpperCase());
      el('div', 'lb', c, b.label || b.key);
      el('div', 'ds', c, b.desc || '');
      const r = String(b.rarity || 'common').toLowerCase();
      const gem = el('div', 'gem ' + r, c);
      el('i', '', gem); el('span', '', gem, r);
      const pick = () => this._act(() => this.game.pickBoon(b.key));
      c.onclick = pick;
      c.onkeydown = (e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); pick(); } };
    });
    el('div', 'fine', s, 'The two you leave behind steep into the Kettle...');
  }

  showEnd(win, stats) {
    const st = stats || {};
    const s = this._open('end');
    const col = win ? '#ffcf5a' : '#ff4d4d';
    s.style.setProperty('--c', col);
    el('h2', 'end-h ui-h', s, win ? 'THE TEA IS SAVED' : 'TODE HAS FALLEN');
    const grid = el('div', 'stats ui-panel', s);
    const row = (v, l, cls) => { const d = el('div', 'stat' + (cls ? ' ' + cls : ''), grid); el('b', '', d, String(v)); el('span', '', d, l); };
    row(st.rooms ?? 0, 'Rooms cleared');
    row(st.kills ?? 0, 'Kills');
    row(fmtTime(st.time), 'Time');
    row(Math.round(st.damageDealt || 0), 'Damage dealt');
    row(st.boonsTaken ?? 0, 'Blessings taken');
    row(st.boonsRefused ?? 0, 'Blessings refused');
    row(Math.floor(st.score ?? this.game.score ?? 0), 'Score', 'score');
    const btns = el('div', 'btns', s);
    const b = el('button', 'btn', btns, 'Try Again');
    b.onclick = () => this._act(() => this.game.newRun());
    b.focus();
  }

  showPause() {
    const s = this._open('pause');
    el('h2', 'pause-h ui-h', s, 'PAUSED');
    const btns = el('div', 'btns', s);
    const r = el('button', 'btn', btns, 'Resume');
    r.onclick = () => this._act(() => this.game.resume());
    const q = el('button', 'btn sec', btns, 'Quit to title');
    q.onclick = () => this._act(() => this.game.quitToTitle());
    r.focus();
  }

  _key(e) {
    if (!this._screen || e.repeat) return;
    const k = e.key;
    if (this._screen === 'boons') {
      const i = k === '1' ? 0 : k === '2' ? 1 : k === '3' ? 2 : -1;
      const b = i >= 0 && this._choices[i];
      if (b) { e.preventDefault(); e.stopImmediatePropagation(); this._act(() => this.game.pickBoon(b.key)); }
    } else if (this._screen === 'end') {
      if (k === 'Enter') { e.preventDefault(); e.stopImmediatePropagation(); this._act(() => this.game.newRun()); }
    } else if (this._screen === 'pause') {
      if (k === 'Escape') { e.preventDefault(); e.stopImmediatePropagation(); this._act(() => this.game.resume()); }
    } else if (this._screen === 'title') {
      if (k === 'Enter' && document.activeElement && document.activeElement.tagName !== 'BUTTON') {
        e.preventDefault(); this._act(() => this.game.newRun());
      }
    }
  }
}
