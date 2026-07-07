# ArtLabWeb 当前交接文档

更新时间：2026-07-07
当前状态：当前功能可构建，已完成新增“功能入口 / 快速拍照上传”流程，并已执行 `npm run sync:ios` 同步到 iOS 工程。

## 0. 重要备份点

在本轮新增快速上传流程前，已经先做了 Git 备份并推送到远端：

- 备份提交：`53d8086`，提交名：`7.7备份`
- 备份标签：`backup-before-direct-upload-20260707`
- 已推送：`origin/main` 和 `origin/backup-before-direct-upload-20260707`

需要回退到本轮修改前时，可回到这个标签。注意：`git reset --hard backup-before-direct-upload-20260707` 会丢弃当前未保存改动，执行前必须确认。

## 1. 项目定位

这是一个 iPad 横屏为主的 React + TypeScript + Vite + Capacitor iOS 项目，用于通过 HTTP 与 Unity 通信。

核心能力：

- 图片上传到 Unity。
- 上传前可套用遮罩并导出 PNG。
- 原控制流程上传后进入控制页，可移动、缩放、旋转、水平翻转、释放物件、选择动画、切换场景。
- 新增快速上传流程只负责上传图片，不进入控制页。
- Unity 端不在本项目内，前端只负责发 HTTP 请求。

## 2. 当前页面流程

当前 App 的页面状态定义在 `src/App.tsx`：

```ts
type Page = 'entry' | 'home' | 'upload' | 'edit' | 'directUpload' | 'directComplete'
```

### 新入口页

文件：`src/components/EntryPage.tsx`

入口页是现在 App 的首页，用于区分两套功能：

- `作品控制上传`：进入原 20 格作品槽位流程，端口 `8080`。
- `快速拍照上传`：进入新增快速上传流程，端口 `11701`。

入口页和两个流程共用同一个 Unity IP。IP 会通过 `saveLastWsIp()` 保存，下次打开软件自动使用上一次 IP；默认 IP 在 `src/services/appSettings.ts` 里。

### 原作品控制上传流程

页面顺序：

```text
EntryPage -> HomePage -> UploadPage(mode="control") -> EditPage
```

用途：

- 首页显示 20 个作品槽位。
- 点击槽位会发送 `GameObject:{index}` 到 Unity。
- 如果本地已有该槽位图片缓存，直接进入控制页。
- 如果没有缓存，进入上传页。
- 上传成功后进入控制页。

端口：`8080`
端口常量：`src/services/networkConfig.ts` 中的 `CONTROL_PORT`

### 新快速拍照上传流程

页面顺序：

```text
EntryPage -> UploadPage(mode="direct") -> DirectUploadCompletePage
```

用途：

- 直接选择图片或拍照。
- 使用新遮罩生成 PNG。
- 发送到 Unity 的 `11701` 端口。
- 上传完成后进入“上传完成”页。
- 不进入控制页。
- 不写入 20 格作品缓存，不污染原作品控制流程。

端口：`11701`
端口常量：`src/services/networkConfig.ts` 中的 `DIRECT_UPLOAD_PORT`

## 3. HTTP 协议和 Unity 信号

### 图片上传

使用 `XMLHttpRequest`，`POST multipart/form-data`。

FormData 字段：

- `image`：图片文件。
- `audio`：仅原控制上传流程可能携带，快速上传流程不携带。

发送位置：

- 原控制上传：`http://{ip}:8080`
- 快速拍照上传：`http://{ip}:11701`

实现位置：

- `src/components/UploadPage.tsx`
- `sendHttpImage(file: File)`

### 首页选择槽位

文件：`src/components/HomePage.tsx`

点击 20 格槽位时发送：

```text
GameObject:{index}
```

示例：

```text
GameObject:3
```

发送端口：`8080`

### 控制页信号

文件：`src/components/EditPage.tsx`

控制页所有信号仍走 `http://{ip}:8080`，`POST text/plain`。

当前信号：

| 功能 | 信号格式 | 示例 |
| --- | --- | --- |
| 实时移动 / 重置位置 | `{gridIndex}` | `72` |
| 缩放 | `{imageName}_Scale:{value}` | `photo.png_Scale:1.5` |
| 旋转 | `{imageName}_Rotate:{degrees}` | `photo.png_Rotate:45.0` |
| 动画 | `{imageName}:{animationId}` | `photo.png:4` |
| 水平翻转 | `{imageName}_Flip:{true|false}` | `photo.png_Flip:true` |
| 释放物件 | `{imageName}_Release:{true|false}` | `photo.png_Release:false` |
| 场景 | `Bg:{Fish|People|Other}` | `Bg:Fish` |

实时移动当前有节流，避免 iPad 上拖动时请求过密：

- 坐标发送节流：约 `90ms`
- 缩放发送节流：约 `120ms`
- 旋转发送节流：约 `120ms`

## 4. 遮罩资源和规则

### 原控制上传遮罩

只用于 `mode="control"`。

资源目录：

```text
public/MaskTexture/
  Mask1.png
  Mask2.png
  Mask3.png
  Mask4.png
  Mask5.png
```

按钮：

- `无`
- `1`
- `2`
- `3`
- `4`
- `5`

默认：`无`

### 快速上传新遮罩

只用于 `mode="direct"`。

资源目录：

```text
public/DirectMaskTexture/
  C-01.png
  A-02.png
  A-03.png
```

按钮：

- `C-01`
- `A-02`
- `A-03`

默认：`C-01`

