# `_animation` / `_material` / `_model` — Three.js 1:1 动画复现规范

## 1. 交付目标与结论

本文档描述如何在 Three.js 中逐项复现 Unity 工程里的照片平面动画系统。源资源：

- 动画：`Assets/_animation`
- 材质与纹理：`Assets/_material`
- 模型：`Assets/_model/photo_plane.fbx`
- 精确曲线数据：`Docs/ThreeJSPhotoAnimation/unity-animation-curves.json`

核心结论：这个对象不是简单 `THREE.PlaneGeometry`。它是一个 **7×9 顶点的细分 Quad（63 顶点、96 三角形）+ 24 个 morph targets（Unity BlendShape）+ 根节点 Transform 动画 + 单张贴图材质**。如果只创建 4 顶点平面并做缩放/旋转，无法 1:1 复刻局部肢体、弯曲、鱼身摆动等动画。

最可靠的 Web 方案是：

1. 将 `Assets/_model/photo_plane.fbx` 离线转换为 `.glb`，完整保留 24 个 morph targets。
2. Three.js 用 `GLTFLoader` 加载 `.glb`。
3. 使用本文档附带的曲线 JSON，以 Unity Hermite 曲线规则驱动 `mesh.morphTargetInfluences`、position、quaternion、scale。
4. 人物使用 `user_landscape.png`；鱼使用 `user_fish.png`；纹理按 sRGB 处理。

> `THREE.AnimationMixer` 的线性/平滑插值不能精确表达 Unity 曲线中保存的每个 in/out tangent。若要求数值级 1:1，应使用本文第 7 节的 Hermite 采样器，而不是手工近似 easing。

---

## 2. 资源盘点

### 2.1 动画目录

| 文件 | 时长（秒） | 60 FPS 帧范围 | Loop Time | 有效动画通道 |
|---|---:|---:|---|---|
| `BalloonAnim.anim` | 4.316667 | 0–259 | 是 | Shapekey09、root position.z、root quaternion |
| `BalloonAnimLoop.anim` | 1.683333 | 0–101 | 否 | root position.z、root quaternion |
| `Dance02Anim.anim` | 0.650000 | 0–39 | 是 | Shapekey01 ↔ Shapekey02 |
| `DanceAnim.anim` | 0.483333 | 0–29 | 是 | Shapekey07 ↔ Shapekey08 |
| `FishAnimation.anim` | 1.316667 | 0–79 | 是 | Key 17 ↔ Key 18 |
| `JellyJumpAnim.anim` | 0.983333 | 0–59 | 否 | Shapekey03、Shapekey04 |
| `JumpFlipAnim.anim` | 1.150000 | 0–69 | 否 | Shapekey03、Shapekey04、root position.z、root quaternion |
| `PullRightAnimation.anim` | 1.983333 | 0–119 | 否 | Key 19、Key 21、Key 22 |
| `RaiseHandAnimation.anim` | 1.316667 | 0–79 | 否 | Key 10、Key 11 |
| `RollingAnimation.anim` | 0.650000 | 0–39 | 否 | root position.z、root quaternion |
| `SkinnyAnimation.anim` | 4.566667 | 0–274 | 否 | Key 12–15、Shapekey09、root position.x/z |
| `SkinnyAnimationLoop.anim` | 1.083333 | 0–65 | 是 | root position.x/z、root quaternion |
| `WalkAnimation.anim` | 0.816667 | 0–49 | 是 | Key 23 ↔ Key 24 |
| `WaveAnimation.anim` | 0.650000 | 0–39 | 否 | Key 19 ↔ Key 20 |
| `TestImageAni.anim` | 0.250000 | 0–15 | 否 | scale x/y/z：0 → 1 |

另外包含 3 个 Animator Controller：

- `_photoanim.controller`：人物控制器。
- `_photoanim 1.controller`：鱼控制器。
- `Image.controller`：只播放未被引用的 `TestImageAni`。

所有动画曲线采样率为 60 FPS；曲线自身不是简单逐帧表，而是带切线的 cubic Hermite 曲线。JSON 保存了原始浮点时间、值、入切线、出切线和权重字段。

### 2.2 模型目录

`photo_plane.fbx`：FBX 7.4，Generic rig，无骨骼 Avatar。Unity 导入设置：

- Import Animation：开启
- Import BlendShapes：开启
- Resample Curves：开启
- Animation Compression：Keyframe Reduction
- Global Scale：1
- Use File Units：开启
- Read/Write：关闭（不影响 Web 转换）

