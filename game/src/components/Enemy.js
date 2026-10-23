import * as THREE from 'three';
import { modelInstance } from './Assets.js';

// Course baseline: enemy.glb (scale 5, rotation.x = PI/2, sitting on the ground), spawned at the four map corners.
export function createEnemyModel(height = 46) {
  const group = new THREE.Group();
  const pivot = new THREE.Group(); group.add(pivot);
  const model = modelInstance('enemy', height);
  if (model) pivot.add(model);
  group.userData = { pivot, model };
  return group;
}

export function cornerSpawns(half) {
  const c = half - 60;
  return [[-c, -c], [c, -c], [-c, c], [c, c]];
}

// Course collision rule: an entity may only move if the new position keeps COLLISION_DISTANCE from the others.
export function blocked(x, y, self, others, dist) {
  for (const o of others) {
    if (o === self || o.dead) continue;
    const d = Math.hypot(o.x - x, o.y - y);
    if (d < dist * ((self.r || 20) + (o.r || 20)) / 40) return true;
  }
  return false;
}
