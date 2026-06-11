// main.js — 启动入口与主循环
import * as THREE from 'three';
import { createScene } from './scene.js';
import { Avatar } from './avatar.js';
import { GazeController } from './gaze.js';
import { IdleAnimator, ReactionPlayer } from './animations.js';
import { InteractionController } from './interaction.js';
import { PosePanel } from './pose.js';
import { PhotoAvatarCreator } from './photo.js';
import { UI } from './ui.js';

const params = new URLSearchParams(location.search);
// 默认模型：本地优先，缺失时自动回退 CDN（仓库不含模型文件时仍可直接运行）
const MODEL_CDN = 'https://cdn.jsdelivr.net/gh/madjin/vrm-samples@master/vroid/stable/AvatarSample_B.vrm';
const DEFAULT_CANDIDATES = params.get('model') ? [params.get('model')] : ['assets/AvatarSample_B.vrm', MODEL_CDN];
const GREETINGS = ['你来啦，我等你好久了～', '今天也想我了吗？', '嗨～要一直看着我哦'];

const canvas = document.getElementById('stage');
const ui = new UI();
const sceneCtl = createScene(canvas);
const { renderer, scene, camera, controls } = sceneCtl;

const avatar = new Avatar(scene);
const gaze = new GazeController(scene, camera);
const idle = new IdleAnimator();
const reactionPlayer = new ReactionPlayer();
const interaction = new InteractionController({ canvas, camera, avatar, reactionPlayer, ui });
let posePanel = null;

// ----- 模型加载 -----
async function loadModel(url, { revoke = false, greeting = null } = {}) {
  document.getElementById('loader').classList.remove('is-done');
  ui.setProgress(0.02, '正在唤醒她…');
  try {
    const model = await avatar.load(url, (r) => ui.setProgress(0.02 + r * 0.9, '正在唤醒她…'));
    gaze.attach(model);
    ui.setProgress(1, '她醒来了 ♥');
    if (!posePanel) posePanel = new PosePanel(avatar);
    else posePanel.syncFromAvatar();
    ui.buildExpressionSliders(avatar);
    setTimeout(() => {
      ui.hideLoader();
      ui.showBubble(greeting || GREETINGS[Math.floor(Math.random() * GREETINGS.length)]);
    }, 350);
    return true;
  } catch (err) {
    console.error(err);
    ui.showError('模型加载失败：' + (err.message || '请用本地服务器打开页面'));
    // 已有模型在场时，稍后自动恢复画面
    if (avatar.mode) {
      setTimeout(() => {
        ui.hideLoader();
        ui.showBubble('呜…换装失败了，再试一次？');
      }, 2600);
    }
    return false;
  } finally {
    if (revoke) URL.revokeObjectURL(url);
  }
}

// ----- 鼠标感知 -----
window.addEventListener('pointermove', (e) => {
  gaze.onPointerMove(
    (e.clientX / window.innerWidth) * 2 - 1,
    -(e.clientY / window.innerHeight) * 2 + 1
  );
});

// ----- 自定义模型：文件选择 + 拖拽 -----
const MODEL_EXT = /\.(vrm|glb)$/i;
document.getElementById('fileVrm').addEventListener('change', (e) => {
  const file = e.target.files[0];
  if (file && MODEL_EXT.test(file.name)) {
    loadModel(URL.createObjectURL(file), { revoke: true });
  }
});
window.addEventListener('dragover', (e) => e.preventDefault());
window.addEventListener('drop', (e) => {
  e.preventDefault();
  const file = [...(e.dataTransfer?.files || [])].find((f) => MODEL_EXT.test(f.name));
  if (file) {
    loadModel(URL.createObjectURL(file), { revoke: true });
  }
});

// ----- 照片生成形象 -----
const photoCreator = new PhotoAvatarCreator((url) => {
  loadModel(url, { greeting: '好看吗？这是用照片生成的我哦～' });
});
document.getElementById('btnAvaturn').addEventListener('click', () => photoCreator.openAvaturn());
document.getElementById('btnRPM').addEventListener('click', () => photoCreator.openRPM());

// ----- 缓慢环绕 -----
document.getElementById('optOrbit').addEventListener('change', (e) => {
  controls.autoRotate = e.target.checked;
  controls.autoRotateSpeed = 0.6;
});

// ----- UI 接线 -----
ui.wire({ avatar, gaze, idle, sceneCtl, interaction, posePanel });
interaction.onJointEdited = () => posePanel && posePanel.syncFromAvatar();

// 调试/自动化测试钩子
window.__lumi = { avatar, gaze, idle, interaction, camera };

// ----- 主循环 -----
const clock = new THREE.Clock();

function mergeOffsets(...maps) {
  const out = {};
  for (const map of maps) {
    if (!map) continue;
    for (const [bone, off] of Object.entries(map)) {
      if (!out[bone]) out[bone] = { x: 0, y: 0, z: 0 };
      out[bone].x += off.x || 0;
      out[bone].y += off.y || 0;
      out[bone].z += off.z || 0;
    }
  }
  return out;
}

function tick() {
  requestAnimationFrame(tick);
  const delta = Math.min(clock.getDelta(), 0.05);
  const t = clock.elapsedTime;

  controls.update();
  sceneCtl.updateParticles(t);

  if (avatar.mode) {
    avatar.updatePoseTween(delta);
    const idleOut = idle.update(t, delta);
    const reactOut = reactionPlayer.update(delta);
    const gazeOut = gaze.update(delta);
    avatar.setEyeGaze(gaze.yaw * 0.55, gaze.pitch * 0.55); // GLB 模式眼骨追踪（VRM 由 lookAt 处理）

    avatar.applyFrame(mergeOffsets(idleOut.bones, reactOut.bones, gazeOut));
    avatar.applyExpressions(delta, idleOut.exprs, reactOut.exprs);
    avatar.update(delta);

    ui.updateBubblePosition(avatar, camera);
    interaction.updateMarkers();
  }

  renderer.render(scene, camera);
}

// 依次尝试候选地址（本地缺失时回退 CDN）
async function loadDefault() {
  for (let i = 0; i < DEFAULT_CANDIDATES.length; i++) {
    const url = DEFAULT_CANDIDATES[i];
    if (i < DEFAULT_CANDIDATES.length - 1) {
      try {
        // 预检文件是否存在，缺失则直接尝试下一个候选
        const head = await fetch(url, { method: 'HEAD' });
        if (!head.ok) continue;
      } catch { continue; }
    }
    if (await loadModel(url)) return;
  }
}

loadDefault();
tick();