FBX 还包含 12 个同名嵌入 clip，但 Unity Animator 实际引用的是 `_animation` 下独立 `.anim` 文件。Web 复刻应以独立 `.anim` 导出的 JSON 为准。

### 2.3 材质目录

实际主链路：

| 用途 | 材质 | 主贴图 | Shader / 参数 |
|---|---|---|---|
| 人物 | `M_PhotoHuman.mat` | `user_landscape.png` | Unity Standard；Cutout；alpha cutoff 0.5；metalness 0；smoothness 0.5；白色 tint |
| 鱼 | `M_PhotoFish.mat` / `fish.mat` | `user_fish.png` | Unity Standard；Cutout；alpha cutoff 0.5；metalness 0；smoothness 0.5 |

纹理共同设置：sRGB、双线性过滤、mipmap、Repeat。源文件均为 1024×768 RGBA；Unity 因 NPOT `ToNearest` 在运行时导入成 1024×1024。Web 若直接使用 PNG，会保留 1024×768；这是推荐做法，不要人为拉伸到 1024×1024。UV 仍是 0–1。

其他资源：

- `RemoveWhiteBackground.shader`：无资产引用。其逻辑是 `mean(rgb) < 0.9 ? alpha=1 : alpha=0`，关闭 ZWrite、标准 alpha blend。它不是当前人物/鱼主材质。
- `New Material.mat`：Standard Cutout，`user_landscape.png`，保存有 `_Threshold=0.9`，但 shader 实际仍是 Standard，阈值字段不起作用。
- `New Material 1.mat`：无主贴图，不属于照片动画主链路。
- `Materials/user_landscape.mat`：未被引用。
- 两张示例图与 `fish.mp4` / `people.mp4`：场景测试或视频资源，不参与 morph 动画本身。

---

## 3. 网格与 Morph Target 规范

### 3.1 基础网格

模型只有一个根节点和一个 `SkinnedMeshRenderer`：

- 节点名：`photo_plane`
- Mesh 名：`user_plane`
- 顶点数：63
- 三角形数：96
- SubMesh：1
- Topology：Triangles
- 基础平面局部尺寸：X = 0.08，Y = 0.06，Z = 0
- 顶点网格：9 列 × 7 行
- UV：约 `[0.001302, 0.999368] × [0.000976, 0.999024]`，边缘略内缩，避免纹理边缘采样渗色
- Normal：基础姿态全部 `(0, 0, 1)`
- Pivot：平面中心附近；模型导入 bounds 会包含 morph 变形范围

虽然用户界面上看起来是一个 Quad，动画所需的实际网格是细分平面。不可替换为 4 顶点 Plane。

### 3.2 Morph Target 顺序

Three.js 端必须保留以下顺序和名称：

| Index | 名称 | Unity 100% 最大顶点位移（模型局部单位） |
|---:|---|---:|
| 0 | Shapekey01 | 0.00590184 |
| 1 | Shapekey02 | 0.00537489 |
| 2 | Shapekey03 | 0.01970793 |
| 3 | Shapekey04 | 0.05801623 |
| 4 | Shapekey05 | 0.00379404 |
| 5 | Shapekey06 | 0.00607047 |
| 6 | Shapekey07 | 0.00287070 |
| 7 | Shapekey08 | 0.00287070 |
| 8 | Shapekey09 | 0.01851492 |
| 9 | Key 10 | 0.01287919 |
| 10 | Key 11 | 0.01575107 |
| 11 | Key 12 | 0.00500814 |
| 12 | Key 13 | 0.01320326 |
| 13 | Key 14 | 0.01305150 |
| 14 | Key 15 | 0.01517617 |
| 15 | Key 16 | 0.01867119 |
| 16 | Key 17 | 0.01097556 |
| 17 | Key 18 | 0.01117577 |
| 18 | Key 21 | 0.04962607 |
| 19 | Key 22 | 0.00804337 |
| 20 | Key 19 | 0.00101175 |
| 21 | Key 20 | 0.00101175 |
| 22 | Key 23 | 0.02086077 |
| 23 | Key 24 | 0.01611443 |

注意名称顺序不是数字顺序：`Key 21/22` 在 `Key 19/20` 前。不要按名字重新排序，应读取 `morphTargetDictionary`。

### 3.3 权重单位

Unity BlendShape 权重为 0–100，Three.js 为 0–1：

