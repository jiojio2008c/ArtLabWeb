# MagicFloor Unity 交互文档

更新时间：2026-08-24

本文档用于 Unity 端实现 MagicFloor 当前与下一版动态艺术功能的接收协议。前端仍以 HTTP 为主，Unity 端只需要监听对应端口，处理 `multipart/form-data` 文件上传和 `text/plain` 控制指令。

## 1. 端口

默认端口：

```text
动态艺术 / 作品控制：8080
互动艺术 / 快速上传：11701
```

端口可以在 iPad 设置页修改，所以 Unity 端部署时需要保证对应端口与前端设置一致。

### 1.1 11701 程式啟動指令

程式啟動與互動藝術圖片共用互動藝術端口（預設 `11701`），接收端按 `Content-Type` 分流：

```text
text/plain          程式啟動指令
multipart/form-data 互動藝術圖片
```

啟動指令格式：

```text
MF|AppLauncher|Launch|{appId}
```

有效指令：

| iPad 操作 | 指令正文 |
| --- | --- |
| 動態藝術 | `MF|AppLauncher|Launch|dynamic-art` |
| 魔幻森林1 | `MF|AppLauncher|Launch|interactive-forest-1` |
| 魔幻森林2 | `MF|AppLauncher|Launch|interactive-forest-2` |
| 畫境成真 | `MF|AppLauncher|Launch|interactive-painting-real` |
| 美麗海洋 | `MF|AppLauncher|Launch|interactive-ocean` |

iPad 使用 fire-and-forget：發送後立即執行原頁面流程，不讀取 HTTP 狀態、不等待接收端回覆，也不確認目標程式是否成功開啟。接收端仍應回覆並關閉連線；目前 `ImageFileSaveHttpServer.cs` 對合法命令回覆 `202 Accepted`。

`ImageFileSaveHttpServer` 不直接執行 EXE。它會把合法命令排入執行緒安全佇列，再於 Unity 主執行緒觸發以下 Inspector 事件：

```text
onDynamicArtLaunch
onMagicForest1Launch
onMagicForest2Launch
onPaintingRealLaunch
onBeautifulOceanLaunch
```

Unity 專案可把既有無參數喚醒方法綁定到對應事件。腳本的程式碼預設端口是 `11701`，但已掛載組件的序列化 Inspector 值可能仍是舊端口，部署前必須人工核對。

### 1.2 11701 關閉外部程式指令

作品檔案根目錄和互動藝術選項頁返回首頁時，iPad 會先顯示確認對話框。使用者確認後，iPad 以同一個 `text/plain` HTTP 請求發送一次關閉指令，並立即執行首頁返回轉場，不等待 Unity 回覆。

指令格式：

```text
MF|AppLauncher|Close|{scope}
```

有效範圍：

| iPad 操作 | 指令正文 |
| --- | --- |
| 作品檔案返回首頁 | `MF|AppLauncher|Close|dynamic-art` |
| 互動藝術返回首頁 | `MF|AppLauncher|Close|interactive-art` |

`interactive-art` 是四個互動藝術 EXE 共用的單一訊號，不攜帶主題 ID。Unity 收到後應由自己的程式管理器判斷目前正在執行的互動藝術程式，再關閉對應 EXE；找不到正在執行的程式時應視為無操作成功。關閉事件也應保持冪等，重複收到相同指令不得啟動或關閉錯誤的程式。

`ImageFileSaveHttpServer` 會把合法指令排入執行緒安全佇列，並在 Unity 主執行緒觸發：

```text
onDynamicArtClose
onInteractiveArtClose
```

這兩個 `UnityEvent` 不直接執行 EXE。Unity Inspector 應將 `onDynamicArtClose` 綁定到動態藝術關閉方法，將 `onInteractiveArtClose` 綁定到能依目前執行狀態關閉四個互動藝術 EXE 之一的通用方法。

### 1.3 iPad 作品檔案與資料夾同步

作品檔案頁的 `資料夾 / 子資料夾` 仍是 iPad 的素材整理結構，不是動態舞台中的場景層級。為了讓 Windows 動態藝術程式與 iPad 顯示相同的作品檔案頁，iPad 會用 `ArchiveView` 傳送一份輕量索引：

