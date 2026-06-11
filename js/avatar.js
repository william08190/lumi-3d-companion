// avatar.js — 模型加载与驱动：VRM（规范化骨骼）与通用人形 GLB（RPM/Avaturn/Mixamo）双适配
import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { VRMLoaderPlugin, VRMUtils } from '@pixiv/three-vrm';

// 可控关节定义：name = VRM 人形骨骼名，label = 中文名，group = 面板分组
export const BONE_DEFS = [
  { name: 'head',          label: '头部',   group: '头颈' },
  { name: 'neck',          label: '颈部',   group: '头颈' },
  { name: 'upperChest',    label: '上胸',   group: '躯干' },
  { name: 'chest',         label: '胸腔',   group: '躯干' },
  { name: 'spine',         label: '腰脊',   group: '躯干' },
  { name: 'hips',          label: '髋部',   group: '躯干' },
  { name: 'leftShoulder',  label: '左肩',   group: '左臂' },
  { name: 'leftUpperArm',  label: '左大臂', group: '左臂', range: 2.8 },
  { name: 'leftLowerArm',  label: '左小臂', group: '左臂', range: 2.6 },
  { name: 'leftHand',      label: '左手腕', group: '左臂' },
  { name: 'rightShoulder', label: '右肩',   group: '右臂' },
  { name: 'rightUpperArm', label: '右大臂', group: '右臂', range: 2.8 },
  { name: 'rightLowerArm', label: '右小臂', group: '右臂', range: 2.6 },
  { name: 'rightHand',     label: '右手腕', group: '右臂' },
  { name: 'leftUpperLeg',  label: '左大腿', group: '左腿', range: 2.2 },
  { name: 'leftLowerLeg',  label: '左小腿', group: '左腿', range: 2.2 },
  { name: 'leftFoot',      label: '左脚踝', group: '左腿' },
  { name: 'rightUpperLeg', label: '右大腿', group: '右腿', range: 2.2 },
  { name: 'rightLowerLeg', label: '右小腿', group: '右腿', range: 2.2 },
  { name: 'rightFoot',     label: '右脚踝', group: '右腿' },
];

// GLB 模式逐帧应用顺序（必须父骨在前，保证世界矩阵级联正确）
const BONE_ORDER = [
  'hips', 'spine', 'chest', 'upperChest', 'neck', 'head',
  'leftShoulder', 'leftUpperArm', 'leftLowerArm', 'leftHand',
  'rightShoulder', 'rightUpperArm', 'rightLowerArm', 'rightHand',
  'leftUpperLeg', 'leftLowerLeg', 'leftFoot',
  'rightUpperLeg', 'rightLowerLeg', 'rightFoot',
];

// 通用 GLB 骨骼名解析：规范名 → 各家命名（统一小写、去 mixamorig 前缀后匹配）
const GLB_BONE_ALIASES = {
  hips: ['hips'], spine: ['spine'], chest: ['spine1'], upperChest: ['spine2'],
  neck: ['neck'], head: ['head'],
  leftShoulder: ['leftshoulder'], leftUpperArm: ['leftarm'], leftLowerArm: ['leftforearm'], leftHand: ['lefthand'],
  rightShoulder: ['rightshoulder'], rightUpperArm: ['rightarm'], rightLowerArm: ['rightforearm'], rightHand: ['righthand'],
  leftUpperLeg: ['leftupleg'], leftLowerLeg: ['leftleg'], leftFoot: ['leftfoot'],
  rightUpperLeg: ['rightupleg'], rightLowerLeg: ['rightleg'], rightFoot: ['rightfoot'],
  leftEye: ['lefteye'], rightEye: ['righteye'],
};

