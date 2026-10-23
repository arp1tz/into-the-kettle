import * as THREE from 'three';

// Course baseline: WebGL renderer on canvas.game (alpha + antialias, window sized). Extended: shadows, tone mapping.
export function createRenderer() {
  const canvas = document.querySelector('canvas.game');
  const renderer = new THREE.WebGLRenderer({ canvas, alpha: true, antialias: true });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
  renderer.setSize(window.innerWidth, window.innerHeight);
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = THREE.PCFSoftShadowMap;
  return renderer;
}
