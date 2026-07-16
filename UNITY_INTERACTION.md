# MagicFloor Unity 交互文档

更新时间：2026-07-14

本文档用于 Unity 端实现 MagicFloor 当前与下一版动态艺术功能的接收协议。前端仍以 HTTP 为主，Unity 端只需要监听对应端口，处理 `multipart/form-data` 文件上传和 `text/plain` 控制指令。

## 1. 端口

默认端口：

```text
动态艺术 / 作品控制：8080
互动艺术 / 快速上传：11701
```

端口可以在 iPad 设置页修改，所以 Unity 端部署时需要保证对应端口与前端设置一致。

## 2. HTTP 基础规则

### 2.1 文本指令

```text
POST http://{ip}:{port}
Content-Type: text/plain
Body: 指令字符串
```

### 2.2 文件上传

```text
POST http://{ip}:{port}
Content-Type: multipart/form-data
```

新版动态艺术上传字段：

| 字段 | 类型 | 说明 |
| --- | --- | --- |
| `file` | File | 上传的图片或视频文件 |
| `name` | string | 原始文件名 |
| `role` | string | `background` 或 `item` |
| `groupId` | string | 所属作品檔案 ID。协议字段仍叫 `groupId`，前端 UI 显示为作品檔案 |
| `itemId` | string | 图片对象 ID，背景没有该字段 |
| `assetId` | string | 前端媒体资源 ID |
| `mediaType` | string | `image` 或 `video` |
| `mimeType` | string | MIME 类型，如 `image/png`、`video/mp4` |

旧版控制上传仍可能使用字段 `image`，Unity 端如果已有兼容逻辑可以保留。

## 3. 动态艺术新版协议

新版动态艺术文本指令统一使用：

```text
MF|DynamicArt|{EventName}|{JSON}
```

Unity 端解析建议：

1. 判断字符串是否以 `MF|DynamicArt|` 开头。
2. 用 `|` 分割前 3 段。
3. 第 3 段为事件名。
4. 第 4 段开始为 JSON 字符串。
5. 根据事件名反序列化 JSON。

示例：

```text
MF|DynamicArt|ItemTransform|{"groupId":"group_a","itemId":"item_1","gridIndex":72,"position":{"x":0.5,"y":0.5},"scale":1.2,"rotation":30}
```

### 3.1 作品檔案事件

说明：前端 UI 统一称为“作品檔案”，协议事件名和字段名继续沿用 `Group*` / `groupId`，避免接收端大范围改名。

#### GroupCreate

创建一个作品檔案。

```text
MF|DynamicArt|GroupCreate|{"groupId":"group_a","name":"森林作品檔案"}
```

字段：

| 字段 | 类型 | 说明 |
| --- | --- | --- |
| `groupId` | string | 作品檔案 ID |
| `name` | string | 作品檔案名称 |

#### GroupUpdate

编辑作品檔案名称或缩略图后发送。缩略图目前主要用于 iPad 端本地展示；如果 Unity 端不需要处理缩略图，可只同步名称。

```text
MF|DynamicArt|GroupUpdate|{"groupId":"group_a","name":"森林作品檔案 02","thumbnailAssetId":"media_thumb_1"}
```

字段：

| 字段 | 类型 | 说明 |
| --- | --- | --- |
| `groupId` | string | 被编辑的作品檔案 ID |
| `name` | string | 最新作品檔案名称 |
| `thumbnailAssetId` | string | 可选。缩略图素材 ID，仅在当前檔案有缩略图时发送 |

#### GroupDelete

删除作品檔案后发送。前端会同时清理该作品檔案的本地缓存素材，包括缩略图、背景素材和檔案内图片。

```text
MF|DynamicArt|GroupDelete|{"groupId":"group_a"}
```

字段：

| 字段 | 类型 | 说明 |
| --- | --- | --- |
| `groupId` | string | 被删除的作品檔案 ID |

#### GroupSelect

进入或切换到某个作品檔案。

```text
MF|DynamicArt|GroupSelect|{"groupId":"group_a","name":"森林作品檔案","itemCount":6}
```

#### GroupAppearMode

设置作品檔案内图片出现方式。`sequence` 会按图层顺序逐个出现，`intervalMs` 表示每个物件淡入之间的间隔；`all` 会同时出现，Unity 端可忽略间隔。