// 规范表情 → ARKit 52 BlendShape 组合（RPM / Avaturn 照片模型）
const ARKIT_EXPRESSIONS = {
  blink:      [['eyeBlinkLeft', 1], ['eyeBlinkRight', 1]],
  blinkLeft:  [['eyeBlinkLeft', 1]],
  blinkRight: [['eyeBlinkRight', 1]],
  happy:      [['mouthSmileLeft', 0.85], ['mouthSmileRight', 0.85], ['cheekSquintLeft', 0.4], ['cheekSquintRight', 0.4], ['eyeSquintLeft', 0.3], ['eyeSquintRight', 0.3]],
  relaxed:    [['eyeBlinkLeft', 0.35], ['eyeBlinkRight', 0.35], ['mouthSmileLeft', 0.4], ['mouthSmileRight', 0.4]],
  angry:      [['browDownLeft', 1], ['browDownRight', 1], ['noseSneerLeft', 0.4], ['noseSneerRight', 0.4], ['mouthFrownLeft', 0.35], ['mouthFrownRight', 0.35]],
  sad:        [['browInnerUp', 0.9], ['mouthFrownLeft', 0.7], ['mouthFrownRight', 0.7], ['eyeSquintLeft', 0.2], ['eyeSquintRight', 0.2]],
  surprised:  [['browInnerUp', 0.8], ['browOuterUpLeft', 0.7], ['browOuterUpRight', 0.7], ['eyeWideLeft', 0.9], ['eyeWideRight', 0.9], ['jawOpen', 0.3]],
  aa:         [['jawOpen', 0.6]],
  ih:         [['jawOpen', 0.25], ['mouthStretchLeft', 0.4], ['mouthStretchRight', 0.4]],
  ou:         [['mouthPucker', 0.9], ['jawOpen', 0.2]],
  ee:         [['mouthStretchLeft', 0.6], ['mouthStretchRight', 0.6], ['mouthSmileLeft', 0.2], ['mouthSmileRight', 0.2]],
  oh:         [['mouthFunnel', 0.8], ['jawOpen', 0.35]],
};

// 自然站立姿势（世界轴约定，T-Pose 为零位；左臂下垂 = -Z，右臂下垂 = +Z，+X = 低头）
export const DEFAULT_POSE = {
  leftUpperArm:  { x: 0,     y: 0,     z: -1.15 },
  rightUpperArm: { x: 0,     y: 0,     z: 1.15 },
  leftLowerArm:  { x: 0,     y: -0.25, z: -0.06 },
  rightLowerArm: { x: 0,     y: 0.25,  z: 0.06 },
  leftHand:      { x: 0,     y: 0,     z: -0.1 },
  rightHand:     { x: 0,     y: 0,     z: 0.1 },
  leftShoulder:  { x: 0,     y: 0,     z: -0.06 },
  rightShoulder: { x: 0,     y: 0,     z: 0.06 },
};

export const POSE_PRESETS = {
  natural: DEFAULT_POSE,
  greet: {
    ...DEFAULT_POSE,
    rightUpperArm: { x: 0, y: -0.25, z: -0.85 },
    rightLowerArm: { x: 0, y: 0.35, z: -0.55 },
    rightHand:     { x: 0, y: 0, z: -0.2 },
    head:          { x: 0, y: 0.12, z: -0.1 },
  },
  akimbo: {
    ...DEFAULT_POSE,
    leftUpperArm:  { x: 0, y: 0.55, z: -0.9 },
    leftLowerArm:  { x: 0, y: -1.7, z: -0.1 },
    rightUpperArm: { x: 0, y: -0.55, z: 0.9 },
    rightLowerArm: { x: 0, y: 1.7, z: 0.1 },
    head:          { x: 0, y: 0, z: 0.06 },
  },
  tpose: {},
};

const zero = () => ({ x: 0, y: 0, z: 0 });
const _q1 = new THREE.Quaternion();
const _q2 = new THREE.Quaternion();
const _e = new THREE.Euler();
const _v = new THREE.Vector3();

export class Avatar {
  constructor(scene) {
    this.scene = scene;
    this.vrm = null;           // VRM 模式
    this.glb = null;           // 通用 GLB 模式 { root, bones, rest, morphs, eyes, armDroop }
    this.basePose = {};
    this.poseTween = null;
    this.exprBaseTarget = {};
    this.exprCurrent = {};
    this.expressionNames = [];
    this.onPoseChanged = null;
    this.eyeGaze = { yaw: 0, pitch: 0 };

    this.loader = new GLTFLoader();
    this.loader.register((parser) => new VRMLoaderPlugin(parser));
  }

  get mode() { return this.vrm ? 'vrm' : (this.glb ? 'glb' : null); }

  get modelRoot() { return this.vrm?.scene || this.glb?.root || null; }

  async load(url, onProgress) {
    const gltf = await new Promise((resolve, reject) => {
      this.loader.load(url, resolve, (ev) => {
        if (ev.total && onProgress) onProgress(ev.loaded / ev.total);
      }, reject);
    });

    this._disposeCurrent();

    const vrm = gltf.userData.vrm;
    if (vrm) this._setupVRM(gltf, vrm);
    else this._setupGLB(gltf);

    this.exprCurrent = {};
    this.exprBaseTarget = {};
    this.resetPose(true);
    return this.vrm || this.glb;
  }