- 索引包含目前路徑、資料夾階層、作品名稱、排序、物件數量及可用的封面素材 ID。
- `ArchiveView` 只切換並更新 PC 的作品檔案畫面，不上傳素材，也不載入或重建舞台。
- PC 冷啟動預設停留在作品檔案畫面；iPad 從首頁開啟動態藝術後會立即同步索引，並在 EXE 啟動期間短暫重送。
- 使用者在 iPad 選取作品後，`GroupSelect` 會把 PC 切換到舞台；控制頁原有的 `GroupStateSync` / `GroupSelectAndSync` 再負責傳送完整舞台資料。
- 把作品移入、移出或跨資料夾整理時，只會更新作品檔案索引，不會觸發媒體重傳或場景重建。
- 沒有 `folderId` 的舊作品會顯示在素材庫根目錄，舞台仍只以既有 `groupId` 區分作品。

### 1.4 11701 遠端鍵盤控制指令

Unity 團隊可直接使用獨立交付文件 [`UNITY_REMOTE_KEYBOARD.md`](./UNITY_REMOTE_KEYBOARD.md)，其中包含完整按鍵表、旋鈕方向、JSON 結構、主執行緒接入方式、C# 解析骨架、Windows 部署要求及聯調驗收清單。本節保留協議摘要。

首頁的鍵盤入口會開啟一個單向機械鍵盤控制頁。所有操作沿用目前設定中的藝術畫廊 IP 與互動藝術端口（預設 `11701`），使用 `Content-Type: text/plain` 發送；iPad 不等待回覆、不重試，也不顯示接收狀態。

按鍵格式：

```text
MF|RemoteKeyboard|Press|{"keys":["Escape"]}
MF|RemoteKeyboard|Press|{"keys":["LeftControl","LeftShift"]}
MF|RemoteKeyboard|Press|{"keys":["LeftAlt","F4"]}
MF|RemoteKeyboard|Press|{"keys":["LeftControl","LeftAlt","Alpha1"]}
```

完整按鍵對照：

| 面板位置 | `keys` |
| ---: | --- |
| 1 | `["Escape"]` |
| 2 | `["Home"]` |
| 3 | `["LeftControl","LeftShift"]` |
| 4 | `["LeftAlt","F4"]` |
| 5 | `["Space","N"]` |
| 6 | `["Space","F"]` |
| 7 | `["End"]` |
| 8 | `["PageDown"]` |
| 9 - 16 | `["LeftControl","LeftAlt","Alpha1"]` 到 `["LeftControl","LeftAlt","Alpha8"]` |

组合键是一条不可拆分的原子指令。Unity 的实际按键执行器应依次执行：修饰键按下、主键按下与释放、修饰键按相反顺序释放。即使执行过程发生异常，也必须在 `finally` 中释放所有已经按下的修饰键，避免 `Control` 或 `Alt` 卡住。

旋钮格式：

```text
MF|RemoteKeyboard|Turn|{"control":"volume","key":"Plus","steps":2}
```

| 旋钮 | 逆时针 | 顺时针 |
| --- | --- | --- |
| `volume` | `Minus` | `Plus` |
| `vertical` | `UpArrow` | `DownArrow` |
| `horizontal` | `LeftArrow` | `RightArrow` |

`steps` 表示旋钮档位数，范围为 `1 - 32`。iPad 每 `15deg` 产生一个档位，并会短暂合并同方向的连续档位，Unity 执行器应按 `steps` 次数重复对应按键。

根目录的 `ImageFileSaveHttpServer.cs` 会在 HTTP 监听线程完成格式和白名单校验，再把完整规范化指令放入线程安全队列；`onRemoteKeyboardCommand(string)` 只在 Unity 主线程的 `Update()` 中触发。该事件应连接到现有 Windows 按键模拟脚本，HTTP 接收脚本本身不直接注入系统按键。

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

#### ArchiveView

打开或更新 PC 端作品档案页。此事件只同步资料夹与作品索引，不代表选择作品，也不得触发舞台素材加载。