```text
MF|DynamicArt|GroupAppearMode|{"groupId":"group_a","mode":"sequence","intervalMs":800}
```

`mode` 可选：

```text
sequence 逐个出现
all      全部出现
```

#### PreviewMode

进入或退出前端预览模式。预览模式用于让客户查看已设置的移动方式和出现方式；编辑模式下前端图片保持静止，方便双击、拖拽和双指缩放旋转。

```text
MF|DynamicArt|PreviewMode|{"groupId":"group_a","enabled":true,"appearMode":"sequence","intervalMs":800,"replayId":1}
MF|DynamicArt|PreviewMode|{"groupId":"group_a","enabled":false,"appearMode":"sequence","intervalMs":800,"replayId":1}
```

`replayId` 每次前端重新播放预览时递增。进入预览会递增一次；预览模式下点击 `逐个出现` / `全部出现` 也会递增一次，用于通知 Unity 端从头播放当前出现方式。

### 3.2 背景事件

背景文件先通过 `multipart/form-data` 上传，然后再发送 `BackgroundSet` 事件。每个作品檔案可以保存多个背景素材，`BackgroundSet` 表示新增后设为当前背景，或从背景素材库中切换当前背景。

#### 背景文件上传

图片背景：

```text
POST http://{ip}:8080
file: background.png
role: background
groupId: group_a
assetId: media_bg_1
mediaType: image
mimeType: image/png
```

视频背景：

```text
POST http://{ip}:8080
file: background.mp4
role: background
groupId: group_a
assetId: media_bg_2
mediaType: video
mimeType: video/mp4
```

#### BackgroundSet

```text
MF|DynamicArt|BackgroundSet|{"groupId":"group_a","assetId":"media_bg_2","name":"background.mp4","mediaType":"video","mimeType":"video/mp4"}
```

Unity 端建议：

- `mediaType=image`：作为 16:9 背景图显示。
- `mediaType=video`：保存视频文件后使用 `VideoPlayer` 播放，作为 16:9 背景。
- 背景属于作品檔案级资源，切换作品檔案时需要加载对应当前背景。
- 如果该 `assetId` 已经上传过，收到 `BackgroundSet` 时只需要切换当前背景，不需要重新创建资源。

#### BackgroundDelete

删除作品檔案中的一个或多个背景素材。

```text
MF|DynamicArt|BackgroundDelete|{"groupId":"group_a","assetIds":["media_bg_1","media_bg_2"],"nextActiveAssetId":"media_bg_3"}
```

字段：

| 字段 | 类型 | 说明 |
| --- | --- | --- |
| `groupId` | string | 作品檔案 ID |
| `assetIds` | string[] | 要删除的背景素材 ID |
| `nextActiveAssetId` | string \| null | 删除后前端当前选中的背景；如果为 `null`，表示该作品檔案暂无背景 |

Unity 端建议在删除当前背景后，使用 `nextActiveAssetId` 切换到剩余背景；前端也会在当前背景发生变化时补发一次 `BackgroundSet`。

### 3.3 图片对象事件

#### 图片文件上传

每张图片先通过 `multipart/form-data` 上传：

```text
POST http://{ip}:8080
file: item.png
role: item
groupId: group_a
itemId: item_001
assetId: media_001
mediaType: image
mimeType: image/png
```

#### ItemCreate

```text
MF|DynamicArt|ItemCreate|{"groupId":"group_a","itemId":"item_001","assetId":"media_001","name":"item.png","order":0,"gridIndex":72}
```

Unity 端创建对应图片对象，并绑定：

```text
groupId + itemId
```

后续所有控制信号都通过 `itemId` 定位对象。

#### ItemUpdate

编辑物件名称或替换物件图片后发送。若 `replacedAsset` 为 `true`，前端会先用 `multipart/form-data` 重新上传该物件图片，再发送此事件。

```text
MF|DynamicArt|ItemUpdate|{"groupId":"group_a","itemId":"item_001","assetId":"media_002","name":"新物件名稱","mediaType":"image","mimeType":"image/png","replacedAsset":true}
```

字段：