  _disposeCurrent() {
    const old = this.vrm?.scene || this.glb?.root;
    if (old) {
      this.scene.remove(old);
      try { VRMUtils.deepDispose(old); } catch (e) { /* 通用清理 */ }
    }
    this.vrm = null;
    this.glb = null;
  }

  // ---------- VRM 模式 ----------
  _setupVRM(gltf, vrm) {
    try { VRMUtils.removeUnnecessaryVertices(gltf.scene); } catch (e) { /* 部分模型不支持 */ }
    try { VRMUtils.combineSkeletons(gltf.scene); } catch (e) { /* 旧版兼容 */ }
    VRMUtils.rotateVRM0(vrm); // VRM 0.x 统一转为面向 +Z

    vrm.scene.traverse((obj) => {
      if (obj.isMesh) { obj.castShadow = true; obj.frustumCulled = false; }
    });

    this.vrm = vrm;
    this.scene.add(vrm.scene);

    // 探测规范化骨骼坐标系朝向：VRM0 与 VRM1 的规范化骨骼局部轴绕 Y 相差 180°，
    // 导致 X/Z 轴旋转的视觉方向相反。以髋骨静止世界朝向为准自动校正。
    vrm.scene.updateMatrixWorld(true);
    const hipsNode = this.getBone('hips');
    this.signX = 1;
    this.signZ = 1;
    if (hipsNode) {
      hipsNode.getWorldQuaternion(_q1);
      this.signX = _v.set(1, 0, 0).applyQuaternion(_q1).x >= 0 ? 1 : -1;
      this.signZ = _v.set(0, 0, 1).applyQuaternion(_q1).z >= 0 ? 1 : -1;
    }

    // 收集表情（小写映射，兼容命名差异）
    this.expressionNames = [];
    this.exprNameMap = {};
    const em = vrm.expressionManager;
    if (em) {
      for (const expr of em.expressions) {
        this.expressionNames.push(expr.expressionName);
        this.exprNameMap[expr.expressionName.toLowerCase()] = expr.expressionName;
      }
    }
  }

  // ---------- 通用 GLB 模式（照片生成模型：RPM / Avaturn / Mixamo 骨骼） ----------
  _setupGLB(gltf) {
    const root = gltf.scene;
    root.traverse((obj) => {
      if (obj.isMesh) { obj.castShadow = true; obj.frustumCulled = false; }
    });

    // 1. 骨骼解析：统一小写、去前缀
    const norm = (n) => n.toLowerCase().replace(/^.*?mixamorig:?/i, '').replace(/[_\s:.]/g, '');
    const byName = {};
    root.traverse((obj) => {
      if (obj.isBone || obj.type === 'Bone') byName[norm(obj.name)] = obj;
    });
    // 部分导出骨骼不是 Bone 类型，兜底用 Object3D 名称匹配
    if (!byName.hips) {
      root.traverse((obj) => {
        const n = norm(obj.name);
        if (GLB_BONE_ALIASES.hips.includes(n) && !byName[n]) byName[n] = obj;
      });
    }
    const bones = {};
    for (const [canonical, aliases] of Object.entries(GLB_BONE_ALIASES)) {
      for (const a of aliases) {
        if (byName[a]) { bones[canonical] = byName[a]; break; }
      }
    }
    if (!bones.hips || !bones.head) {
      throw new Error('未找到人形骨骼（需要 Hips/Head 等标准命名）');
    }

    this.scene.add(root);
    root.updateMatrixWorld(true);

    // 朝向探测：面向 +Z（镜头）时模型左手应在世界 +X 侧，否则转身 180°
    if (bones.leftUpperArm && bones.rightUpperArm) {
      const lv = new THREE.Vector3(), rv = new THREE.Vector3();
      bones.leftUpperArm.getWorldPosition(lv);
      bones.rightUpperArm.getWorldPosition(rv);
      if (lv.x < rv.x) {
        root.rotation.y += Math.PI;
        root.updateMatrixWorld(true);
      }
    }

    // 2. 记录静止姿势（局部四元数），世界轴旋转法需要
    const rest = {};
    for (const [name, node] of Object.entries(bones)) {
      rest[name] = node.quaternion.clone();
    }

    // 3. 测量手臂静止下垂角（A-Pose 模型需要补偿，使 T-Pose 零位语义一致）
    let armDroop = 0;
    if (bones.leftUpperArm && bones.leftLowerArm) {
      const a = new THREE.Vector3(), b = new THREE.Vector3();
      bones.leftUpperArm.getWorldPosition(a);
      bones.leftLowerArm.getWorldPosition(b);
      const dir = b.sub(a);
      armDroop = Math.atan2(-dir.y, Math.abs(dir.x) + 1e-6);
      if (!isFinite(armDroop) || armDroop < 0) armDroop = 0;
    }

    // 4. 收集 ARKit 形态键
    const morphMeshes = [];
    root.traverse((obj) => {
      if (obj.isMesh && obj.morphTargetDictionary) morphMeshes.push(obj);
    });
    const hasMorph = (n) => morphMeshes.some((m) => m.morphTargetDictionary[n] !== undefined);
    this.expressionNames = [];
    this.exprNameMap = {};
    for (const [canonical, combos] of Object.entries(ARKIT_EXPRESSIONS)) {
      if (combos.some(([mn]) => hasMorph(mn))) {
        this.expressionNames.push(canonical);
        this.exprNameMap[canonical.toLowerCase()] = canonical;
      }
    }

    this.glb = {
      root, bones, rest, morphMeshes, armDroop,
      eyes: { left: bones.leftEye || null, right: bones.rightEye || null },
      eyeRest: {
        left: bones.leftEye ? bones.leftEye.quaternion.clone() : null,
        right: bones.rightEye ? bones.rightEye.quaternion.clone() : null,
      },
    };
    this.signX = 1;
    this.signZ = 1;
  }

