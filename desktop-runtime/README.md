# MagicFloor Dynamic Player

独立 Windows EXE 播放运行时，只负责 `8080` 动态艺术，不接入 `11701` 互动艺术。

## 功能范围

- 监听 `http://0.0.0.0:8080`
- 接收 `multipart/form-data` 上传的背景、物件与音频素材；音频使用 `role: audio`
- 接收 `MF|DynamicArt|...` 文本协议
- 冷启动后等待 iPad 的档案同步，不恢复到上次舞台画面
- 档案阶段只显示 iPad 当前画面的只读镜像，PC 不读取、不重建也不保存作品档案资料
- 只有收到携带完整作品参数的 `GroupStateSync` / `GroupSelectAndSync` 后才进入并加载舞台；`GroupSelect` 只记录选择，不切换画面
- 1920x1080 全屏 16:9 舞台
- 背景图片 / MP4 视频播放
- 预览模式支持固定背景、随机切换、逐个切换和 `1-600` 秒切换间隔
- 物件位置、缩放、旋转、水平翻转、垂直翻转
- `animationId 0~9` 程序化动画，作用于 iPad 上传的图片
- 预览模式下播放移动轨迹和逐个出现 / 全部出现
- 进阶预览支持上方掉落、按轨道左右进场，以及从起始位置移动到用户设定的目标点
- 作品统一指定物件进场方式：淡入、上方掉落或按轨道左右进场
- 物件可联动另一物件，在触发物件完成进场后按指定时间淡入或淡出；支持一个触发方控制多个物件、联动链，并阻止自绑定与循环绑定
- 受控物件未绑定当前背景时，会由触发物件临时带入当前预览；支持跨背景 `A -> B -> C`，且不会修改物件原有的 `backgroundIds`
- 物件可绑定全部背景或指定背景；只有由不可见变为可见时才重新触发“出现”事件
- 每个背景可配置独立 BGM，也可让多个背景共用同一 BGM；不同 BGM 交叉淡化，物件音源播放时自动压低 BGM
- 物件音源支持出现时、延迟和到达目标点三种触发方式
- 每张背景可独立指定直接切换、舞台窗帘、相机闪光或皮影戏；切入目标背景时播放该背景绑定的转场，下一张图片/视频会在切换前预载
- 随机背景顺序按作品 ID 与 `replayId` 确定，使 iPad 和 EXE 在同一轮预览保持一致
- Windows 生产版以无边框全屏模式启动，舞台保持 1920x1080 比例
- 鼠标点击背景会产生 WebGL 水波折射，波纹会真实扭曲图片或影片背景；最多可同时显示 4 个涟漪
- 水波只作用于背景，上传物件保持清晰；WebGL 不可用或运行中失效时会自动切换为 2D 涟漪备用效果
- 点击可见图片会循环切换 `animationId 1~9` 并播放点击音效，透明像素区域仍按背景点击处理

鼠标切换动画只保存在当前 EXE 内存中，不修改作品档案、不写入运行时状态，也不会向 iPad 回传。iPad 启动或重播预览、切换作品档案、同步组状态或修改物件动画时，播放器会清除对应的鼠标临时动画并立即恢复 iPad 设置。

背景播放参数通过 `GroupStateSync` / `GroupSelectAndSync` 的 `backgroundPlayMode`、`backgroundIntervalMs` 字段同步，也可由 `BackgroundPlayback` 事件即时更新。自动切换只在 `PreviewMode.enabled=true` 时运行，编辑状态保持当前背景。

舞台 `MagicFloor` 水印默认开启，主体与描边统一使用 `44%` 不透明度（`56%` 透明度）；可通过 `DisplaySettings` 事件的 `{ watermarkEnabled }` 即时切换。`GroupStateSync`、`GroupSelectAndSync` 与 `PreviewMode` 也接受同名字段。旧消息未携带该字段时保留当前设置，水印只绘制在 1920x1080 舞台范围内，不覆盖作品档案镜像或舞台外区域。

进阶参数同样由 `GroupStateSync` / `GroupSelectAndSync` 和 `PreviewMode` 同步。组级字段包括统一的物件 `appearAnimation`、旧数据兼容用的 `backgroundTransition` 和 `audioLibrary`；每张背景包含 `bgmAudioId` 与 `backgroundTransition`；物件包含 `targetMode`、`targetPosition`、`audioId`、`audioTrigger`、`audioDelayMs`、`linkedAppearance` 和 `backgroundIds`。只有 `PreviewMode.advancedFeaturesEnabled=true` 时播放进阶行为，关闭进阶功能不会删除已同步的数据。