```js
mesh.morphTargetInfluences[index] = unityWeight / 100;
```

当状态开始时，Unity Animator 的 `Write Defaults` 为 true。为复现其状态隔离效果，开始新 clip 前应将全部 24 个 morph influence 清零，再应用该 clip 在当前时刻的曲线值。未被 clip 驱动的 root 分量也应恢复到基准 Transform。

---

## 4. 坐标、Transform 与显示尺寸

### 4.1 Unity 基准 Transform

`photo_plane` 根节点导入/实例基准：

- position = `(0, 0, 0)`
- rotation quaternion = `(-0.7071068, 0, 0, 0.7071067)`，即 X 轴 -90°
- scale：FBX/Prefab 实例根为 `(100, 100, 100)`

Prefab 有两个常见缩放：

- `小纸人`、`小纸人 2`：100（同模型默认实例值）
- `小纸人 1`：6750.3

这属于场景显示尺寸，不属于 clip 动画。Three.js 应将“场景布局缩放”放在外层 wrapper，将动画根节点保持单位化，避免把动画位移意外乘错。

推荐层级：

```text
layoutRoot       // Web 页面/场景的位置、最终尺寸
└── animationRoot // JSON 中 root position/quaternion/scale
    └── photo_plane mesh // morph targets + texture
```

### 4.2 Unity → Three.js 手工坐标转换

Unity 与 Three.js 均以 +Y 为上，但 Unity 使用左手坐标习惯，Three.js 为右手坐标。若不是直接使用可靠的 FBX→glTF 转换器，而是手工套用 Unity JSON：

- position：`(x, y, z)_three = (x, y, -z)_unity`
- quaternion：`(x, y, z, w)_three = (-x, -y, z, w)_unity`
- scale：不变
- morph 权重：除以 100

转换后对 quaternion normalize。

若 `.glb` 转换器已对模型坐标做过变换，必须用一个固定姿态校准，避免再次转换两次。校准标准：基础贴图正面朝相机，`JumpFlipAnim` 与 `RollingAnimation` 的翻转方向和 Unity 参考一致。

### 4.3 动画位移的视觉含义

动画中的位移发生在经过 -90° X 旋转的模型根上。Unity 数据常表现为 local position.z 负向，但最终画面通常是竖直跳跃/漂移。不要把 `position.z` 武断解释为 Web 深度；应按完整坐标变换处理。

---

## 5. 材质与纹理在 Three.js 中的复现

### 5.1 Standard Cutout 对应设置

人物和鱼的 Unity 主材质为 Standard Cutout，推荐：

```js
const texture = await new THREE.TextureLoader().loadAsync(url);
texture.colorSpace = THREE.SRGBColorSpace;
texture.wrapS = THREE.RepeatWrapping;
texture.wrapT = THREE.RepeatWrapping;
texture.minFilter = THREE.LinearMipmapLinearFilter;
texture.magFilter = THREE.LinearFilter;
texture.generateMipmaps = true;

const material = new THREE.MeshStandardMaterial({
  map: texture,
  color: 0xffffff,
  metalness: 0,
  roughness: 0.5,       // Unity smoothness 0.5 ≈ roughness 0.5
  alphaTest: 0.5,
  transparent: false,
  side: THREE.FrontSide,
  depthWrite: true,
  depthTest: true
});
```

Unity Standard 的光照结果还依赖场景灯光、环境反射、色彩空间和 tone mapping。若网页目标是“贴图颜色绝对一致”而不是“Unity Standard 灯光一致”，使用 `MeshBasicMaterial` 会更稳定；但它不是 Unity 材质的 1:1 光照复刻。严格材质复刻应使用 `MeshStandardMaterial`，并匹配 Unity 场景灯光/环境。

### 5.2 PNG 透明区域

`user_landscape.png` 与 `user_fish.png` 都带 alpha。当前材质为 Cutout，不是半透明混合：

- alpha < 0.5：丢弃片元。
- alpha ≥ 0.5：完全不透明。
- ZWrite 开启。

不要设置 `transparent: true` 后做柔和 alpha blending，否则边缘和遮挡排序会与 Unity 不同。

### 5.3 可选“去白底”Shader

只有外部输入为白底图且明确要复现 `RemoveWhiteBackground.shader` 时使用：

```glsl
vec4 col = texture2D(map, vUv);
float white = (col.r + col.g + col.b) / 3.0;
col.a = white < 0.9 ? 1.0 : 0.0;
```

