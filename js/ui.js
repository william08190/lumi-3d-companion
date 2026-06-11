// ui.js — 面板接线、气泡、光标、加载遮罩
import * as THREE from 'three';
import { MOODS } from './animations.js';

export class UI {
  constructor() {
    this.bubble = document.getElementById('speechBubble');
    this.bubbleText = document.getElementById('speechText');
    this.bubbleTimer = null;
    this.bubbleAnchor = new THREE.Vector3();

    this.loader = document.getElementById('loader');
    this.loaderFill = document.getElementById('loaderFill');
    this.loaderText = document.getElementById('loaderText');

    this._initTabs();
    this._initCursor();
    this._initPanelToggle();
  }

  _initTabs() {
    const tabs = document.querySelectorAll('.tab');
    const pages = document.querySelectorAll('.tab-page');
    tabs.forEach((tab) => {
      tab.addEventListener('click', () => {
        tabs.forEach((t) => t.classList.toggle('is-active', t === tab));
        pages.forEach((p) => p.classList.toggle('is-active', p.dataset.page === tab.dataset.tab));
      });
    });
  }

  _initPanelToggle() {
    const panel = document.getElementById('panel');
    document.getElementById('panelToggle').addEventListener('click', () => {
      panel.classList.toggle('is-collapsed');
    });
  }

  _initCursor() {
    const dot = document.getElementById('cursorDot');
    const ring = document.getElementById('cursorRing');
    let rx = innerWidth / 2, ry = innerHeight / 2;
    let tx = rx, ty = ry;
    window.addEventListener('pointermove', (e) => {
      tx = e.clientX; ty = e.clientY;
      dot.style.left = `${tx}px`;
      dot.style.top = `${ty}px`;
      const overUi = e.target.closest && e.target.closest('.panel, .joint-marker, .hint-bar');
      ring.classList.toggle('is-hover', !!overUi);
    });
    window.addEventListener('pointerdown', () => ring.classList.add('is-down'));
    window.addEventListener('pointerup', () => ring.classList.remove('is-down'));
    const loop = () => {
      rx += (tx - rx) * 0.18;
      ry += (ty - ry) * 0.18;
      ring.style.left = `${rx}px`;
      ring.style.top = `${ry}px`;
      requestAnimationFrame(loop);
    };
    loop();
  }

  // ----- 气泡 -----
  showBubble(text) {
    this.bubbleText.textContent = text;
    this.bubble.classList.add('is-visible');
    clearTimeout(this.bubbleTimer);
    this.bubbleTimer = setTimeout(() => this.bubble.classList.remove('is-visible'), 2600);
  }

  updateBubblePosition(avatar, camera) {
    if (!this.bubble.classList.contains('is-visible')) return;
    const head = avatar.getWorldPosOf('head', 0.22);
    if (!head) return;
    this.bubbleAnchor.copy(head).project(camera);
    this.bubble.style.left = `${(this.bubbleAnchor.x * 0.5 + 0.5) * innerWidth}px`;
    this.bubble.style.top = `${(-this.bubbleAnchor.y * 0.5 + 0.5) * innerHeight}px`;
  }

  // ----- 加载遮罩 -----
  setProgress(ratio, text) {
    this.loaderFill.style.width = `${Math.round(ratio * 100)}%`;
    this.loaderText.style.color = '';
    if (text) this.loaderText.textContent = text;
  }

  hideLoader() {
    this.loader.classList.add('is-done');
  }

  showError(msg) {
    this.loaderText.textContent = msg;
    this.loaderText.style.color = '#e87a7a';
  }

  // ----- 控件接线 -----
  wire({ avatar, gaze, idle, sceneCtl, interaction, posePanel }) {
    // 心情
    document.querySelectorAll('#moodRow .chip').forEach((chip) => {
      chip.addEventListener('click', () => {
        document.querySelectorAll('#moodRow .chip').forEach((c) => c.classList.remove('is-active'));
        chip.classList.add('is-active');
        avatar.setMood(MOODS[chip.dataset.mood] || {});
        this._syncExpressionSliders(avatar);
      });
    });

    // 开关
    document.getElementById('optGaze').addEventListener('change', (e) => { gaze.enabled = e.target.checked; });
    document.getElementById('optBlink').addEventListener('change', (e) => { idle.blinkEnabled = e.target.checked; });
    document.getElementById('optBreath').addEventListener('change', (e) => { idle.breathEnabled = e.target.checked; });

    // 姿势模式
    document.getElementById('optPoseMode').addEventListener('change', (e) => {
      interaction.setPoseMode(e.target.checked);
      if (e.target.checked) this.showBubble('要给我摆什么姿势呢？');
    });

    // 姿势预设
    document.querySelectorAll('[data-preset]').forEach((chip) => {
      chip.addEventListener('click', () => avatar.applyPreset(chip.dataset.preset));
    });
    document.getElementById('btnResetPose').addEventListener('click', () => avatar.resetPose());

    // 主题
    document.querySelectorAll('[data-theme-btn]').forEach((chip) => {
      chip.addEventListener('click', () => {
        document.querySelectorAll('[data-theme-btn]').forEach((c) => c.classList.remove('is-active'));
        chip.classList.add('is-active');
        sceneCtl.setTheme(chip.dataset.themeBtn);
      });
    });

    // 镜头
    document.getElementById('btnResetCam').addEventListener('click', () => sceneCtl.resetCamera());

    // 表情重置
    document.getElementById('btnResetExpr').addEventListener('click', () => {
      avatar.setMood({});
      document.querySelectorAll('#moodRow .chip').forEach((c) => c.classList.remove('is-active'));
      this._syncExpressionSliders(avatar);
    });
  }

  // 根据模型实际表情列表生成滑杆
  buildExpressionSliders(avatar) {
    const container = document.getElementById('expressionSliders');
    container.innerHTML = '';
    const skip = new Set(['lookUp', 'lookDown', 'lookLeft', 'lookRight']);
    const labels = {
      happy: '开心', angry: '生气', sad: '难过', relaxed: '温柔', surprised: '惊讶',
      aa: '张嘴-啊', ih: '张嘴-咿', ou: '张嘴-呜', ee: '张嘴-诶', oh: '张嘴-哦',
      blink: '闭眼', blinkLeft: '眨左眼', blinkRight: '眨右眼', neutral: '默认',
    };
    this.exprInputs = new Map();
    for (const name of avatar.expressionNames) {
      if (skip.has(name)) continue;
      const row = document.createElement('div');
      row.className = 'slider-row';
      const label = document.createElement('label');
      label.textContent = labels[name] || name;
      const input = document.createElement('input');
      input.type = 'range';
      input.min = 0; input.max = 1; input.step = 0.01; input.value = 0;
      const output = document.createElement('output');
      output.textContent = '0';
      input.addEventListener('input', () => {
        avatar.setExpressionBase(name, parseFloat(input.value));
        output.textContent = input.value;
      });
      row.append(label, input, output);
      container.appendChild(row);
      this.exprInputs.set(name, { input, output });
    }
  }

  _syncExpressionSliders(avatar) {
    if (!this.exprInputs) return;
    for (const [name, { input, output }] of this.exprInputs) {
      const v = avatar.exprBaseTarget[name] || 0;
      input.value = v;
      output.textContent = v.toFixed(2);
    }
  }
}
