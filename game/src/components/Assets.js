import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import * as SkeletonUtils from 'three/addons/utils/SkeletonUtils.js';

// Loads the course models once (public/models) and hands out clones.
const cache = {};
export async function loadModels(names = ['tode', 'enemy', 'small_house']) {
  const loader = new GLTFLoader();
  await Promise.all(names.map((n) => new Promise((res) => {
    loader.load(`${import.meta.env.BASE_URL}models/${n}.glb`, (g) => { cache[n] = g; res(); }, undefined, () => { console.warn('model failed', n); res(); });
  })));
}
export function hasModel(n) { return !!cache[n]; }

// Course recipe: rotate x by PI/2 (Z-up), scale, and lift so the model sits on z = 0.
// The course models come in very different native sizes, so `height` (world units) normalises them;
// the course scale values are kept as the documented defaults in the components.
export function modelInstance(name, height) {
  const g = cache[name];
  if (!g) return null;
  const model = SkeletonUtils.clone(g.scene);
  model.rotation.x = Math.PI / 2;
  model.updateMatrixWorld(true);
  const raw = new THREE.Box3().setFromObject(model, true);
  model.scale.setScalar(height / Math.max(0.001, raw.max.z - raw.min.z));
  model.traverse((o) => {
    if (o.isMesh) {
      o.castShadow = true; o.receiveShadow = true;
      o.material = o.material.clone();
    }
  });
  model.updateMatrixWorld(true);
  const box = new THREE.Box3().setFromObject(model, true);
  model.position.z -= box.min.z;
  model.userData.height = box.max.z - box.min.z;
  model.userData.size = box.getSize(new THREE.Vector3());
  return model;
}