物件联动的 UI 使用控制方语义 `A -> B`，同步协议仍由受控物件 B 保存 `linkedAppearance`：`{ triggerItemId: A.id, mode, delayMs }`。`mode` 为 `showAfter` 或 `hideAfter`，延迟上限为 `600000ms`；一个 A 可控制多个 B，一个 B 只能有一个触发方。当前 `linkedAppearanceModelVersion` 为 `3`。

联动物件不占逐个出场排序位置。若 B 没有绑定 A 当前所在背景，播放清单会递归临时加入 B 及后续受控物件，但不会写回或修改 `backgroundIds`；B 在自己的原生背景中且 A 不存在时会回退到正常进场。关闭进阶功能时不执行联动，但保留同步数据。关系锁仅用于表达联动，不限制位置、缩放、旋转或图层操作。共享时间线位于 `renderer/advanced-appearance-timeline.js`，iPad 与 EXE 使用同一组时长：淡入 `420ms`、上方掉落 `620ms`、左右进场 `560ms`。

## 页面同步

iPad 从首页打开动态艺术时，会先通过 `11701` 请求启动本程式，再向动态艺术端口发送同一段入场动画的会话与时间轴：

```text
MF|DynamicArt|ArchiveEnter|{"version":3,"replayId":"archive_xxx","startedAt":0,"elapsedMs":0,"source":{"dataUrl":"data:image/jpeg;base64,...","width":1180,"height":820,"capturedAt":0,"origin":{"left":180,"top":220,"width":360,"height":460}}}
```

档案页稳定后，iPad 会发送当前页面的 JPEG 只读镜像：

```text
MF|DynamicArt|ArchiveSnapshot|{"version":2,"replayId":"archive_xxx","dataUrl":"data:image/jpeg;base64,..."}
```

`ArchiveEnter.source` 是 iPad 首页画面，`source.origin` 是首页「动态艺术」卡片在该画面中的位置。EXE 以这张 iPad 首页镜像为转场底图，并从相同的卡片位置启动门户。`ArchiveSnapshot` 是 iPad 当前作品档案页的完整镜像。

EXE 只同步播放 iPad 的入场节奏并显示 iPad 镜像，不读取 PC 缓存来生成任何资料夹或作品卡片，也不提供档案交互。使用者在 iPad 选择作品进入控制页后，原有 `GroupStateSync` / `GroupSelectAndSync` 才会让 EXE 进入并加载真实舞台。从控制页返回档案时使用 `ArchiveReturn`，先保留最近一次 iPad 镜像，再由新快照无闪烁接管。

## 开发运行

```bash
npm install
npm start
```

开发时需要普通窗口和标题栏，可使用：

```powershell
$env:ELECTRON_RUN_AS_NODE=$null
$env:MAGICFLOOR_WINDOWED='1'
npm start
```

部分开发终端会预设 `ELECTRON_RUN_AS_NODE=1`；必须先清除，否则 Electron 会按 Node 进程启动并立即退出。

## 打包

```powershell
npm run pack:portable
npm run pack:vertical-flip
```

也可以连续生成标准版与完整翻转版：

```powershell
npm run pack:all
```

每个打包命令执行前都会自动清理同类型的旧 `release*` 目录。生成标准版时只删除旧标准版，生成完整翻转版时只删除旧翻转版，因此连续执行两个命令不会互相删除刚生成的另一版本。需要手动清空全部发布目录时可运行 `npm run clean:releases`。

2026-08-20 当前最终交付位于：

```text
desktop-runtime/release/MagicFloor Dynamic Player 0.1.0.exe
desktop-runtime/release-vertical-flip/MagicFloor Dynamic Player Vertical Flip 0.1.0.exe
```

两个版本都监听 `8080`，不能同时运行。标准版 SHA-256 为 `B0EBF4B963EF61F7E9757471CC4B736B0712D140175FE79035E1C4B93AF942BA`；整体显示水平与垂直翻转版 SHA-256 为 `08AC9D0DEFC0888B1FBB9EFED263D5E4ED08E37689A84759B8E4F6A1D8593097`。打包使用本地 `node_modules/electron/dist`，避免 Windows 在下载缓存解压阶段产生临时目录重命名失败。

行为测试可运行：

```powershell
npm run test:appearance
```

该测试覆盖淡入、上方掉落、左右进场，以及联动物件的逐个排序、延迟出现、延迟隐藏、隐藏后的点击状态、跨背景递归带入且不修改背景归属、原生背景回退、关系方向、循环联动保护与延迟上限。
