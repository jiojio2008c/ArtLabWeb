# Art Lab Web 项目交接文档

整理日期: 2026-07-02

功能基线标记: 当前版本已由项目方确认所有功能均已跑通，可作为后续大批量修改前的稳定功能基线。后续重构、拆分、协议调整或 UI 改造，应优先保证本文档记录的现有链路和 Unity 联动行为不被破坏。

复刻目标标记: 项目根目录的 `Target.gif` 是后续需要复刻的目标参考。它不是普通素材，而是一段完整演示动效/流程参考，后续 UI、交互节奏、视觉呈现和 Unity 联动体验改造都应以它为主要目标参照。

iPad 目标标记: 后续界面以较新的 iPad 横屏为主，按横屏体验设计，并在 iPad/Capacitor 端锁定横屏。虽然新款 iPad 物理分辨率已接近或超过 2K，但 Web/CSS 布局应按 iPad 横屏逻辑分辨率适配，例如约 `1024 x 768`、`1180 x 820`、`1194 x 834`、`1366 x 1024` 这一类 viewport，而不是直接按物理像素写死。

横屏 UI 改造记录: 已执行第一版 iPad 横屏界面改造。改造范围包括首页作品槽位选择界面、上传/遮罩/录音工作台、编辑控制台、全局横屏样式、Web 竖屏提示和 iOS 横屏方向限制。现有图片导入、遮罩截图、Supabase 可选上传、HTTP 发图、编辑页控制命令等功能逻辑保持原有链路。

页面转场记录: 已加入第一版 iPad 操作动效，包括全局页面前进/返回方向转场、首页槽位点击选中反馈、上传成功后的“正在發送作品”短过渡层，以及 `prefers-reduced-motion` 兼容。该动效层只改变界面反馈，不改变原有上传和 Unity HTTP 通信逻辑。

轻量控制改造记录: 已临时关闭 Supabase 使用路径，界面显示为 `HTTP 直送`；首页点击已有缩略图的作品位置会直接进入控制页，空位置仍进入上传页；编辑页改成双击/双点舞台弹出右侧轻量工具面板，工具内可切换缩放、动画、场景、物件操作，底部保留返回上传和重新上传入口。该改造继续保留原有 Unity HTTP 控制命令格式。

图片缓存修复记录: 首页缓存已从“只存 80x80 缩略图”扩展为同时保存 `thumbnails` 和完整控制图 `images`。首页缩略图仍用于格子展示，点击已有记录进入控制页时读取完整图片 URL，避免控制页使用缩略图导致图片尺寸变小。旧版本已经写入的历史记录可能只有缩略图，没有完整控制图，需要重新上传一次后才会生成新的完整记录。

旧记录直进修复记录: 首页点击已有缩略图但缺少完整 `images` 记录的旧槽位时，现已使用缩略图作为兜底进入控制页，不再跳回上传页；同时控制页图片加入基础显示宽度，避免兜底缩略图按 80px 天然尺寸显示得过小。旧记录画质无法恢复为原图，重新上传后会生成高清完整记录。

本文以当前工作区源码为准，重点覆盖 `src/App.tsx`、`src/main.tsx`、`src/components/HomePage.tsx`、`src/components/UploadPage.tsx`、`src/components/EditPage.tsx` 以及相关配置。当前项目的 README 存在历史描述和现实代码不一致的地方，后文会单独列出。

## 1. 项目定位

这是一个面向 iPad/WebView 的 React 应用，用于和 Unity 接收端联动。当前实际通信方式以 HTTP 为主:

- 图片上传: 通过 `XMLHttpRequest` 向 `http://{IP}:8080` 发送 `multipart/form-data`，字段名为 `image`，可附带 `audio`。
- 控制命令: 通过 `XMLHttpRequest` 向 `http://{IP}:8080` 发送 `text/plain` 文本命令。
- 可选 Supabase: 上传页可勾选是否先把图片发到 Supabase Edge Function，再进入编辑页。

核心用户流程:

1. 首页输入 Unity/HTTP 服务器 IP，选择一个物体编号 0 到 19。
2. 选择物体时先向 Unity 发送 `GameObject:{index}`，再进入上传页。
3. 上传页选择本地图片或拖放图片。
4. 图片进入遮罩对齐面板，可选择无遮罩或 5 个遮罩，可拖动图片位置，可选录制一段音频。
5. 确认后截图生成 PNG，按配置上传 Supabase，同时或随后向 Unity 发送图片和音频。
6. 上传成功后进入编辑页，用户可拖动图片、缩放、选择动画、翻转、释放物体、切换背景场景。
7. 编辑页每次操作会按约定向 Unity 发送 HTTP 文本命令。