| 字段 | 类型 | 说明 |
| --- | --- | --- |
| `groupId` | string | 所属作品檔案 ID |
| `itemId` | string | 被编辑的物件 ID |
| `assetId` | string | 当前物件图片资源 ID |
| `name` | string | 当前物件名称 |
| `mediaType` | string | 当前为 `image` |
| `mimeType` | string | 图片 MIME 类型 |
| `replacedAsset` | boolean | 是否替换了图片文件；只改名时为 `false` |

#### ItemDelete

```text
MF|DynamicArt|ItemDelete|{"groupId":"group_a","itemId":"item_001"}
```

Unity 端删除对应图片对象。

#### ItemSelect

```text
MF|DynamicArt|ItemSelect|{"groupId":"group_a","itemId":"item_001"}
```

用于前端和 Unity 保持当前选中对象一致。

### 3.4 图片变换事件

#### ItemTransform

拖动、缩放、旋转都会发送该事件。前端有节流，避免 iPad 拖动时请求过密。

```text
MF|DynamicArt|ItemTransform|{"groupId":"group_a","itemId":"item_001","gridIndex":72,"position":{"x":0.5,"y":0.5},"scale":1.2,"rotation":30}
```

字段：

| 字段 | 类型 | 说明 |
| --- | --- | --- |
| `gridIndex` | number | 16 x 9 网格坐标，沿用旧控制系统 |
| `position.x` | number | 0 到 1 的横向归一化坐标 |
| `position.y` | number | 0 到 1 的纵向归一化坐标 |
| `scale` | number | 缩放值 |
| `rotation` | number | 角度，范围建议 -180 到 180 |

#### ItemDeform

控制页工具栏的 `物件變形` 会发送该事件。水平翻转与旧版 `{imageName}_Flip:{true|false}` 语义一致；垂直翻转为新版新增状态。

```text
MF|DynamicArt|ItemDeform|{"groupId":"group_a","itemId":"item_001","flipX":true,"flipY":false}
```

字段：

| 字段 | 类型 | 说明 |
| --- | --- | --- |
| `flipX` | boolean | 水平翻转，勾选发送 `true`，取消发送 `false` |
| `flipY` | boolean | 垂直翻转，勾选发送 `true`，取消发送 `false` |

网格规则：

```text
16 列 x 9 行
左上为视觉起点
gridIndex = row * 16 + col
```

### 3.5 动画事件

#### ItemAnimation

```text
MF|DynamicArt|ItemAnimation|{"groupId":"group_a","itemId":"item_001","animationId":4}
```

`animationId` 当前范围：

```text
0 - 9
```

### 3.6 移动方式事件

#### ItemMotion

```text
MF|DynamicArt|ItemMotion|{"groupId":"group_a","itemId":"item_001","mode":"verticalWave","percent":50,"speed":60,"track":"middle"}
```

`mode` 可选：

| mode | 中文 | percent 含义 |
| --- | --- | --- |
| `none` | 停止 | 无 |
| `verticalWave` | 上下波浪 | 波浪覆盖幅度，100 可覆盖上中下三区 |
| `left` | 左移循环 | 以完整 16:9 画布高度为参考的水平波浪幅度，0 为当前轨道直线，50 为画布中部小幅波浪，100 为上下到达画布最高 / 最低点 |
| `right` | 右移循环 | 以完整 16:9 画布高度为参考的水平波浪幅度，0 为当前轨道直线，50 为画布中部小幅波浪，100 为上下到达画布最高 / 最低点 |
| `orbit` | 360 回环 | 椭圆回环幅度，Unity 端可做近大远小 |
| `random` | 随机 | 随机范围百分比 |

补充：`percent` 现在只表示幅度，`speed` 只表示速度。左移和右移会同时读取 `percent` 与 `speed`：`percent` 控制水平移动时的上下波浪幅度，`speed` 控制循环速度。

左移和右移不再把 `track` 当作波浪运动边界。`percent = 0` 时，`track` 决定直线横移所在高度；`percent > 0` 时，波浪固定以 16:9 画布中心线为中心，`track` 不再影响前端波浪轨迹高度，避免切换轨道导致波浪路径跳变。

左移和右移的波浪频率不单独发送字段。当前前端预览按一次横穿约 `8` 个完整波形处理，并使用线性多点采样避免波峰 / 波谷停顿；Unity 端如需对齐前端视觉，可使用同样固定频率。

