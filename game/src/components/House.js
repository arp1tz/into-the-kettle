import * as THREE from 'three';
import { modelInstance } from './Assets.js';

// Course baseline: small_house.glb at scale 65, rotation.x = PI/2, random yaw in steps of PI/2, flush on z = 0,
// blocking both the player and enemies. Returns obstacles as circles { x, y, r } for collision.
export function createHouses(count, half, rng, keepOut = []) {
  const group = new THREE.Group(), obstacles = [];
  let tries = 0;
  while (obstacles.length < count && tries++ < 300) {
    const x = (rng() * 2 - 1) * (half - 170), y = (rng() * 2 - 1) * (half - 170);
    if (keepOut.some((k) => Math.hypot(k[0] - x, k[1] - y) < (k[2] || 200))) continue;
    if (obstacles.some((o) => Math.hypot(o.x - x, o.y - y) < 300)) continue;
    const house = modelInstance('small_house', 150);
    const holder = new THREE.Group();
    if (house) holder.add(house);
    holder.position.set(x, y, 0);
    holder.rotation.z = Math.floor(rng() * 4) * (Math.PI / 2);
    group.add(holder);
    const s = house ? house.userData.size : new THREE.Vector3(120, 120, 120);
    obstacles.push({ x, y, r: Math.max(s.x, s.y) * 0.42 });
  }
  return { group, obstacles };
}

// Push a circle out of every obstacle (houses, pillars).
export function resolveObstacles(e, obstacles) {
  for (const o of obstacles) {
    const dx = e.x - o.x, dy = e.y - o.y, d = Math.hypot(dx, dy), min = o.r + (e.r || 20);
    if (d < min && d > 0.001) { e.x = o.x + (dx / d) * min; e.y = o.y + (dy / d) * min; e.hitWall = true; }
  }
}