```text
MF|DynamicArt|ArchiveView|{"version":1,"currentFolderId":"folder_a","folders":[{"folderId":"folder_a","name":"我們這一家","parentFolderId":null,"order":0,"updatedAt":1750000000000}],"groups":[{"groupId":"group_a","name":"森林作品檔案","folderId":"folder_a","order":0,"itemCount":6,"previewAssetId":"media_thumb_1","previewAssetIds":["media_thumb_1","media_bg_1"],"updatedAt":1750000000000}],"requestedAt":1750000001000}
```

字段：

| 字段 | 类型 | 说明 |
| --- | --- | --- |
| `currentFolderId` | string \| null | iPad 当前打开的资料夹；根目录为 `null` |
| `folders` | array | 资料夹索引，包含 `folderId`、名称、父层、排序和更新时间 |
| `groups` | array | 作品索引，包含 `groupId`、名称、所属资料夹、排序、物件数量和封面候选素材 ID |
| `previewAssetIds` | string[] | PC 可从本机既有素材缓存中选择的封面候选，不要求重新上传 |
| `requestedAt` | number | iPad 发出同步时的毫秒时间戳 |

接收 `ArchiveView` 后应关闭预览并显示作品档案页。PC 冷启动也应默认显示该页；只有收到 `GroupSelect`、`GroupStateSync`、`GroupSelectAndSync` 或启用 `PreviewMode` 后才进入舞台。

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

在作品档案页选中作品并准备进入舞台。接收端收到后可切换到舞台画面；随后控制页会按既有流程发送完整作品状态与必要素材。

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

进入或退出前端预览模式。预览模式用于让客户查看已设置的移动方式和出现方式；编辑模式下前端图片保持静止，方便单击打开物件属性、单指拖拽，以及双指缩放和旋转。

```text
MF|DynamicArt|PreviewMode|{"groupId":"group_a","enabled":true,"appearMode":"sequence","intervalMs":800,"backgroundPlayMode":"sequence","backgroundIntervalMs":5000,"replayId":1}
MF|DynamicArt|PreviewMode|{"groupId":"group_a","enabled":false,"appearMode":"sequence","intervalMs":800,"backgroundPlayMode":"sequence","backgroundIntervalMs":5000,"replayId":1}
```

`replayId` 每次前端重新播放预览时递增。`backgroundPlayMode` 可为 `fixed`、`random`、`sequence`；`backgroundIntervalMs` 为背景切换间隔。当前 iPad 预览会锁定编辑界面，只能点击 `停止预览` 退出。

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

#### BackgroundPlayback

设置当前作品檔案的背景播放方式。该事件只修改播放参数，不代表上传、删除或立即切换背景素材。

```text
MF|DynamicArt|BackgroundPlayback|{"groupId":"group_a","mode":"sequence","intervalMs":5000}
```

| 字段 | 类型 | 说明 |
| --- | --- | --- |
| `groupId` | string | 作品檔案 ID |
| `mode` | string | `fixed` 固定、`random` 随机、`sequence` 逐个 |
| `intervalMs` | number | 自动切换间隔，前端限制为 `1000-600000ms` |

自动背景切换只在 `PreviewMode.enabled=true` 时运行；编辑模式显示 `activeBackgroundId` 对应背景。`sequence` 应按 `GroupStateSync` / `GroupSelectAndSync` 中 `backgrounds` 数组顺序，从当前背景开始依次循环；`random` 应避免连续显示同一个背景。iPad 端现在允许通过背景卡片拖拽调整该数组顺序。

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

控制页物件属性允许直接修改名称。只改名时不会重新上传媒体，也不会生成新的 `itemId` 或 `assetId`；接收端只需根据 `itemId` 更新显示名称，并保持现有对象和参数不变。

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

当前已经正式实现的第十个按钮映射：

| 界面位置 | `animationId` | 动作 | Unity Clip |
| --- | ---: | --- | --- |
| 第 1 个按钮 | `0` | 无动画 | 无 |
| 第 10 个按钮 | `9` | 行走 | `WalkAnimation` |

`WalkAnimation` 时长为 `0.8166667s`、60 FPS、循环播放，主要使用 `Key 23` / `Key 24` 交叉变形。iPad 与 `desktop-runtime` 均继续发送和读取 `animationId:9`；不要把第十个按钮改成 `animationId:10`。完整作品档案同步和属性复制中的 `animationId=9` 也具有相同语义。