对应材质必须 alpha blend、`depthWrite=false`。当前工程没有材质引用该 shader，因此它不能替代人物/鱼主材质配置。

---

## 6. 动画通道与动作语义

动作本质均为 morph target 交叉混合和/或根 Transform 曲线：

- `Dance02Anim`：Shapekey01 从 100 降到 0，同时 Shapekey02 从 0 升到 100，再返回；循环。
- `DanceAnim`：Shapekey07/08 交叉；循环。
- `FishAnimation`：Key 17/18 交叉；鱼身摆动循环。
- `JellyJumpAnim`：Shapekey03 形成主弹跳，Shapekey04 在前段形成挤压/伸展。
- `JumpFlipAnim`：Shapekey03/04 + root z 抛物线位移 + quaternion 完成翻转。
- `PullRightAnimation`：Key 21/22 为主要拉扯变形；Key 19 在首帧由 100 立即降至 0。
- `RaiseHandAnimation`：Key 10 完成前半段，Key 11 完成后半段。
- `RollingAnimation`：无 morph，只有 root 位移和 quaternion 滚转。
- `SkinnyAnimation`：长序列组合 Key 12–15、Shapekey09，并在后段加入 x/z 位移。
- `SkinnyAnimationLoop`：只做小幅 x/z 漂移和几乎恒定的基准 quaternion；循环。
- `WalkAnimation`：Key 23/24 交叉；循环。
- `WaveAnimation`：Key 19/20 交叉；单次。
- `BalloonAnim`：Shapekey09 在约 0.167 秒达到 100，root z 在整个 4.317 秒内移到 -4，并伴随轻微摆动；clip 标记循环。
- `BalloonAnimLoop`：名称像 intro，但状态机先播放它，再进入 `BalloonAnim`；它在 z≈-4 附近轻微摆动，clip 本身不循环。
- `TestImageAni`：三轴 scale 从 0 到 1，端点切线为 0，形成 smoothstep 式放大。

完整关键帧不要从上述文字重建；必须读取附带 JSON。文字仅用于实现校验。

---

## 7. Unity 曲线的精确采样

### 7.1 JSON 结构

`unity-animation-curves.json`：

```json
{
  "clips": [
    {
      "name": "DanceAnim",
      "duration": 0.483333349,
      "frameRate": 60.0,
      "loopTime": true,
      "curves": [
        {
          "path": "",
          "type": "UnityEngine.SkinnedMeshRenderer",
          "property": "blendShape.Shapekey07",
          "preWrapMode": "ClampForever",
          "postWrapMode": "ClampForever",
          "keys": [
            {
              "time": 0.0,
              "value": 100.0,
              "inTangent": -87.46,
              "outTangent": -87.46,
              "inWeight": 0.33333334,
              "outWeight": 0.33333334,
              "weightedMode": "None"
            }
          ]
        }
      ]
    }
  ]
}
```

本数据全部 `weightedMode=None`，所以 `inWeight/outWeight` 不参与结果；所有 pre/post wrap 为 `ClampForever`。clip 的 `loopTime` 在采样器外层控制时间取模。

### 7.2 Cubic Hermite 公式

Unity 非加权关键帧段 `[k0, k1]`：

```js
function sampleUnityCurve(curve, rawTime) {
  const keys = curve.keys;
  if (keys.length === 0) return 0;
  if (rawTime <= keys[0].time) return keys[0].value;
  if (rawTime >= keys[keys.length - 1].time) return keys[keys.length - 1].value;

  // 生产代码应使用二分搜索；此处简化展示。
  let i = 0;
  while (i + 1 < keys.length && rawTime > keys[i + 1].time) i++;

  const k0 = keys[i];
  const k1 = keys[i + 1];
  const dt = k1.time - k0.time;
  const u = (rawTime - k0.time) / dt;
  const u2 = u * u;
  const u3 = u2 * u;

  const h00 =  2 * u3 - 3 * u2 + 1;
  const h10 =      u3 - 2 * u2 + u;
  const h01 = -2 * u3 + 3 * u2;
  const h11 =      u3 -     u2;

  return h00 * k0.value
       + h10 * dt * k0.outTangent
       + h01 * k1.value
       + h11 * dt * k1.inTangent;
}
```

循环时间：

