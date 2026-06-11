// scene.js — 渲染器、相机、灯光、地台与氛围粒子
import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { RoomEnvironment } from 'three/addons/environments/RoomEnvironment.js';

const THEMES = {
  dusk:     { key: 0xfff0e6, rim: 0xe8a0b4, hemi: 0x8a7a8f, ground: 0x16090f, glow: '#e8a0b4' },
  midnight: { key: 0xe6f0ff, rim: 0x9fb8e8, hemi: 0x6a7a9f, ground: 0x080d1a, glow: '#9fb8e8' },
  dawn:     { key: 0xffe2c4, rim: 0xe8bc8f, hemi: 0x9f8a6a, ground: 0x1a0f06, glow: '#e8bc8f' },
};

function makeGlowTexture(color) {
  const c = document.createElement('canvas');
  c.width = c.height = 256;
  const ctx = c.getContext('2d');
  const g = ctx.createRadialGradient(128, 128, 0, 128, 128, 128);
  g.addColorStop(0, color + 'ff');
  g.addColorStop(0.35, color + '55');
  g.addColorStop(1, color + '00');
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, 256, 256);
  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.SRGBColorSpace;
  return tex;
}

export function createScene(canvas) {
  const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: true });
  renderer.setSize(window.innerWidth, window.innerHeight);
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
  renderer.setClearColor(0x000000, 0);
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = THREE.PCFSoftShadowMap;
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1.12;
  renderer.outputColorSpace = THREE.SRGBColorSpace;

  const scene = new THREE.Scene();
  const pmrem = new THREE.PMREMGenerator(renderer);
  scene.environment = pmrem.fromScene(new RoomEnvironment(), 0.04).texture;
  scene.environmentIntensity = 0.45;

  const camera = new THREE.PerspectiveCamera(30, window.innerWidth / window.innerHeight, 0.1, 60);
  camera.position.set(0, 1.32, 2.7);

  const controls = new OrbitControls(camera, canvas);
  controls.target.set(0, 1.02, 0);
  controls.enableDamping = true;
  controls.dampingFactor = 0.06;
  controls.enablePan = false;
  controls.minDistance = 0.7;
  controls.maxDistance = 6;
  controls.maxPolarAngle = Math.PI * 0.62;
  controls.minPolarAngle = Math.PI * 0.18;
  // 左键留给互动，右键旋转视角
  controls.mouseButtons = { LEFT: null, MIDDLE: THREE.MOUSE.DOLLY, RIGHT: THREE.MOUSE.ROTATE };
  controls.update();

  // ----- 灯光 -----
  const keyLight = new THREE.DirectionalLight(0xfff0e6, 2.4);
  keyLight.position.set(1.6, 2.6, 2.2);
  keyLight.castShadow = true;
  keyLight.shadow.mapSize.set(2048, 2048);
  keyLight.shadow.camera.top = 2.2;
  keyLight.shadow.camera.bottom = -0.4;
  keyLight.shadow.camera.left = -1.6;
  keyLight.shadow.camera.right = 1.6;
  keyLight.shadow.camera.near = 0.5;
  keyLight.shadow.camera.far = 8;
  keyLight.shadow.bias = -0.0003;
  keyLight.shadow.normalBias = 0.02;
  scene.add(keyLight);

  const rimLight = new THREE.DirectionalLight(0xe8a0b4, 1.6);
  rimLight.position.set(-2.2, 1.9, -2.4);
  scene.add(rimLight);

  const hemiLight = new THREE.HemisphereLight(0x8a7a8f, 0x14080e, 0.55);
  scene.add(hemiLight);

  const fillLight = new THREE.PointLight(0xffd9e0, 0.5, 6, 1.6);
  fillLight.position.set(0, 1.1, 2.0);
  scene.add(fillLight);

  // ----- 地台 -----
  const ground = new THREE.Mesh(
    new THREE.CircleGeometry(3.2, 80),
    new THREE.MeshStandardMaterial({ color: 0x16090f, roughness: 0.38, metalness: 0.45, envMapIntensity: 0.7 })
  );
  ground.rotation.x = -Math.PI / 2;
  ground.receiveShadow = true;
  scene.add(ground);

  const ringMat = new THREE.MeshBasicMaterial({
    color: 0xe8a0b4, transparent: true, opacity: 0.4,
    blending: THREE.AdditiveBlending, side: THREE.DoubleSide, depthWrite: false,
  });
  const ring = new THREE.Mesh(new THREE.RingGeometry(1.18, 1.2, 96), ringMat);
  ring.rotation.x = -Math.PI / 2;
  ring.position.y = 0.002;
  scene.add(ring);
  const ring2 = new THREE.Mesh(new THREE.RingGeometry(1.32, 1.325, 96), ringMat.clone());
  ring2.material.opacity = 0.16;
  ring2.rotation.x = -Math.PI / 2;
  ring2.position.y = 0.002;
  scene.add(ring2);

  // ----- 身后辉光 -----
  const glowMat = new THREE.SpriteMaterial({
    map: makeGlowTexture('#e8a0b4'), transparent: true, opacity: 0.3,
    blending: THREE.AdditiveBlending, depthWrite: false,
  });
  const glow = new THREE.Sprite(glowMat);
  glow.scale.set(5.5, 5.5, 1);
  glow.position.set(0, 1.25, -1.6);
  scene.add(glow);

  // ----- 漂浮粒子 -----
  const COUNT = 280;
  const positions = new Float32Array(COUNT * 3);
  const seeds = new Float32Array(COUNT * 2);
  for (let i = 0; i < COUNT; i++) {
    const r = 0.6 + Math.random() * 2.6;
    const a = Math.random() * Math.PI * 2;
    positions[i * 3] = Math.cos(a) * r;
    positions[i * 3 + 1] = Math.random() * 2.6;
    positions[i * 3 + 2] = Math.sin(a) * r;
    seeds[i * 2] = Math.random() * Math.PI * 2;
    seeds[i * 2 + 1] = 0.2 + Math.random() * 0.8;
  }
  const pGeo = new THREE.BufferGeometry();
  pGeo.setAttribute('position', new THREE.BufferAttribute(positions, 3));
  const pMat = new THREE.PointsMaterial({
    color: 0xe8a0b4, size: 0.018, transparent: true, opacity: 0.55,
    map: makeGlowTexture('#ffffff'), blending: THREE.AdditiveBlending,
    depthWrite: false, sizeAttenuation: true,
  });
  const particles = new THREE.Points(pGeo, pMat);
  scene.add(particles);

  function updateParticles(t) {
    const pos = pGeo.attributes.position;
    for (let i = 0; i < COUNT; i++) {
      const phase = seeds[i * 2];
      const speed = seeds[i * 2 + 1];
      pos.array[i * 3 + 1] += speed * 0.0009;
      if (pos.array[i * 3 + 1] > 2.7) pos.array[i * 3 + 1] = 0;
      pos.array[i * 3] += Math.sin(t * 0.4 + phase) * 0.0004;
    }
    pos.needsUpdate = true;
    ring.rotation.z = t * 0.05;
    ring2.rotation.z = -t * 0.03;
  }

  function setTheme(name) {
    const th = THEMES[name] || THEMES.dusk;
    keyLight.color.setHex(th.key);
    rimLight.color.setHex(th.rim);
    hemiLight.color.setHex(th.hemi);
    ground.material.color.setHex(th.ground);
    ringMat.color.setHex(th.rim);
    ring2.material.color.setHex(th.rim);
    glowMat.map = makeGlowTexture(th.glow);
    glowMat.needsUpdate = true;
    pMat.color.setHex(th.rim);
    document.body.dataset.theme = name;
  }

  function resetCamera() {
    camera.position.set(0, 1.32, 2.7);
    controls.target.set(0, 1.02, 0);
    controls.update();
  }

  window.addEventListener('resize', () => {
    camera.aspect = window.innerWidth / window.innerHeight;
    camera.updateProjectionMatrix();
    renderer.setSize(window.innerWidth, window.innerHeight);
  });

  return { renderer, scene, camera, controls, updateParticles, setTheme, resetCamera };
}