当前仓库只有 Unity 曲线权重，没有原始 `photo_plane.fbx` / `photo_plane.glb` 中的 Morph Target 顶点 delta。因此现有 iPad / PC 播放器使用同曲线、同 7×9 网格拓扑的程序化行走回退；取得保留 24 个 Morph Targets 的模型后，可替换为真实 `Key 23/24` 顶点变形，而不修改本协议。

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
| `random` | 随机 | 每次预览按 `groupId + itemId + replayId` 固定解析为上下、左移、右移或 360 回环之一；同一次预览不变，重新预览会重新选择，永不解析为停止 |

补充：`percent` 现在只表示幅度，`speed` 只表示速度。左移和右移会同时读取 `percent` 与 `speed`：`percent` 控制水平移动时的上下波浪幅度，`speed` 控制循环速度。`random` 只在预览播放层解析，不改写物件保存值，也不额外发送 `ItemMotion`；iPad 与 PC 使用相同规则得到相同的移动方式。

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

### 3.7 属性复制事件

#### ItemSettingsCopy

```text
MF|DynamicArt|ItemSettingsCopy|{"groupId":"group_a","targetItemId":"item_002","sourceItemId":"item_001","copyFields":["motion","animation"],"fields":["moveMode","movePercent","moveSpeed","moveTrack","animationId"]}
```

前端会先选择来源物件，再在确认弹窗内勾选需要复制的内容；只有用户按下确认后，前端才在本地把目标属性改成来源物件参数并发送该事件。关闭或取消弹窗不会写入数据、发送事件或修改目标物件。`copyFields` 是 UI 分类，`fields` 是接收端实际需要复制的展开字段：

| `copyFields` | UI 名称 | `fields` |
| --- | --- | --- |
| `motion` | 移动方式 | `moveMode`、`movePercent`、`moveSpeed`、`moveTrack` |
| `animation` | 动画 | `animationId` |
| `size` | 大小 | `scale`、`rotation` |
| `deform` | 变形 | `flipX`、`flipY` |

用户可以只选一类，也可以任意多选。未列入 `fields` 的参数必须保持不变，图片媒体、素材路径和图层顺序绝不参与复制。复制移动方式时，目标物件的 X 坐标保持不变，Y 坐标移动到来源物件轨道中心；前端还会补发对应的 `ItemTransform`、`ItemMotion`、`ItemAnimation` 或 `ItemDeform`，供接收端即时刷新。

### 3.8 状态同步事件

#### GroupStateSync

进入控制页时，前端可以发送完整作品檔案状态，方便 Unity 端重建场景。

```text
MF|DynamicArt|GroupStateSync|{"groupId":"group_a","name":"森林作品檔案","appearMode":"all","appearIntervalMs":800,"backgroundPlayMode":"fixed","backgroundIntervalMs":5000,"activeBackgroundId":"media_bg_1","background":{"assetId":"media_bg_1","mediaType":"image"},"backgrounds":[{"assetId":"media_bg_1","mediaType":"image"},{"assetId":"media_bg_2","mediaType":"video"}],"items":[{"itemId":"item_001","assetId":"media_001","gridIndex":72,"position":{"x":0.5,"y":0.5},"scale":1,"rotation":0,"flipX":false,"flipY":false,"animationId":0,"moveMode":"none","movePercent":50,"moveSpeed":50,"moveTrack":"middle","order":0}]}
```

Unity 端建议在收到该事件时：

1. 清理当前动态艺术作品檔案运行态。
2. 加载 `backgrounds` 中的背景素材，并将 `background` / `activeBackgroundId` 设为当前背景。
3. 按 `items` 创建图片对象，并按 `order` 从小到大绘制；数值越大表示越靠前。
4. 应用每张图片的坐标、缩放、旋转、翻转、动画和移动方式。

控制页图层列表顶部为前景、底部为后景。用户拖曳图层后，前端会持久化每个物件的新 `order`，并发送完整 `GroupStateSync`；逐个出现仍按 `order` 从小到大，也就是由后景至前景播放。

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