```js
function resolveClipTime(clip, elapsed) {
  if (!clip.loopTime) return Math.min(Math.max(elapsed, 0), clip.duration);
  return ((elapsed % clip.duration) + clip.duration) % clip.duration;
}
```

### 7.3 Quaternion 通道

JSON 保存四条独立 Unity quaternion component 曲线。严格复刻步骤：

1. 在同一时间分别 Hermite 采样 x/y/z/w。
2. 得到 Unity quaternion。
3. 手工坐标转换时应用 `(-x, -y, z, w)`。
4. normalize。
5. 赋给 `animationRoot.quaternion`。

不要将四元数转 Euler 后逐轴插值；会改变翻转轨迹并可能出现万向锁。

### 7.4 曲线绑定

```js
function applyCurve(mesh, animationRoot, sampled, curve, value) {
  const p = curve.property;

  if (p.startsWith('blendShape.')) {
    const name = p.slice('blendShape.'.length);
    const index = mesh.morphTargetDictionary[name];
    if (index === undefined) throw new Error(`Missing morph target: ${name}`);
    mesh.morphTargetInfluences[index] = value / 100;
    return;
  }

  // 先把 position / scale / quaternion 各分量缓存到临时结构，
  // 所有曲线采样结束后统一做坐标转换与 quaternion normalize。
  switch (p) {
    case 'm_LocalPosition.x': sampled.position.x = value; break;
    case 'm_LocalPosition.y': sampled.position.y = value; break;
    case 'm_LocalPosition.z': sampled.position.z = value; break;
    case 'm_LocalRotation.x': sampled.quaternion.x = value; break;
    case 'm_LocalRotation.y': sampled.quaternion.y = value; break;
    case 'm_LocalRotation.z': sampled.quaternion.z = value; break;
    case 'm_LocalRotation.w': sampled.quaternion.w = value; break;
    case 'm_LocalScale.x': sampled.scale.x = value; break;
    case 'm_LocalScale.y': sampled.scale.y = value; break;
    case 'm_LocalScale.z': sampled.scale.z = value; break;
  }
}
```

每帧不要创建新数组/对象；预缓存 clip、curve、key、morph index 和二分搜索游标，避免 GC。

---

## 8. Three.js 推荐实现骨架

```js
import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';

const BASE_UNITY = {
  position: new THREE.Vector3(0, 0, 0),
  quaternion: new THREE.Quaternion(-0.7071068, 0, 0, 0.7071067),
  scale: new THREE.Vector3(1, 1, 1)
};

export class UnityPhotoAnimator {
  constructor(mesh, animationRoot, curveData) {
    this.mesh = mesh;
    this.root = animationRoot;
    this.clips = new Map(curveData.clips.map(c => [c.name, c]));
    this.current = null;
    this.elapsed = 0;
    this.playing = false;
    this.morph = mesh.morphTargetInfluences;
    this.dict = mesh.morphTargetDictionary;
    this.sampledPosition = new THREE.Vector3();
    this.sampledQuaternion = new THREE.Quaternion();
    this.sampledScale = new THREE.Vector3();
    this.sampledPose = {
      position: this.sampledPosition,
      quaternion: this.sampledQuaternion,
      scale: this.sampledScale
    };
  }

  play(name) {
    const clip = this.clips.get(name);
    if (!clip) throw new Error(`Unknown clip ${name}`);
    this.current = clip;
    this.elapsed = 0;
    this.playing = true;
    this.resetDefaults();
    this.apply(0);
  }

  resetDefaults() {
    this.morph.fill(0);
    this.sampledPosition.copy(BASE_UNITY.position);
    this.sampledQuaternion.copy(BASE_UNITY.quaternion);
    this.sampledScale.copy(BASE_UNITY.scale);
  }

  update(deltaSeconds) {
    if (!this.playing || !this.current) return;
    this.elapsed += deltaSeconds;
    if (this.current.loopTime) {
      this.apply(resolveClipTime(this.current, this.elapsed));
      return;
    }
    const ended = this.elapsed >= this.current.duration;
    this.apply(Math.min(this.elapsed, this.current.duration));
    if (ended) this.playing = false;
  }

  apply(time) {
    this.resetDefaults();

    for (const curve of this.current.curves) {
      const value = sampleUnityCurve(curve, time);
      applyCurve(this.mesh, this.root, this.sampledPose, curve, value);
    }

    // Unity → Three 手工转换；若 glTF 根已转换过坐标，按校准结果调整此处。
    this.root.position.set(
      this.sampledPosition.x,
      this.sampledPosition.y,
      -this.sampledPosition.z
    );
    this.root.quaternion.set(
      -this.sampledQuaternion.x,
      -this.sampledQuaternion.y,
       this.sampledQuaternion.z,
       this.sampledQuaternion.w
    ).normalize();
    this.root.scale.copy(this.sampledScale);
  }
}
```

