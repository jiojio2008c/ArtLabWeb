# MagicFloor Dynamic Player

独立 Windows EXE 播放运行时，只负责 `8080` 动态艺术，不接入 `11701` 互动艺术。

## 功能范围

- 监听 `http://0.0.0.0:8080`
- 接收 `multipart/form-data` 上传的背景/物件素材
- 接收 `MF|DynamicArt|...` 文本协议
- 1920x1080 全屏 16:9 舞台
- 背景图片 / MP4 视频播放
- 预览模式支持固定背景、随机切换、逐个切换和 `1-600` 秒切换间隔
- 物件位置、缩放、旋转、水平翻转、垂直翻转
- `animationId 0~9` 程序化动画，作用于 iPad 上传的图片
- 预览模式下播放移动轨迹和逐个出现 / 全部出现
- Windows 生产版以无边框全屏模式启动，舞台保持 1920x1080 比例
- 鼠标点击背景会产生 WebGL 水波折射，波纹会真实扭曲图片或影片背景；最多可同时显示 4 个涟漪
- 水波只作用于背景，上传物件保持清晰；WebGL 不可用或运行中失效时会自动切换为 2D 涟漪备用效果
- 点击可见图片会循环切换 `animationId 1~9` 并播放点击音效，透明像素区域仍按背景点击处理

鼠标切换动画只保存在当前 EXE 内存中，不修改作品档案、不写入运行时状态，也不会向 iPad 回传。iPad 启动或重播预览、切换作品档案、同步组状态或修改物件动画时，播放器会清除对应的鼠标临时动画并立即恢复 iPad 设置。

背景播放参数通过 `GroupStateSync` / `GroupSelectAndSync` 的 `backgroundPlayMode`、`backgroundIntervalMs` 字段同步，也可由 `BackgroundPlayback` 事件即时更新。自动切换只在 `PreviewMode.enabled=true` 时运行，编辑状态保持当前背景。

## 开发运行

```bash
npm install
npm start
```

开发时需要普通窗口和标题栏，可使用：

```powershell
$env:MAGICFLOOR_WINDOWED='1'
npm start
```

## 打包

```bash
npm run pack:dir
```

打包后的 EXE 位于：

```text
desktop-runtime/release/win-unpacked/MagicFloor Dynamic Player.exe
```
