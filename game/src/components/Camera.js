import * as THREE from 'three';

// Course baseline: perspective camera, Z-up, far plane 9000, looking at the player from (300, -300, 300).
// Extended: a Hades-style high three-quarter view that follows the player and leans toward the aim point.
export const CAMERA_OFFSET = new THREE.Vector3(0, -380, 520);

export function createCamera() {
  const camera = new THREE.PerspectiveCamera(36, window.innerWidth / window.innerHeight, 1, 9000);
  camera.up.set(0, 0, 1);
  camera.position.copy(CAMERA_OFFSET);
  camera.lookAt(0, 0, 0);
  return camera;
}
