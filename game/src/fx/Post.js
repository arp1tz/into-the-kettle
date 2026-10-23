import * as THREE from 'three';
import { EffectComposer } from 'three/addons/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/addons/postprocessing/RenderPass.js';
import { UnrealBloomPass } from 'three/addons/postprocessing/UnrealBloomPass.js';
import { ShaderPass } from 'three/addons/postprocessing/ShaderPass.js';
import { OutputPass } from 'three/addons/postprocessing/OutputPass.js';


// Storm grade: cool desaturation that deepens with the storm, warm lift for the village fire,
// vignette, lightning exposure kick and a red chromatic split when the hero is hurt.
const GradeShader = {
  uniforms: {
    tDiffuse: { value: null },
    uStorm: { value: 0 },
    uFlash: { value: 0 },
    uHurt: { value: 0 },
    uNight: { value: 0 },
    uTime: { value: 0 },
  },
  vertexShader: /* glsl */`
    varying vec2 vUv;
    void main() { vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }`,
  fragmentShader: /* glsl */`
    uniform sampler2D tDiffuse; uniform float uStorm, uFlash, uHurt, uNight, uTime;
    varying vec2 vUv;
    void main() {
      vec2 c = vUv - 0.5;
      float r = length(c);
      vec2 off = c * (0.004 + uHurt * 0.018);
      vec3 col = vec3(texture2D(tDiffuse, vUv + off).r, texture2D(tDiffuse, vUv).g, texture2D(tDiffuse, vUv - off).b);
      float lum = dot(col, vec3(0.299, 0.587, 0.114));
      // storm grade: desaturate + push toward cold teal shadows
      col = mix(col, vec3(lum), uStorm * 0.35);
      col *= mix(vec3(1.0), vec3(0.86, 0.97, 1.08), uStorm);
      col = mix(col, col * vec3(0.55, 0.65, 0.95), uNight * 0.6);
      // lightning: blown-out cold exposure kick
      col += uFlash * (0.25 + lum * 1.6) * vec3(0.85, 0.92, 1.0);
      // hurt: red edge
      col = mix(col, vec3(0.9, 0.05, 0.05), uHurt * smoothstep(0.35, 0.85, r) * 0.35);
      // vignette
      col *= 1.0 - smoothstep(0.38, 0.95, r) * (0.45 + uStorm * 0.25);
      // fine film grain keeps flat colours alive
      float n = fract(sin(dot(vUv * (uTime + 1.0), vec2(12.9898, 78.233))) * 43758.5453);
      col += (n - 0.5) * 0.025;
      gl_FragColor = vec4(col, 1.0);
    }`,
};

export class Post {
  constructor(renderer, scene, camera) {
    this.renderer = renderer;
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    renderer.toneMappingExposure = 0.9;
    renderer.outputColorSpace = THREE.SRGBColorSpace;
    const size = renderer.getSize(new THREE.Vector2());
    this.composer = new EffectComposer(renderer);
    this.composer.addPass(new RenderPass(scene, camera));
    this.bloom = new UnrealBloomPass(new THREE.Vector2(size.x, size.y), 0.55, 0.6, 0.82);
    this.composer.addPass(this.bloom);
    this.grade = new ShaderPass(GradeShader);
    this.composer.addPass(this.grade);
    this.composer.addPass(new OutputPass());
    this.enabled = true;
    this.hurt = 0;
    window.addEventListener('resize', () => this.composer.setSize(window.innerWidth, window.innerHeight));
  }
  setStorm(storm, night = 0) { this.grade.uniforms.uStorm.value = storm; this.grade.uniforms.uNight.value = night; this.bloom.strength = 0.5 + night * 0.35; }
  pulseHurt() { this.hurt = 1; }
  render(dt, flash = 0) {
    const u = this.grade.uniforms;
    this.hurt = Math.max(0, this.hurt - dt * 4);
    u.uHurt.value = this.hurt; u.uFlash.value = Math.min(1, flash); u.uTime.value = (u.uTime.value + dt) % 100;
    if (this.enabled) this.composer.render(dt); else this.renderer.render(this.composer.passes[0].scene, this.composer.passes[0].camera);
  }
}