## 2. 技术栈和运行方式

主要技术:

- React 18
- TypeScript 5
- Vite 5
- Tailwind CSS 3
- Axios: 仅用于 Supabase `multipart/form-data` 上传
- react-use-gesture: 编辑页拖拽定位
- Capacitor 8: iOS/iPad 壳工程
- Web API: `FileReader`、`Canvas`、`XMLHttpRequest`、`navigator.mediaDevices`、`MediaRecorder`

常用命令:

```bash
npm install
npm run dev
npx tsc --noEmit
npm run build
npx cap sync ios
npx cap open ios
```

本次交接时执行过:

```bash
npx tsc --noEmit
```

结果: 通过，无 TypeScript 报错。没有执行 `npm run build`，因为它会改写 `dist` 构建产物，而当前工作区的 `dist` 已经存在未提交变更。

## 3. 当前工作区状态

交接时 `git status --short` 显示已有未提交变更:

```text
D dist/assets/index-BwPDWXnr.css
D dist/assets/index-GHcmscdA.js
M dist/index.html
M src/App.tsx
M src/components/EditPage.tsx
M src/components/HomePage.tsx
M src/components/UploadPage.tsx
?? dist/assets/index-BohJ55hc.js
?? dist/assets/index-Bs3QXuDc.css
```

这些改动在整理文档前已经存在。本次只新增了本文档，没有回退或覆盖现有源码。

## 4. 目录结构说明

重要文件和目录:

```text
src/
  main.tsx
  App.tsx
  index.css
  components/
    HomePage.tsx
    UploadPage.tsx
    EditPage.tsx

public/
  fish.png
  fish.mp4
  people.png
  people.mp4
  MaskTexture/
    Mask1.png
    Mask2.png
    Mask3.png
    Mask4.png
    Mask5.png

ios/
  App/
    App/
      Info.plist
      AppDelegate.swift
    App.xcodeproj/

dist/
  构建产物

node_modules/
  依赖目录
```

根目录文件:

- `package.json`: 脚本和依赖。
- `vite.config.ts`: Vite React 插件配置。
- `tailwind.config.js`: Tailwind 扫描 `index.html` 和 `src/**/*`。
- `postcss.config.js`: Tailwind 和 Autoprefixer。
- `tsconfig.json`: 严格模式，`noUnusedLocals`、`noUnusedParameters` 开启。
- `capacitor.config.ts`: Capacitor appId、appName、webDir、iOS 样式和插件权限描述。
- `udp-forwarder.js`: 历史/辅助 Node 脚本，用于 HTTP/WebSocket 转 UDP，当前前端没有调用。
- `README.md`: 项目说明，但多处和当前源码不一致。

## 5. 入口和页面状态

### `src/main.tsx`

职责很单一:

- 引入 React、ReactDOM。
- 引入 `App.tsx`。
- 引入全局样式 `index.css`。
- 将 `<App />` 挂载到 `#root`。
- 包裹在 `React.StrictMode` 内。

### `src/App.tsx`

`App` 是当前应用的页面状态中心，不使用路由库。主要状态:

- `currentPage`: `'home' | 'upload' | 'edit'`，初始为 `home`。
- `imageData`: 当前已上传或本地生成的图片数据，结构为 `{ name, url }`。
- `wsIp`: 实际是 HTTP 服务器 IP，默认 `192.168.8.101`。
- `selectedName`: 当前固定为 `'fish'`，没有 UI 修改入口。
- `enableSupabaseUpload`: 是否启用 Supabase 上传，默认 `true`。
- `selectedObjectIndex`: 首页选择的物体编号，默认 `0`。

页面跳转:

- 首页选择物体: `handleSelectObject(index)` 设置 `selectedObjectIndex`，进入上传页。
- 上传成功: `handleUploadSuccess(data)` 设置 `imageData`，进入编辑页。
- 编辑页返回拍摄页: `handleBackToUpload()` 进入上传页，但保留 `imageData`。
- 重新上传: `handleResetUpload()` 清空 `imageData`，进入上传页。
- 回首页: `handleBackToHome()` 进入首页。