加载模型后必须定位真正带 morph target 的 Mesh：

```js
const gltf = await new GLTFLoader().loadAsync('/photo_plane.glb');
let photoMesh;
gltf.scene.traverse(o => {
  if (o.isMesh && o.morphTargetInfluences?.length === 24) photoMesh = o;
});
if (!photoMesh) throw new Error('photo_plane morph mesh not found');
photoMesh.updateMorphTargets();
```

模型转换验证条件：

```js
console.assert(photoMesh.geometry.attributes.position.count === 63);
console.assert(photoMesh.geometry.index.count === 288);
console.assert(photoMesh.morphTargetInfluences.length === 24);
console.assert(photoMesh.morphTargetDictionary['Shapekey01'] === 0);
console.assert(photoMesh.morphTargetDictionary['Key 24'] === 23);
```

---

## 9. Animator Controller 行为复现

若只需要独立播放动作，可忽略 Unity Controller，直接 `play(clipName)`。若还要复现项目运行逻辑，则实现下面状态机。

### 9.1 参数

人物 `_photoanim.controller`：

- `flag`：int，默认 5
- `IsFlag`：int，默认 0
- `Random`：Bool，默认 false；无 transition 使用，可忽略

鱼 `_photoanim 1.controller`：

- `flag`：int，默认 0
- `IsFlag`：int，默认 0
- `Random`：Bool，默认 false；无 transition 使用

项目脚本在对象启用后一帧随机设置 `IsFlag = 1 或 2`；点击时随机设置 `flag = 1..9`。

### 9.2 Idle 家族

人物：

- `IsFlag=1`：进入 `BalloonAnimLoop`，然后自动过渡至循环 `BalloonAnim`。
- `IsFlag=2`：进入 `SkinnyAnimation`，然后自动过渡至循环 `SkinnyAnimationLoop`。

鱼：同样使用这些状态名，但四个状态实际都绑定 `FishAnimation.anim`。因此 `IsFlag=1/2` 的视觉 idle 都是鱼摆动。

### 9.3 flag 映射

从 `BalloonAnimLoop`、`BalloonAnim` 或初始 `SkinnyAnimation`：

| flag | 动作 |
|---:|---|
| 1 | Dance02Anim |
| 2 | DanceAnim |
| 3 | JellyJumpAnim |
| 4 | JumpFlipAnim |
| 5 | PullRightAnimation |
| 6 | RaiseHandAnimation |
| 7 | RollingAnimation |
| 8 | WaveAnimation |
| 9 | WalkAnimation |

从 `SkinnyAnimationLoop`：

| flag | 动作 |
|---:|---|
| 1 | Dance02Anim |
| 2 | DanceAnim |
| 3 | JellyJumpAnim |
| 4 | PullRightAnimation |
| 5 | RaiseHandAnimation |
| 6 | RollingAnimation |
| 7 | WaveAnimation |
| 8 | WalkAnimation |
| 9 | 无 transition |

`SkinnyAnimationLoop` 中无法触发 `JumpFlipAnim`，这是原 Controller 的真实行为，不应“修正”。

### 9.4 Crossfade

所有 Controller transition duration = 0.25 秒，Fixed Duration 开启，offset=0。Unity 会在 0.25 秒内混合源状态和目标状态。要 1:1 复现 Controller 而不是单 clip：

1. transition 开始时保留源状态时间。
2. 目标状态从 0 秒开始。
3. 两边各自采样完整 pose（24 morph + Transform）。
4. `alpha = clamp(transitionElapsed / 0.25, 0, 1)`。
5. morph/position/scale 做线性插值。
6. quaternion 做 shortest-path slerp。

多数动作返回 `New State` 也使用 0.25 秒 crossfade。`New State` 无 motion，Write Defaults=true，可视为基准 pose。

状态机中有些 transition 同时标记 Has Exit Time 与条件；如果目标只是网页动作按钮，推荐按动作播放完成后 0.25 秒回基准 pose。若严格复刻整个 Controller，应读取 `exitTime × sourceDuration` 作为允许切换的归一化时间。

