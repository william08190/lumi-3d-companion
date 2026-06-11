# LUMI · 心动玩偶

纯网页版 3D 互动伴侣 —— 真 3D 渲染、全身关节可动、感知鼠标位置与点击。零构建、零后端，浏览器打开即用。

**🎮 在线试玩（无需安装，点开即玩）：<https://william08190.github.io/lumi-3d-companion/>**

[![Live Demo](https://img.shields.io/badge/🎮_在线试玩-Live_Demo-e8527a?style=for-the-badge)](https://william08190.github.io/lumi-3d-companion/)

![tech](https://img.shields.io/badge/Three.js-0.170-e8a0b4) ![tech](https://img.shields.io/badge/three--vrm-3.x-d8b78a) ![tech](https://img.shields.io/badge/构建-无需-9fb8e8)

## ✨ 功能

| 功能 | 说明 |
|---|---|
| 👁️ 视线感知 | 眼球 + 头 / 颈 / 胸三层联动追随鼠标，平滑阻尼 |
| 👆 点击互动 | 头 / 脸 / 胸 / 腹 / 手 / 臂 / 腿 / 脚 8 个区域独立反应：表情 + 动作 + 台词气泡 |
| 🦴 全身关节 | 20 个关节 × 3 轴。姿势模式下直接拖拽身上发光关节点（Shift 拖 = 扭转），或用滑杆微调 |
| 🧘 姿势预设 | 自然站立 / 挥手致意 / 元气叉腰 / T-Pose，0.65s 缓动过渡 |
| 🎭 表情调音台 | 自动读取模型全部表情（开心 / 生气 / 委屈 / 口型等）自由混合 |
| 📸 照片定制形象 | 上传自己的照片，AI 生成专属写实 3D 形象并自动载入（内嵌 Avaturn，备选 Ready Player Me） |
| 🌬️ 生命感 | 程序化呼吸、重心摇摆、随机眨眼（含双连眨）、头发裙摆物理（VRM SpringBone） |
| 🎨 氛围主题 | 暮夜玫瑰 / 午夜蓝调 / 晨光暖橘，灯光 + 背景整体切换 |
| 📦 自定义模型 | 任意 `.vrm` / `.glb` 人形模型拖入窗口即可替换（自动适配 VRM 0.x / 1.x / Mixamo / RPM / Avaturn 骨骼） |

## 🚀 运行

**方式一：在线试玩（推荐）** — 直接打开 <https://william08190.github.io/lumi-3d-companion/>，无需任何安装。

**方式二：本地运行** — 需要通过本地 HTTP 服务器打开（ES Module + 模型加载有跨域限制）：

```bash
cd web-girlfriend-3d
python -m http.server 8080
# 或 npx serve
```

浏览器访问 `http://localhost:8080`。可用 `?model=<url>` 参数指定启动模型。

> 默认模型按「本地 `assets/AvatarSample_B.vrm` → jsDelivr CDN」顺序自动加载，克隆仓库后无需手动下载模型即可运行；如需离线使用，把[模型文件](https://cdn.jsdelivr.net/gh/madjin/vrm-samples@master/vroid/stable/AvatarSample_B.vrm)存入 `assets/` 即可。

## 📸 用照片自定义形象

面板 → 设置 → 「照片定制形象」：

1. **Avaturn**（推荐，国内可直连）— 上传 2 张照片或自拍，生成写实 3D 形象，点击「Next」自动载入
2. **Ready Player Me** — 部分网络环境需开启国际加速
3. 也可在任意服务官网生成后下载 `.glb` / `.vrm` 文件，直接拖入窗口

照片生成的模型同样支持视线跟随、点击互动、全身关节摆姿势与 ARKit 表情系统。

## 🕹️ 操作

- **移动鼠标** — 她的视线与头部跟随你
- **左键点击身体** — 触发对应部位的互动反应
- **右键拖动** — 旋转视角；**滚轮** — 缩放
- **姿势模式**（面板 → 姿势）— 拖拽关节点摆姿势

## 📁 结构

```
web-girlfriend-3d/
├── index.html          # 页面骨架 + importmap
├── css/style.css       # 暮夜玫瑰视觉主题
├── js/
│   ├── main.js         # 入口与主循环（动画合成管线）
│   ├── scene.js        # 渲染器 / 灯光 / 地台 / 粒子
│   ├── avatar.js       # 模型加载与驱动：VRM + 通用人形 GLB 双适配
│   ├── gaze.js         # 视线与头部跟随
│   ├── animations.js   # 待机微动 / 反应播放器 / 反应与心情定义
│   ├── interaction.js  # 点击区域判定 / 关节拖拽
│   ├── photo.js        # 照片生成形象（Avaturn / RPM 内嵌创建器）
│   ├── pose.js         # 关节滑杆面板
│   └── ui.js           # 面板 / 气泡 / 自定义光标
└── assets/              # 本地模型目录（可选，默认走 CDN）
```

## 🔧 技术要点

- **Three.js + @pixiv/three-vrm**：ACES 色调映射、PCF 软阴影、IBL 环境光照
- **规范化骨骼坐标系自动探测**：VRM 0.x 与 1.x 的规范化骨骼局部轴相差 180°，加载时以髋骨世界朝向探测并统一符号，任何模型姿势方向都正确
- **通用 GLB 人形适配层**：世界轴旋转法（`q_local = Qp⁻¹·E·Qp·R0`）让 Mixamo / RPM / Avaturn 骨骼与 VRM 共用同一套姿势语义；A-Pose 自动补偿、朝向自动探测、ARKit 52 BlendShape 表情映射、眼骨视线追踪
- **动画合成管线**：`基础姿势(用户) + 待机微动 + 点击反应 + 视线跟随` 每帧叠加合成，互不干扰
- **表情名大小写兼容**：自动建立小写映射，兼容不同作者模型的命名习惯

默认模型 [AvatarSample_B](https://vroid.pixiv.help/hc/en-us/articles/4402394424089) 版权归 pixiv / VRoid Project，允许任何人免费使用与改作（禁止有偿再分发）。