注意：快速上传没有“无”遮罩选项，也不使用原 `MaskTexture` 里的旧遮罩。

## 5. 关键源码文件

### `src/App.tsx`

负责页面路由和流程分流。

当前重点：

- 初始页面是 `entry`。
- 原流程进入 `home`。
- 快速上传进入 `directUpload`。
- 原上传成功后显示 handoff 动效，然后进入 `edit`。
- 快速上传成功后直接进入 `directComplete`。

### `src/components/EntryPage.tsx`

新增入口页。

职责：

- 填写/保存 Unity IP。
- 选择原控制流程或快速上传流程。
- 展示两个大触控入口。

### `src/components/HomePage.tsx`

原 20 格作品槽位页。

职责：

- 读取当前 IP 下的缩略图缓存。
- 点击槽位发送 `GameObject:{index}`。
- 有缓存图时直接进入控制页。
- 空槽位进入上传页。
- 顶部有“返回入口”按钮。

### `src/components/UploadPage.tsx`

共用上传页，通过 `mode` 区分两套流程。

重要 props：

```ts
mode?: 'control' | 'direct'
uploadPort?: number
shouldCacheArtwork?: boolean
```

原控制流程传入：

```tsx
mode="control"
uploadPort={CONTROL_PORT}
shouldCacheArtwork
```

快速上传流程传入：

```tsx
mode="direct"
uploadPort={DIRECT_UPLOAD_PORT}
shouldCacheArtwork={false}
```

差异：

- `control`：旧遮罩、默认无、可录音、写入作品缓存、上传后进控制页。
- `direct`：新遮罩、默认 C-01、无录音区、不写作品缓存、上传后进完成页。

### `src/components/DirectUploadCompletePage.tsx`

新增快速上传完成页。

职责：

- 显示上传后的预览图。
- 显示文件名和目标 IP/端口。
- 底部两个按钮：
  - `返回首页`
  - `重新上传`

### `src/components/EditPage.tsx`

原控制页。

职责：

- 显示作品在舞台中的位置。
- 单指拖动移动图片并实时发送网格坐标。
- 双指缩放和旋转，实时发送缩放/旋转信号。
- 双击打开工具抽屉。
- 支持动画、场景、水平翻转、释放物件等控制。

## 6. 本地缓存和 IP 记忆

### IP 记忆

文件：`src/services/appSettings.ts`

localStorage key：

```text
artlab_last_ws_ip
```

默认 IP：

```text
192.168.8.101
```

入口页、首页、上传发送时都会保存当前 IP。

### 作品图片缓存

文件：`src/services/artworkStorage.ts`

用途：

- 让 20 格首页能显示缩略图。
- 让重新打开软件后，已有图片的槽位能直接进入控制页。

存储策略：

- iOS/Capacitor：优先用 `@capacitor/filesystem` 写入 App 沙盒目录。
- Web 浏览器：fallback 到 IndexedDB 保存 Blob。
- localStorage 保存索引、缩略图、文件路径或 IndexedDB key。

快速上传流程不会调用该缓存写入，避免污染 20 格作品槽位。

## 7. iOS / Capacitor 注意事项

同步命令：

```bash
npm run sync:ios
```

该命令会执行：

1. `npm run build`
2. `npx cap sync ios`
3. `npm run fix:ios-spm`

本轮已执行成功。

新增快速上传遮罩已同步到：

```text
ios/App/App/public/DirectMaskTexture/
  C-01.png
  A-02.png
  A-03.png
```

该目录当前被 Git 忽略，但 Capacitor 同步会从 `dist` 复制资源。打包前只要执行 `npm run sync:ios` 即可。

SPM 路径修复：

```text
ios/App/CapApp-SPM/Package.swift
```

当前正确路径：

```swift
.package(name: "CapacitorFilesystem", path: "../../../node_modules/@capacitor/filesystem")
```

如果 Xcode 仍提示 Swift Package 路径或 XCFramework artifact 问题，优先：

1. 在 Windows 侧重新执行 `npm run sync:ios`。
2. 在 macOS 侧清理 Xcode DerivedData。
3. 重新打开 Xcode 工程再 Archive。

## 8. 构建验证

本轮已验证：

```bash
npx tsc --noEmit
npm run build
npm run sync:ios
```

结果：

- TypeScript 检查通过。
- Vite 生产构建通过。
- Capacitor iOS 同步通过。
- `fix-ios-spm-paths` 执行通过。

## 9. 当前资源目录

重要 public 资源：

```text
public/
  fish.mp4
  people.mp4
  animations/
    0.gif ... 9.gif
  MaskTexture/
    Mask1.png ... Mask5.png
  DirectMaskTexture/
    C-01.png
    A-02.png
    A-03.png
```

说明：

- `animations/0.gif` 到 `animations/9.gif` 用于控制页动画示例。
- `MaskTexture` 只给原控制上传用。
- `DirectMaskTexture` 只给快速上传用。

## 10. 后续大改建议

为了继续降低污染风险，建议后续保持下面的边界：

- 原控制流程只改 `home -> upload(control) -> edit`。
- 快速上传流程只改 `entry -> upload(direct) -> directComplete`。
- 端口统一从 `src/services/networkConfig.ts` 读取。
- 遮罩选项继续在 `UploadPage.tsx` 顶部按 `CONTROL_MASK_OPTIONS` 和 `DIRECT_MASK_OPTIONS` 分开维护。
- 如果以后快速上传还要增加自己的参数，优先继续通过 `mode="direct"` 和独立 props 隔离，不要复用控制页状态。
