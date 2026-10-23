import * as THREE from 'three';

// Pooled-ish particle and shape effects on the ground plane (Z-up). Everything fades and cleans itself up.
const boxGeo = new THREE.BoxGeometry(1, 1, 1);
const ringGeo = new THREE.RingGeometry(0.86, 1, 48);
const discGeo = new THREE.CircleGeometry(1, 48);

export class Fx {
  constructor(scene) {
    this.scene = scene; this.list = []; this.shake = 0;
    this.group = new THREE.Group(); scene.add(this.group);
  }
  _add(mesh, life, upd) { this.group.add(mesh); this.list.push({ mesh, t: 0, life, upd }); return mesh; }
  basic(color, opacity = 1, add = true) {
    return new THREE.MeshBasicMaterial({ color, transparent: true, opacity, depthWrite: false, blending: add ? THREE.AdditiveBlending : THREE.NormalBlending, side: THREE.DoubleSide });
  }
  addShake(v) { this.shake = Math.min(28, Math.max(this.shake, v)); }

  // sparks / chunks flying out
  burst(x, y, z, color, n = 10, speed = 300, life = 0.45, size = 6, gravity = 900) {
    for (let i = 0; i < n; i++) {
      const m = new THREE.Mesh(boxGeo, this.basic(color));
      m.position.set(x, y, z); m.scale.setScalar(size * (0.5 + Math.random()));
      const a = Math.random() * Math.PI * 2, up = Math.random();
      const v = new THREE.Vector3(Math.cos(a) * (1 - up * 0.5), Math.sin(a) * (1 - up * 0.5), up * 0.9 + 0.2).multiplyScalar(speed * (0.4 + Math.random()));
      const l = life * (0.6 + Math.random() * 0.6);
      this._add(m, l, (k, dt) => { v.z -= gravity * dt; m.position.addScaledVector(v, dt); if (m.position.z < 1) { m.position.z = 1; v.z *= -0.3; v.x *= 0.7; v.y *= 0.7; } m.material.opacity = 1 - k; m.rotation.x += dt * 9; m.rotation.y += dt * 7; });
    }
  }
  ring(x, y, color, r0, r1, life = 0.4, z = 2, opacity = 0.9) {
    const m = new THREE.Mesh(ringGeo, this.basic(color, opacity)); m.position.set(x, y, z);
    this._add(m, life, (k) => { m.scale.setScalar(r0 + (r1 - r0) * (1 - (1 - k) * (1 - k))); m.material.opacity = opacity * (1 - k); });
  }
  disc(x, y, color, r, life = 0.25, z = 1.5, opacity = 0.5) {
    const m = new THREE.Mesh(discGeo, this.basic(color, opacity)); m.position.set(x, y, z); m.scale.setScalar(r);
    this._add(m, life, (k) => { m.material.opacity = opacity * (1 - k); });
  }
  // sword-like arc for the tongue lash
  slash(x, y, yaw, range, half, color = 0xffffff, z = 26, life = 0.16) {
    const g = new THREE.RingGeometry(range * 0.45, range, 24, 1, -half, half * 2);
    const m = new THREE.Mesh(g, this.basic(color, 0.85)); m.position.set(x, y, z); m.rotation.z = yaw;
    this._add(m, life, (k) => { m.material.opacity = 0.85 * (1 - k); m.scale.setScalar(1 + k * 0.12); });
    m.userData.ownGeo = true;
  }
  // a line from a to b (lightning / tracers)
  zap(x1, y1, x2, y2, color = 0xb6ff5a, z = 30, life = 0.18) {
    const pts = []; const n = 8;
    for (let i = 0; i <= n; i++) { const k = i / n, j = i && i < n ? 18 : 0; pts.push(new THREE.Vector3(x1 + (x2 - x1) * k + (Math.random() - 0.5) * j, y1 + (y2 - y1) * k + (Math.random() - 0.5) * j, z + (Math.random() - 0.5) * j)); }
    const m = new THREE.Line(new THREE.BufferGeometry().setFromPoints(pts), new THREE.LineBasicMaterial({ color, transparent: true, blending: THREE.AdditiveBlending }));
    m.userData.ownGeo = true;
    this._add(m, life, (k) => { m.material.opacity = 1 - k; });
  }
  // Ground telegraph that fills up, then calls back. shape: { circle: r } | { rect: [len, width], yaw } | { cone: [r, half], yaw }
  telegraph(x, y, shape, time, color = 0xff2a2a, onDone) {
    const grp = new THREE.Group(); grp.position.set(x, y, 2.5);
    let outline, fill;
    if (shape.circle) {
      outline = new THREE.Mesh(ringGeo, this.basic(color, 0.95, false)); outline.scale.setScalar(shape.circle);
      fill = new THREE.Mesh(discGeo, this.basic(color, 0.35, false)); fill.userData.full = shape.circle;
    } else if (shape.rect) {
      const [len, w] = shape.rect;
      const g = new THREE.PlaneGeometry(len, w).translate(len / 2, 0, 0);
      outline = new THREE.Mesh(g, this.basic(color, 0.22, false)); outline.userData.ownGeo = true;
      fill = new THREE.Mesh(g.clone(), this.basic(color, 0.45, false)); fill.userData.ownGeo = true; fill.userData.rect = true;
      grp.rotation.z = shape.yaw || 0;
    } else if (shape.cone) {
      const [r, half] = shape.cone;
      const g = new THREE.CircleGeometry(r, 32, -half, half * 2);
      outline = new THREE.Mesh(g, this.basic(color, 0.22, false)); outline.userData.ownGeo = true;
      fill = new THREE.Mesh(g.clone(), this.basic(color, 0.45, false)); fill.userData.ownGeo = true;
      grp.rotation.z = shape.yaw || 0;
    }
    grp.add(outline, fill);
    this.group.add(grp);
    const h = { grp, done: false, cancel: () => { h.done = true; this.group.remove(grp); } };
    this.list.push({ mesh: grp, t: 0, life: time, upd: (k) => {
      if (h.done) return;
      if (fill.userData.full) fill.scale.setScalar(Math.max(0.01, fill.userData.full * k));
      else if (fill.userData.rect) fill.scale.set(Math.max(0.01, k), 1, 1);
      else fill.scale.setScalar(Math.max(0.01, k));
      outline.material.opacity = (shape.circle ? 0.95 : 0.22) * (0.75 + 0.25 * Math.sin(k * 30));
    }, end: () => { if (!h.done && onDone) onDone(); h.done = true; } });
    return h;
  }
  update(dt) {
    this.shake = Math.max(0, this.shake - dt * 60);
    for (let i = this.list.length - 1; i >= 0; i--) {
      const f = this.list[i]; f.t += dt; const k = Math.min(1, f.t / f.life);
      f.upd(k, dt);
      if (k >= 1) {
        this.list.splice(i, 1);
        if (f.end) f.end();
        this.group.remove(f.mesh);
        f.mesh.traverse((o) => { if (o.userData.ownGeo && o.geometry) o.geometry.dispose(); if (o.material) o.material.dispose(); });
      }
    }
  }
  clear() { for (const f of this.list) this.group.remove(f.mesh); this.list = []; }
}