原控制器不会自动清除 `flag` 或 `IsFlag`，所以返回 `New State` 后持久参数可能再次触发。严格复刻时保留；产品化 Web 接口若希望“一次点击只播一次”，应由上层在消费动作后把 `flag` 设回 0，但这属于行为修正，不是原版 1:1。

---

## 10. 逐动画验收清单

建议 Unity 与 Web 同时固定：60 FPS、同一分辨率、同一相机、同一贴图，然后对下列时间截图做像素差：

| 动画 | 建议采样时间（秒） | 重点 |
|---|---|---|
| BalloonAnim | 0、0.166667、1、2.633333、4.316667 | 膨胀完成、z 漂移、轻摆 |
| BalloonAnimLoop | 0、0.25、1.066667、1.683333 | 高位轻摆 |
| Dance02Anim | 0、0.316667、0.65 | Shapekey01/02 交叉 |
| DanceAnim | 0、0.233333、0.483333 | Shapekey07/08 交叉 |
| FishAnimation | 0、0.65、1.316667 | Key17/18 交叉 |
| JellyJumpAnim | 0.266667、0.55、0.666667、0.833333、0.983333 | 多次弹性衰减 |
| JumpFlipAnim | 0.15、0.483333、0.65、1.15 | 抛物线顶点与翻转 |
| PullRightAnimation | 0、0.816667、0.9、1.183333、1.4、1.983333 | 首帧 Key19、拉伸回弹 |
| RaiseHandAnimation | 0.316667、0.65、0.983333、1.316667 | 两段 raise morph |
| RollingAnimation | 0、0.166667、0.366667、0.65 | 两次 z 起伏与旋转 |
| SkinnyAnimation | 0.233333、0.9、1.55–2.35、2.933333、3.65、4.566667 | 长序列、多 morph、位移 |
| SkinnyAnimationLoop | 0、0.166667、0.333333、0.833333、1.0、1.083333 | 两段小跳 |
| WalkAnimation | 0、0.416667、0.816667 | Key23/24 交叉 |
| WaveAnimation | 0、0.333333、0.65 | Key19/20 交叉 |
| TestImageAni | 0、0.125、0.25 | scale smoothstep |

数值验收：

- 时间误差 ≤ 1/120 秒。
- morph influence 误差 ≤ 1e-4。
- position 每轴误差 ≤ 1e-5（未计外层布局 scale）。
- quaternion 归一化后角度误差 ≤ 0.05°。
- 循环 clip 首尾必须按源曲线真实值处理，不要强制把最后一帧改成第一帧；源数据中部分循环首尾只近似相等。

---

## 11. 常见失败原因

1. **使用 4 顶点 Plane**：morph 无法复现，必须保留 FBX 的 63 顶点与 24 morph targets。
2. **把 Unity 0–100 权重直接赋给 Three.js**：会放大 100 倍，必须除以 100。
3. **对关键帧做线性插值**：弹跳和回弹节奏明显不一致，必须使用 tangent Hermite。
4. **Euler 插值旋转**：翻转轨迹错误，必须采样 quaternion 四通道并 normalize。
5. **重复做坐标转换**：glTF 工具已转换一次，运行时又转换一次，会镜像或反向。
6. **开启普通透明混合**：当前主材质是 alpha test/cutout，不是 blended transparency。
7. **依赖文件名猜 morph 顺序**：`Key 21/22` 位于 `Key 19/20` 前，必须使用 dictionary。
8. **忽略 0.25 秒 transition**：单 clip 可以一致，但完整 Animator 状态切换会显得更硬。
9. **擅自修复原 Controller 映射**：鱼控制器多个 idle 状态都绑定 FishAnimation；Skinny loop 没有 JumpFlip；这些都是源行为。

---

## 12. 外部团队最小交付包

外部 Web 团队至少需要：

- 从 `Assets/_model/photo_plane.fbx` 转出的 `photo_plane.glb`，保留全部 morph targets。
- `Assets/_material/user_landscape.png`。
- `Assets/_material/user_fish.png`。
- `Docs/ThreeJSPhotoAnimation/unity-animation-curves.json`。
- 本文档。

如果外部团队只拿到文档而没有包含 24 个 morph target 顶点 delta 的模型文件，就不可能 1:1 复刻；文档中的动作曲线只描述“每个 morph target 在何时使用多少权重”，具体顶点怎么变形存储在 FBX/GLB 内。