注意:

- `imageData!` 在进入编辑页时被强制断言非空。正常流程不会为空，但如果未来引入异步路由或恢复状态，需要补保护。
- `selectedName` 固定为 `fish`，导致 Supabase 的 `name` 字段、编辑页初始背景都默认走 fish 逻辑。后续如果要多物体或多场景，需要先重构这里。

## 6. 首页: `HomePage.tsx`

首页职责:

- 输入 HTTP 服务器 IP。
- 控制 Supabase 上传开关。
- 展示 20 个物体槽位。
- 读取和展示每个 IP 下的物体缩略图。
- 点击物体时向 Unity 发送物体选择命令，并跳转上传页。

### 本地缩略图缓存

缓存常量:

- `STORAGE_KEY = 'artlab_ip_thumbnails'`
- `MAX_IP_GROUPS = 3`

缓存结构:

```ts
interface IpThumbnailGroup {
  ip: string
  thumbnails: Record<number, string>
}
```

行为:

- `loadAllGroups()`: 从 `localStorage` 读取全部 IP 分组，JSON 解析失败则返回空数组。
- `saveAllGroups(groups)`: 写回 `localStorage`。
- `findGroupByIp(ip)`: 查找指定 IP 的分组。
- `saveThumbnailToIp(ip, index, dataUrl)`: 为某个 IP 和物体编号保存缩略图。如果 IP 分组超过 3 个，会 `shift()` 删除最老分组。
- `loadThumbnailsForIp(ip)`: 加载指定 IP 的缩略图字典。

上传页会从这里导入 `saveThumbnailToIp`，因此首页同时承担了缩略图存储模块的角色。

### 首页 HTTP 命令

`sendHttpMessage(message)`:

- URL: `http://${wsIp}:8080`
- 方法: `POST`
- Content-Type: `text/plain`
- Body: 传入的字符串
- 发送方式: `XMLHttpRequest`
- 错误处理: 只捕获同步异常并 `console.error`，不读取响应状态，也没有用户提示。

点击物体:

```text
GameObject:{index}
```

例如:

```text
GameObject:7
```

### 首页 UI 注意点

- IP 输入框变化只更新 `wsIp`，不会自动加载对应 IP 的缩略图，需要点击“载入配置”。
- 物体编号固定 0 到 19。
- 缩略图为空时显示一个内联 SVG 占位图。
- Supabase 开关在首页显示，上传页也收到对应状态和 setter。

## 7. 上传页: `UploadPage.tsx`

上传页是当前代码中最复杂的模块，承担以下职责:

- 本地图片选择。
- 拖放图片。
- 文件类型和大小校验。
- 图片预览。
- 遮罩对齐。
- 可选音频录制。
- Canvas 截图和遮罩裁剪。
- Supabase 上传。
- HTTP 发送图片和音频到 Unity。
- 保存首页缩略图。
- 相机相关逻辑。

### Props

```ts
interface UploadPageProps {
  onUploadSuccess: (data: { name: string; url: string }) => void
  wsIp: string
  onWsIpChange: (ip: string) => void
  selectedName: string
  onBackToHome: () => void
  enableSupabaseUpload: boolean
  onEnableSupabaseUploadChange: (val: boolean) => void
  selectedObjectIndex: number
}
```

### 主要状态

- `previewUrl`: FileReader 生成的 dataURL，或当前图片预览 URL。
- `selectedFile`: 用户选择的原始文件。
- `isUploading`: 上传中状态。
- `uploadError`: 错误文案。
- `uploadSuccess`: 成功文案。
- `showCamera`: 是否显示相机 UI。
- `isDragging`: 拖放区域高亮。
- `showMaskPanel`: 是否显示遮罩对齐面板。
- `selectedMask`: 当前遮罩编号，`0` 表示无遮罩，`1..5` 对应 `public/MaskTexture/Mask{n}.png`。
- `imagePosition`: 遮罩面板中图片拖动偏移。
- `isImageDragging`: 遮罩面板内图片是否正在拖动。
- `_imageDimensions`: 记录图片原始尺寸，目前只写入未读取。
- `isRecording`: 是否正在录音。
- `audioRecorded`: 是否已有录音。
- `audioBlob`: 当前录音 Blob。
- `audioStatus`: 录音状态文案。

### 图片选择和校验

入口:

- 文件输入: `handleFileSelect`
- 拖放: `handleDrop`
- 拍照后生成文件: `handleTakePhoto`

校验规则:

- 支持 MIME: `image/jpeg`、`image/png`、`image/gif`、`image/webp`
- 大小上限: 10MB

`handleFile(file)` 成功后:

1. 清空错误。
2. 如果正在录音则停止。
3. 清空录音状态。
4. 用 `FileReader.readAsDataURL(file)` 生成预览。
5. 用 `Image` 读取尺寸。
6. 保存 `selectedFile` 和 `previewUrl`。
7. 自动打开遮罩对齐面板 `showMaskPanel = true`。
8. 重置图片偏移。

因此当前正常文件上传路径一定会先进入遮罩对齐面板。

### 遮罩对齐和截图

遮罩资源:

```text
/MaskTexture/Mask1.png
/MaskTexture/Mask2.png
/MaskTexture/Mask3.png
/MaskTexture/Mask4.png
/MaskTexture/Mask5.png
```

UI:

- 面板高度固定为 `h-96`。
- 图片用 `absolute max-w-full max-h-full` 显示。
- 触摸和鼠标拖动通过手写事件处理。
- 遮罩图覆盖在图片上方，`w-full h-full object-cover`。

截图函数: `handleScreenshotAndUpload()`

流程:

1. 读取遮罩对齐容器当前实际宽高。
2. 创建相同尺寸的 Canvas。
3. 加载用户图片。
4. 按 `object-contain` 逻辑计算图片显示宽高。
5. 以居中位置加 `imagePosition` 偏移绘制用户图片。
6. 如果选择了遮罩，则加载对应遮罩图。
7. 遮罩图按 `object-cover` 逻辑铺满容器。
8. 使用 `ctx.globalCompositeOperation = 'destination-out'` 绘制遮罩。
9. 导出 PNG Blob。
10. 生成 `processedFile`，文件名为原文件名去扩展名后加 `.png`。

遮罩语义:

- 遮罩图片的白色不透明区域会擦除用户图片，使其透明。
- 遮罩图片透明区域会保留用户图片。
- 所以遮罩素材必须按这个规则制作，否则裁剪结果会反。

### Supabase 上传

Edge Function URL:

```text
https://lmlzavksopdunbpckaqh.supabase.co/functions/v1/gallery-upload
```

FormData 字段:

- `file`: 图片文件。
- `questionId`: 固定 `752d87b3-5f33-4097-ae16-c99eabed2e86`。
- `name`: `selectedName`，当前 App 中固定为 `fish`。

成功判定:

- 需要 `response.data.media_url` 存在。
- 成功后保存缩略图，并调用 `onUploadSuccess({ name, url })` 进入编辑页。

注意:

- 没有鉴权 header。
- Supabase URL、questionId、name 都是硬编码。
- 如果启用 Supabase 且 Supabase 请求失败，当前截图上传流程会进入 `catch`，不会继续发送 HTTP 图片给 Unity。
- 注释写着“强制发送HTTP请求”，但实际只在 Supabase 成功后或关闭 Supabase 时发送。

### HTTP 图片和音频发送

截图上传路径中，HTTP 发送逻辑:

- URL: `http://${wsIp}:8080`
- 方法: `POST`
- Body: `FormData`
- 字段:
  - `image`: `processedFile`
  - `audio`: 可选，录音文件 `recording.wav`
- 发送方式: `XMLHttpRequest`
- 不等待响应，不读取状态码，不显示发送失败。

关闭 Supabase 时:

- 仍会发送 HTTP。
- 设置成功文案: `已發送HTTP請求，未上傳至Supabase`
- 通过 `URL.createObjectURL(blob)` 生成本地 URL 进入编辑页。

### 音频录制

录音入口:

- `startAudioRecording()`
- `stopAudioRecording()`

使用:

- `navigator.mediaDevices.getUserMedia({ audio: true })`
- `MediaRecorder`

当前逻辑:

- 开始录音时清空旧数据。
- `ondataavailable` 收集 chunk。
- `onstop` 把 chunks 合成 `new Blob(chunks, { type: 'audio/wav' })`。
- 发送时包装为 `new File([audioBlob], 'recording.wav', { type: 'audio/wav' })`。

风险:

- 浏览器 `MediaRecorder` 实际输出格式通常不一定是 WAV，可能是 WebM 或其他格式。当前代码强行标为 `audio/wav`，Unity 端如果严格按 WAV 解码可能失败。
- iOS WebView 对 `MediaRecorder` 支持需要真机验证。