  // ----- 姿势 -----
  resetPose(instant = false) {
    const target = {};
    for (const def of BONE_DEFS) target[def.name] = zero();
    for (const [k, v] of Object.entries(DEFAULT_POSE)) target[k] = { ...zero(), ...v };
    if (instant) {
      this.basePose = target;
      this.poseTween = null;
      this.onPoseChanged && this.onPoseChanged();
    } else {
      this.tweenTo(target);
    }
  }

  applyPreset(name) {
    const preset = POSE_PRESETS[name];
    if (!preset) return;
    const target = {};
    for (const def of BONE_DEFS) target[def.name] = { ...zero(), ...(preset[def.name] || {}) };
    this.tweenTo(target);
  }

  tweenTo(target, duration = 0.65) {
    const from = {};
    for (const def of BONE_DEFS) {
      const cur = this.basePose[def.name] || zero();
      from[def.name] = { ...cur };
    }
    this.poseTween = { from, to: target, t: 0, duration };
  }

  updatePoseTween(delta) {
    if (!this.poseTween) return;
    const tw = this.poseTween;
    tw.t = Math.min(tw.t + delta / tw.duration, 1);
    const e = 1 - Math.pow(1 - tw.t, 3); // easeOutCubic
    for (const def of BONE_DEFS) {
      const a = tw.from[def.name], b = tw.to[def.name];
      this.basePose[def.name] = {
        x: a.x + (b.x - a.x) * e,
        y: a.y + (b.y - a.y) * e,
        z: a.z + (b.z - a.z) * e,
      };
    }
    this.onPoseChanged && this.onPoseChanged();
    if (tw.t >= 1) this.poseTween = null;
  }

  setJoint(name, axis, value) {
    if (!this.basePose[name]) this.basePose[name] = zero();
    this.basePose[name][axis] = value;
    this.poseTween = null;
  }

  getBone(name) {
    if (this.vrm) return this.vrm.humanoid?.getNormalizedBoneNode(name) || null;
    if (this.glb) return this.glb.bones[name] || null;
    return null;
  }

  setEyeGaze(yaw, pitch) {
    this.eyeGaze.yaw = yaw;
    this.eyeGaze.pitch = pitch;
  }