`orbit` 的中心点使用物件当前 `position`，也就是图片移动前的放置点。`50%` 幅度限制在当前 `track` 内回环，`100%` 幅度会以该放置点为中心扩大到可覆盖上中下三段轨道；Unity 端不应把回环中心固定到舞台中心或轨道中心。

`track` 可选：

```text
top
middle
bottom
```

前端会保存每个物件的 `moveTrack`。拖动物件时会根据当前 Y 坐标同步更新轨道；在工具栏手动切换轨道时，前端只改变 Y 到该轨道中心，X 坐标保持不变。Unity 端可根据 `track` 决定左右循环的起点 / 基准线高度。

### 3.7 复用参数事件

#### ItemSettingsCopy

```text
MF|DynamicArt|ItemSettingsCopy|{"groupId":"group_a","targetItemId":"item_002","sourceItemId":"item_001","fields":["scale","rotation","flipX","flipY","animationId","moveMode","movePercent","moveSpeed","moveTrack"]}
```

前端会先在本地把目标图片参数改成源图片参数，再发送该事件。复制字段包含动画、移动方式、移动百分比、轨道、缩放、旋转、水平翻转和垂直翻转。轨道复用时目标物件的 X 坐标保持不变，Y 坐标移动到源物件轨道中心。

### 3.8 状态同步事件

#### GroupStateSync

进入控制页时，前端可以发送完整作品檔案状态，方便 Unity 端重建场景。

```text
MF|DynamicArt|GroupStateSync|{"groupId":"group_a","name":"森林作品檔案","appearMode":"all","appearIntervalMs":800,"activeBackgroundId":"media_bg_1","background":{"assetId":"media_bg_1","mediaType":"image"},"backgrounds":[{"assetId":"media_bg_1","mediaType":"image"},{"assetId":"media_bg_2","mediaType":"video"}],"items":[{"itemId":"item_001","assetId":"media_001","gridIndex":72,"position":{"x":0.5,"y":0.5},"scale":1,"rotation":0,"flipX":false,"flipY":false,"animationId":0,"moveMode":"none","movePercent":50,"moveSpeed":50,"moveTrack":"middle"}]}
```

Unity 端建议在收到该事件时：

1. 清理当前动态艺术作品檔案运行态。
2. 加载 `backgrounds` 中的背景素材，并将 `background` / `activeBackgroundId` 设为当前背景。
3. 按 items 创建图片对象。
4. 应用每张图片的坐标、缩放、旋转、翻转、动画和移动方式。

## 4. 旧作品控制协议

旧版单图控制协议暂时保留，主要作为已跑通基线和兼容能力。

| 功能 | 端口 | 信号 |
| --- | --- | --- |
| 选择槽位 | `8080` | `GameObject:{index}` |
| 删除槽位 | `8080` | `GameObjectDelete:{index}` |
| 移动 | `8080` | `{gridIndex}` |
| 缩放 | `8080` | `{imageName}_Scale:{value}` |
| 旋转 | `8080` | `{imageName}_Rotate:{degrees}` |
| 动画 | `8080` | `{imageName}:{animationId}` |
| 翻转 | `8080` | `{imageName}_Flip:{true|false}` |
| 释放 | `8080` | `{imageName}_Release:{true|false}` |
| 场景 | `8080` | `Bg:{Fish|People|Other}` |

## 5. 互动艺术协议

互动艺术走 `11701`。当前流程上传的是完整合成 PNG：

```text
用户图片 + 可见遮罩
```

上传方式为 `multipart/form-data`，Unity 端只需要接收图片并展示，不需要进入控制页。

## 6. 解耦建议

Unity 端建议按模块拆分：

- `HttpUploadReceiver`：只负责接收文件。
- `TextCommandReceiver`：只负责接收 text/plain 指令。
- `DynamicArtController`：处理 `MF|DynamicArt|...` 新协议。
- `LegacyControlController`：处理旧 8080 单图控制协议。
- `InteractiveUploadController`：处理 11701 快速上传图。
- `MediaStore`：保存图片/视频文件，并通过 `assetId` 查询。

这样当前端后续砍掉某个功能时，Unity 端也只需要停用对应模块。