### 相机逻辑

代码中存在:

- `handleOpenCamera()`
- `handleCloseCamera()`
- `handleTakePhoto()`
- `showCamera` UI

但是当前页面没有渲染“打开相机”的按钮，并且代码里有:

```ts
void handleOpenCamera
```

这说明相机功能目前是半保留状态: 逻辑存在，但用户从界面上无法进入相机模式。后续如果要恢复拍照，需要添加入口，并在 iPad 真机上确认权限和 WebView 行为。

### 直接上传路径

`handleUpload()` 会上传 `selectedFile` 原图，不走截图和遮罩处理。UI 上它只在 `previewUrl && !showMaskPanel` 时显示。

由于 `handleFile()` 总是把 `showMaskPanel` 设为 `true`，当前正常选图后会显示遮罩面板。用户确认截图成功后一般直接进入编辑页，所以直接上传按钮在实际流程中基本不可达。后续如需支持“跳过遮罩直接上传”，需要补一个明确入口。

## 8. 编辑页: `EditPage.tsx`

编辑页职责:

- 显示背景场景。
- 显示已上传图片。
- 拖动图片位置。
- 计算 16x9 网格索引。
- 控制缩放。
- 选择动画编号。
- 水平翻转。
- 释放图片物体。
- 切换背景。
- 向 Unity 发送控制命令。

### Props

```ts
interface EditPageProps {
  imageData: { name: string; url: string }
  wsIp: string
  selectedName: string
  onBackToUpload: () => void
  onResetUpload: () => void
  onBackToHome: () => void
}
```

### 主要状态

- `position`: 图片中心点归一化位置，初始 `{ x: 0.5, y: 0.5 }`。
- `scale`: 图片缩放，初始 `1`，范围 UI 上为 `0.1` 到 `3.0`。
- `animationId`: 动画编号，初始 `0`。
- `gridIndex`: 当前网格索引，初始 `0`。
- `currentBg`: 当前背景，初始为 `selectedName`，当前通常是 `fish`。
- `isFlipped`: 是否水平翻转。
- `isReleased`: 是否释放图片物体，释放后禁用拖动绑定。

注意:

- 初始 `position` 在中心点，但初始 `gridIndex` 显示为 `0`。按算法中心点实际应为 `72`。
- 点击“重设位置”会把 `gridIndex` 更新为中心点对应值并发送。

### 网格计算

函数:

```ts
const calculateGridIndex = (x: number, y: number) => {
  const col = Math.floor(x * 16)
  const row = 8 - Math.floor(y * 9)
  return row * 16 + col
}
```

规则:

- 容器被视为 16 列 x 9 行。
- 左下角为 0。
- 从左到右递增。
- 从下到上递增。

例子:

- `x = 0, y = 1` 理论上接近左下。
- `x = 0.5, y = 0.5` 得到 `72`。

风险:

- `x` 或 `y` 被允许等于 `1`，此时 `Math.floor(x * 16)` 会得到 `16`，超过列范围 0 到 15；`Math.floor(y * 9)` 会得到 `9`，导致 row 为 `-1`。应在后续改动中把 col clamp 到 `0..15`，row clamp 到 `0..8`。

### 拖动

使用 `react-use-gesture` 的 `useDrag`。

拖动中:

1. 读取容器宽高。
2. 把拖动 delta 转成归一化比例。
3. 叠加到 `position`。
4. clamp 到 `0..1`。
5. 计算并保存 `gridIndex`。

拖动结束:

```ts
sendHttpMessage(gridIndex.toString())
```

风险:

- `setGridIndex` 是异步的，拖动结束时发送的 `gridIndex` 可能是上一帧状态。更稳的方式是在 drag handler 里保存最新值到 ref，或在释放时用最新 position 重新计算。

### 编辑页 HTTP 命令

统一函数:

- URL: `http://${wsIp}:8080`
- 方法: `POST`
- Content-Type: `text/plain`
- Body: 命令字符串
- 发送方式: `XMLHttpRequest`
- 错误处理: 只捕获同步异常。

当前命令表:

| 操作 | 命令格式 | 示例 |
| --- | --- | --- |
| 物体选择 | `GameObject:{index}` | `GameObject:3` |
| 拖动定位 | `{gridIndex}` | `72` |
| 重设位置 | `{gridIndex}` | `72` |
| 缩放 | `{imageData.name}_Scale:{value}` | `photo.png_Scale:1.5` |
| 动画 | `{imageData.name}:{animationId}` | `photo.png:4` |
| 水平翻转 | `{imageData.name}_Flip:{true|false}` | `photo.png_Flip:true` |
| 释放 | `{imageData.name}_Release:true` | `photo.png_Release:true` |
| 背景 | `Bg:{Fish|People|Other}` | `Bg:Fish` |

### 背景场景

背景下拉选项:

- `fish`: UI 文案“海底珊瑚”，本地播放 `fish.mp4`，发送 `Bg:Fish`。
- `people`: UI 文案“動物小鎮”，本地播放 `people.mp4`，发送 `Bg:People`。
- `other`: UI 文案“空白網格”，不播放视频，发送 `Bg:Other`。

视频文件通过相对路径 `fish.mp4`、`people.mp4` 加载。Vite 下这些文件在 `public` 目录可作为站点根路径资源访问。

## 9. 全局样式: `index.css`

样式结构:

- Tailwind base/components/utilities。
- Apple 风格 CSS 变量。
- `.apple-container` 淡入动画。
- `.apple-card`、`.apple-button`、`.apple-input`、`.apple-select`、`.apple-slider`、`.apple-status-*`。
- `.grid-container`: 16:9 网格背景，目前当前编辑页没有直接使用这个 class。
- `.draggable-image`: 编辑页图片定位。
- `.drag-overlay`: 编辑页拖动覆盖层。
- `.home-background`、`.upload-background`、`.edit-background`。

注意:

- 目前设计以白色、浅灰、蓝色为主。
- 卡片圆角较大，`apple-card` 是 20px。
- 上传页和编辑页很多局部样式直接写 Tailwind class，没有统一组件层。

## 10. Capacitor 和 iOS

### `capacitor.config.ts`

当前配置:

- `appId`: `com.artlab.web`
- `appName`: `Art Lab Web`
- `webDir`: `dist`
- `ios.contentInset`: `always`
- `ios.backgroundColor`: `#ffffff`

插件权限描述中配置了 Camera 和 Filesystem，但 `package.json` 当前没有安装 `@capacitor/camera` 或 `@capacitor/filesystem`。当前源码主要使用 Web API，不是 Capacitor Camera API。

### `ios/App/App/Info.plist`

重要权限:

- `NSCameraUsageDescription`
- `NSPhotoLibraryUsageDescription`
- `NSPhotoLibraryAddUsageDescription`
- `NSMicrophoneUsageDescription`
- `NSAppTransportSecurity`
  - `NSAllowsArbitraryLoads = true`
  - `NSAllowsLocalNetworking = true`

这允许访问本地 HTTP 服务和使用麦克风/相机权限。当前 plist 文案使用简体中文，和 README 要求的香港繁体不一致。

### `AppDelegate.swift`

基本是 Capacitor 默认 AppDelegate，没有自定义业务逻辑。

## 11. 资源文件

实际被前端使用的资源:

- `public/fish.mp4`: 编辑页 fish 背景视频。
- `public/people.mp4`: 编辑页 people 背景视频。
- `public/MaskTexture/Mask1.png` 到 `Mask5.png`: 上传页遮罩。

可能是历史或备用资源:

- 根目录 `fish.png`、`fish.mp4`、`people.png`、`people.mp4`。
- 根目录 `MaskTexture/鱼形遮罩.png`、`恐龙遮罩.png`、`小熊遮罩.png`、`人形遮罩.png`、`人形全身遮罩.png`。

后续如果要清理资源，需要确认 iOS 构建、部署脚本、Unity 侧文档是否还有引用。

### `Target.gif` 目标参考

`Target.gif` 位于项目根目录，是后续复刻目标。当前提取到的基础信息:

- 文件路径: `D:\ArtLabWeb\Target.gif`
- 文件大小: 约 68.5 MB
- 尺寸: 426 x 240
- 帧数: 1162
- 帧间隔: 100ms
- 帧率: 约 10fps
- 总时长: 约 116.2 秒

关键画面结构:

- 0s 附近: 青蓝色纯色开场。
- 2.5s 附近: 居中出现 `Art Lab` 标题。
- 5s 附近: 手持 iPad 和鱼形画作，出现英文标语 `Bring your Client's Artwork to Life`。
- 7.5s 到 15s: iPad 对着纸面作品操作，呈现从实体画作到平板/数字内容的转换。
- 20s 到 70s: Unity/投影侧展示海底场景，鱼群、珊瑚、用户上传的鱼形作品和人物互动。
- 55s 到 70s: 线稿人物/角色被引入到海底投影场景中，体现“作品被带入场景并动画化”的目标体验。
- 75s 到 110s: 进入眼睛造型场景，iPad 控制/展示内容，投影中有眼球、鱼、角色等动画元素。
- 116s 附近: 白底 logo/版权收尾。

复刻时需要注意:

- 这个 GIF 更像“最终展示效果和体验节奏”的参考，不只是某个页面样式参考。
- 当前 Web 端重点负责上传、选择物体、遮罩裁剪、发送图片/音频/控制命令；GIF 中的海底、眼睛、角色运动大多应由 Unity 侧承担。
- Web 端后续改造应优先靠近 GIF 中的 iPad 操作体验: 简洁、直接、以作品上传和场景联动为核心。
- 如果要在 Web 端复刻 GIF 的开场/引导视频，需要另外确认是否直接使用 `Target.gif`、拆帧/转 MP4，还是按它重做一套轻量动效。

## 12. README 和实际代码差异

当前 README 中有明显历史遗留:

- README 同时提到 UDP、WebSocket、HTTP，但当前前端源码实际使用 HTTP POST 到 `:8080`。
- README 写“Capacitor 6”，当前依赖是 Capacitor 8.3。
- README 写“仅使用 WebSocket，无任何 UDP 相关程式碼”，但仓库有 `udp-forwarder.js`，依赖中也有 `capacitor-udp`、`capacitor-tcp-client`、`ws`。
- README 写“仅保留 Supabase 上载方式”，但当前代码支持关闭 Supabase，并始终存在 HTTP 直发 Unity 的路径。
- README 要求“港式繁体”，当前 `UploadPage.tsx` 和 `Info.plist` 中存在大量简体文案。

建议后续把 README 作为待更新文件，不要按它直接理解当前行为。

## 13. 已知风险和后续改造重点

### 通信层

- HTTP 命令和 HTTP 图片上传分散在 `HomePage`、`UploadPage`、`EditPage`。
- 没有统一超时、重试、状态码处理、错误提示。
- Web 端可能受 CORS 影响，Unity 接收端需要允许跨域或运行在 WebView 可接受的环境。
- 当前 `XMLHttpRequest` 大多是 fire-and-forget，用户无法知道 Unity 是否真正收到。

建议:

- 新增 `src/services/unityClient.ts`，集中管理:
  - `sendTextCommand(ip, message)`
  - `sendImage(ip, imageFile, audioFile?)`
  - 超时、响应解析、错误上报
  - 统一端口常量 `8080`

### 协议层

- 命令字符串是散落的模板字符串，没有类型保护。
- `imageData.name` 直接参与协议，文件名里如果有空格、中文、特殊符号，Unity 解析要确认。
- `selectedName` 固定 `fish`，和“物体选择”不是一套明确模型。

建议:

- 新增协议类型和命令构造器。
- 和 Unity 端确认稳定协议文档。
- 明确 objectIndex、imageName、sceneName、selectedName 的职责。

### 上传层

- Supabase URL 和 questionId 硬编码。
- Supabase 失败时启用状态下不会继续 HTTP 直发。
- “关闭 Supabase”时进入编辑页使用 object URL，只在当前会话有效。
- `handleUpload()` 直接上传路径基本不可达。

建议:

- 抽出 `uploadService.ts`。
- 用环境变量管理 Supabase URL、questionId。
- 明确上传策略:
  - 先 Supabase，成功后 HTTP
  - Supabase 失败是否仍发 HTTP
  - 是否允许仅本地 HTTP 模式

### 遮罩和图片编辑

- 遮罩面板、录音、上传都堆在 `UploadPage.tsx`。
- 图片拖动 clamp 只在图片大于容器时限制，小图可以拖出容器。
- Canvas 截图依赖当前 DOM 容器尺寸，iPad 横竖屏切换时要实测。
- 遮罩素材语义需要固定为“白色擦除，透明保留”。

建议:

- 拆分:
  - `MaskAlignmentPanel`
  - `AudioRecorder`
  - `UploadActions`
  - `useImageDrag`