  // 每帧合成：基础姿势 + 各动画系统偏移量
  applyFrame(...offsetMaps) {
    if (!this.mode) return;
    const compose = (name) => {
      const base = this.basePose[name] || zero();
      let x = base.x, y = base.y, z = base.z;
      for (const map of offsetMaps) {
        const off = map && map[name];
        if (off) { x += off.x || 0; y += off.y || 0; z += off.z || 0; }
      }
      return { x, y, z };
    };

    if (this.vrm) {
      for (const def of BONE_DEFS) {
        const node = this.getBone(def.name);
        if (!node) continue;
        const r = compose(def.name);
        node.rotation.set(r.x * this.signX, r.y, r.z * this.signZ);
      }
      return;
    }

    // GLB：世界轴旋转法。E 为世界轴欧拉旋转，换算到骨骼局部：
    // q_local = Qp⁻¹ · E · Qp · R0（Qp = 父骨当前世界旋转，R0 = 静止局部旋转）
    // 父骨先行处理，保证级联正确
    const g = this.glb;
    for (const name of BONE_ORDER) {
      const node = g.bones[name];
      if (!node) continue;
      const r = compose(name);
      // A-Pose 手臂下垂补偿：让 z=0 等效 T-Pose 水平
      if (name === 'leftUpperArm') r.z += g.armDroop;
      else if (name === 'rightUpperArm') r.z -= g.armDroop;
      node.parent.updateWorldMatrix(true, false);
      node.parent.getWorldQuaternion(_q1);
      _e.set(r.x, r.y, r.z, 'XYZ');
      _q2.setFromEuler(_e);
      node.quaternion.copy(_q1).invert().multiply(_q2).multiply(_q1).multiply(g.rest[name]);
    }

    // 眼球追踪（VRM 由 lookAt 处理；GLB 用眼骨）
    const yaw = THREE.MathUtils.clamp(this.eyeGaze.yaw, -0.35, 0.35);
    const pitch = THREE.MathUtils.clamp(this.eyeGaze.pitch, -0.25, 0.25);
    for (const side of ['left', 'right']) {
      const eye = g.eyes[side];
      if (!eye) continue;
      eye.parent.updateWorldMatrix(true, false);
      eye.parent.getWorldQuaternion(_q1);
      _e.set(pitch, yaw, 0, 'XYZ');
      _q2.setFromEuler(_e);
      eye.quaternion.copy(_q1).invert().multiply(_q2).multiply(_q1).multiply(g.eyeRest[side]);
    }
  }

  // ----- 表情 -----
  setMood(values) {
    this.exprBaseTarget = { ...values };
  }

  setExpressionBase(name, value) {
    this.exprBaseTarget[name] = value;
  }

  applyExpressions(delta, ...overrideMaps) {
    if (!this.mode) return;
    const k = Math.min(1, delta * 7);
    const touched = new Set([
      ...Object.keys(this.exprCurrent),
      ...Object.keys(this.exprBaseTarget),
    ]);
    for (const map of overrideMaps) if (map) for (const n of Object.keys(map)) touched.add(n);

    const finalValues = {};
    for (const name of touched) {
      const actual = this.exprNameMap[name.toLowerCase()];
      if (!actual) continue;
      const target = this.exprBaseTarget[name] || 0;
      const cur = this.exprCurrent[name] || 0;
      let v = cur + (target - cur) * k;
      this.exprCurrent[name] = v;
      for (const map of overrideMaps) {
        if (map && map[name] !== undefined) v += map[name];
      }
      finalValues[actual] = THREE.MathUtils.clamp(v, 0, 1);
    }

    if (this.vrm) {
      const em = this.vrm.expressionManager;
      if (em) for (const [name, v] of Object.entries(finalValues)) em.setValue(name, v);
      return;
    }

    // GLB：规范表情 → ARKit 形态键累加
    const morphWeights = {};
    for (const [name, v] of Object.entries(finalValues)) {
      const combos = ARKIT_EXPRESSIONS[name];
      if (!combos) continue;
      for (const [mn, scale] of combos) {
        morphWeights[mn] = (morphWeights[mn] || 0) + v * scale;
      }
    }
    for (const mesh of this.glb.morphMeshes) {
      for (const [mn, w] of Object.entries(morphWeights)) {
        const idx = mesh.morphTargetDictionary[mn];
        if (idx !== undefined) mesh.morphTargetInfluences[idx] = THREE.MathUtils.clamp(w, 0, 1);
      }
    }
  }

  getWorldPosOf(boneName, yOffset = 0) {
    const node = this.getBone(boneName);
    if (!node) return null;
    const v = new THREE.Vector3();
    node.getWorldPosition(v);
    v.y += yOffset;
    return v;
  }

  update(delta) {
    this.vrm?.update(delta);
  }
}
