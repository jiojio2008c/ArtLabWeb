# MagicFloor Dynamic Player

独立 Windows EXE 播放运行时，只负责 `8080` 动态艺术，不接入 `11701` 互动艺术。

## 功能范围

- 监听 `http://0.0.0.0:8080`
- 接收 `multipart/form-data` 上传的背景/物件素材
- 接收 `MF|DynamicArt|...` 文本协议
- 1920x1080 全屏 16:9 舞台
- 背景图片 / MP4 视频播放
- 物件位置、缩放、旋转、水平翻转、垂直翻转
- `animationId 0~9` 程序化动画，作用于 iPad 上传的图片
- 预览模式下播放移动轨迹和逐个出现 / 全部出现

## 开发运行

```bash
npm install
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