- 为遮罩截图算法加纯函数或小型测试样例。

### 编辑页网格

- 初始 `gridIndex` 和初始位置不一致。
- x/y 为 1 时可能算出越界索引。
- 拖动结束发送的索引可能是旧状态。

建议:

- 把 `calculateGridIndex` 改成可测试的工具函数。
- clamp col 到 `0..15`，row 到 `0..8`。
- 使用 ref 保存最新 gridIndex，释放时发送 ref。

### 相机和音频

- 相机入口当前没有显示。
- 录音 MIME 被强制标为 WAV，但 MediaRecorder 不保证输出 WAV。
- iOS WebView 对 MediaRecorder 和摄像头行为需要真机验证。

建议:

- 如果要 iPad 原生体验，考虑使用 Capacitor Camera 插件。
- 如果继续使用 Web API，补兼容性检测和不可用提示。
- 录音发送前记录真实 MIME，或在前端/后端转码为 Unity 可稳定解析的格式。

### 文案和本地化

- 当前 UI 混合香港繁体、简体中文、少量英文。
- README 明确要求香港繁体，但源码没有统一。

建议:

- 建立 `src/i18n` 或简单文案常量文件。
- 一次性统一所有 UI 文案、注释可以后续再处理。

### 依赖和历史文件

- `capacitor-udp`、`capacitor-tcp-client` 在当前前端未使用。
- `ws` 只被 `udp-forwarder.js` 使用，但没有 npm script。
- `udp-forwarder.js` 不是当前主流程。

建议:

- 后续确认 Unity 端到底使用 HTTP 还是 UDP。
- 如果确定 HTTP，清理 UDP 相关依赖和 README 历史描述。
- 如果要恢复 UDP，先明确 iPad/Capacitor 网络权限和插件可用性，再做协议层重构。

## 14. 后续大改建议顺序

建议按以下顺序改，风险会更可控:

1. 先冻结并确认 Unity HTTP 协议，包括所有命令、字段名、端口、图片和音频格式。
2. 抽出 Unity 通信服务，替换三个页面里的重复 `XMLHttpRequest`。
3. 抽出上传服务，统一 Supabase 和 HTTP 直发策略。
4. 修正编辑页网格算法和拖动释放发送旧索引的问题。
5. 拆分上传页，把遮罩、录音、文件选择、上传动作拆成组件。
6. 明确 `selectedName`、`selectedObjectIndex`、背景场景之间的业务关系。
7. 恢复或删除相机入口。
8. 统一 UI 文案语言。
9. 更新 README，使其和当前代码一致。
10. 最后清理未使用依赖、历史资源、构建产物提交策略。

## 15. 快速改动定位表

| 需求 | 主要文件 | 说明 |
| --- | --- | --- |
| 改 Unity IP 默认值 | `src/App.tsx` | 修改 `wsIp` 初始值 |
| 改端口 8080 | `HomePage.tsx`、`UploadPage.tsx`、`EditPage.tsx` | 当前端口硬编码在多个文件 |
| 改物体数量 | `HomePage.tsx` | `Array.from({ length: 20 })` |
| 改缩略图缓存数量 | `HomePage.tsx` | `MAX_IP_GROUPS` |
| 改 Supabase 地址 | `UploadPage.tsx` | 两处 `gallery-upload` URL |
| 改 Supabase questionId | `UploadPage.tsx` | 两处固定 UUID |
| 改上传字段名 | `UploadPage.tsx` | HTTP 图片字段为 `image`，音频字段为 `audio` |
| 改遮罩数量 | `UploadPage.tsx` | 遮罩按钮 `[0,1,2,3,4,5]` 和 public 资源 |
| 改遮罩算法 | `UploadPage.tsx` | `handleScreenshotAndUpload` |
| 改录音行为 | `UploadPage.tsx` | `startAudioRecording`、`stopAudioRecording` |
| 恢复相机入口 | `UploadPage.tsx` | `handleOpenCamera` 已有但未渲染入口 |
| 改网格规则 | `EditPage.tsx` | `calculateGridIndex` |
| 改动画数量 | `EditPage.tsx` | `Array.from({ length: 10 })` |
| 改背景选项 | `EditPage.tsx` | `currentBg`、video、`bgMap` |
| 改整体视觉 | `src/index.css` | Apple 风格全局类和 Tailwind class |
