import * as THREE from 'three';

// Course baseline: a checkerboard floor of alternating tiles (Dark Green #228B22 / Light Green #90EE90).
// Extended: colours per zone, a canvas texture with speckle and edge darkening, and a wall ring around the room.
export function createMap(half, c1 = '#228B22', c2 = '#90EE90', tile = 80) {
  const group = new THREE.Group();
  const n = Math.round((half * 2) / tile);
  const cv = document.createElement('canvas'); cv.width = cv.height = 1024;
  const x = cv.getContext('2d'), s = 1024 / n;
  for (let i = 0; i < n; i++) for (let j = 0; j < n; j++) {
    x.fillStyle = (i + j) % 2 ? c1 : c2; x.fillRect(i * s, j * s, s + 1, s + 1);
  }
  // speckle for texture
  const r = mulberry(7);
  for (let k = 0; k < 9000; k++) { x.fillStyle = `rgba(0,0,0,${r() * 0.08})`; x.fillRect(r() * 1024, r() * 1024, 2, 2); }
  for (let k = 0; k < 4000; k++) { x.fillStyle = `rgba(255,255,255,${r() * 0.06})`; x.fillRect(r() * 1024, r() * 1024, 2, 2); }
  const g = x.createRadialGradient(512, 512, 300, 512, 512, 760); g.addColorStop(0, 'rgba(0,0,0,0)'); g.addColorStop(1, 'rgba(0,0,0,.45)');
  x.fillStyle = g; x.fillRect(0, 0, 1024, 1024);
  const tex = new THREE.CanvasTexture(cv); tex.colorSpace = THREE.SRGBColorSpace; tex.anisotropy = 8;
  const floor = new THREE.Mesh(new THREE.PlaneGeometry(half * 2, half * 2), new THREE.MeshStandardMaterial({ map: tex, roughness: 0.95 }));
  floor.receiveShadow = true;
  group.add(floor);
  // outer ground so the room edge doesn't fall into the void
  const outer = new THREE.Mesh(new THREE.PlaneGeometry(9000, 9000), new THREE.MeshStandardMaterial({ color: new THREE.Color(c1).multiplyScalar(0.35), roughness: 1 }));
  outer.position.z = -2; outer.receiveShadow = true; group.add(outer);
  return group;
}

function mulberry(a) { return () => { a |= 0; a = (a + 0x6d2b79f5) | 0; let t = Math.imul(a ^ (a >>> 15), 1 | a); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; }; }
