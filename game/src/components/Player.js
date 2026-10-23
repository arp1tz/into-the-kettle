import * as THREE from 'three';
import { modelInstance } from './Assets.js';

// Course baseline: the player is a THREE.Group holding tode.glb (course scale 20 → normalised to 46 units tall,
// rotation.x = PI/2, flush on the ground).
// The model is kept as a separate reference so it can be rotated and squashed without moving the group.
export function createPlayer() {
  const group = new THREE.Group();
  const pivot = new THREE.Group();   // yaw
  const body = new THREE.Group();    // squash / hop
  group.add(pivot); pivot.add(body);
  const model = modelInstance('tode', 46) || fallbackFrog();
  body.add(model);
  group.userData = { pivot, body, model };
  return group;
}

function fallbackFrog() {
  const m = new THREE.Mesh(new THREE.SphereGeometry(22, 16, 12), new THREE.MeshStandardMaterial({ color: 0x4caf50 }));
  m.position.z = 22; m.castShadow = true;
  return m;
}
