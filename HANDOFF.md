# MagicFloor 当前交接文档

## 2026-08-13 当前交付基线（权威现况）

> 本节是当前代码与交付物的权威说明。下方原有内容是按日期累积的开发历史，保留用于追溯，但若与本节冲突，以本节为准。

### 1. 产品与交付范围

MagicFloor 当前由三个协作部分组成：

1. **iPad 控制端**：本仓库根目录的 React/Vite/TypeScript 应用，经 Capacitor 封装为 iOS App。负责登录、首页导航、动态艺术资料管理、舞台编辑、预览控制、互动艺术拍照/遮罩/上载、设置与遥控键盘。
2. **动态艺术 Windows 播放端**：`desktop-runtime/` 下的 Electron 应用。负责接收 iPad 发来的动态艺术资料、播放背景和物件动画、显示 iPad 作品档案页镜像，并提供鼠标互动。
3. **互动艺术/其他 Unity 程序**：不在本仓库实现。iPad 只向 `11701` 发送启动、关闭、快速上载、二维码和遥控键盘指令；不等待 Unity 回执，也不负责判断外部程序是否成功启动或关闭。

当前主流程可交付到以下程度：

- 用户使用 Supabase 邮箱和密码登录，登录后进入首页。
- 首页可进入动态艺术、互动艺术、远程机械键盘和设置。
- 动态艺术可建立资料夹/子资料夹和素材作品档案，管理多背景、多图层及完整物件参数；进入预览后 iPad 与 EXE 同步播放。
- 互动艺术可选择四种主题、拍照或选择图片、套用定位遮罩、合成并上载到 Unity，随后显示完成页。
- Windows EXE 可无边框全屏显示 1920x1080 舞台，接收 iPad 的资料与状态；另有整体翻转版本用于特殊镜像展示环境。
- 设置中的“进阶功能”可按设备开启。关闭时保持原有控制页和播放行为；开启后提供物件进场、目标点、物件音源、背景音乐、物件背景绑定和背景切换动画，并与 EXE 同步预览。

### 2. 技术栈与目录职责

#### iPad/Web 主应用

- 框架：React 18、TypeScript 5、Vite 5。
- 动效：GSAP、Three.js、CSS/Web Animations、Canvas 2D。
- 图标：Lucide React。
- 本地化：i18next + react-i18next。
- 原生容器：Capacitor 8，iOS 工程位于 `ios/`。
- 原生文件能力：`@capacitor/filesystem`；相机界面主要使用浏览器媒体设备能力与现有自定义拍照 UI。
- 截图镜像：`html-to-image`，用于把 iPad 首页/作品档案页转成 JPEG 发给 EXE。

关键入口与模块：

- `src/main.tsx`：React 入口与 i18n 初始化。
- `src/App.tsx`：登录态、页面状态机、动态/互动艺术路由、跨页转场、EXE 档案镜像同步。
- `src/index.css`：全局设计系统、响应式布局、所有页面和过场动画样式。
- `src/components/EntryPage.tsx`：首页，包含动态艺术、互动艺术、键盘和设置入口。
- `src/components/LoginPage.tsx`：仅登录用途的登录页。
- `src/components/SettingsPanel.tsx`：账号资料、IP/端口、二维码、语言和登出。
- `src/components/DynamicGroupsPage.tsx`：动态艺术作品档案、资料夹层级、图标/详细模式、排序和面包屑。
- `src/components/DynamicBackgroundPage.tsx`：新素材首次建立且无背景时的背景上传流程。
- `src/components/DynamicItemsPage.tsx`：保留的图片上传/素材页流程；正常新建作品现以直接进入控制页为主。
- `src/components/DynamicControlPage.tsx`：动态艺术舞台、图层、编辑背景、物件属性、属性复制和预览。
- `src/components/DirectUploadSelectPage.tsx`：互动艺术四主题选择页。
- `src/components/UploadPage.tsx`：拍照、文件/相簿选择、遮罩定位、合成和上载。
- `src/components/DirectUploadCompletePage.tsx`：上载完成结果和重新上载确认。
- `src/components/RemoteKeyboardPage.tsx`：机械键盘式远程控制器。
- `src/components/dynamicTransitions/`：首页到动态作品档案、作品档案到控制页的统一转场。
- `src/components/interactiveTransitions/`：首页到互动主题、主题到上载页、返回和作品发射过场。
- `transition-portal-preview/`：视觉方案测试页。它不是正式产品路由，主要用于先确认 UI/动画提案。

#### Windows 动态播放端

- 技术：Electron 37 + Canvas 2D；打包使用 electron-builder。
- 目录：`desktop-runtime/`。
- `desktop-runtime/main.js`：窗口、8080 HTTP 服务、协议解析、资产落盘、运行状态和 IPC。
- `desktop-runtime/main.vertical-flip.js`：特殊翻转版入口。
- `desktop-runtime/renderer/player.js`：1920x1080 舞台渲染、背景/物件/动画、档案镜像、鼠标命中和涟漪。
- `desktop-runtime/renderer/item-animation-core.js`：原有动画 `1-8`。
- `desktop-runtime/renderer/walk-animation-core.js`：行走动画 `9`。
- `desktop-runtime/renderer/unity-animation-core.js` 与 `unity-animation-curves.js`：从 Unity 曲线复刻的额外动画 `10-17`。
- `desktop-runtime/renderer/dynamic-animation-catalog.js`：动画模式、ID、随机解析和点击动画范围的共享规范；iPad 也直接复用该模块。
- `desktop-runtime/renderer/interaction-core.js`：点击动画覆盖、点击范围和坐标转换。
- `desktop-runtime/renderer/water-ripple-renderer.js`：点击背景时的水面涟漪。
- `desktop-runtime/renderer/archive-portal-world.js`：EXE 侧同步的首页到作品档案 Three.js 门户动画。

### 3. 页面与导航现况

应用页面状态由 `src/App.tsx` 管理，主要页面如下：

- `entry`：首页。
- `remoteKeyboard`：远程机械键盘。
- `dynamicGroups`：动态艺术作品档案。
- `dynamicBackground`：新作品首次背景上传。
- `dynamicItems`：素材图片列表/上传兼容流程。
- `dynamicControl`：动态艺术控制页。
- `directSelect`：互动艺术四主题选择。
- `directUpload`：互动艺术拍照、遮罩与上载。
- `directComplete`：互动艺术完成页。

登录状态独立于上述页面：启动时先检查 Supabase session；没有有效 session 时只显示登录页。登出入口位于首页设置菜单内。

动态艺术路由包含两类连续视觉转场：

- 首页进入作品档案：纸雕自然首页解构为科技门户，iPad 与 EXE 使用同一时间基准和源卡片位置。
- 作品档案进入控制页：资料卡破框并展开为舞台；返回时使用逆向衔接，避免整页刷新和白帧。
- 资料夹下钻：背景保持不动，文件夹盖板和内容层完成轻量级层级切换，面包屑随层级出现；根层级不显示面包屑。

互动艺术路由包含：

- 首页到四主题页的同步门户转场。
- 主题卡到上载页的柔和衔接转场。
- 上载页返回主题页的独立逆向转场。
- 点击“上载图片”后，作品缩至中心并向上飞出，彩色星星位于作品下层形成拖尾；之后才进入原有的成功揭晓动画。

所有重动画均提供 `prefers-reduced-motion` 降级路径；iPad Air 上重点限制了 Canvas DPR、粒子数量、滤镜层和重复布局读取。

### 4. 登录、账号与语言

Supabase 配置位于 `src/services/supabaseClient.ts`：

- Project URL：`https://lmlzavksopdunbpckaqh.supabase.co`
- 默认使用仓库内 anon key，也允许通过 `VITE_SUPABASE_URL`、`VITE_SUPABASE_ANON_KEY` 覆盖。
- Auth session key：`magicfloor_supabase_auth_v1`。
- 登录方式：`signInWithPassword(email, password)`。
- session 持久化与 token 自动刷新已开启。
- 登出使用本地 scope，不做额外远程设备管理协议。

设置菜单的账号组合会读取：

- Supabase Auth 当前用户的 `email`、`user_metadata`。
- 远端 `players` 表中当前 `user_id` 最新一条具有头像的记录。
- 显示名称字段：`players.name`。
- 头像字段：`players.avatar_url`，仅接受 `http`/`https` URL。
- 读取头像失败时使用账号名称/邮箱回退，不阻塞应用。

当前并未在本应用内实现“另一台设备登录后主动顶掉旧设备”的服务端单会话机制；若需要强制单设备，必须增加服务端 session/device 记录和 Realtime/轮询撤销策略。

多语言支持：

- 繁体中文 `zh-Hant`（默认与 fallback）。
- 简体中文 `zh-Hans`。
- English `en`。
- Português `pt-PT`。
- Polski `pl-PL`。
- 选择值保存到 `magicfloor_locale_v1`；所有语言方向当前均为 LTR。

### 5. 设置与远程机械键盘

设置菜单当前包括：

- 当前账号、名称、头像和邮箱。
- 艺术画廊/PC IP。
- 动态艺术端口，默认 `8080`。
- 互动艺术端口，默认 `11701`。
- “显示二维码”：向 `11701` 发送纯文本 `QrCode`，fire-and-forget，不显示结果提示。
- 五种界面语言。
- “进阶功能”：控制动态艺术的进阶编辑和播放能力；关闭时只隐藏并停用进阶行为，不删除已经保存的进阶参数。
- 登出。

网络设置保存于 `magicfloor_network_settings_v1`，最后 IP 同时兼容保存于 `artlab_last_ws_ip`。默认 IP 为 `192.168.8.101`。

远程机械键盘页面发送 `MF|RemoteKeyboard|...` 指令，当前按键映射：

- Escape。
- Home。
- LeftControl + LeftShift。
- LeftAlt + F4。
- Space + N。
- Space + F。
- End。
- PageDown。
- LeftControl + LeftAlt + Alpha1 至 Alpha8。
- 旋钮 1：音量减/加。
- 旋钮 2：UpArrow/DownArrow。
- 旋钮 3：LeftArrow/RightArrow。

按键和旋钮有独立的 Web Audio 按压、回弹和刻度音效。iPad 端仍然只发送，不等待对方反馈。

### 6. 动态艺术资料模型与本地持久化

#### 资料夹与作品档案

资料夹由 `src/services/dynamicFolderStorage.ts` 管理：

- 支持根资料夹、任意层级子资料夹、重命名、移动、删除资料夹或连同内容删除。
- 支持图标模式和详细模式。
- 支持按名称、更新时间和类型排序。
- 当前资料夹、视图和排序偏好会持久化。
- 资料夹数据 key：`magicfloor_dynamic_folders_v1`。
- 浏览偏好 key：`magicfloor_dynamic_library_preferences_v1`。

作品档案称为 `DynamicGroup`，主要字段：

- `id`、`name`、`folderId`、`libraryOrder`。
- 缩略图 `thumbnail`。
- 多背景 `backgrounds`、当前背景 `activeBackgroundId`。
- 背景播放方式：`fixed`、`random`、`sequence`。
- 背景切换间隔：`1000-600000ms`。
- 物件出现方式：`all` 或 `sequence`。
- 逐个出现间隔：`100-5000ms`。
- 物件进场动画 `appearAnimation`：`none`（淡入）、`drop`（上方快速掉落）或 `trackSlide`（按轨道从侧边进入）。
- 背景切换动画 `backgroundTransition`：`none`、`curtain`、`cameraFlash` 或 `shadowPlay`。
- 作品音频库 `audioLibrary`；每个背景可用 `bgmAudioId` 指向独立 BGM，也可让多个背景共用同一音频。
- 图层物件数组 `items`，每组最多 30 个。

动态资料元数据保存于 localStorage：`magicfloor_dynamic_groups_v1`。媒体二进制保存策略：

- iOS/Capacitor：写入 `Directory.Data/dynamic-art/...`，元数据保存 `filePath`。
- 浏览器：写入 IndexedDB `magicfloor_dynamic_media` 的 `media` store，元数据保存 `storageKey`。
- localStorage 中不会保存临时 `blob:` URL；启动时会根据 `filePath`/`storageKey` 重新 hydrate。
- 图片会记录真实宽高，舞台按长宽比和统一最大/最小边界计算显示尺寸，已针对极端细长抠图做稳定加载、重试和扩大触控区处理。

**重要限制：当前动态艺术资料仍以设备本地为主，尚未上传到 Supabase Storage，也没有账号级云端恢复。** 更换 iPad 不会自动恢复资料夹、素材、背景和参数。

#### 物件参数

每个 `DynamicItem` 当前持久化：

- 名称、媒体、位置 `x/y`、16x9 网格索引。
- 缩放、旋转、水平翻转、垂直翻转。
- 图层顺序、显示状态。
- 移动方式：停止、上下、左移、右移、360 回环、随机。
- 起始轨道：上、中、下。
- 幅度与速度。
- 动画模式：无、固定、随机。
- 固定动画 ID。
- EXE 点击后允许切换的动画 ID 集合 `clickAnimationIds`。
- 目标移动模式 `targetMode`、可选往返字段 `targetLoop` 与归一化目标坐标 `targetPosition`；旧作品没有 `targetLoop` 时默认只执行一次 `起点 → 目标点`。
- 物件音频 `audioId`、触发方式 `audioTrigger` 和延迟 `audioDelayMs`。
- 背景绑定 `backgroundIds`；空数组代表贯穿所有背景，非空数组代表只在指定背景出现。受控物件会强制继承触发物件的背景范围，其自身背景设置在关系解除前不可修改。

控制页：

- 舞台为 16:9；图层面板收起时舞台居中放大，展开时恢复舞台+面板布局，具有平滑过渡。
- 图层卡片整体可长按拖拽排序，并将层级关系实时反映到舞台。
- 支持全选与批量删除；面板内 `+` 可直接加入物件。
- 单击舞台物件或图层属性按钮打开“物件属性”；面板固定覆盖图层区域，关闭后返回图层。
- 基础模式属性页固定为单行四项：`移动方式 | 动画 | 变形 | 属性复制`，现有尺寸和行为保持不变。
- 进阶模式属性页固定为两行三列：第一行 `移动方式 | 动画 | 变形`，第二行 `物件音源 | 物件背景 | 属性复制`。每个标签文字保持单行，属性面板不加宽；标签区高度固定，属性内容从顶部开始且只有内容区纵向滚动。
- 缩略图可放大查看；名称可单击编辑。
- 属性复制先选择目标，再在确认弹窗勾选移动方式、动画、大小、变形等内容。
- 编辑背景支持新增、删除、拖拽排序、固定/随机/顺序播放和秒/分钟间隔输入+滚轮选择。进阶模式可配置每个背景的 BGM、批量共用 BGM，以及舞台窗帘、相机闪光和皮影戏切换动画。
- 进阶模式的移动方式可从原有循环移动切换为“移动到目标点”：确认起始位置后拖到目标并完成，编辑态物件自动回到起点，只有预览时才移动到目标。目标点模式默认单次到达并停留；只有用户另行开启“循环移动”后才会按 `起点 → 目标点 → 起点` 持续往返。
- 物件音源支持“出现时”“出现后延迟”“到达目标点”三种触发；播放期间自动压低 BGM，结束后平滑恢复。
- 物件绑定所有背景时不会在每次换背景时重复触发出现音源；只有从不可见重新变为可见才算再次出现。
- 预览模式隐藏并锁定编辑 UI，只有“停止预览”可退出；退出后恢复进入预览前的图层/物件属性面板和 tab。
- 逐个/全部出现切换在预览中会从头播放；背景与随机动画也随 `replayId` 重算。

#### 移动轨迹

iPad 与 EXE 共享的视觉语义：

- 上下：以物件原位置和轨道为起点做连续垂直循环；幅度按完整画布比例计算，不在轨道边界处停顿。
- 左移/右移：横向线性穿越，同时叠加连续正弦波；0% 为所在轨道直线，50% 为局部波浪，100% 覆盖画布最高/最低视觉范围。
- 360 回环：围绕物件原放置点做横向椭圆轨迹，并以近大远小表现深度。
- 随机移动：每次预览从上下、左移、右移、360 回环中确定一种；不包含停止。
- 轨道只定义动画起点，不再把动画拆成会产生顿挫的轨道切换段。

### 7. 动画目录与随机规则

当前动画 ID 是 iPad 与 EXE 的公共协议，不得随意重排：

| ID | 动画 | 实现 |
|---:|---|---|
| 0 | 无动画 | 静态 |
| 1 | 呼吸缩放 | 原有 Canvas/DOM 动画 |
| 2 | 摇摆 | 原有 Canvas/DOM 动画 |
| 3 | 闪烁/淡入淡出 | 原有 Canvas/DOM 动画 |
| 4 | 轻微旋转 | 原有 Canvas/DOM 动画 |
| 5 | 弹跳 | 原有 Canvas/DOM 动画 |
| 6 | 波动 | 原有 Canvas/DOM 动画 |
| 7 | 快速翻转/倾斜 | 原有 Canvas/DOM 动画 |
| 8 | 透明度脉冲/组合效果 | 原有 Canvas/DOM 动画 |
| 9 | 行走 | `walk-animation-core.js` |
| 10 | Dance02 | Unity 曲线复刻 |
| 11 | Dance | Unity 曲线复刻 |
| 12 | Jelly Jump | Unity 曲线复刻 |
| 13 | Jump Flip | Unity 曲线复刻 |
| 14 | Pull Right | Unity 曲线复刻 |
| 15 | Raise Hand | Unity 曲线复刻 |
| 16 | Rolling | Unity 曲线复刻 |
| 17 | Unity Wave | Unity 曲线复刻 |

动画属性使用左右切换的轮播预览，并显示页码；“无”和“随机”为固定入口。随机动画不是每帧乱跳，而是用以下 seed 在一次预览中稳定解析：

```text
groupId:itemId:previewReplayId
```

iPad 会把本次的 `resolvedAnimationIds` 随 `PreviewMode` 发给 EXE，确保两边得到同一个动画。属性面板中的随机预览使用独立 session seed，每次重新打开/重播属性预览可得到新的明确动画。

EXE 点击物件时：

- 仅从该物件 `clickAnimationIds` 中循环/选择点击动画。
- 点击动画临时覆盖当前展示动画，并记录覆盖前状态。
- iPad 再次开启预览时，EXE 清除点击覆盖，恢复 iPad 的预览配置。
- 点击背景不切动画，而是绘制水面涟漪。
- 点击物件播放独立点击音效。

### 8. 动态艺术 iPad 与 EXE 同步

动态艺术的实际接收端口默认是 EXE 的 `8080`。iPad 使用 HTTP POST，不依赖 WebSocket，虽然部分变量历史上仍命名为 `wsIp`。

同步分两部分：

#### 作品档案镜像

正确产品流程：

```text
iPad 点击动态艺术
→ iPad 向 11701 发送动态艺术程序启动指令
→ iPad 与 EXE 同步播放首页到作品档案的门户动画
→ EXE 显示 iPad 作品档案页的只读 JPEG 镜像
→ iPad 选择作品进入控制页
→ GroupStateSync / GroupSelectAndSync 才让 EXE 进入真实舞台
```

协议：

- `ArchiveEnter` version 3：包含首页 JPEG、时间基准和动态艺术卡片在 iPad 页面中的真实 bounds。
- `ArchiveSnapshot` version 2：包含当前作品档案页 JPEG；资料夹、面包屑、排序或列表变化后会重发。
- `ArchiveReturn` version 2：控制页返回作品档案时，EXE 直接恢复最近镜像，不重播首页门户。
- 镜像图片只保存在 EXE 内存，不写入 `runtime-state.json`。
- 延迟或重复的旧 `replayId` 会被忽略。
- 舞台状态向 renderer 发布时会剥离大 JPEG，避免 Electron IPC 持续搬运大字符串。

**PC 不拥有、不读取、不生成独立的作品档案 UI。** 它只显示 iPad 截图镜像，因此不能在 PC 上浏览、创建或编辑资料夹/作品档案。

#### 舞台资料同步

- 新设备/IP 在设置页保存后会标记 receiver 需要重新同步。
- 用户重新进入作品时，`dynamicArtReceiverSync.ts` 会按资产签名判断是否需要重发。
- 背景、物件与音频媒体先以 `multipart/form-data` 上传；音频使用 `role: audio`，随后再发送完整参数。
- `GroupSelect` 只记录选中组，不进入舞台。
- 只有 `GroupStateSync` 与 `GroupSelectAndSync` 会切换 EXE 到真实舞台。
- `GroupStateSync` / `GroupSelectAndSync` 同步 `appearAnimation`、`backgroundTransition`、`audioLibrary`、背景 `bgmAudioId`，以及物件的目标点、音频触发和背景绑定字段。
- `PreviewMode` 传递启停、是否开启进阶功能、出现方式/动画/间隔、背景播放方式/切换动画/间隔、`replayId` 和解析后的随机动画 ID。
- 位置、缩放、旋转、翻转、动画、移动、图层、背景等操作均有对应增量事件；完整组同步是最终一致性保障。
- 随机背景顺序由双方使用同一组 ID 与 `replayId` 确定，确保 iPad 与 EXE 在同一轮预览选择相同背景；下一张图片或视频会在切换前预载。

### 9. 互动艺术功能

主题与外部程序映射位于 `src/services/directUploadThemes.ts`：

- 美丽海洋：C 组，多种鱼类，launcher `interactive-ocean`。
- 魔幻森林 1：A 组，多种动物，launcher `interactive-forest-1`。
- 魔幻森林 2：A 组，多种动物，launcher `interactive-forest-2`。
- 画境成真：B 组，缤纷建筑/车辆，launcher `interactive-painting-real`。

当前遮罩：

- A：长颈鹿、孔雀、狐狸、斑马、大象、鹿。
- B：建筑群、建筑立面、长条建筑、L 型建筑、货车、厢型车、轿车、小型车。
- C：旗鱼、小丑鱼、河豚、海马、海龟、鱿鱼、神仙鱼、鲔鱼、鲨鱼。
- UI 显示繁体中文内容名；内部 `A-xx/B-xx/C-xx` ID 保持协议稳定。

上载流程：

- `+` 菜单支持 Photo Library、Take Photo、Choose File。
- 自定义相机接近原生全屏构图；关闭与圆形快门位于安全区内。
- 打开相机时底部遮罩导航默认显示，用户可自行收起/展开。
- 遮罩只是拍照定位辅助，不裁掉原始照片；最终上载前由 Canvas 按用户缩放/位移合成原图与选中遮罩。
- 遮罩铺满取景区域，拍照结果仍保留完整原图能力。
- 点击“上载图片”先播放作品发射动画，再进入既有完成揭晓动画。
- 完成页仅表达图片已发送；“返回”回到互动艺术主题选择页，不回整个 App 首页。
- “重新上载”先弹出毛玻璃确认框；确认后回到保留当前主题语境的遮罩/图片选择流程。
- 本地可确认的图片读取、遮罩读取、Canvas 合成或同步 `xhr.send()` 异常会中断并保留编辑状态。
- 由于协议没有 Unity 回执，完成页只能表示本地已发出，不能证明 Unity 已保存。

互动艺术上载和 launcher 使用 `11701`。iPad 不接收 Unity 回应。

### 10. 11701 指令约定

`src/services/unityBridge.ts` 是 iPad 侧统一发送入口。现有类别：

- 外部程序启动：`MF|AppLauncher|...`，动态艺术一项、互动艺术四项。
- 外部程序关闭：`MF|AppLauncher|Close|dynamic-art` 与 `MF|AppLauncher|Close|interactive-art`；后者是四个互动艺术 EXE 共用的范围，由 Unity 判断实际运行中的程序。
- 动态艺术结构化事件：`MF|DynamicArt|<EventName>|<JSON>`；默认主要发往 8080，但启动命令仍发往 11701。
- 远程键盘：`MF|RemoteKeyboard|...`。
- 显示二维码：纯文本 `QrCode`。
- 快速上载图片：HTTP `multipart/form-data` 到 11701，字段和图片格式保持现有 Unity 接收脚本兼容。

根目录 `ImageFileSaveHttpServer.cs` 是 Unity 接收端参考/集成脚本，包含 11701 的已有接收逻辑和预留 UnityEvent。修改协议前必须同时核对该文件和 Unity 项目实际挂载版本。

### 11. Windows EXE 行为与运行数据

EXE 默认：

- 无边框、全屏/全屏窗口方式运行，目标画布固定 1920x1080，再按实际显示器等比适配。
- 开启 HTTP `0.0.0.0:8080`。
- 支持图片和视频背景；视频在预览状态播放。
- 多背景支持固定、随机和顺序切换。
- 物件按 iPad 图层顺序绘制。
- 支持所有移动、动画、缩放、旋转和翻转参数。
- 进阶预览支持三种物件进场、目标点移动、背景绑定、逐背景 BGM、BGM 交叉淡化、物件音源触发与 BGM 自动压低。
- 支持舞台窗帘、相机闪光和皮影戏背景切换；相机快门音由程序生成，不依赖外部音效文件。
- 相邻背景共用同一 BGM 时不重播；不同 BGM 切换时交叉淡化。背景图片和视频会预载，但不会改变既有切换动画时长或曲线。
- 背景点击显示逼真水涟漪；物件点击按配置切换动画并播放声音。
- 档案模式显示 iPad JPEG 镜像；舞台模式不展示 PC 自有档案。

运行数据位于 Electron `userData` 下的 runtime 目录，包含资产与 `runtime-state.json`。档案镜像不持久化。更换 EXE 或清理 userData 后，iPad 可通过“设置保存后重新进入作品”的流程重发媒体和参数。

特殊翻转版：

- 入口 `main.vertical-flip.js` 设置翻转环境变量。
- 当前特殊包是**整体显示水平+垂直翻转（等效 180 度）**的展示版本，并对 pointer 坐标做对应修正，保证现场鼠标左/右、上/下与翻转后的视觉位置一致。
- 标准版与特殊翻转版不要同时启动，否则会争用 8080。

调试窗口模式：

```powershell
$env:ELECTRON_RUN_AS_NODE = $null
$env:MAGICFLOOR_WINDOWED = '1'
npm start
```

某些终端环境存在 `ELECTRON_RUN_AS_NODE=1`，若不清除，Electron 会按 Node 运行而不是打开窗口。

### 12. 构建、同步与打包

根项目：

```powershell
cd D:\ArtLabWeb
npm install
npm run dev -- --host 0.0.0.0 --port 5175
npm run build
npm run sync:ios
```

说明：

- `npm run build` 执行 `tsc && vite build`，输出 `dist/`。
- `npm run sync:ios` 会再次 build、执行 `npx cap sync ios`，然后运行 `scripts/fix-ios-spm-paths.cjs`。
- iOS 工程：`ios/App/App.xcodeproj` / 对应 Xcode workspace（以当前 Capacitor 生成结果为准）。
- iOS 状态栏已配置为全屏隐藏；安全区 CSS 仍必须保留，避免实体 iPad 顶部系统区域遮挡控件。
- Windows 本机不能完成 Xcode archive/sign；最终 iOS 安装包需在 macOS/Xcode 使用正确 Team、Bundle ID 和签名配置构建。

EXE：

```powershell
cd D:\ArtLabWeb\desktop-runtime
npm install
npm run pack:portable
npm run pack:vertical-flip
```

也可使用 `npx electron-builder --win portable --config.directories.output=<新目录>` 为标准版输出到独立目录。每次修复后必须使用新目录，避免把旧 EXE 误认为新构建。

### 13. 2026-08-13 当前 EXE 交付基线

以下两个包已包含档案镜像同步、档案面包屑截图修复、额外动画循环修复，以及本节所述全部动态艺术进阶功能。后续现场交付只使用这两个目录中的文件：

```text
D:\ArtLabWeb\desktop-runtime\release-advanced-final-20260813\
  MagicFloor Dynamic Player 0.1.0.exe

D:\ArtLabWeb\desktop-runtime\release-advanced-vertical-final-20260813\
  MagicFloor Dynamic Player Vertical Flip 0.1.0.exe
```

文件大小与 SHA-256（已在最终路径重新核对）：

```text
标准版：85,297,870 bytes
SHA-256：06887217F0C9F51DFC5F7B9CBFCB90E09601D7429B04DF9E37C5DD717C9205F7

整体翻转版：85,284,311 bytes
SHA-256：20DD272F34A6505966F121F472E957B60DACF8E89743FB63101001DA66F70C8F
```

2026-08-13 已再次清理旧构建和失败临时输出；当前 `desktop-runtime/` 下所有 `release-*` 目录中只保留上述标准版与整体翻转版两份最终交付。`renderer/`、`scripts/`、`node_modules/` 和 EXE 源码均未删除。

### 14. 验收清单

每次触及动态艺术或 EXE 后至少验证：

1. `npm run build` 成功。
2. `npm run sync:ios` 成功，`dist` 已同步到 iOS public。
3. `node --check desktop-runtime/main.js`、`player.js` 及被修改的 renderer 模块通过。
4. iPad 点击动态艺术时，iPad/EXE 同步播放门户，EXE 最终显示 iPad 档案镜像。
5. 进入子资料夹后 EXE 镜像与 iPad 面包屑一致。
6. 单独 `GroupSelect` 不进入舞台；`GroupStateSync`/`GroupSelectAndSync` 才进入舞台。
7. 图片、极端细长抠图、视频背景均能载入。
8. 预览中的出现方式、背景切换、移动和动画在 iPad/EXE 一致。
9. 随机动画在同一 `replayId` 下两端一致，重复预览会重新抽取。
10. EXE 点击物件动画范围和背景涟漪不受预览逻辑影响。
11. 标准版与整体翻转版分别启动；翻转版画面和鼠标命中方向均正确。
12. 测试完成后关闭已知测试进程并确认 8080 已释放。
13. 基础模式仍为四个属性标签且旧作品播放不变；进阶模式为两行三列且面板不加宽。
14. 逐个/全部进场、目标点和到达音频在 iPad/EXE 同步；离开背景后延迟音频会被取消。
15. 多背景 BGM 共用、交叉淡化和物件音频压低 BGM 正常；共用同一 BGM 时不重启。
16. 窗帘、相机闪光和皮影戏分别验证图片/视频背景，并在 20-30 个物件时观察性能。

### 15. 已知限制与维护约束

- 动态艺术资料尚未做 Supabase Storage 云端备份/账号漫游。
- “账号只允许一台设备”尚无服务端强制机制。
- 互动艺术发送没有 Unity 回执，成功页不代表远端已落盘。
- EXE 档案页依赖 iPad JPEG 镜像，不能脱离 iPad自行浏览作品档案。
- 大 JPEG 通过 8080 发送，接收端必须保持足够的 body 大小与内存余量。
- `src/index.css` 很大且包含多轮后置覆盖；改样式前必须搜索同名 selector，最终规则通常位于文件后部。
- 动画 ID、事件名和 payload 字段是跨 iPad/EXE 的协议，修改时必须双端一起调整。
- `transition-portal-preview/` 是测试页，不应被误当成生产入口。
- 根目录中的 `ThreeJSPhotoAnimation/` 是 Unity 动画复刻依据，不能在没有对照验证时删除。
- 进阶功能关闭时必须保留已经保存的进阶字段，只停用进阶 UI 与播放行为；重新开启后应恢复原设置。
- 基础模式的四项属性布局、既有移动轨迹和图片动画属于回归保护范围，不得因进阶功能继续调整而改写。
- 工作区可能存在用户未提交改动；不得回退或覆盖与当前任务无关的修改。
- **只有用户明确要求时才执行 Git 命令（包括 status、diff、commit、push、tag、checkout 等）。**

### 16. 2026-08-13 档案镜像与随机动画修复（已解决）

#### EXE 档案面包屑毛玻璃块

- 问题只存在于发送给 EXE 的档案页 JPEG 镜像中，不是 EXE 自己生成了面包屑或资料浏览 UI。
- 根因是 `html-to-image` 截取 iPad 档案页面时，WebKit 会把面包屑的 `backdrop-filter` 错误栅格化成横跨下方区域的大矩形。
- `captureDynamicArchiveSnapshot()` 现在只在截图期间为档案根节点挂载 `dynamic-archive-snapshot-capture`，并在 `finally` 中可靠移除。
- 截图期间仅关闭面包屑的 `backdrop-filter/-webkit-backdrop-filter`，改用视觉接近的实色透明背景；iPad 实际页面仍保留原有毛玻璃效果，其他页面和过场动画不受影响。

#### 首次随机动画只播放一轮

- 根因是随机模式可能抽中 `12-17` 的 Unity 额外动画，而这些曲线的原始定义是 non-loop。物件属性内的小预览原本会强制循环，但 iPad 舞台与 EXE 舞台在第一次预览没有统一处理，所以会停在末帧；后续预览若抽中天然循环动画，就会看起来恢复正常。
- iPad 的实际预览舞台现在为 `UnityAnimationCanvas` 启用 `forceLoop`，只在进入预览模式时生效。
- EXE 在 `PreviewMode.enabled` 时根据 Unity 额外动画的真实时长循环折返 elapsed time，使 `10-17` 在预览期间连续播放。
- EXE 的鼠标点击动画仍优先走原有 one-shot override；点击物件时按勾选范围播放一次的行为没有被改成循环。
- 同一轮预览仍使用 iPad 发出的 resolved animation ID；随机结果、`replayId` 重播和双端同步协议均未改变。

#### 本轮验证

- `npm run build`：通过，1752 个模块完成转换；仅保留既有的大 chunk 提示。
- `npm run sync:ios`：通过；Capacitor iOS 同步与 `fix-ios-spm-paths` 均成功。
- Web 构建与 `ios/App/App/public` 文件核对：`58` 个文件，`MissingInIos: 0`，`HashMismatch: 0`。
- EXE 语法检查：`main.js`、`renderer/player.js`、`unity-animation-core.js`、`dynamic-animation-catalog.js`、`interaction-core.js` 全部通过。
- 标准版与整体翻转版均成功打包，并以窗口模式启动做烟雾测试；两者 `/status` 均返回 `server.status = listening`、`server.port = 8080`、`view.mode = archive`。
- 测试进程已按实际 EXE 路径关闭，端口 `8080` 已确认释放；没有发送会修改用户作品资料的协议事件。
- 当前开发预览服务仍位于 `http://localhost:5175/`。
- 自动化环境无法代替实体 iPad 与 EXE 双屏截图，因此面包屑镜像最终视觉，以及“随机抽中 12-17 后长时间连续播放”仍应在实机做最后一次人工验收。

更新时间：2026-08-13
当前状态：登录、首页、五语设置、远程键盘、动态艺术档案与控制工作台、互动艺术拍照遮罩与上载、11701 单向 Unity 指令、8080 iPad/EXE 同步、档案镜像、标准与整体翻转 Windows 播放端均已形成可构建交付。动态艺术本地资料可以持久保存并在更换接收端后重发，但 Supabase Storage 云端备份、账号资料漫游和服务端单设备登录互斥仍未实现。大改前历史基线与逐轮修改记录保留在下方，供协议追溯和回归排查。

### 17. 2026-08-13 iPad 首页与控制页细节修正

- 首页键盘入口与设置入口共用 `entry-home-icon-button` 的 52×52 容器、8px 圆角、图标尺寸、双描边、高光与阴影。最终版本采用约 28% 不透明度的半透明蓝色玻璃基底，并降低表层渐变、内阴影和外发光强度；两处材质参数一致，同时允许蓝天或草地轻微透入，避免厚重磨砂感。入口位置和功能不变。
- 出现方式选择“全部出现”时，间隔滑杆继续保留原数值供切回“逐个出现”恢复，但整段控件会灰化、去饱和并禁止触控，同时提供 `aria-disabled` 语义。
- 物件属性关闭按钮由字体字符改为 Lucide `X`，图层收起按钮由字体字符改为 Lucide `ChevronRight`；按钮使用固定方形网格居中，避免繁中字体基线造成视觉偏移。
- 最终透明度调整后再次执行 `npm run sync:ios` 并通过；其中包含 TypeScript/Vite 生产构建、Capacitor iOS 资源复制与 `fix-ios-spm-paths`。构建完成 1752 个模块，仅保留既有的大 chunk 警告；前一轮核对中 `dist` 的 58 个文件在 `ios/App/App/public` 内为 `MissingInIos: 0`、`HashMismatch: 0`。

## 近期修改记录

### 2026-08-03 互動藝術快速上載兩級返回

- 快速上載遮罩編輯頁的左上角「返回」現在只會清除尚未送出的圖片、遮罩位置、縮放與手勢狀態，並回到同一主題下的初始 `+` 圖片選擇頁。
- 初始 `+` 圖片選擇頁再次點擊「返回」時，才沿用既有反向共享元素轉場回到四個互動藝術主題選擇頁；目前選中的主題不變，內部返回不會重送 11701 指令。
- 內部返回加入獨立、可移除的短淡出與 `+` 卡片聚焦入場；頂部導覽列保持穩定，`prefers-reduced-motion` 下取消位移與縮放。
- 若相機仍在使用，返回時會停止媒體軌、手電筒與拍照狀態；檔案輸入亦會清空，因此可立即重新選擇同一張圖片。原作品控制上載、遮罩合成、發送與完成頁流程不變。

### 2026-08-03 互動藝術返回選擇頁轉場

- `選擇快速上載圖片` 返回主題選擇頁時，新增獨立的反向共享元素轉場：中央 `+` 會展開為目前選中的主題卡片，並在換頁後精準落回原卡片位置，其餘卡片與導覽列再依序進場。
- 返回轉場使用獨立元件、獨立路由狀態與獨立 CSS 區塊，可直接整體移除；沒有修改正向轉場、11701 啟動指令、相機、遮罩、圖片合成、上載及完成頁流程。亦提供 `prefers-reduced-motion` 簡化淡入淡出版本。
- 修正返回完成時偶發的一幀全畫面閃動：目標卡片與導覽列的 GSAP 可見狀態會保留到 React 移除轉場路由類之後，再由元件卸載清理統一釋放，避免 CSS 隱藏規則在兩者交接期間短暫重新生效。
- 同步修正主題選擇頁進入快速上載頁時的正向閃幀：移動中的主題標題會先完整抵達左上角，再與真實頁面標題短暫交叉淡化；眉題隨後出現。返回按鈕、標題與上載區的 GSAP 樣式延後至路由狀態移除後清理，過場遮罩亦改用上載頁最終漸變背景，避免完成瞬間全畫面重繪。

### 2026-08-03 首页设置按钮液态玻璃统一

- 首页右上角设置齿轮的方形容器已改用与 `動態藝術`、`互動藝術` 入口卡片一致的蓝紫液态玻璃材质，包括透明渐变、斜向折射高光、内层描边、柔和外发光和背景模糊。
- 小型按钮继续维持原有 `52px` 点击范围与 `8px` 圆角；齿轮改为白色高对比显示，并保留聚焦、悬停和按压反馈。设置抽屉、账号、语言、二维码、登出及入口转场逻辑均未修改。

### 2026-08-03 控制页标题、随机移动与上载入口细节

- 控制页作品标题整体上移 `3px`，解决短标题（例如 `gggg`）底部被顶栏边缘遮住的问题；图层卡片与物件属性按钮没有改动。
- 物件的 `随机` 移动改为在每次开始或重播预览时，从 `上下`、`左移`、`右移`、`360 回环` 中选择一种；同一轮预览保持不变，绝不会选到 `停止`。
- 随机结果只存在于预览播放层，不改写 IndexedDB 中保存的 `moveMode: random`，也不发送额外 `ItemMotion`。iPad 与 `desktop-runtime` 统一按 `groupId + itemId + replayId` 解析，确保同一轮使用相同移动方式。
- 图片上载区中央圆形 `+` 由文字字符改为 Lucide 图标，并使用几何居中布局，修复不同字体和 WebView 下视觉偏心的问题；点击与上载流程保持不变。

### 2026-08-03 遮罩英文语义命名

- 互动艺术 `public/Mask` 的 23 张正式遮罩已统一改为小写英文语义与两位序号文件名，例如 `mask-animal-giraffe-01.png`、`mask-building-complex-01.png`、`mask-marine-marlin-01.png`；遮罩选择页仅显示 `長頸鹿`、`建築群`、`旗魚` 等繁体中文内容名称，不向使用者显示数字序号。
- 原控制上传页 `public/MaskTexture` 的 5 张遮罩文件同样使用英文语义文件名，界面显示为 `恐龍`、`小熊`、`魚`、`全身人形`、`人像`；旧快速上传目录的 3 张未引用资源使用 `-legacy` 或 `full-frame` 文件名明确标识。
- 所有 A/B/C 及数字内部 `id`、排列顺序、默认遮罩、主题分组与上传合成逻辑保持不变；B 组车辆素材和 A-01 长颈鹿素材仅重命名，没有旋转、裁切或重新编码。
- 正式 31 张遮罩在重命名前后逐一执行 SHA-256 比对，结果 `Mismatch = 0`；测试页遮罩副本与引用路径同步更新，历史记录中的旧文件名保留作为版本说明。

### 2026-07-31 三十五版：互動藝術緊湊目錄正式套用

- 已將測試頁確認的互動藝術緊湊選擇卡正式套用到 `DirectUploadSelectPage`：四張卡片使用 `184px - 224px` 響應式寬度、固定比例與居中單列佈局，iPad Air 橫屏不再被卡片撐滿。
- 卡片底部資訊區固定為 `58px`，主題名稱與遮罩分類改為上下排列；分類使用輕量文字顯示，完整卡片仍保留原有點擊、選中與焦點範圍。
- 正式版繼續使用 `InteractiveMagicTransition` 的四卡中心發牌動畫：卡片終點根據實際 DOM 尺寸動態計算，沿用 `0.46s`、`0.06s` stagger 與 `power4.out`，並保留標題及分類文字的分段入場。
- 保留現有 iPad 優化後的 Canvas 撕紙、裂縫與分散光線效果；沒有重新加入中央圓球、光圈或最後一幀閃光核心。
- 本輪只調整互動藝術選擇頁的視覺尺寸與動畫落點，不修改主題順序、A/B/C 遮罩映射、相機、11701 指令、上載合成及完成頁流程。
- `npx tsc --noEmit`、Vite 生產構建與 `npm run sync:ios` 均已通過；Edge 以 `1024×768` 及 `1180×820 / DPR 2` 驗證四卡單行置中、文字完整且頁面無溢位。`dist` 共 58 個文件，與 `ios/App/App/public` 比對為 `Missing = 0`、`SHA-256 Mismatch = 0`。

### 2026-07-31 互動藝術緊湊目錄尺寸測試（三十四版，僅測試頁）

- `transition-portal-preview` 新增互動藝術選擇項尺寸比較器，可在 `目前尺寸` 與 `緊湊目錄` 間即時切換；緊湊版使用約 `184–224px` 寬的近方形卡片，四張保持單行置中，比例與密度參考使用者提供的目錄畫面。
- 測試場景同步使用首頁紙雕背景、四個真實主題與 `多種魚類／多種動物／繽紛建築` 分類文字；選擇尺寸後可重播既有魔幻轉場，直接比較四卡發牌到不同最終尺寸的落位效果。
- 本項目前只修改獨立測試工程，正式 `src`、互動藝術業務流程、遮罩、相機、11701、iOS 工程與上載功能均未修改；待視覺確認後再決定是否接入正式頁面。
- 獨立測試工程生產構建已通過；Edge 以 `1180×820 / DPR 2` 驗證緊湊卡片約為 `212×233px`，以 `1024×768 / DPR 2` 驗證約為 `184×203px`，四張均單行置中，標題與分類文字完整，頁面無溢位或執行期錯誤。

### 2026-07-31 互動藝術遮罩分類名稱（三十三版）

- 互動藝術主題選擇頁的遮罩標籤由內部編號改為使用者可理解的內容分類：A 組顯示 `多種動物`、B 組顯示 `繽紛建築`、C 組顯示 `多種魚類`。
- 只修改四張主題入口卡片下方的顯示文字；A／B／C 內部對應、遮罩檔名、遮罩選擇頁、相機、圖片合成、11701 指令與上載流程均未修改。
- `npx tsc --noEmit`、Vite 生產構建與 `npm run sync:ios` 已通過，新名稱已同步至 iOS 工程。

### 2026-07-31 互動藝術選擇頁首頁背景統一（三十二版）

- 互動藝術四個主題入口頁已由舊版淺色漸層改為首頁同一張紙雕自然背景，使用一致的底色、置中靠下定位與滿版裁切方式，iPad 橫屏下可維持首頁到主題選擇頁的視覺連續性。
- 只修改互動藝術選擇頁的靜態背景；入口轉場、四張主題卡片、主題排序、遮罩、相機、11701 指令、圖片合成、上載與完成頁流程均保持不變。
- `npx tsc --noEmit`、Vite 生產構建與 `npm run sync:ios` 已通過，首頁背景資源已同步至 iOS 工程。

### 2026-07-30 互動藝術末幀光軌核心移除（三十一版）

- 修復互動藝術入口轉場在四張主題卡片已接近落位時，畫面中央仍短暫殘留白色「閃光核心」的問題；該亮點不是已刪除的圓形門戶，而是 14 條 Canvas 光軌共用同一個中心起點疊加而成。
- 14 條光軌現在沿不規則垂直裂縫的不同高度取樣，左右交錯向外發射，並依起點高度連續計算出射角度；保留魔幻能量向外擴散的方向感，但不再形成共同圓心、光球或封閉光圈。
- 裂縫改為約 `180ms–620ms`，光軌改為約 `220ms–600ms`，火花改為約 `220ms–680ms`；特效 Canvas 於約 `520ms–680ms` 統一淡出，紙幕 Canvas 亦在目標卡片落穩前退場，避免任何過場效果覆蓋最終選擇頁。
- 目標頁的暗色過渡底層同步提前淡出；四張主題卡片、標題與遮罩標籤完成後仍等待兩個穩定繪製幀才卸載轉場，避免 iPad WKWebView 快取最後一幀。主題排序、遮罩、相機、11701、圖片合成、上載及完成頁流程均未修改。
- `npx tsc --noEmit`、Vite 生產構建與 `npm run sync:ios` 已通過；`dist` 共 58 個文件，在 `ios/App/App/public` 中 `Missing = 0`、`SHA-256 Mismatch = 0`，額外兩個文件仍為 Capacitor 正常生成的 `cordova.js` / `cordova_plugins.js`。靜態核對亦確認正式源碼與生產包內舊共用起點、圓形門戶、圓環及光核引用均為 0。

### 2026-07-30 互動藝術中央光圈完全移除（三十版）

- 在二十九版取消「圓球飛向中央」後，進一步完全刪除互動藝術入口轉場的中央圓形門戶；正式 DOM 不再建立 `.interactive-magic-portal`、三層 `.interactive-magic-ring` 或 `.interactive-magic-core`，相關尺寸、縮放、旋轉、淡出補間及 CSS 關鍵幀也已移除。
- 中央視覺焦點改為 Canvas 內的非封閉魔幻裂縫：裂縫由 9 個不規則折點組成，從屏幕中央向上下伸展，使用紫色外光、青色主光與白色細芯三層直線描邊，另帶四條短分支；全程不形成圓球、圓環、圓形波紋或封閉輪廓。
- 新時間軸保持卡片原地發光與淡出，約 `200ms` 開始生成裂縫，隨後銜接既有紙幕撕裂、粒子／放射光軌與四卡發牌；裂縫在主題卡片展開期間自行淡出，最終頁面和原有節奏保持一致。
- 移除中央門戶後，轉場覆蓋層不再需要 3D `perspective` 或大型門戶合成面，iPad Air 的 GPU 壓力在二十八版 Canvas 優化基礎上進一步下降；`prefers-reduced-motion` 仍直接隱藏兩個 Canvas，只使用交叉淡入。
- 主題排序、遮罩、相機、11701 啟動指令、圖片合成、上載與完成頁流程均未修改；`npx tsc --noEmit` 與 `npm run sync:ios` 已通過，Vite 生產構建、Capacitor iOS 複製及 SPM 路徑修正完成，僅保留既有主包大小提示。

### 2026-07-30 互動藝術中央門戶入場調整（二十九版）

- 移除首頁點擊 `互動藝術` 後圓形門戶從卡片位置飛向屏幕中央的軌跡；互動卡片現在留在原位完成一次 `scale(1.06)` 發光激活，再於紙幕撕裂前原地淡出，不再執行任何 `x / y` 位移。
- 門戶從建立開始便固定在視口中央，以約 `64px - 96px` 的空心光圈直接旋轉放大；時間軸只改 `scale / rotate / opacity`，延續二十八版的 iPad 合成層優化，不重新引入位置或尺寸補間。
- 中央青白實心光核縮小為短暫閃光：在門戶打開時快速出現，約 `160ms` 內放大淡出，之後只保留藍紫色圓環、紙幕、粒子與光軌，避免形成圓球停留或飛行的觀感。
- 紙幕撕裂、粒子爆發、四卡發牌、最終淺色主題頁、主題排序、遮罩、11701 啟動指令和圖片上載流程均保持不變。
- 靜態審計確認 `PortalTravelTween = 0`、`SourceCardTravelTween = 0`；`npx tsc --noEmit` 與 `npm run sync:ios` 已通過，Vite 生產構建、Capacitor iOS 複製及 SPM 路徑修正完成，僅保留既有主包大小提示。

### 2026-07-30 互動藝術 iPad Air 轉場效能優化（二十八版）

- 針對 iPad Air Retina 橫屏播放首頁 `互動藝術` 魔幻轉場時的掉幀問題完成渲染層優化；轉場故事、約 1.3 秒節奏、紙幕撕裂、藍紫門戶、粒子／光軌、四卡發牌與最終主題頁內容保持不變，沒有改動主題順序、遮罩、11701 指令或上載流程。
- 新增互動轉場資源預載器；首頁穩定顯示後會提前載入並 `decode()` 紙雕背景與四張主題封面，切頁熱路徑不再同時承擔圖片解碼、React 掛載與 GSAP 動畫。預載結果會在模組內復用，重複返回首頁不會重複建立同一批請求。
- 原有 8 個全屏紙雕碎片、42 個發光粒子與 14 條光軌共 64 個獨立 DOM 動畫層，已收斂為「紙幕 Canvas + 光效 Canvas」兩個合成表面；仍按原多邊形、方向、顏色與時間軸繪製，粗指標 iPad 橫屏的內部 DPR 上限為 `1.5`，桌面上限為 `2`，CSS 顯示尺寸保持全屏。
- 魔幻門戶預先固定為最終直徑，動畫只改 `translate3d / scale / rotate / opacity`；不再逐幀修改 `left / top / width / height`。首頁退場也移除全屏動態 `blur / saturate / brightness`，改由既有暗幕、位移與透明度完成視覺聚焦；門戶超大模糊陰影改為漸層發光，持續旋轉線環仍保留。
- `interactive-magic-route-active` 期間暫停森林浮光、海洋波紋與畫境掠光，等門戶卸載後自動恢復，避免目標頁循環特效與四卡入場同時競爭主線程；`prefers-reduced-motion` 的既有簡化路徑保持不變。
- 隔離 Edge 已使用 `1180×820 / DPR 2 / 5 點觸控` 的 iPad Air 等效視口驗證完整路徑，畫面無白屏、遮擋、圖片缺失或執行期錯誤；不截圖的純動畫採樣為 91 幀、平均幀間隔約 `13.75ms`、最大 `53.7ms`、超過 `33ms` 的長幀 1 個。臨時測試入口、截圖、Edge profile 與測試服務均已移除。
- `npx tsc --noEmit`、Vite 生產構建及 `npm run sync:ios` 已通過；Capacitor iOS 資源複製與 SPM 路徑修正完成。倉庫仍沒有 ESLint 配置文件，因此既有 `lint` 腳本無法啟動，本輪未新增或修改 lint 配置。

### 2026-07-30 設定二維碼指令與相機遮罩預展開（二十七版）

- 首頁設定抽屜在 `互動藝術端口` 下方新增 `顯示二維碼` 按鈕，使用 Lucide `QrCode` 圖標、青綠色毛玻璃底色、`52px` iPad 觸控高度及明確按壓回饋；按鈕不會關閉設定抽屜，也不會顯示成功提示、等待狀態或接收結果。
- 每次點擊只會以現有 fire-and-forget `XMLHttpRequest` 發送一次純文字 `QrCode`，`Content-Type` 為 `text/plain`；目標使用設定抽屜目前輸入的 `藝術畫廊 IP` 與 `互動藝術端口`（預設 `11701`），因此修改地址後不必先保存也能直接發送。
- `unityBridge.ts` 新增 `sendQrCodeCommand(ip, port)`，集中保存 `QrCode` 協議字串；沒有加入回執、重試、輪詢、WebSocket 或 PC / Unity 狀態判斷，既有四個互動藝術啟動指令和圖片上載格式不變。
- 互動藝術上載頁選擇 `拍照` 後，只要目前主題存在遮罩，相機遮罩導航欄便會在每次進入相機時默認展開；使用者仍可使用現有點擊或下滑手勢自行收起，關閉相機時狀態照常重置。
- 相機預展開只作用於 `direct` 互動藝術模式，不影響動態藝術、相簿、選擇檔案、相機原圖捕獲、遮罩定位、最終 Canvas 合成、11701 上載或完成頁流程；現有 `下滑收起` 文字保持不變，沒有新增操作提示。
- `npx tsc --noEmit` 與 `npm run sync:ios` 已通過；Vite 生產構建、Capacitor iOS 複製及 SPM 路徑修正均完成，僅保留既有 Three.js 主包大於 500KB 的提示。

### 2026-07-30 作品檔案立體資料夾下鑽（二十六版）

- 正式版 `動態藝術 → 作品檔案` 已把獨立測試頁方案 B 的立體資料夾素材與下鑽節奏完整接入；正式應用沒有在執行時引用 `transition-portal-preview`，現有資料夾 ID、作品檔案資料、排序、快取與 PC 協議均未修改。
- 圖示模式與詳細模式不再使用單層 Lucide 資料夾圖標，改為可獨立控制的 `tab / body / lid` 三層紙雕資料夾；前蓋可沿左上邊緣做 3D 開蓋，並保留測試頁的暖黃色材質、陰影、柔和環境光和低頻掃光。圖示卡片尺寸、五欄網格、詳細模式行高與欄位寬度保持原值。
- 資料夾切換改為雙層內容舞台：目前層在 DOM 中完成按壓、開蓋和退出，目標層會提前渲染但不可操作；新路徑與內容在同一條 GSAP 時間軸中接續出現，動畫結束後才提交 `currentFolderId`，不再因 React 先換頁而產生空白幀或節奏斷層。
- 正向時間軸對齊測試頁 storybook 參數：卡片 `scale(0.96)`、前蓋 `rotationY(-15deg) / rotationX(-34deg)`、其他卡片向右淡出、目標內容由 `scale(0.8) + translateY(24px)` 使用 `back.out(1.35)` 級聯就位；返回上層則反向收走目前內容，讓上層卡片由 `scale(0.96) + translateY(12px)` 平順恢復。
- 路徑導航改為測試頁同款獨立毛玻璃浮層：根目錄完全不渲染導航容器，進入子資料夾時從上方 `12px` 淡入；多層路徑仍可點擊任一上級返回，導航不再透過整頁重排突然出現。空資料夾狀態也會沿用同一入場與返回節奏。
- 動畫期間會鎖定返回、檢視切換、排序、新建、長按和更多操作，避免重複觸發；元件卸載會取消待執行的 animation frame 並終止 GSAP timeline。`prefers-reduced-motion` 下取消開蓋、位移和彈性級聯，只保留約 `120ms` 的交叉淡入。
- 隔離正式元件已在 `1194×834` 與 `1024×768` 驗證圖示模式、詳細模式、子資料夾內容、浮動路徑與長按毛玻璃選單；卡片切換前後寬高一致，根目錄導航保持隱藏，子層導航不遮擋內容，頁面無水平溢位。臨時驗證入口、測試資料與 Edge profile 已全部移除。
- `npm run sync:ios` 已通過；Vite 生產構建、Capacitor iOS 複製與 SPM 路徑修正均完成，構建只保留既有 Three.js 主包大於 500KB 的提示。

### 2026-07-30 首頁雙入口轉場閃屏修復（二十五版）

- 修復首頁進入 `動態藝術` 與 `互動藝術` 時，門戶動畫完成後目標頁面短暫變白、變淡或再次位移的共用閃屏問題；問題不在 WebGL 或主題圖片本身，而是門戶狀態清除後，原本被 `animation: none !important` 暫停的 `.page-forward` 與 `.apple-container` 入場動畫會重新啟動，令已顯示的頁面再次從 `opacity: 0` 播放。
- `TransitionDirection` 新增專用 `portal` 狀態；兩個首頁門戶在切換真實頁面時改用 `page-portal`，該狀態持續停用一般頁面與容器淡入，並固定 `opacity: 1`、`transform: none`。使用者下一次正常前進、返回或資料夾操作仍會由既有 `navigateTo()` 改回 `forward` / `backward`，其他過場不受影響。
- `DynamicPortalTransition` 的正常與 reduced-motion 時間軸都改為在動畫結束後等待兩個 `requestAnimationFrame`，確認作品檔案已提交穩定畫面後才卸載 WebGL、代碼流與門戶覆蓋層；清理時同步取消尚未執行的穩定幀回呼。
- `InteractiveMagicTransition` 在四張封面解碼、卡片發牌、標題與遮罩標籤完成入場後，同樣等待兩個穩定繪製幀再清除門戶狀態；既有圖片 decode、360ms 最長等待及 GSAP 暫時樣式清理規則均保留。
- 本輪只修改首頁兩套門戶的最後交接，不改紙雕／淺色背景、動畫主體、四卡順序、作品檔案、控制頁、8080、11701、遮罩、圖片上載、快取或 PC 同步。
- 隔離 Edge 已在 `1194×834` 與 `1024×768` 驗證動態／互動四條正常路徑，並補測兩條 reduced-motion 路徑；每條路徑在門戶覆蓋層消失後連續採樣 40 幀，`page-frame` 與目標 `.apple-container` 全程保持 `animation-name: none`、`opacity: 1`、`transform: none`，沒有二次入場。四張最終穩定畫面均完整且無水平溢位。
- `npm run build` 與 `npm run sync:ios` 已通過；`dist` 共 58 個文件，在 `ios/App/App/public` 中 `Missing = 0`、`SHA-256 Mismatch = 0`，iOS 額外兩個文件仍為 Capacitor 正常生成的 `cordova.js` / `cordova_plugins.js`。構建只保留既有 Three.js 主包大於 500KB 的提示。

### 2026-07-30 背景目標修正與雙入口視覺恢復（二十四版）

- 二十三版曾把「背景用回之前的顏色」誤解為 `動態藝術` 的 `作品檔案`，因此錯誤將 `.dynamic-library-screen` 改為 `#eef2f3` 純色，而真正需要調整的 `互動藝術` 四項快速上載選擇頁仍保留深色背景；本版已更正目標，二十三版的背景結論不再代表目前狀態。
- `動態藝術` 作品檔案重新恢復指定的首頁紙雕背景：使用 `magic-floor-background.webp`、`center bottom` 與 `cover`；首頁、作品檔案和動態藝術入口轉場再次維持同一自然紙雕視覺來源。
- `互動藝術` 四項選擇頁的最終背景改回舊版淺色環境：使用原有青色淡漸層與 `var(--surface)`，並關閉最終頁的深色科技線、黑色暗角及裂隙環境層。魔幻紙幕撕裂與傳送門只在頁面轉場期間播放，完成後自然落到淺色選擇頁。
- 四張主題卡片的目前尺寸、發牌入場、排列順序、海洋水波、森林浮光、畫境掠光、遮罩分組與 11701 啟動指令均保持不變；首頁互動藝術卡片的內容對齊修復也繼續保留。
- 隔離 Edge 已以 `1194×834` 與 `1024×768` 驗證兩條真實入口：互動藝術最終頁的深色偽元素及環境層計算為 `display: none`，四張卡片完整顯示；動態作品檔案的計算背景包含 `magic-floor-background`、位置為 `50% 100%`、尺寸為 `cover`，兩種尺寸均無水平溢位。
- `npm run build` 與 `npm run sync:ios` 已通過；`dist` 共 58 個文件，在 `ios/App/App/public` 中 `Missing = 0`、`SHA-256 Mismatch = 0`，iOS 額外兩個文件為 Capacitor 正常生成的 `cordova.js` / `cordova_plugins.js`。構建只保留既有 Three.js 主包大於 500KB 的提示。

### 2026-07-30 首頁卡片對齊與作品檔案舊背景恢復（二十三版）

- 修復首頁 `互動藝術` 卡片內圖示與標題整體上移的問題；根因是新加入的 `.interactive-magic-card-aura` 被首頁通用子元素規則覆蓋為相對定位，因而誤入卡片 Grid 成為第三個排版項目。
- 首頁通用規則現在明確排除互動藝術發光層，發光層繼續使用絕對定位覆蓋卡片邊緣；`動態藝術` 與 `互動藝術` 都只保留「圖示 + 標題」兩列內容，沒有使用固定像素位移，因此不同 iPad 橫屏尺寸會維持同一基線。
- `作品檔案` 頁已移除紙雕背景圖片覆蓋，恢復舊版純色 `#eef2f3` 淺灰藍工作台背景；首頁紙雕背景、動態藝術數碼門戶、資料夾下鑽、素材破框、控制頁和互動藝術魔幻主題頁均保持不變。
- 隔離 Edge 已以 `1194×834` 與 `1024×768` 驗證：兩張首頁卡片的圖示與標題頂部坐標誤差不超過 `0.5px`，互動發光層計算定位為 `absolute`；作品檔案計算背景色為 `rgb(238, 242, 243)` 且 `background-image: none`，兩種尺寸均無水平溢位。
- `npm run build` 與 `npm run sync:ios` 已通過；`dist` 共 58 個文件，在 `ios/App/App/public` 中 `Missing = 0`、`SHA-256 Mismatch = 0`，iOS 額外兩個文件仍為 Capacitor 正常生成的 `cordova.js` / `cordova_plugins.js`。構建只保留既有 Three.js 主包大於 500KB 的提示。

### 2026-07-30 互動藝術魔幻傳送門正式接入（二十二版）

- 已把独立测试工程 `transition-portal-preview` 中确认通过的「纸幕撕裂 + 魔幻传送门 + 四卡发牌」效果接入正式首页；测试工程继续保留作视觉对照，正式应用运行时不会引用测试工程或复制测试状态。
- 点击首页 `互動藝術` 后，真实入口卡片先移动至画面中心并产生虹彩蓄能；`動態藝術` 向左模糊退场，纸雕天空、山林和草地拆成八块向四周 3D 翻折，中央传送门、旋转光环、放射光轨与粒子依次展开，再由真实四张主题卡片从中心按 3D 发牌轨迹落位。
- 转场目标直接使用现有 `DirectUploadSelectPage`；该页已重构为沉浸式暗色异界画面，保留安全区顶栏、返回首页、MagicFloor 标识和四张真实主题封面，并分别加入海洋水波、森林浮光和画境掠光等克制的场景细节。
- 四项顺序保持为 `美麗海洋`、`魔幻森林1`、`魔幻森林2`、`畫境成真`；现有主题 ID、遮罩分组、11701 端口、相机、遮罩合成、图片上载及完成页流程均未改写。
- 进入互动艺术选择页本身不会发送 11701 指令；只有点击具体主题后才分别发送 `interactive-ocean`、`interactive-forest-1`、`interactive-forest-2`、`interactive-painting-real`，随后进入原有上载页。动态艺术入口继续发送原有 `dynamic-art` 指令。
- 动画期间会锁定首页重复点击；页面切换时等待四张真实封面完成 `decode()` / load，最长约 `360ms`，避免卡片发牌时出现空白。转场结束只清理 GSAP 写入的临时视觉属性，不删除 React 的业务内联样式或页面状态。
- `prefers-reduced-motion` 下自动取消纸幕翻折、光轨和 3D 发牌，改用短淡入淡出；竖屏也会隐藏复杂转场层，保证辅助模式与异常方向下仍可完成页面导航。
- 已在隔离 Edge 以 `1194×834` 与 `1024×768` 两种 iPad 横屏尺寸检查正式关键帧和最终页面：四张封面全部解码，页面无水平或垂直溢出，Header 未触碰安全区，转场覆盖层会完整清除，浏览器控制台无错误。
- 自动回归共通过六条路径：四个主题逐项验证「进入选择页零指令、点击主题恰好一条正确启动指令」，并验证返回首页后可再次进入、动态艺术入口不受影响，以及 reduced-motion 正式路径。`npm run sync:ios` 已通过；`dist` 共 58 个文件，在 `ios/App/App/public` 中 `Missing = 0`、`SHA-256 Mismatch = 0`，额外的 `cordova.js` / `cordova_plugins.js` 为 Capacitor 正常运行时文件。构建仅保留既有 Three.js 主包大于 500KB 的提示。

### 2026-07-30 互動藝術入口排序與 A 組遮罩更新（二十一版）

- `互動藝術` 四個快速上載入口已依現場參考圖調整為：`美麗海洋`、`魔幻森林1`、`魔幻森林2`、`畫境成真`；只修改畫面排列順序，各入口原有 `launcherAppId`、11701 啟動指令、遮罩分組和上載流程均不變。
- A 組遮罩採用「新增與替換、舊項保留」方式更新：新增 `A-01` 與 `A-04`，以根目錄新版素材覆蓋原 `A-02`，繼續保留既有 `A-03`、`A-05`、`A-06`；目前 A 組完整順序為 `A-01` 至 `A-06`，共六張。
- `A-04.png` 使用根目錄圖片本身標記為 `#A-04` 的素材，已複製至 `public/Mask` 並加入 A 組遮罩選單；根目錄原檔保持不動。
- `npm run sync:ios` 已通過；六張 A 組遮罩在 `public`、`dist` 與 `ios/App/App/public` 中全部存在且內容一致。`dist` 共 58 個文件，iOS 同步核對結果為 `Missing = 0`、`SHA-256 Mismatch = 0`。

### 2026-07-30 B 方案控制页首屏稳定性修复（二十版）

- 修复第一次由作品档案进入控制页时，舞台物件图片不显示、缩成异常小块或位置错误的问题；物件缓存、归一化坐标、大小、旋转、动画、移动方式和 8080 / PC 同步协议均未修改。
- 根因之一是 B 方案展开期间曾对真实 `.dynamic-stage-shell` 使用 `rotationX` / `scaleY`，而控制页首次通过 `getBoundingClientRect()` 读取舞台尺寸；该 API 会返回 transform 后的视觉尺寸，导致错误高度同时进入物件尺寸、坐标换算、图层高度和物件属性高度。
- 控制页舞台测量已改为 `useLayoutEffect` + `ResizeObserverEntry.contentRect`，不支持 `ResizeObserver` 时回退 `clientWidth` / `clientHeight`；两种尺寸都不受 CSS transform 影响，并通过首帧 `requestAnimationFrame` 二次校准和 `0.5px` 阈值避免无意义重绘。
- B 方案的 3D 舞台折叠改由独立 `.dynamic-story-stage-proxy` 承担：替身只克隆真实背景，物件与网格在替身中隐藏；真实 16:9 舞台始终保持正常布局，只在转场阶段控制透明度，因此不会再污染物件手势、坐标或右侧面板尺寸。
- 控制页切换完成前会等待图片 `decode()` / load 与视频 metadata，最长等待约 `360ms`；素材准备后，真实物件按照图层顺序从各自最终 X 坐标上方依次落下，使用压缩后的 stagger 和弹性衰减，最多 30 个物件时也不会把过场拖得过长。
- 修复转场结束清理使用 `clearProps: all` 的问题；旧清理会连同 React 写入的物件 `left`、`top`、`width`、`height`、动画 CSS 变量及面板内联高度一起删除。现在只清除 GSAP 临时写入的 `opacity`、`transform` 与 `boxShadow`，首次进入后的图片位置和物件属性面板均保持完整。
- 右侧转场识别同时覆盖图层、物件属性和编辑背景三种面板；点击图层物件后，不需要进入预览即可立即显示完整的物件属性内容。转场结束后不会残留替身、内联透明度或锁定层。
- 隔离 Edge 已以 `1194×834` 和 `1024×768` 两种 iPad 横屏尺寸验证：两张测试图片均成功解码并按最终坐标显示，舞台分别为约 `929×523` 与 `766×431`，图层及物件属性面板与舞台高度一致，页面宽高不超出视口，控制台无错误。正式 Supabase 登录门禁已恢复，新浏览器会话只显示登录页，不存在测试绕过。
- `npm run build` 与 `npm run sync:ios` 已通过；`dist` 共 56 个文件，在 `ios/App/App/public` 中 `Missing = 0`、`SHA-256 Mismatch = 0`。构建仍只有既有 Three.js 主包大于 500KB 的提示，不影响运行。

### 2026-07-30 B 方案正式接入现有版本（十九版）

- 本轮实施前远端 `main` 已存在回退提交 `caaa5aed`，提交名称为 `7.30beifen`；该提交是本轮 UI 转场接入前的完整功能节点。独立效果工程 `transition-portal-preview` 继续保留用于视觉对照，但生产代码没有在运行时引用测试工程。
- 首页 `動態藝術` / `互動藝術` 两张入口卡改为更明确的液态玻璃层次：半透明折射、内部高光、细白描边和稳定阴影；右上角设置按钮改用 Lucide `Settings` 齿轮，点击位置、设置抽屉、账号摘要和登出流程不变。
- 点击 `動態藝術` 后，真实首页卡片作为门户原点，使用 GSAP + Three.js 播放约 `2.2s` 的纸雕自然风到数码科技层转场：卡片全息激活、低多边形碎片解构、二进制代码流、彩色光轨、线框笔记本门户推进，随后切换到真实的 `作品檔案` 页面。动画期间锁定重复操作；`prefers-reduced-motion` 下改为快速淡入淡出。
- 作品档案的资料夹下钻不更换背景：点击资料夹先产生 `scale(0.96)` 按压，文件夹图标做 `rotationY(-15deg)` / `rotationX(-34deg)` 开盖，其他卡片向侧面淡出；新路径面包屑和资料夹内容使用 `back.out` 级联入场。返回上层和点击面包屑同样走轻量级退场/入场，长按菜单、详细模式、图标模式、排序、创建、编辑、移动和删除逻辑均保留。
- 点击素材后使用 B 方案进入真实控制页：素材缩略图外框发光并扩展至近全屏，封面向上漂浮蒸发，纸雕背景通过四块 `clip-path` 裂片向外剥离，显露浅灰工作台；真实 16:9 舞台随后从 `rotationX(78deg)` 折叠状态展开，已有物件以弹性落地进入，顶部工具栏、图层和同步提示按顺序出现。控制页点击返回时执行反向折叠、背景重组与素材卡片收拢。
- 首页长按 `動態藝術` 后直接点击作品气泡，也会以该气泡位置作为 B 方案起点进入对应控制页；新建素材没有现成卡片时使用画面中央的安全起点，不影响新建完成后直接进入控制页的现有流程。
- 转场只包裹真实页面切换，不复制测试数据，也不修改 `GroupSelect`、`GroupCreate`、8080 HTTP、PC 重同步、背景发送、物件参数、本地 IndexedDB / Capacitor Filesystem、11701 互动艺术或 Supabase 登录。控制页所有原有手势、预览动画、图层拖拽和属性复制继续由原组件负责。
- 新增 `src/components/dynamicTransitions/`：`DynamicPortalTransition.tsx` 管理首页门户时间轴，`DynamicPortalWorld.ts` / `portalShaders.ts` 管理 WebGL 场景，`DynamicArtworkTransition.tsx` 管理素材破框与反向收拢，`types.ts` 统一屏幕锚点和方向类型。新增生产依赖 `gsap`、`three` 与开发类型 `@types/three`。
- 隔离 Edge 使用真实 `DynamicGroupsPage` / `DynamicControlPage` 和本地测试组完成 `1194×834` 全流程：主页门户、资料夹进入、素材破框、控制页展开和返回均成功；控制舞台可见，返回后原素材仍可见，页面宽高与视口完全一致，浏览器控制台无错误。临时登录绕过只用于隔离测试，已在最终代码中完全移除。
- `npm run build` 与 `npm run sync:ios` 已通过；`dist` 共 56 个文件，在 `ios/App/App/public` 中全部存在且 SHA-256 一致。生产主 JS 因 Three.js 增至约 `1.06MB`（gzip 约 `302KB`），Vite 会给出大于 500KB 的体积提示，但不影响构建和运行；后续可以用动态导入继续拆包。
- 仓库仍没有 ESLint 配置文件，所以 `npm run lint` 无法启动。`npm audit --omit=dev` 另外报告既有 `axios`、`form-data`、`ws` 共 3 个高危依赖项；本轮没有用强制升级混入 UI 转场修改，需另开依赖维护任务评估升级和协议回归。

### 2026-07-29 動態藝術第十按鈕行走動畫（十八版）

- 動態藝術控制頁仍維持十個按鈕：第一個 `animationId=0` 是 `無動畫`，後九個是實際動作；Unity 的第九個動作 `WalkAnimation` 現在固定對應畫面第十個按鈕與協議值 `animationId=9`，沒有新增 `animationId=10`，因此既有 8080 指令、作品檔案持久化、完整群組同步和選擇性屬性複製格式均不變。
- 第十個按鈕已由舊 `組合效果` 改為繁體 `行走`，並換成足跡圖示；動畫詳情預覽使用 `public/AnimationPreview/user_landscape.png`，不再播放舊的整圖縮放、旋轉、透明度組合 CSS。
- 新增 `desktop-runtime/renderer/walk-animation-core.js` 作為 iPad 與 PC 共用的瀏覽器動畫核心；直接使用 `ThreeJSPhotoAnimation/unity-animation-curves.json` 中 `WalkAnimation` 的 `0.8166667s`、60 FPS、循環語意，以及 `Key 23` / `Key 24` 原始關鍵幀值和 Unity 非加權 Cubic Hermite 切線規則。控制頁舞台只在 `預覽` 模式播放行走，編輯模式維持靜止，不干擾單指移動、雙指縮放旋轉或圖層操作；重新預覽會從行走起點重播。
- iPad 與 PC 現階段都使用 7×9 頂點、96 三角形的 Canvas2D 網格變形回退；PC 的背景、圖層排序、物件坐標、移動方式、大小、角度和翻轉仍沿用原渲染順序，只將 `animationId=9` 的舊組合仿真替換為行走網格。PC `player.js` 已改為 ES module，以便直接匯入同一核心。
- 倉庫目前沒有原始 `photo_plane.fbx` 或保留 24 個 Morph Targets 的 `photo_plane.glb`。曲線 JSON 只包含每個時間點的權重，不包含 `Key 23/24` 的頂點 delta；所以目前版本的時間、權重和網格拓撲與 Unity 對齊，但局部肢體形狀是程序化回退，不是 Unity 模型逐頂點 1:1。後續取得模型後只需替換核心的頂點資料 / 渲染器，`animationId=9`、UI、HTTP、快取與屬性複製均無須變動。
- `WalkAnimationCanvas` 使用全頁共用的單一 `requestAnimationFrame` 調度，Canvas 像素比上限為 `1.5`，避免每個物件建立獨立計時器並控制 iPad WebView 負載；`prefers-reduced-motion` 下保持第一幀靜態姿態。
- 已驗證 `npx tsc --noEmit`、ES module 語法、Unity 曲線關鍵點取樣、Canvas 實際非空輸出、Vite production build、diff whitespace 與 `npm run sync:ios`；`dist` 的 56 個檔案在 `ios/App/App/public` 中全部存在且 SHA-256 一致。`desktop-runtime` 的 `npm run pack:dir` / `npm run pack:portable` 同樣通過，新版 `release/win-unpacked/resources/app.asar` 已確認包含 `index.html`、`player.js` 與 `walk-animation-core.js`；可執行產物為 `release/win-unpacked/MagicFloor Dynamic Player.exe` 與 `release/MagicFloor Dynamic Player 0.1.0.exe`。

### 2026-07-28 11701 程式啟動單向指令（十七版）

- 首頁點擊 `動態藝術` 時，iPad 會先向目前設定的互動藝術端口（預設 `11701`）單向發送 `MF|AppLauncher|Launch|dynamic-art`，隨即照原流程載入作品檔案；不等待回覆、不判斷程式是否成功開啟，也不新增載入狀態、錯誤提示或 UI。
- `互動藝術` 首頁入口仍只進入四項選擇頁；選擇 `魔幻森林1`、`魔幻森林2`、`畫境成真`、`美麗海洋` 時，分別單向發送 `interactive-forest-1`、`interactive-forest-2`、`interactive-painting-real`、`interactive-ocean`，之後立即進入既有上載頁。
- 啟動指令統一為 `text/plain`，現有互動藝術圖片仍為 `multipart/form-data`；兩種請求共用 `11701`，遮罩合成、圖片上載字段、完成過場和頁面操作流程沒有修改。
- 根目錄 `ImageFileSaveHttpServer.cs` 已在圖片解析前增加純文字指令分流；合法請求回覆 `202 Accepted` 並排入執行緒安全佇列，五個對應的空 `UnityEvent` 只在 Unity 主執行緒 `Update()` 中觸發，不直接負責啟動 EXE。
- Unity Inspector 可把既有無參數喚醒方法分別綁定到 `onDynamicArtLaunch`、`onMagicForest1Launch`、`onMagicForest2Launch`、`onPaintingRealLaunch`、`onBeautifulOceanLaunch`。腳本預設端口已改為 `11701`；既有場景上的序列化組件仍需人工核對 Inspector 端口，避免保留舊值 `8081`。
- `ImageFileSaveHttpServer` 必須是常駐且唯一佔用 `11701` 的接收端；若被喚醒的其他程式也嘗試監聽同一端口，Windows 會發生端口衝突。
- TypeScript、production build、diff whitespace 與 `npm run sync:ios` 已通過；`dist` 的 56 個檔案在 iOS public 中全部存在且 SHA-256 一致，iOS 額外的 `cordova.js` / `cordova_plugins.js` 是 Capacitor 生成檔。專案目前沒有 ESLint 設定檔，因此既有 `npm run lint` 腳本無法啟動；根目錄 C# 腳本仍需放回 Unity 專案後由 Unity 編譯器完成最終驗證。

### 2026-07-27 設定玩家帳號摘要（十六版）

- 首頁齒輪設定抽屜在標題下方新增固定尺寸帳號摘要：`56px` 圓形頭像、玩家名稱與登入郵箱；IP、8080、11701、保存和登出位置維持既有資訊層級。
- `players` 是一名登入使用者對多名玩家的資料表：Supabase Auth `user.id` 對應遠端 `players.user_id`，`players.id` 是獨立玩家 ID。MagicFloor 目前沒有「已選玩家 ID」狀態，因此設定摘要會排除 `avatar_url IS NULL`，依 `updated_at DESC` 取最近更新且有頭像的一名玩家；不依賴資料庫自然順序。
- REST 回傳欄位限定為 `id,name,avatar_url`；名稱使用被選中記錄的 `players.name`，頭像只使用完整的 `players.avatar_url` 公開 HTTP(S) 連結，不讀取 `player_groups.icon_url` 或 `player_nfc_bindings.avatar_url`，也不需要 Storage SDK、簽名 URL 或圖片 Blob 快取。
- 查詢沿用目前 Supabase 專案和既有 Session access token，並帶入公開 `anon` key；沒有使用或要求 `service_role`，也沒有把完整 `players` 表開放或下載到本地。
- 本輪沒有移植 ContentForgeAI 的 `syncRemotePlayers()`、`remote-player-tree.ts`、`player_group_mapping` 或 `patapata_remote_players` IndexedDB；設定頁只需要目前玩家一筆摘要，避免把玩家樹同步生命週期耦合進 MagicFloor。
- 遠端無記錄、RLS 拒絕、網路失敗時不阻止首頁：名稱依序回退 Auth Metadata 與郵箱前綴，郵箱維持 Auth `user.email`，頭像顯示名稱首字母。`avatar_url` 只接受 `http` / `https`，圖片載入失敗也會原位切換首字母，版面不跳動。
- 認證成功後在背景載入一次帳號摘要，設定抽屜使用固定骨架狀態；登出或 Session 失效會立即清空目前帳號資料，重新登入其他帳號時不會殘留上一個玩家名稱或頭像。
- 新增 `src/services/userProfileService.ts` 隔離 Auth Session、REST 查詢、字段轉換和回退規則；`SettingsPanel` 只接收整理後的 `UserAccount`，不直接操作 Supabase。未引入完整 `@supabase/supabase-js`，production 主 JS 只由約 `459.6KB` 增至約 `462.2KB`。
- 隔離 Edge 驗證覆蓋 `1194×834` 與 `1024×768`：兩種尺寸帳號與底部登出均完整位於設定抽屜，無水平溢位；請求會使用目前 Auth UUID 篩選 `user_id`、排除空頭像、按 `updated_at DESC` 排序並限制一筆，選取字段、Bearer Token 和 apikey 均正確。遠端名稱 / 頭像可顯示，圖片錯誤會回退首字母，登出後 Session 清除並返回登入頁。TypeScript、production build、diff whitespace 與 `npm run sync:ios` 均通過；`dist` 的 56 個檔案與 iOS 對應資源 SHA-256 完全一致。

### 2026-07-27 首頁設定登出（十五版）

- 首頁右上角齒輪展開的既有設定抽屜底部新增 `登出`；入口不放在首頁主畫面或登入頁，避免干擾 `動態藝術` / `互動藝術` 兩個主要工作入口。
- 登出操作與 IP、8080、11701 欄位以分隔線區分；`取消` / `保存` 仍維持原排列，登出使用獨立全寬警示色按鈕和登出圖示，符合 iPad 橫屏觸控尺寸。
- 登出使用 Supabase `signOut({ scope: 'local' })`，只結束目前 iPad / 瀏覽器的本地會話，不會讓其他已登入設備一併登出。
- 成功登出後會關閉設定抽屜、重設目前頁面至首頁入口狀態、清除本次頁面選取，並顯示登入頁；認證狀態監聽同時處理 Supabase `SIGNED_OUT`，避免畫面殘留在已受保護頁面。
- 登出不會刪除藝術畫廊 IP、8080 / 11701 端口、作品檔案、背景、物件圖片、控制參數或 IndexedDB / Capacitor Filesystem 素材；重新登入後仍可沿用原有本機設定與作品資料。
- 登出執行期間會停用 `取消`、`保存` 和登出按鈕，防止重複操作；若 Supabase 登出失敗，抽屜會保留並以 `aria-live="polite"` 顯示 `無法登出，請稍後再試。`。
- 已在隔離 Edge `1194×834` iPad 橫屏環境完成互動驗證：登出按鈕位於設定面板內及所有網路欄位下方，沒有超出抽屜；點擊後本地 `magicfloor_supabase_auth_v1` 會話被清除、設定關閉、首頁隱藏並返回登入頁。TypeScript、production build、diff whitespace 與 `npm run sync:ios` 均通過；`dist` 的 56 個檔案與 `ios/App/App/public` 對應資源 SHA-256 完全一致。

### 2026-07-27 Supabase 登入門禁（十四版）

- 應用最外層新增獨立 Supabase 認證門禁；登入頁不加入原有 `Page` / `pageOrder` 路由，認證成功後才顯示既有首頁，因此 `動態藝術`、`互動藝術`、8080、11701、IP 設定、作品快取和 PC 同步流程均未改寫。
- 新增純登入頁，只提供 `電子郵件`、`密碼`、密碼顯示切換與 `登入`；沒有註冊、忘記密碼、使用者資料、Supabase URL 或其他技術資訊。所有靜態文字和錯誤提示維持繁體中文。
- 登入頁共用首頁 `magic-floor-background.webp` 與同一 MagicFloor Logo 位置；表單放在橫屏畫面左側天空留白，使用單層高可讀性毛玻璃面板、54px 輸入與按鈕觸控高度、明確 focus / error 狀態、安全區和鍵盤可捲動處理。
- 登入成功後按鈕顯示確認狀態並播放既有成功音，表單約 `320ms` 淡出，再由原首頁進場；`prefers-reduced-motion` 只保留快速透明度切換。啟動檢查期間只顯示共用背景與 Logo，不會閃出登入表單或首頁。
- 認證只引入官方 `@supabase/auth-js`，未打包 Database、Realtime、Storage 等無關模組；production 主 JS 約 `458.6KB`，低於完整 `supabase-js` 造成的約 `574.5KB`，且沒有 Vite 大包警告。
- Supabase 配置集中於 `src/services/supabaseClient.ts`，支援 `VITE_SUPABASE_URL` / `VITE_SUPABASE_ANON_KEY` 覆寫；內建配置只使用可公開的 `anon` 公鑰，絕不可替換為 `service_role`。
- 會話使用 Supabase `persistSession` 與 `autoRefreshToken`；只保存 access / refresh token，不保存或輸出明文密碼。重新開啟時除讀取本地 Session 外，還會呼叫 Supabase `/user` 驗證使用者，失效或偽造 token 不會繞過登入頁。
- 錯誤資訊不直接暴露 Supabase 英文回應：空欄位、錯誤憑證、離線和頻率限制分別轉換為簡短繁體提示；錯誤區使用 `aria-live="polite"`，輸入框具有 `aria-invalid` / `aria-describedby`，初始不自動聚焦以避免 iPad 鍵盤突然彈出。
- Chromium 驗證覆蓋 `1024×768`、`1194×834`、`1366×1024`：三種尺寸均無水平或垂直溢位、沒有初始輸入焦點；空欄位會聚焦郵箱，真實 Supabase 錯誤憑證會顯示 `電子郵件或密碼不正確。`。模擬成功登入約 `340ms` 進入首頁，Session 不含測試密碼，重新載入經 `/user` 驗證後約 `129ms` 恢復首頁。

### 2026-07-27 互動藝術作品送出與結果揭曉過場（十三版）

- 本輪把 `互動藝術` 快速上載恢復為結果導向的「作品送出與結果揭曉」過場；不顯示百分比、進度條、旋轉等待、`正在上載`、`正在處理`、`正在確認`、HTTP、端口、IP、連線狀態或其他技術階段。
- 點擊 `發送快速上載` 後立即鎖定頁面並保留明確按壓回饋；按鈕不播放一般點擊音，只播放獨立 `artwork-send` 柔和上升送出音。互動藝術上載頁右上角的狀態膠囊同步隱藏。
- 過場先淡化並模糊原操作介面，只保留目前作品為視覺中心；作品約 `300ms` 輕微放大至 `1.03`。若本地圖片、遮罩或 Canvas 合成較慢，作品只維持克制的呼吸效果，不顯示 loading 或等待文案。
- 合成完成並成功啟動 `xhr.send()` 後，作品在約 `700ms` 內完成一次邊框向內收束與單條左至右掃描線，隨後輕微縮小並銜接完成頁預覽位置；正常快速路徑總時間約 `1000ms`，已移除舊版雙層殘影、四角鎖定、逐邊畫框和第三個鎖定音。
- 完成頁只保留綠色完成標記、`結果`、`圖片已發送`、檔案名稱、`返回首頁` 與 `重新上載`；勾號出現時播放獨立雙音 `artwork-arrived`，只有最終結果區使用 `aria-live="polite"`，過場本身不向輔助功能朗讀技術狀態。
- 本地圖片讀取、遮罩讀取、Canvas 建立或 `xhr.send()` 同步失敗時，過場會反向回到原上載頁，完整保留圖片、遮罩、縮放與位置，只顯示 `無法完成，請重試。`，不進入結果頁也不播放完成音。
- `prefers-reduced-motion` 會取消掃描、縮放和位置移動，只保留快速淡出與完成頁淡入。11701 仍維持既有 fire-and-forget：表單欄位為 `image`，不註冊 `xhr.upload` 進度事件、不等待 HTTP 狀態或接收端回覆。
- 本輪未修改 `動態藝術`、8080、IP / 端口設定、遮罩合成內容、HTTP 表單格式、相機拍照流程或接收端程式。
- 已以隔離 Edge 環境驗證 `1024×768`、`1194×834`、`1366×1024` 三種 iPad 橫屏尺寸：正常路徑約 `1.02–1.13 秒` 進入結果頁，每次只送出一個包含 `image` 欄位的 multipart `POST`，沒有 `OPTIONS` 或技術狀態文字。TypeScript、production build、diff whitespace 與 `npm run sync:ios` 均通過；最新資源已同步至 `ios/App/App/public`。專案現有 `npm run lint` 因倉庫未提供 ESLint 設定檔而無法執行，與本輪程式內容無關。

### 2026-07-27 動態藝術左右移動單軌跡預覽（十二版）

- 本輪只重做 iPad `動態藝術` 控制頁預覽模式中的 `左移` / `右移` 視覺動畫；物件參數、本地持久化、8080 HTTP 事件、PC 接收端公式和 `互動藝術` 11701 流程均未修改。
- 舊版把外層水平位移和內層上下波浪拆成兩個 CSS 動畫，iPad WebView 可能因兩個時間軸的插值與相位差出現機械感；新版改用 Web Animations API 為每個物件生成一條完整二維軌跡，每個關鍵幀同時計算 X / Y，只保留一個合成動畫實例。
- 軌跡繼續以 PC 端規則為標準：1920×1080 基準、260px 畫面外邊距、7 個正弦波週期、`movePercent × 舞台高度 × 0.5` 幅度、PC 速度換算和物件實際 `position.y` 中線；左移以反向進度生成同一條軌跡，不再反轉獨立波浪動畫。
- 每個週期使用 140 段軌跡採樣，透過單一 `translate3d` 動畫交由瀏覽器合成執行；不會逐幀更新 React state。順序出現的淡入延遲保持獨立，停止預覽或離開頁面會取消動畫，舞台尺寸改變時會重建相同比例軌跡並保留播放時間。
- 舊 `dynamic-preview-left`、`dynamic-preview-right`、`dynamic-preview-horizontal-wave` 關鍵幀、水平波浪 CSS 變數和左移 `animation-direction` 已移除；上下、360 回環、隨機、圖片動畫、縮放、旋轉與翻轉維持既有實作。
- Chromium 自動化驗證覆蓋 `1024×768`、`1194×834`、`1366×1024`：三種尺寸的舞台均維持 16:9，每個左右移動物件只有一個外層動畫、波浪子層沒有獨立動畫；上 / 下軌道 50% 幅度採樣與公式誤差約 `0.8px`。`npx tsc --noEmit`、Vite production build、diff whitespace 與 `npm run sync:ios` 均通過，最新資源已同步至 `ios/App/App/public`。

### 2026-07-27 互動藝術拍照與上載流程完善（十一版）

本輪修改前已建立並推送完整回退節點：`cc7eb4cf05dc255256403e7aea56e257f30d6fac`（短提交 `cc7eb4cf`，提交訊息 `7.27动态艺术完整修改`，分支 `main`，遠端 `origin/main` 已核對一致）。該提交是本輪互動藝術改動前的穩定備份，不應改寫。

- 本輪只優化 `互動藝術` 的相機拍照、上載等待與完成回饋；`動態藝術` 的作品檔案、背景、圖層、物件參數、PC 同步和 8080 流程均未修改。
- 自定義相機右側新增閃光燈開關，使用後置鏡頭 `MediaStreamTrack` 的 `torch` capability / constraint；支援時可直接開關補光燈，不支援的鏡頭會停用按鈕但仍可正常拍照。
- 相機開啟期間新增 `正在啟動相機` 狀態；只有影片 metadata 與有效畫面尺寸準備完成後才開放快門，並鎖定連續點擊，降低 iPad WebView 黑圖或重複拍攝風險。
- 快門增加獨立的 Web Audio 拍照聲與短白色快門閃光；音效由程式生成，不增加外部音效授權或素材依賴。快門不再疊加一般按鈕點擊音。
- 拍照來源在遮罩調整頁顯示 `重新拍攝`，相簿或檔案來源維持 `重新選擇`；關閉重新拍攝相機不會清除原圖片、遮罩、縮放或位置。
- 上載過場改為結果導向的作品轉場：不顯示百分比、轉圈、`正在處理`、`正在發送` 或接收端確認文字；畫面只聚焦實際完成遮罩合成的 PNG，依序執行作品浮起、四邊畫框閉合、雙層殘影收束、表面掠光與空間前移，再自然銜接完成頁。
- 點擊發送時播放一次短促的作品送出音，畫框閉合時播放輕量鎖定音，進入完成頁時再播放獨立完成音；三者皆由 Web Audio 即時生成，不增加外部素材依賴，也不使用循環等待音效。
- 完整轉場約 `1.5 秒`，只使用 GPU 友好的 `transform` / `opacity` 為主動畫；`prefers-reduced-motion` 模式會停用裝飾動畫並縮短展示延遲，不改變 HTTP 發送時機與結果頁流程。
- 11701 接收格式維持既有 `POST http://{ip}:{interactivePort}`，`multipart/form-data` 欄位仍為 `image`；圖片與目前遮罩的合成方式、IP / 端口來源及完成頁跳轉均未改寫。
- 互動藝術保持舊版 fire-and-forget 語意：呼叫 `XMLHttpRequest.send(FormData)` 後只保留短暫視覺過場，不等待 HTTP 狀態、不讀取 Unity 回應，也不判斷 PC 是否完成保存或展示。
- 不可在 11701 發送器掛載 `xhr.upload.onprogress` / `xhr.upload.onload`；跨來源 WebView 會因此先送出 CORS `OPTIONS` 預檢，而既有 Unity 接收器沒有處理 `OPTIONS` 或 CORS 標頭，會使真正的圖片 `POST` 被瀏覽器阻止。
- 本地圖片或遮罩合成失敗時會保留目前圖片、遮罩、縮放和位置，使用者可直接重試，不需要重新拍攝或重新選擇。
- 上載完成頁保留原版面與 `返回首頁` / `重新上載` 操作，新增綠色完成標記縮放、勾號描邊、預覽與資訊面板進場、狀態及底部按鈕出現動畫；同時支援 `prefers-reduced-motion` 和 `aria-live`。
- 上載完成頁的結果摘要已精簡：隱藏 HTTP / 快速上載端口說明與 `目標` 資訊卡，只保留完成狀態和實際檔案名稱，避免向一般使用者暴露傳輸實作資訊。
- Web 端已以 `1194×834` iPad 橫屏尺寸完成相機、閃光燈、拍照、遮罩調整、發送狀態及完成頁全流程檢查；另以不提供任何 CORS 標頭的臨時接收器驗證，瀏覽器只送出一次 `POST`，沒有 `OPTIONS`，並正常進入 `已發送` 頁面。TypeScript、Vite build 與 diff whitespace 驗證均通過，最新構建亦已經由 `npm run sync:ios` 同步至 `ios/App/App/public`。

### 2026-07-27 首頁 Logo 頂欄透明化（十版）

- 移除首頁 `.entry-topbar` 的深色半透明背景、邊框、陰影與 backdrop blur，Logo 和設定按鈕現在直接顯示在品牌天空背景上，不再出現黑色長方形遮罩。
- 保留原有頂欄高度、內距、iPad safe area、Logo 尺寸與設定按鈕位置，沒有改變首頁入口和任何頁面流程。
- 白色 `Right_Logo.png` 只增加沿透明輪廓生效的兩層輕量 drop-shadow，確保亮色天空下仍可辨識，不會形成新的矩形底色。
- 已以 Chromium `1194×834` iPad 橫屏尺寸實際截圖確認，Logo、設定按鈕與兩個藝術入口均無重疊或裁切。

### 2026-07-24 品牌背景、完整縮圖與 PC 移動軌跡同步（九版）

本輪修改前已先把可回退基線推送至遠端 `origin/main`，確認遠端提交為 `948150c8836c15634b1a05b043df5527149e2c5c`（短提交 `948150c8`，提交訊息 `7.24动态艺术功能完善`）。該提交不得改寫，可作為本輪 UI 修改前的穩定回退節點。

- 首頁使用根目錄 `Magic_floor_background.png` 產生的 iPad 優化資源 `src/assets/magic-floor-background.webp` 作為背景；原始 `8334×4168` PNG 保留不動，介面使用的 `4096×2048` WebP 約 136.6 KB，降低 WebView 解碼記憶體、包體和頁面切換負擔。
- `作品檔案` 根頁套用相同品牌背景，並增加獨立的淺色可讀性覆層；背景只作用於首頁與作品檔案，不會進入背景上載、物件上載、控制頁、16:9 舞台或 `互動藝術`。
- 首頁文字版 `MagicFloor` 標誌替換為根目錄 `Right_Logo.png`；保留原圖比例和透明通道，使用深色半透明頂欄確保白色 Logo、設定按鈕在各種背景位置上均清晰可見。
- 動態藝術內的素材、首頁作品氣泡、圖層、屬性、屬性複製與背景資源縮圖統一使用 `object-fit: contain`；極端直圖、橫圖與透明去背圖片會完整顯示並以固定容器留白，不再被 `cover` 裁切。16:9 舞台背景仍維持既有 `cover`，避免改變實際舞台效果。
- iPad 左移 / 右移預覽對齊 `desktop-runtime/renderer/player.js`：使用 1920×1080 基準、260px 畫面外邊距、7 個波形週期、PC 速度換算、原始 Y 座標與 50% 舞台高度最大幅度；左移波形相位反向，確保同一 X 位置的上下軌跡方向與 PC 一致。HTTP / PC 訊號欄位沒有修改。
- 編輯背景的拖拽預覽改由 React Portal 掛載至 `document.body`，並提升至背景編輯彈窗之上；排序命中、資料更新與既有手勢判定不變。
- 新建資料夾 / 素材的背景遮罩會攔截 pointer、click 與 context menu；點擊任意留白不會關閉建立彈窗，只能由關閉、取消或建立成功離開。
- 驗證結果：`npx tsc --noEmit`、`npm run build`、`git diff --check` 均通過；以 Chromium 實際檢查 `1024×768` 與 `1180×820` iPad 橫屏，首頁及作品檔案背景、Logo、兩個入口、工具列和空狀態均無重疊。建立資料夾自動化檢查確認初始焦點位於彈窗，點擊空白遮罩後彈窗與輸入內容仍保留。

### 2026-07-23 動態藝術物件檢視、改名與屬性複製（八版）

本輪只整理控制頁 `物件屬性` 的檢視和複製流程；舞台手勢、圖層排序、背景管理、移動動畫、媒體檔案、PC 同步格式和 `互動藝術` 11701 流程均未改寫。

- 物件屬性頂部縮圖改為預覽按鈕；點擊後開啟置中的深色圖片預覽，透明圖片使用棋盤底，橫圖 / 直圖均完整顯示。預覽支援雙指縮放、放大後單指平移、雙擊或工具按鈕重設，手勢不會傳入 16:9 舞台。
- 物件名稱可由屬性標題單擊後原位編輯；只有用戶主動點擊才喚起鍵盤，空名稱不能提交，可經完成按鈕或鍵盤 Enter 儲存，取消不改資料。名稱更新會同步圖層和其他引用位置，並寫入既有本地持久化。
- 物件改名沿用既有 `ItemUpdate`，且 `replacedAsset: false`；`itemId`、`assetId`、圖片檔案、位置和所有控制參數維持不變。
- `屬性複製` 頁只保留來源物件；點擊來源後開啟確認彈窗，再於彈窗勾選 `移動方式`、`動畫`、`大小`、`變形`，核對來源 / 目標後才真正複製。零選項時確認按鈕停用，取消不寫資料或發送事件。
- 屬性複製仍使用 `ItemSettingsCopy` 與既有 `copyFields` / `fields` 展開規則；提交期間鎖定重複操作，成功後保留目標物件高亮和完成音效。
- 新彈窗遵守 iPad safe area、44px 以上主要觸控範圍、鍵盤與焦點返回、窄屏內部滾動和 `prefers-reduced-motion`。

### 2026-07-23 動態藝術 iPad 安全區與建立流程完善（七版）

本輪依照 iPad 實機畫面統一 `作品檔案`、背景上載、物件上載和控制頁的頂部幾何，並收緊新建資料夾 / 素材的彈窗行為；只涉及 iPad 端版面與本地素材庫交互，HTTP、PC 同步協議、媒體資料和 `互動藝術` 11701 流程均未修改。

- 動態藝術各頁共用 `safe-area-inset-*` 安全區和固定頂欄高度；1024 / 1194 / 1366 橫屏下返回按鈕、標題與右側操作維持相同垂直位置，不再與 iPad 時間、Wi-Fi 或電量狀態重疊。
- 動態藝術頁面切換動畫只作用於主內容區，頂欄保持固定；內容以約 `240ms` 淡入與輕微位移過場，並支援 `prefers-reduced-motion`。
- `作品檔案` 根目錄完全隱藏路徑導航及其容器，進入子資料夾後才顯示麵包屑，根目錄素材區會使用釋放出的高度。
- 新建資料夾或素材時不再自動聚焦名稱輸入框，避免進入彈窗便彈出 iPad 鍵盤；初始焦點停在彈窗本身，關閉後返回原觸發按鈕。
- 新建資料夾 / 素材彈窗不能再由點擊背景遮罩或任意留白關閉，只能經右上角關閉、`取消` 或成功建立後關閉，避免已填名稱或已選縮圖被誤操作丟失。編輯既有項目仍保留名稱輸入框自動聚焦。
- 背景上載頁和控制頁的 16:9 舞台改為 `14px` 圓角 Mask；裁切只影響 iPad 顯示層，不改座標、網格、手勢、上載素材或 PC 顯示比例。預覽紅色呼吸邊框同步適配圓角。
- 已以 Chromium 實際檢查 `1024x768`、`1194x834`、`1366x1024` 三種橫屏尺寸；根目錄路徑隱藏、子資料夾路徑顯示、建立彈窗焦點、遮罩不可關閉及舞台圓角均符合預期。

### 2026-07-23 動態藝術作品檔案素材庫 / 控制頁交互完善（六版）

本輪把 `作品檔案` 升級為適合 iPad 橫屏操作的文件管理器式素材庫，同時修正控制頁的圖層恢復入口、背景排序手感和預覽邊框裁切；既有作品 ID、媒體檔案、物件參數、PC 同步流程和 `互動藝術` 11701 流程均未改寫。

- 作品檔案新增 `圖示模式` 與 `詳細模式`；圖示模式會按 1024 / 1194 / 1366 橫屏寬度自動使用 3 / 4 / 5 欄，詳細模式顯示名稱、修改日期、類型和內容數量。檢視模式、排序方式和所在資料夾會跨次開啟保存。
- 新增資料夾 / 子資料夾概念、麵包屑導航和返回上一層；可在根目錄或任一資料夾內直接建立素材。新素材建立後直接進入控制頁，背景和物件均從控制頁新增。
- 素材與資料夾都支援長按或更多按鈕開啟 iOS 毛玻璃選單，可執行編輯、移動到和刪除。非空資料夾可選擇先移出內容再刪除，或二次確認後連同後代資料夾和素材一起刪除。
- 舊作品不需要重建或搬移媒體；沒有 `folderId` 的既有作品會自動顯示在素材庫根目錄。`DynamicGroup` 只新增可選的 `folderId` / `libraryOrder` 組織欄位。
- 資料夾元資料使用獨立 localStorage 鍵 `magicfloor_dynamic_folders_v1`，素材庫偏好使用 `magicfloor_dynamic_library_preferences_v1`。資料夾只影響 iPad 本地組織，不會加入 `GroupStateSync`、`GroupSelectAndSync` 或任何 PC / Unity 指令。
- 圖層收起後舞台會平滑置中放大；恢復 `圖層` 的按鈕位於 16:9 舞台右側空白軌道，不覆蓋舞台。展開圖層後以相同三軌布局平滑回到現有雙欄比例。
- 背景排序改為與圖層卡片一致的整卡拖曳：iPad 長按啟動、浮動毛玻璃預覽、插入線、原位占位和上下邊緣自動滾動。只有成功放開才持久化順序並發送一次組狀態，取消手勢會恢復原順序。
- 背景列表改為單欄，提升卡片命中範圍和拖曳穩定性。預覽模式為紅色呼吸邊框預留完整外側空間，四邊不再被舞台容器裁切。
- 已在 Chromium 以 `1024x768`、`1194x834`、`1366x1024` 實際檢查圖示 / 詳細模式、控制頁展開 / 收起、預覽邊框和背景拖曳；`npx tsc --noEmit`、`npm run build`、`git diff --check` 和 `npm run sync:ios` 均已通過，最新資源已同步至 `ios/App/App/public`。

### 2026-07-23 動態藝術控制頁結構糾正（五版）

本輪修正四版把 `編輯背景` 和 `物件屬性` 都做成右側替換頁面的理解偏差；背景、物件、圖層、預覽的資料和 PC 協議均未重寫，`互動藝術` 11701 流程沒有修改。

- 圖層面板仍是控制頁右側基礎面板；收起後右側軌道縮為 `0`，16:9 舞台按可用空間置中放大，恢復圖層時以約 `260ms` 動畫回到雙欄布局。
- 頂部按鈕維持 `編輯背景`，但背景編輯已從錯誤的右側替換頁恢復為上一版居中 iOS 毛玻璃彈窗；開關彈窗不改舞台或圖層寬度。
- 背景彈窗保留 `固定背景`、`隨機切換`、`逐個切換`、新增、勾選刪除和拖拽排序；雙列背景卡片的命中算法已改為同時根據 X / Y 坐標判斷插入位置。
- 背景間隔改為數值框加 `秒 / 分鐘` 單位選擇，失焦或按 Enter 才提交；`固定背景` 時整個間隔設定隱藏。UI 輸入仍轉為 `intervalMs` 儲存和發送，PC 協議不變，上限仍為 `600000ms`。
- `物件屬性` 恢復上一版淺色毛玻璃工具面板、物件縮略圖和頁籤樣式，只把位置改到圖層面板所在區域；點擊 `X` 返回圖層，舞台尺寸不跳動。
- 屬性頁籤現在是 `移動方式`、`動畫`、`變形`、`屬性複製`。`變形` 內合併縮放數值、旋轉數值、縮放 / 旋轉步進、水平翻轉和垂直翻轉；接收端使用的網格值不向用戶顯示。
- `屬性複製` 的勾選粒度仍保留 `移動方式`、`動畫`、`大小`、`變形`，方便只複製縮放 / 旋轉而不連帶翻轉。
- 預覽紅色呼吸邊框和鎖定交互維持；`停止預覽` 按鈕補充原生 appearance 與 iPad tap highlight 清理，避免按壓後停留在全白狀態。
- 已用 Chromium 實際載入測試作品檔案核對居中背景彈窗、右側物件屬性面板和圖層收起布局；`npx tsc --noEmit`、`npm run build`、`git diff --check`、`npm run sync:ios` 均已通過。

### 2026-07-23 動態藝術控制頁右側工作面板重整（四版）

本輪只改 `動態藝術` 控制頁 UI/UX、背景播放設定和 PC 背景間隔上限；`互動藝術` 11701 上載流程沒有修改。

- 控制頁整理為「16:9 舞台 + 右側工作面板」：右側面板可在 `圖層`、`編輯背景`、`物件屬性` 之間切換。
- 圖層面板新增收起按鈕；收起後右側面板完全隱藏，舞台自動置中並按可用寬度放大；點擊浮動 `圖層` 按鈕可恢復原雙欄布局。
- 頂部 `背景` 按鈕更名為 `編輯背景`；背景設定不再使用居中彈窗，改為和圖層同位置、同高度的右側面板。
- `編輯背景` 面板改為圖層式卡片列表，可新增背景、勾選刪除、點擊切換當前背景，並支援按住拖曳背景卡片調整 `sequence` 播放順序。
- 背景切換方式保留 `固定背景`、`隨機切換`、`逐個切換`；`固定背景` 不顯示切換間隔。切換間隔改為秒數輸入框，上限由 `60 秒` 放寬為 `600 秒`。
- `desktop-runtime/renderer/player.js` 同步放寬背景切換間隔上限到 `600000ms`，避免 iPad 設定 5 分鐘時 PC 端被夾回 60 秒。
- `物件屬性` 不再從舞台左側浮出，而是佔用右側工作面板位置；點擊 `X` 會返回圖層面板。
- `物件屬性` 頁籤精簡為 `移動方式`、`動畫`、`大小與變形`、`屬性複製`；`大小與變形` 合併縮放、旋轉、水平翻轉和垂直翻轉，並隱藏給接收端使用的網格值。
- 預覽模式舞台外側新增紅色呼吸邊框，提示目前處於預覽鎖定狀態；`停止預覽` 按鈕補齊 `active/focus` 樣式，避免實機按壓後變成全白。

### 2026-07-23 動態藝術控制頁實機交互整理（三版）

本輪以已跑通版本和遠端回退標籤 `backup-before-dynamic-ui-redesign-20260723` 為基線，重整動態藝術控制頁；`互動藝術` 的 11701 主題、相機、遮罩合成及上載流程沒有修改。

- 新建作品檔案或點擊既有作品檔案後，現在直接進入 `dynamicControl`；不再強制經過背景頁或圖片上載頁。空作品檔案也可正常顯示 16:9 舞台，並從圖層欄 `+` 新增第一個物件。
- 控制頁返回按鈕改為回到作品檔案列表；舊 `DynamicBackgroundPage` / `DynamicItemsPage` 檔案和路由型別暫時保留，方便回退，但主流程已繞過。
- 控制頁頂部加入 iPad 狀態列安全區，使用 `max(24px, env(safe-area-inset-top))` 作為 WebView 實機兜底；`1024x768`、`1194x834`、`1366x1024` 均無頂部重疊、頁面溢出或按鈕文字截斷。
- 背景入口當時改為整屏居中的 iOS 毛玻璃彈窗；四版已改為右側工作面板，切換間隔上限也已放寬到 `600 秒`。
- `DynamicGroup` 新增 `backgroundPlayMode` / `backgroundIntervalMs`，舊快取自動遷移為 `fixed + 5000ms`。新事件 `BackgroundPlayback` 只同步播放參數，不改素材上載格式。
- iPad 和 `desktop-runtime` 都只在預覽模式執行背景自動切換；編輯模式始終保持當前背景。逐個切換從當前背景開始，隨機切換避免連續重複；視頻背景重新切回時從頭播放。
- 圖層欄移除 `後景`、`逐個出現由此開始` 等方向說明；新增單項勾選、三態全選、已選數量及批量刪除。批量刪除在本地一次性持久化，對 PC 逐項發送既有 `ItemDelete`，最後只發一次 `GroupStateSync`。
- 圖層整卡拖曳改為獨立視窗級 Pointer 監聽：iPad 按住約 `180ms` 啟動，滑動容差提高到 `18px`；按下會縮小，啟動後顯示跟手毛玻璃浮層，原位置保留半透明占位，接近列表邊緣仍可自動捲動。
- 圖層拖曳不再依賴正在重排的卡片 DOM；即使 React 重排或 iPad WebView 丟失卡片事件，仍由 `window` 級監聽完成或取消。取消會恢復原順序，松手後才持久化並同步 PC。
- `物件屬性` 現在固定從舞台左側彈出，不再按物件 X 坐標左右切換；面板使用半透明白色、`30px` 模糊和獨立內部捲動，固定圖層仍保持可見。
- 預覽模式改為完全鎖定：隱藏返回、背景、出現設定、圖層和物件屬性，舞台不接收編輯指標事件，頁首只保留 `停止預覽`；只能由該按鈕退出。
- 已用真實 Chromium CDP Pointer / Touch 事件驗證：鼠標整卡重排、iPad 長按啟動、按壓狀態、拖曳浮層、取消回滾、順序恢復、全選 / 部分選取三態、背景模式持久化、背景彈窗整屏覆蓋及預覽鎖定均正常。
- PC 端 `desktop-runtime/main.js` 和 `renderer/player.js` 已接入背景模式字段及 `BackgroundPlayback`；`node --check` 已通过。Web 端 `npx tsc --noEmit`、`npm run build`、`git diff --check` 和 `npm run sync:ios` 已通过，最新资源已复制到 `ios/App/App/public`。

### 2026-07-23 動態藝術圖層整卡拖曳

本輪只擴大控制頁圖層排序的觸控範圍，不改圖層資料、舞台排序規則或 PC 協議：

- 圖層排序不再限定三條線按鈕；滑鼠可從整張圖層卡片拖曳，iPad 觸控按住卡片約 `200ms` 後即可拖曳。
- 普通單擊仍開啟 `物件屬性`；觸控在長按成立前快速上下移動仍交給圖層列表捲動，不會誤觸排序。
- 原三條線排序按鈕已改為明確的「屬性」按鈕，點擊後開啟該圖層物件的 `物件屬性`；整張卡片本身仍是排序拖曳區域。
- `ArrowUp` / `ArrowDown` 鍵盤排序移至縮略圖與名稱按鈕，鍵盤操作能力維持不變。
- 「屬性」和刪除按鈕均明確排除在整卡拖曳手勢之外，按住或點擊這兩個操作區不會啟動排序。
- 拖曳時卡片會浮起、高亮並顯示插入線；指標位於目標卡片上半部時插入其前方，下半部時插入其後方。
- 拖曳接近圖層列表頂部或底部 `52px` 區域時會持續自動捲動，速度依接近邊緣程度調整，方便跨越長列表排序。
- 拖曳過程只更新 iPad 本地舞台遮擋關係；松手後才持久化最終 `order` 並發送一次既有 `GroupStateSync`。取消手勢會恢復拖曳前順序，不寫入快取。
- 已用真實瀏覽器 Pointer / Touch 事件驗證：鼠標整卡拖曳、觸控短按、觸控快速滑動、觸控長按拖曳、邊緣自動捲動、取消回滾、刪除區隔離及鍵盤排序均正常。

### 2026-07-23 動態藝術控制頁視覺重設（二版）

本輪針對第一版控制工作台在 4:3 橫屏 iPad 上舞台偏小、頁面上下留白像未完成區域、資訊層級不夠清晰的問題，再次重設控制頁視覺；功能事件、HTTP 協議、素材上載、手勢、持久化及 PC 端程式均未改動。

- 控制頁改為真正的深色編輯工作台：深色區域代表舞台以外的工作空間，不再用大片淺灰背景形成空白頁感；16:9 舞台使用高對比深色邊框和畫布陰影，成為畫面第一視覺焦點。
- 頂部操作帶縮至 `72px`，保留返回、作品檔案名稱、出現設定、背景及預覽；移除操作按鈕外層的卡片式包覆，按鈕選中、按壓與預覽狀態仍有明確視覺回饋。
- 固定圖層欄寬度調整為 `204-230px`，比第一版更緊湊；圖層仍與舞台嚴格等高，列表只在圖層面板內滾動，前景 / 後景方向、數量、快速新增、拖曳排序及刪除入口均保留。
- 舞台與圖層作為同一工作台整體在可用區域置中，避免留白只堆積在頁面底部；工作台不產生頁面級水平或垂直捲動。
- `物件屬性`、背景素材及出現設定改為貼齊舞台邊緣的淺色浮層，與深色工作台形成明確層級；面板彼此互斥，不會覆蓋固定圖層欄。
- 預覽模式隱藏圖層、物件屬性、背景和出現設定，舞台自動擴展為可用寬度；退出預覽後恢復原本編輯佈局。
- 實測 `1366x1024`：舞台約 `1098x618`，圖層 `230x618`；`1194x834`：舞台約 `952x536`，圖層 `204x536`；`1024x768`：舞台約 `782x440`，圖層 `204x440`。
- `1024x768` 預覽模式舞台可擴展至約 `996x560`；三檔尺寸的文件寬高均等於 viewport，沒有頁面溢出或文字與操作列重疊。
- 已回歸驗證：圖層 / 舞台單擊開啟屬性、面板互斥、選擇性屬性複製確認彈窗、預覽進出、圖層鍵盤排序及排序還原均正常。
- 本輪已執行並通過 `npm run build`、`git diff --check` 和 `npm run sync:ios`；最新 Web 資源已同步到 `ios/App/App/public`。

### 2026-07-23 動態藝術 UI/UX 產品化重構

本輪在不改動既有上載、手勢、預覽、持久化和 PC 接收規則的前提下，重構 `動態藝術` 作品檔案、物件列表、背景頁和控制頁：

- 改版前可用版本已推送到遠端 `origin/main`：提交 `bf6fe35a`，提交名 `7.23beifen`；回退標籤為 `backup-before-dynamic-ui-redesign-20260723`。
- 控制頁改為固定雙欄工作台：左側為 16:9 舞台，右側為常駐圖層面板；圖層面板高度直接跟隨舞台實測高度，圖層超出時只在面板內部滾動。
- 圖層列表頂部代表前景、底部代表後景；拖曳圖層縮略圖可調整前後關係，舞台以同一個 `order` 即時更新遮擋關係，放開後持久化並發送完整 `GroupStateSync`。
- 圖層拖曳把手支援觸控與滑鼠，也支援鍵盤 `ArrowUp` / `ArrowDown`；圖層標題右側保留 `+`，可直接向當前作品檔案新增物件。
- 舞台物件由雙擊改為單擊開啟屬性：單指拖曳仍移動物件，雙指仍縮放與旋轉；點擊移動小於 8px 才視為選取，避免拖曳結束時誤開面板。
- 舊稱 `物件控制` 已改為 `物件屬性`，舊稱 `套用` 已改為 `屬性複製`；屬性面板依物件所在位置從舞台左側或右側彈出，並與背景、出現設定互斥。
- 物件屬性分為 `移動方式`、`動畫`、`大小`、`變形`、`屬性複製` 五個頁籤；編輯模式物件保持靜止，只有進入預覽模式才播放移動與出現效果。
- `屬性複製` 可獨立勾選 `移動方式`、`動畫`、`大小`、`變形`；執行前會顯示來源、目標和所選內容的確認彈窗，未勾選內容時按鈕不可用。
- 四類複製範圍：`移動方式` 對應移動模式、幅度、速度和軌道；`動畫` 對應 `animationId`；`大小` 對應縮放和角度；`變形` 對應水平與垂直翻轉。媒體 URL、Filesystem 路徑和 IndexedDB key 不參與複製。
- `ItemSettingsCopy` 現在同時發送簡單分類 `copyFields` 和 PC 端可直接套用的展開字段 `fields`；現有 `desktop-runtime/main.js` 已支援 `fields`，本輪不需要修改 PC 端。
- 已用真實瀏覽器驗證 `1366x1024`、`1194x834`、`1024x768`：舞台、固定圖層和物件屬性面板等高，頁面無溢出；較小尺寸下圖層與工具內容改為內部滾動。
- 已驗證圖層拖曳後刷新仍保留排序，且媒體引用不變；已驗證只複製 `移動方式` 時，目標圖片、動畫、大小、角度和變形均不受影響。
- 本輪已執行並通過 `npm run build` 和 `npm run sync:ios`；最新 Web 資源已同步到 `ios/App/App/public`，Capacitor Filesystem 與 SPM 路徑修正均成功。
- `互動藝術` 的 11701 主題選擇、相機遮罩定位、遮罩合成和上載完成流程沒有改動。

### 2026-07-23 動態藝術動畫預覽改為即時小人預覽

本輪針對 `動態藝術` 控制頁的動畫工具做 UI 預覽升級：

- 新增 `src/components/DynamicAnimationPreview.tsx`，用 `user_landscape.png` 小人素材按 `animationId 0-9` 即時播放 CSS 預覽。
- `user_landscape.png` 已複製到 `public/AnimationPreview/user_landscape.png`，確保 Vite 與 Capacitor iOS 打包時可直接讀取。
- 控制頁動畫工具不再使用 `/animations/{id}.gif` 作為主預覽，改為 `DynamicAnimationPreview` 即時渲染。
- 動畫按鈕由純數字升級為繁體短標籤與輕量識別 icon：`無`、`呼吸`、`搖擺`、`閃爍`、`旋轉`、`彈跳`、`波動`、`翻轉`、`脈衝`、`組合`。
- 本輪只改 iPad 控制頁動畫預覽 UI，不改 `animationId`、`ItemAnimation` 發送格式、PC 端 `desktop-runtime` 動畫算法或上傳流程。

### 2026-07-22 動態藝術新接收端重同步

本輪針對「iPad 已有作品檔案和圖片，但切換到新 PC / 新 IP 後 PC 只顯示物件占位框」做接收端重同步：

- 新增 `src/services/dynamicArtReceiverSync.ts`，按 `IP:端口 + 作品檔案` 記錄同步狀態。
- 設定頁點擊 `保存` 時，會把目前 `動態藝術` 接收端標記為需要重同步；普通 `互動藝術` 上載頁臨時改 IP 不會觸發該標記。
- 進入 `動態藝術` 作品圖片頁或控制頁時，若當前接收端從未同步該作品檔案，或剛在設定頁保存過，會自動同步當前作品檔案。
- 同步流程為：先從 iPad 本地快取還原背景 / 物件素材文件，再按既有 multipart 方式重新上傳背景和圖片，最後發送完整 `GroupSelectAndSync`。
- 新增 `getDynamicMediaFile()`，可從 Capacitor Filesystem、IndexedDB 或目前媒體 URL 還原 `File`，用於換 PC 後重新上傳舊素材。
- 新增 `uploadUnityAssetAsync()`、`sendDynamicEventAsync()`，重同步時會等待素材上傳完成後再發完整組狀態，降低新 PC 收到參數但缺素材的占位問題。
- 重同步不因日常新增 / 替換圖片後的素材簽名變化自動全量重傳，避免每次編輯都重傳背景視頻；日常新增 / 替換仍走原本單素材上傳流程。
- 作品圖片頁和控制頁會顯示輕量狀態提示，例如 `正在同步圖片 2/6`、`作品檔案已同步` 或同步失敗提示。
- 本輪不改 PC 端 `desktop-runtime` 接收邏輯，不新增協議字段，只復用既有 multipart 素材上傳和 `GroupSelectAndSync`。
- 本輪已執行並通過：`npm run build`、`npm run sync:ios`。

### 2026-07-21 動態藝術控制頁物件尺寸對齊 / 圖層快速新增

本輪針對 `動態藝術` 控制頁修復 iPad 預覽與 PC 播放端物件大小不一致的問題，並補充圖層抽屜快速新增圖片入口：

- `DynamicMedia` 新增可選 `width` / `height` 元數據；新上傳圖片會讀取原始寬高並保存，舊快取圖片仍可繼續使用。
- 控制頁圖片載入後會以 `naturalWidth` / `naturalHeight` 補齊舊圖片尺寸，不需要清空 IndexedDB 或重新建立作品檔案。
- 控制頁物件基準尺寸改為對齊 PC 端 `desktop-runtime/renderer/player.js` 的規則：在 `1920x1080` 舞台中最長邊最大 `380`、最小 `120`，再依照 iPad 端當前 16:9 舞台比例換算。
- `item.scale` 仍只作為使用者雙指縮放倍率，不把尺寸修正寫入 `scale`，避免污染 PC 端已有控制參數。
- 控制頁右側圖層抽屜 `圖層` 標題行右上角新增 `+` 按鈕，可直接向當前作品檔案新增圖片；新增後沿用既有 `ItemCreate` 和 multipart 素材上傳流程。
- 本輪只改 `動態藝術` 控制頁預覽尺寸和圖層新增入口，不改 `互動藝術`、背景上載、PC 播放端尺寸算法或既有 Unity / PC 協議字段。
- 本輪已執行並通過：`npm run build`、`npm run sync:ios`。

### 2026-07-21 互動藝術相機 UI 實機修正

本輪根據 iPad 實機截圖修正 `互動藝術` 自定義相機頁視覺：

- 相機遮罩覆蓋層由 `object-fit: contain` 改為 `object-fit: cover`，確保遮罩圖鋪滿整個取景畫面。
- 遮罩導航欄收起時，抽屜主體完全移到屏幕外；屏幕內只保留底部中央一個小型拖拽把手。
- 遮罩導航欄仍支持點擊把手或上滑展開、下滑收起；展開後仍是橫向遮罩縮略圖選擇。
- `互動藝術` 相機頁不再使用底部兩個矩形按鈕；改為右上角圓形關閉按鈕和右側垂直中心的圓形快門按鈕。
- 快門按鈕只保留拍照視覺，不顯示 `PHOTO`、`1x` 或前後鏡頭切換。
- 本輪只改相機 UI，不改 11701 上傳端口、拍照 canvas 捕獲、遮罩定位或導出規則。
- 本輪已執行並通過：`npm run build`、`npm run sync:ios`。

### 2026-07-20 首頁 icon / 互動藝術上載頁 / 動態藝術建組背景流程

本輪根據實機反饋和 PC 端 `desktop-runtime` 接收邏輯調整三處：

- 首頁 `互動藝術` 入口 icon 改為 `public/MainIcon/Magic_floor_UI_art.png`，入口標題仍保留 `互動藝術`。
- 根目錄臨時加入的 `Magic_floor_UI_art.png` 已移入 `public/MainIcon/`，確保 Vite 和 Capacitor iOS 打包時能正確帶入資源。
- `互動藝術` 上載頁移除右側 `快速拍照上載` 視覺容器；左側 `+` 上載容器改為單列占滿所在行。
- `互動藝術` 拍照功能未刪除，仍從點擊 `+` 後的上載方式選單進入自定義相機遮罩定位流程。
- `動態藝術` 入口流程調整為先進 `作品檔案` 頁；即使當前沒有任何作品檔案，也不再先進 `draft` 背景上載頁。
- 新建作品檔案後，如果該作品檔案沒有背景，會先進 `背景上載` 頁；背景上載完成後才進入該作品檔案的圖片上載頁。
- 選擇既有作品檔案時，如果該作品檔案沒有背景，也會先進 `背景上載` 頁；已有背景的作品檔案仍直接進圖片上載頁。
- 已移除 iPad 端 `draftBackground` 建組鏈路，不再用 `groupId: "draft"` 上傳背景給 PC。
- `DynamicBackgroundPage` 現在必須綁定真實作品檔案 `group.id`。背景上載時本地使用 `setDynamicBackground(group.id, file)` 寫入，PC 端 multipart 欄位也使用同一個真實 `groupId`。
- 背景上載後會發送 `MF|DynamicArt|BackgroundSet|{"groupId","assetId","activeBackgroundId","name","mediaType","mimeType"}`，其中 `groupId` 為真實作品檔案 ID，對齊 `desktop-runtime/main.js` 的 `BackgroundSet` 和 multipart `role=background` 接收方式。
- 背景上載頁點擊 `下一步` 時，會發送 `MF|DynamicArt|GroupSelectAndSync|...`，payload 帶 `groupId`、作品檔案名稱、出現方式、目前背景、背景列表和物件列表；PC 端 `desktop-runtime/main.js` 會把該作品檔案設為 `activeGroupId`，避免新建作品檔案上載背景後 PC 端沒有直接切入該組。
- `互動藝術` 點擊 `+` 後的三項選單中，`相簿` / `拍照` / `選擇檔案` 使用同一個中性按鈕樣式，不再給中間 `拍照` 單獨做強調色。
- `互動藝術` 自定義相機頁已改為全屏取景：隱藏頂部欄，取景視頻 full-bleed 鋪滿畫面，底部只保留懸浮操作和遮罩抽屜。
- 相機遮罩選擇改為底部抽屜形態：默認只露出把手，上滑或點擊把手展開遮罩縮略圖，下滑收起；遮罩仍只用於拍照定位，不會寫入相機原圖。
- 本輪已執行並通過：`npm run build`、`npm run sync:ios`。

### 2026-07-16 Git 備份與互動藝術拍照遮罩定位

本輪先處理 GitHub 推送失敗問題，再修改 `互動藝術` 快速上載的拍照流程。

- 已將推送失敗的原因定位為 `desktop-runtime/node_modules` 和 `desktop-runtime/release` 內含 100MB 以上 exe / Electron 產物。這些目錄已從 Git 索引移除，本地檔案保留不刪除。
- 新增 `.gitignore` 忽略 `desktop-runtime/node_modules/` 和 `desktop-runtime/release/`。
- 已 amend 並成功推送備份到 GitHub：`main` 最新提交為 `07f6e71b 7.16动态艺术完善`。
- `UploadPage.tsx` 的 `互動藝術` 上載入口改為應用內三項選單：`相簿`、`拍照`、`選擇檔案`。
- `拍照` 不再走 iOS 原生 file input 的相機入口，而是走專案內 `getUserMedia` 自定義相機預覽，因為原生相機畫面無法被 WebView 疊加遮罩。
- `互動藝術` 拍照預覽頁新增遮罩覆蓋層與橫向遮罩縮略圖選擇；遮罩只用於定位，不會寫入相機畫面，也不會進入 canvas 捕獲。
- 拍照完成後仍進入既有遮罩對齊頁，可繼續縮放 / 拖曳圖片做位置調整。
- 導出規則已更新：`互動藝術` 的 `相簿` / `拍照` / `選擇檔案` 最終上傳 PNG 都會合成當前選中遮罩；拍照遮罩仍只用於取景定位，不寫入相機捕獲原圖。
- `互動藝術` 相關頁面已移除右上角 `wsIp:11701` 顯示，不再在頁面上暴露 IP；IP 和 11701 端口繼續由 `設定` 頁統一管理。
- `拍照` 按鈕原本無反應的原因是相機流在條件渲染前就被讀取；目前改為先進入相機頁，再由 `useEffect` 把 `getUserMedia` 取得的 stream 綁到 `<video>`，並使用 `playsInline / muted / autoPlay` 提高 iPad WebView 相容性。相機請求會優先使用後置鏡頭，失敗時回退到普通 `video: true`。
- 本輪已執行並通過：`npm run build`、`npm run sync:ios`。

### 2026-07-15 動態藝術控制頁參數持久化與復用媒體修復

本輪針對兩個控制頁 BUG 做修復：重新打開 App 後物件位置 / 大小 / 旋轉 / 動畫 / 移動等參數可能回到默認值，以及使用 `復用` 後背景、作品檔案縮略圖、物件圖片顯示成問號。

- 控制頁拖拽與雙指縮放 / 旋轉時，新增 `180ms` 節流保存，不再只依賴鬆手時保存，降低 iPad WebView 漏掉 `pointerup` 時參數未落盤的風險。
- 控制頁離開或手勢結束時會強制 flush 當前作品檔案狀態到本地快取。
- `upsertDynamicGroup` 保存作品檔案時會保留舊快取內的 `filePath` / `storageKey`，避免 UI 層更新參數時把媒體持久化引用覆蓋掉。
- `saveDynamicGroups` 寫入 localStorage 前會剔除所有媒體 `url`，只保留 `filePath` / `storageKey` 等持久化引用。這是關鍵修復：iPad 上 hydrate 後的 `url` 可能是很大的 base64 data URL，若直接寫入 localStorage 會超出容量，導致位置、縮放、旋轉、動畫、移動和復用參數實際沒有保存。
- `loadDynamicGroups` 啟動讀取舊資料後會立即重寫一份精簡快取，用於清掉歷史資料裡已經寫入的巨大 `url`。
- `復用` 現在基於控制頁當前已載入的作品檔案狀態複製參數，保存後會重新 hydrate 媒體 URL 再回傳給 UI，避免直接把過期 `blob:` URL 塞回畫面導致圖片變問號。
- `復用` 仍只復用控制參數，不替換物件本身圖片；媒體資源引用會保持原物件、背景、縮略圖各自獨立。

### 2026-07-15 動態藝術物件變形工具

本輪在 `動態藝術` 控制頁左 / 右側工具欄新增 `物件變形` 頁籤，提供 `水平翻轉` 和 `垂直翻轉` 兩個開關。

- `DynamicItem` 新增 `flipX` / `flipY`，舊本地快取載入時會自動補為 `false`。
- 新建物件默認 `flipX = false`、`flipY = false`。
- 前端舞台預覽會把翻轉合入圖片 transform：水平翻轉對應 `scaleX(-1)`，垂直翻轉對應 `scaleY(-1)`。
- 每次勾選或取消勾選都會發送 `MF|DynamicArt|ItemDeform|{"groupId","itemId","flipX","flipY"}`。
- `GroupStateSync` 會帶 `flipX` / `flipY`，方便重新進入控制頁或 Unity 重建場景。
- `復用` 會一併復用 `flipX` / `flipY`，並在復用後補發 `ItemDeform`。
- `UNITY_INTERACTION.md` 已同步新增 `ItemDeform` 說明。

### 2026-07-15 動態藝術左右波浪簡化軌跡

本輪摒棄上一版的軌道切換暫停、吸附和 `top` 過渡方案。`左移` / `右移` 現在使用最簡單的畫布軌跡：`movePercent = 0` 時按目前 `track` 做直線左右橫移；`movePercent > 0` 時波浪固定以 16:9 畫布中心線為中心，不再受 `track` 高度影響。

- 已移除 `is-track-switching`、`TRACK_SWITCH_TRANSITION_MS` 和相關 timer。
- 已移除上一版 `.dynamic-stage-item-motion` 的 `top 180ms linear` 過渡，避免軌道變更本身參與波浪視覺。
- `movePercent = 50` 時在畫布中部上下小幅波浪。
- `movePercent = 100` 時上下波浪幅度為畫布高度的 `50%`，也就是最高 / 最低點。
- 只要 `movePercent > 0`，切換 `上` / `中` / `下` 不會改變前端左右波浪的垂直基準點。
- `moveSpeed` 仍只控制循環速度；Unity 協議不新增字段。

### 2026-07-15 動態藝術左右波浪密度修正

本輪把控制頁 `左移` / `右移` 的前端預覽拆成兩層動畫：外層只做左右線性橫移，內層單獨做上下波浪。內層已改為線性多點採樣，移除 `ease-in-out`，避免波峰或波谷處產生停頓感；目前約為每次橫穿 `8` 個完整波形。

- `movePercent` 仍控制上下波浪幅度，`moveSpeed` 仍控制整體橫移速度。
- `HORIZONTAL_WAVE_CYCLES = 8` 只影響前端預覽節奏，不新增 Unity 協議字段。
- `UNITY_INTERACTION.md` 已補充：Unity 端如需對齊前端效果，可按一次橫穿 8 個完整波形處理，波形採用線性多點採樣。

### 2026-07-15 動態藝術左右波浪移動幅度

本輪把控制頁 `左移` / `右移` 從純直線循環改為可調幅度的水平波浪移動，並沿用既有 `ItemMotion.percent` 欄位，不新增 Unity 協議字段。

- `移動` 工具頁籤在 `左移` / `右移` 下也會顯示 `幅度` 滑桿。
- `movePercent = 0` 時維持當前基準線直線左右循環。
- 目前 `movePercent > 0` 時固定按完整 16:9 畫布中心線計算波浪；`track` 只影響 `0%` 直線所在高度。
- `moveSpeed` 仍只控制循環速度；`UNITY_INTERACTION.md` 已同步更新 `ItemMotion` 說明。

### 2026-07-15 首頁入口控制台化 / 動態藝術長按預覽

本輪將首頁從左右兩個半屏大卡片改為更緊湊的 iPad 控制台入口：`動態藝術` / `互動藝術` 仍只保留標題和 icon，但入口卡片不再各占半屏，而是以中間 Dock 式雙入口呈現，背景加入非常輕的舞台網格質感，默認狀態不再出現強選中邊框。

- `EntryPage` 新增 `dynamicGroups` 入參，只用於首頁預覽，不改動 `動態藝術` / `互動藝術` 的原有跳轉流程。
- 普通點擊 `動態藝術` 仍然進入原流程；長按 `動態藝術` 會在該入口左下方彈出作品檔案氣泡預覽。
- 氣泡預覽會顯示最多 4 個作品檔案，每個檔案顯示縮略圖 / 背景 / 首張圖片作為主圓形縮略圖，並在下方顯示最多 5 張檔案內圖片小氣泡。
- 點擊某個作品檔案氣泡會直接選中該檔案並進入其圖片上載頁，不需要先進作品檔案列表。
- 氣泡預覽容器會根據作品檔案數量自動調整寬度；內容超出最大安全寬度時改為橫向滾動。
- 如果尚未建立作品檔案，長按會顯示 `新作品檔案` 的空狀態氣泡。
- 長按展開後會抑制當次 click，避免 iPad 長按後誤進入下一頁；再次普通點擊仍可正常進入。

### 2026-07-15 動態藝術預覽模式 / 出現間隔 / 全局點擊音效

本輪把控制頁拆成明確的編輯態和預覽態：默認進入控制頁時所有圖片保持靜止，方便雙擊打開工具欄、單指拖拽、雙指縮放旋轉。點擊頂部 `預覽` 後才播放已設定的移動方式；再次點擊 `停止預覽`，或在預覽中點擊舞台，會退出預覽並回到靜止編輯態。

- `逐個出現` / `全部出現` 保留為出現方式切換，新增 `間隔` 滑桿，範圍為 `100ms` 到 `5000ms`，默認 `800ms`。
- 預覽模式中，`逐個出現` 會按圖層排序依照間隔淡入；`全部出現` 會同時淡入，不使用間隔。
- 預覽模式下會隱藏並禁用圖層抽屜、圖片控制工具欄和背景素材面板；點擊舞台會退出預覽，回到可編輯狀態。
- 預覽模式中點擊 `逐個出現` 或 `全部出現` 會重新播放一次預覽動畫；前端會遞增 `PreviewMode.replayId`，Unity 端可用它判斷是否需要從頭播放。
- `DynamicGroup` 新增 `appearIntervalMs`，舊本地快取載入時會自動補默認值，不需要清空資料。
- 協議更新：`GroupAppearMode` 新增 `intervalMs`，`GroupStateSync` 新增 `appearIntervalMs`，並新增 `PreviewMode` 事件告知 Unity 目前是否進入預覽；`PreviewMode` 會帶 `replayId`。
- 按鈕點擊音效從控制頁局部邏輯抽出到 `src/services/uiFeedback.ts`，由 `App` 根節點統一處理全站按鈕點擊；復用成功仍保留成功音，但復用來源按鈕標記為靜音，避免一次點擊響兩次。

### 2026-07-15 動態藝術 360 回環橫向橢圓

本輪把 `360回環` 的前端預覽軌跡從偏縱向橢圓調整為偏橫向橢圓。中心點、幅度、速度和聚焦暫停規則不變：中心仍是圖片當前 `position`，`movePercent` 控制範圍，`moveSpeed` 控制速度；靠近左右邊緣時會略微收窄橫向半徑，避免預覽大面積離開舞台。

### 2026-07-15 動態藝術移動預覽暫停規則

本輪修正控制頁移動預覽體驗：`360回環` 預覽動畫改為線性播放，避免每段 keyframe 緩入緩出造成停頓感。雙擊圖片打開工具欄時，該圖片只暫停前端預覽並回到真實放置點，不改 `moveMode`、不發送停止移動指令；點擊舞台空白處關閉工具欄或切換聚焦物件後會恢復預覽。切換移動方式、幅度、速度仍會立即更新本地狀態並發送 `ItemMotion`。

### 2026-07-15 動態藝術 360 回環錨點修正

本輪修正 `360回環` 的運動定義：回環中心固定為圖片當前放置點，也就是 `position`，不是舞台中心或軌道中心。`50%` 幅度只在當前軌道內環繞，`100%` 幅度會以該放置點為中心擴大到可覆蓋上中下三段軌道。前端預覽改為 16 點橢圓採樣並保留近大遠小效果，相關協議說明已同步到 `UNITY_INTERACTION.md`。

### 2026-07-15 動態藝術移動參數拆分

本輪把 `動態藝術` 控制頁的移動參數拆開：

- `movePercent` 只表示移動幅度或範圍，`moveSpeed` 只表示速度。
- `左移` / `右移` 目前同樣使用幅度滑桿；幅度控制水平波浪上下起伏，速度滑桿只控制循環速度。
- `上下` 移動改為從當前位置出發的純垂直循環，`50%` 只在當前軌道內移動，`100%` 可往上下出屏並循環。
- `360回環` 改為平滑橢圓軌跡，並加入近大遠小的縮放表現。
- `ItemMotion`、`ItemSettingsCopy` 和 `GroupStateSync` 已同步補上 `speed` 欄位，方便 Unity 端直接接入。

### 2026-07-15 動態藝術控制頁 / 軌道與移動預覽

本輪針對 `動態藝術` 控制頁補齊移動軌道、面板互斥和舞台動畫預覽：

- `DynamicItem` 新增 `moveTrack`，可選值為 `top` / `middle` / `bottom`；舊本地快取載入時會依照物件目前 Y 座標自動補齊，不需要清空使用者資料。
- 移動工具頁籤新增 `軌道` 選擇，按鈕為 `上` / `中` / `下`。手動切換軌道時只改 Y 座標到軌道中心，X 座標保持不變；軌道中心分別為上 `1/6`、中 `1/2`、下 `5/6`。
- 單指拖曽物件時會即時更新 `position`、`gridIndex` 和 `moveTrack`；雙指縮放/旋轉仍只影響 `scale` / `rotation`，不改軌道。
- `復用` 參數已包含 `moveTrack`。復用後會套用來源物件的動畫、移動方式、移動百分比、縮放、旋轉和軌道；目標物件 X 不變，Y 會移到來源軌道中心。
- 控制頁舞台新增移動預覽：`上下` 會以波浪方式上下擺動，`左移` / `右移` 會沿所選軌道循環，`360回環` 會做橢圓近大遠小預覽，`隨機` 會做範圍漂移。這些是前端預覽動畫，不改變儲存參數本身。
- 拖曳或雙指操作時，該物件會暫停預覽動畫並回到真實位置，避免動畫干擾手勢命中和座標計算。
- 右側圖層抽屜和物件工具欄改為互斥：打開圖層會收起工具欄；雙擊物件或從圖層選中物件打開工具欄時會收起圖層。
- 雙擊物件打開工具欄時會依照物件 X 座標決定彈出方向：物件在右側時工具欄從左側彈出，物件在左側或中間時從右側彈出。
- 動態藝術協議文件 `UNITY_INTERACTION.md` 已同步更新：`ItemMotion` 使用正式 `track`，`ItemSettingsCopy` 增加 `moveTrack`，`GroupStateSync` 物件狀態增加 `moveTrack`。

### 2026-07-14 动态艺术流程 / 控制页交互修正

本轮针对新版 `動態藝術` 做了控制页交互细化：

- `作品檔案` 卡片新增长按菜单：
  - 单点卡片仍然进入檔案内图片上传页。
  - 长按卡片会呼出 iOS 毛玻璃菜单。
  - 菜单包含 `編輯作品檔案` 和 `刪除作品檔案`。
  - 右键同样可呼出菜单，方便桌面浏览器调试。
- `編輯作品檔案` 复用新建檔案的右侧弹窗样式，可修改檔案名称和缩略图。
- 删除作品檔案会清理该檔案本地缓存素材，包括缩略图、背景素材和檔案内图片；App 状态会同步移除该檔案。
- 新增动态艺术协议事件：
  - `GroupUpdate`：编辑作品檔案后发送。
  - `GroupDelete`：删除作品檔案后发送。
- 控制页顶部的 `逐個出現` / `全部出現` 已从右侧普通按钮组拆出，作为左侧独立的 `出現方式` 状态切换块；协议仍使用原来的 `GroupAppearMode`，未新增 `isTrigger` 或其他触发字段。
- `作品圖片` 页交互调整为和 `作品檔案` 页一致：
  - 点击 `+` 不再直接弹系统选图，而是从右侧滑出 `新增物件` 面板。
  - `新增物件` 面板支持先上载图片、预览图片、填写物件名称，再点击 `建立`。
  - 点击已有物件卡片会直接进入控制页，并默认选中该物件。
  - 长按物件卡片会呼出 iOS 毛玻璃菜单，菜单包含 `編輯物件` 和 `刪除物件`。
  - `編輯物件` 使用右侧面板，可改名称，也可替换图片；替换图片时保留该物件原有位置、缩放、旋转、动画和移动参数。
  - 新增 `ItemUpdate` 协议事件，用于同步物件改名或替换图片。
- `動態藝術` 入口会先读取本地作品檔案缓存：
  - 如果没有任何作品檔案，进入 `背景上載`，用于首次建立檔案前准备背景。
  - 如果已经存在作品檔案，直接进入 `作品檔案` 列表，跳过 `背景上載`。
- `作品檔案` 页返回目标会根据进入来源判断：
  - 首次背景流程进入时，可返回 `背景上載`。
  - 已有檔案直接进入时，返回首页。
- 控制页右侧图层抽屉关闭时，内容完全移出屏幕，只保留可点击 / 可拖动的把手，避免缩略图列表露出一截。
- 控制页按钮增加按压视觉反馈和轻量点击音效；音效由 WebAudio 在用户点击时生成，不依赖额外音频文件。
- 控制页危险按钮使用较低音色，普通按钮使用轻点击音，复用成功使用更明确的成功提示音。
- 打开 `選擇背景` 或 `新增背景` 时，会收起左侧图片工具栏，避免多个控制面板叠在一起。
- 双击图片打开左侧工具栏时，会自动收起背景素材面板。
- `復用` 参数成功后会给出 UI 反馈：
  - 来源图片按钮短暂高亮。
  - 舞台目标图片短暂描边闪动。
  - 工具栏显示 `已套用參數`。
  - 约半秒后左侧工具栏自动收起，并回到 `移動` 页签。

### 2026-07-14 新版动态艺术 UI / 功能架构

本轮开始将原 `作品控制上載` 入口升级为新版 `動態藝術` 创作流程，`互動藝術` 暂时保持原快速上传流程。

新增/调整内容：

- 首页 `EntryPage` 改为极简双入口，只显示：
  - `動態藝術`
  - `互動藝術`
- 首页移除左侧视频预览、端口号和描述文案。
- 首页入口使用旧版图标：
  - `動態藝術`：`/MainIcon/8080.png`
  - `互動藝術`：`/MainIcon/畫境成真.png`
- 右上角新增齿轮 SVG 设置按钮，打开 `SettingsPanel`。
- 设置页集中管理：
  - `藝術畫廊 IP`
  - `動態藝術端口`，默认 `8080`
  - `互動藝術端口`，默认 `11701`
- `互動藝術` 继续走：

```text
entry -> directSelect -> upload(direct) -> directComplete
```

- `動態藝術` 新流程为：

```text
entry -> dynamicBackground -> dynamicGroups -> dynamicItems -> dynamicControl
```

新增文件：

- `src/components/SettingsPanel.tsx`
- `src/components/DynamicBackgroundPage.tsx`
- `src/components/DynamicGroupsPage.tsx`
- `src/components/DynamicItemsPage.tsx`
- `src/components/DynamicControlPage.tsx`
- `src/services/dynamicArtStorage.ts`
- `src/services/unityBridge.ts`
- `UNITY_INTERACTION.md`

新版动态艺术能力：

- 背景页支持图片 / 视频背景上载，预览区域固定 16:9。
- `作品檔案` 通过小方块 `+` 创建，支持檔案名稱和缩略图。
- 档案内图片通过小方块 `+` 上传，每个作品檔案最多 `30` 张。
- 档案内图片长按可删除。
- 有图片时才显示 `進入控制頁`。
- 控制页舞台固定 16:9。
- 控制页支持多图片单指拖动、双指缩放、双指旋转。
- 右侧图层抽屉默认收起，可通过右侧把手呼出；抽屉内可选中图片、复用参数、删除图片。
- 控制页图片双击 / 双击触控后，从左侧呼出工具栏；工具栏默认隐藏。
- 左侧工具栏包含 `移動`、`動畫`、`大小`、`復用` 四个页签。
- 动画页签使用 `0 - 9` 按钮选择动画，并在下方显示当前 `/animations/{id}.gif` 预览，不同时铺满十个 GIF。
- 顶部支持 `逐個出現` / `全部出現` 互斥模式。
- 顶部支持 `選擇背景` 和 `新增背景`。
- 背景素材跟随当前作品檔案保存；初始背景和后续新增背景都会进入该檔案的背景素材库。
- 背景素材库支持切换当前背景、单选 / 多选、批量删除；删除当前背景后会自动切到剩余背景。
- 移动方式包含：
  - `停止`
  - `上下`
  - `左移`
  - `右移`
  - `360回環`
  - `隨機`
- 每张图片会保存：
  - 位置 / 网格坐标
  - 缩放
  - 旋转
  - 动画 ID
  - 移动方式
  - 移动百分比
  - 显示顺序
- 每个作品檔案会保存：
  - 名称 / 缩略图
  - 出现方式
  - 背景素材列表
  - 当前激活背景 ID
  - 所属图片及每张图片的控制参数
- 新版动态艺术数据使用 `magicfloor_dynamic_groups_v1` 和 `magicfloor_dynamic_media`，与旧 `artlab_ip_thumbnails` / `artlab_artwork_cache` 解耦。
- 新版 Unity 交互统一通过 `src/services/unityBridge.ts` 发出。
- Unity 端落地文档见 `UNITY_INTERACTION.md`。

### 2026-07-14 大改前可用功能基线

用户确认当前版本在功能层面已经跑通，后续将进行较大范围 UI / 功能重构。以下内容作为“大改前可复用基线”，重构时要优先保留、迁移或明确替换，避免把已经打通的接收端协议和本地缓存链路改坏。

#### 入口和页面流程

当前入口页是 `EntryPage`，分为两条流程：

- `作品控制上載`：`entry -> home -> upload(control) -> edit`
- `快速拍照上載`：`entry -> directSelect -> upload(direct) -> directComplete`

页面状态定义在 `src/App.tsx`：

```ts
type Page = 'entry' | 'home' | 'upload' | 'edit' | 'directSelect' | 'directUpload' | 'directComplete'
```

#### 端口和接收端

端口常量在 `src/services/networkConfig.ts`：

```ts
CONTROL_PORT = 8080
DIRECT_UPLOAD_PORT = 11701
```

- 原作品控制流程固定走 `8080`。
- 快速拍照上載流程固定走 `11701`。
- 客户可见 UI 不出现 `Unity` 字眼，统一显示 `藝術畫廊`。
- 技术交接中可说明实际接收端是 Unity，但不要把 `Unity` 放回界面文案。

#### 作品控制上載基线

相关文件：

- `src/components/HomePage.tsx`
- `src/components/UploadPage.tsx`
- `src/components/EditPage.tsx`
- `src/services/artworkStorage.ts`

当前已跑通能力：

- 首页 20 个作品槽位。
- 点击槽位发送 `GameObject:{index}`。
- 空槽位进入上传页；已有缓存槽位直接进入控制页。
- 上传页可选择图片或保留相机能力，套用原 `MaskTexture` 遮罩。
- 原控制上传遮罩仍使用 `destination-out` 逻辑，不要被快速上传的可见遮罩逻辑污染。
- 上传成功后缓存图片和缩略图，然后进入控制页。
- 控制页可移动图片，并实时发送网格坐标。
- 控制页支持双指缩放、双指旋转、滑条和按钮微调。
- 控制页支持动画选择，并播放 `/animations/0.gif` 到 `/animations/9.gif` 示例。
- 控制页支持场景切换、水平翻转、释放物件。
- 控制页支持删除当前槽位：发送 `GameObjectDelete:{index}`，清除该 IP 下该槽位缓存，并返回首页。

#### 快速拍照上載基线

相关文件：

- `src/components/DirectUploadSelectPage.tsx`
- `src/components/UploadPage.tsx`
- `src/components/DirectUploadCompletePage.tsx`
- `src/services/directUploadThemes.ts`

当前已跑通能力：

- 入口进入快速上传后，先选择主题。
- 主题为 `魔幻森林1`、`魔幻森林2`、`畫境成真`、`美麗海洋`。
- `魔幻森林1 / 魔幻森林2` 使用 A 组遮罩。
- `畫境成真` 使用 B 组遮罩。
- `美麗海洋` 使用 C 组遮罩。
- 遮罩来源为 `/Mask/`，旧 `DirectMaskTexture` 不再作为当前快速上传来源。
- 快速上传没有“無”遮罩选项，默认使用当前主题对应分组的第一个遮罩。
- 快速上传遮罩按原图比例完整显示，不使用 `cover` 裁切。
- 快速上传最终发送的是“用户图片 + 可见遮罩”的完整合成 PNG。
- 快速上传发送到 `11701`，成功后进入完成页。
- 快速上传不进入控制页，也不写入 20 格作品缓存。

#### 当前 HTTP 信号基线

所有控制信号均为 `POST text/plain`。

| 功能 | 端口 | 信号格式 | 示例 |
| --- | --- | --- | --- |
| 选择作品槽位 | `8080` | `GameObject:{index}` | `GameObject:3` |
| 上传控制作品图片 | `8080` | `multipart/form-data`，字段 `file/name/question`，可带 `audio` | 图片文件 |
| 快速拍照上載图片 | `11701` | `multipart/form-data`，字段 `file/name/question` | 合成 PNG |
| 实时移动 / 重置位置 | `8080` | `{gridIndex}` | `72` |
| 缩放 | `8080` | `{imageName}_Scale:{value}` | `photo.png_Scale:1.5` |
| 旋转 | `8080` | `{imageName}_Rotate:{degrees}` | `photo.png_Rotate:45.0` |
| 动画 | `8080` | `{imageName}:{animationId}` | `photo.png:4` |
| 水平翻转 | `8080` | `{imageName}_Flip:{true|false}` | `photo.png_Flip:true` |
| 释放物件 | `8080` | `{imageName}_Release:{true|false}` | `photo.png_Release:false` |
| 场景 | `8080` | `Bg:{Fish|People|Other}` | `Bg:Fish` |
| 删除作品槽位 | `8080` | `GameObjectDelete:{index}` | `GameObjectDelete:7` |

当前节流规则：

- 移动网格坐标：约 `90ms`
- 缩放：约 `120ms`
- 旋转：约 `120ms`

#### 本地缓存和资源基线

当前缓存策略：

- 最近一次 IP 保存在 `artlab_last_ws_ip`。
- 作品槽位索引、缩略图、文件路径或 IndexedDB key 保存在 `artlab_ip_thumbnails`。
- Web fallback 图片 Blob 存在 IndexedDB：`artlab_artwork_cache`。
- iOS/Capacitor 优先使用 `@capacitor/filesystem` 写入 App 沙盒目录。
- `removeArtworkFromIp(ip, index)` 只删除当前 IP 下的指定槽位，不影响其它 IP 或其它槽位。

当前关键资源：

- `/MainIcon/`：入口和快速上传主题图。
- `/MaskTexture/`：原作品控制上传遮罩。
- `/Mask/`：快速上传 A/B/C 新遮罩。
- `/animations/0.gif` 到 `/animations/9.gif`：控制页动画示例。
- `fish.mp4`、`people.mp4`：首页/控制页视频背景和场景。

#### 大改注意事项

- 后续 UI 可以重做，但上面的端口、信号格式和缓存边界需要保留，除非 Unity 接收端同步改协议。
- 不要把快速上传的可见遮罩合成逻辑套到 `mode="control"`。
- 不要让快速上传写入 20 格作品缓存。
- 不要让原控制上传使用快速上传 `/Mask/` 遮罩，除非明确要合并遮罩体系。
- 不要改动现有 localStorage key，除非提供迁移逻辑，否则旧设备上的 IP 记忆和作品缓存会丢。
- 后续如果重构组件，建议先抽协议层和缓存层，再重做 UI，这样最不容易损坏已经跑通的功能。

### 2026-07-09 UI / 品牌 / 文案调整

本轮最新界面要求已经落地：

- 用户可见品牌从 `Art Lab` / `ART LAB` 改为 `MagicFloor`。
- 用户界面不再出现 `Unity` 字眼，统一改为繁体显示的 `藝術畫廊`。
- 用户界面静态文案已转为繁体中文，例如 `上传` 改为 `上載`、`发送` 改为 `發送`、`选择` 改为 `選擇`、`无` 改为 `無`。
- 入口页右上角原 `共用 Unity IP` 状态容器已隐藏/移除。
- IP 输入框 placeholder 从 `Unity IP` 改为 `藝術畫廊 IP`。
- 浏览器标题 `index.html` 已改为 `MagicFloor`。
- `capacitor.config.ts` 中 `appName` 已改为 `MagicFloor`。
- `ios/App/App/Info.plist` 中 App 显示名和相机、相册、麦克风权限说明已改为 `MagicFloor` 与繁体中文。
- 内部缓存 key 暂时保留 `artlab_last_ws_ip`、`artlab_ip_thumbnails`、`artlab_artwork_cache`，避免旧设备上的 IP 记忆和作品缓存失效。

涉及文件：

- `src/App.tsx`
- `src/components/EntryPage.tsx`
- `src/components/HomePage.tsx`
- `src/components/UploadPage.tsx`
- `src/components/DirectUploadCompletePage.tsx`
- `src/components/EditPage.tsx`
- `index.html`
- `capacitor.config.ts`
- `ios/App/App/Info.plist`

### 2026-07-09 快速上传遮罩合成修正

快速拍照上載流程现在发送的是“完整图片 + 可见遮罩”的最终合成 PNG，不再只是遮罩内的内容。

实现位置：`src/components/UploadPage.tsx` 的 `handleScreenshotAndUpload()`。

当前规则：

- `mode="direct"` 快速上传：遮罩舞台会读取当前遮罩原图宽高比，并在可用区域内按原始比例完整显示，避免 `cover` 放大裁切。
- `mode="direct"` 快速上传：先绘制用户图片，再用 `source-over` 绘制快速上传遮罩，因此最终 PNG 包含遮罩本身。
- `mode="direct"` 快速上传：最终导出 PNG 直接把完整遮罩绘制到同宽高比画布上，预览和发送结果保持一致。
- `mode="control"` 原控制上传：继续使用旧逻辑，遮罩仍按 `destination-out` 处理，不改变原控制流程。

这次修正只影响快速上載 `11701` 流程，不影响原作品控制上載 `8080` 流程。

### 2026-07-09 构建与同步状态

最近一次已验证：

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
- Web 预览 `http://localhost:5173/` 可访问。

注意：当前开发过程中 `node_modules/.vite/deps` 会产生 Vite 缓存变化，这些不是功能修改，提交时不要纳入。

### 2026-07-09 快速上載主题选择 / 新遮罩 / 上传页手势

本轮新增快速上載主题选择页，并替换快速上載遮罩来源：

- 入口页两个主入口已加入图标：
  - `8080` 使用 `/MainIcon/8080.png`
  - `11701` 使用 `/MainIcon/畫境成真.png`
- 快速上載入口不再直接进入上传页，而是先进入 `DirectUploadSelectPage`。
- 快速上載四个主题使用图片文件名作为显示名称：
  - `魔幻森林1`
  - `魔幻森林2`
  - `畫境成真`
  - `美麗海洋`
- 主题配置集中在 `src/services/directUploadThemes.ts`。
- 快速上載遮罩完全改用 `/Mask/` 目录，不再引用旧 `DirectMaskTexture`。
- 遮罩分组规则：
  - `魔幻森林1` / `魔幻森林2`：使用 A 开头遮罩。
  - `畫境成真`：使用 B 开头遮罩。
  - `美麗海洋`：使用 C 开头遮罩。
- 上传页遮罩选择器已改为带缩略图和当前遮罩预览，原控制上传和快速上載共用这套预览 UI。
- 上传页遮罩对齐阶段新增双指缩放用户图片：
  - 单指拖动：移动用户图片。
  - 双指捏合：缩放用户图片。
  - 缩放只作用于用户图片，不作用于遮罩。
  - Canvas 导出时也使用相同缩放值，保证预览与最终发送图一致。

新增/更新资源目录：

```text
public/MainIcon/
  8080.png
  畫境成真.png
  美麗海洋.jpg
  魔幻森林1.jpg
  魔幻森林2.jpg

public/Mask/
  A-02.png
  A-03.png
  A-05.png
  A-06.png
  B-01_revised.png ... B-08_revised.png
  C-01.png ... C-09.png
```

## 0. 重要备份点

本轮动态艺术 UI/UX 重构前的远端备份：

- 备份提交：`bf6fe35a`，提交名：`7.23beifen`
- 备份标签：`backup-before-dynamic-ui-redesign-20260723`
- 已推送：`origin/main` 和 `origin/backup-before-dynamic-ui-redesign-20260723`

该标签是当前整套已跑通功能的最新改版前基线。需要回退时应先保存当前工作树，再从该标签新建分支或恢复；不要在存在未提交改动时直接执行破坏性重置。

在本轮新增快速上传流程前，已经先做了 Git 备份并推送到远端：

- 备份提交：`53d8086`，提交名：`7.7备份`
- 备份标签：`backup-before-direct-upload-20260707`
- 已推送：`origin/main` 和 `origin/backup-before-direct-upload-20260707`

需要回退到本轮修改前时，可回到这个标签。注意：`git reset --hard backup-before-direct-upload-20260707` 会丢弃当前未保存改动，执行前必须确认。

## 1. 项目定位

这是一个 iPad 横屏为主的 React + TypeScript + Vite + Capacitor iOS 项目，用于通过 HTTP 与实际接收端通信。技术交接里可继续称接收端为 Unity，但客户可见 UI 必须显示为 `藝術畫廊`，不要出现 `Unity` 字眼。

核心能力：

- 图片通过 HTTP 上传到实际接收端。
- 上传前可套用遮罩并导出 PNG。
- 原控制流程上传后进入控制页，可移动、缩放、旋转、水平翻转、释放物件、选择动画、切换场景。
- 新增快速上传流程只负责上传图片，不进入控制页。
- 接收端不在本项目内，前端只负责发 HTTP 请求。

## 2. 当前页面流程

当前 App 的页面状态定义在 `src/App.tsx`：

```ts
type Page = 'entry' | 'home' | 'upload' | 'edit' | 'directSelect' | 'directUpload' | 'directComplete'
```

### 新入口页

文件：`src/components/EntryPage.tsx`

入口页是现在 App 的首页，用于区分两套功能：

- `作品控制上載`：进入原 20 格作品槽位流程，端口 `8080`。
- `快速拍照上載`：进入新增快速上传流程，端口 `11701`。

入口页和两个流程共用同一个目标 IP，界面显示为 `藝術畫廊 IP`。IP 会通过 `saveLastWsIp()` 保存，下次打开软件自动使用上一次 IP；默认 IP 在 `src/services/appSettings.ts` 里。

### 原作品控制上載流程

页面顺序：

```text
EntryPage -> HomePage -> UploadPage(mode="control") -> EditPage
```

用途：

- 首页显示 20 个作品槽位。
- 点击槽位会发送 `GameObject:{index}` 到实际接收端。
- 如果本地已有该槽位图片缓存，直接进入控制页。
- 如果没有缓存，进入上传页。
- 上传成功后进入控制页。

端口：`8080`
端口常量：`src/services/networkConfig.ts` 中的 `CONTROL_PORT`

### 新快速拍照上載流程

页面顺序：

```text
EntryPage -> DirectUploadSelectPage -> UploadPage(mode="direct") -> DirectUploadCompletePage
```

用途：

- 直接选择图片或拍照。
- 先选择快速上載主题，再按主题使用 A/B/C 分组遮罩生成 PNG。
- 发送到 `11701` 端口，界面文案显示为发送到 `藝術畫廊`。
- 上載完成后进入“上載完成”页。
- 不进入控制页。
- 不写入 20 格作品缓存，不污染原作品控制流程。

端口：`11701`
端口常量：`src/services/networkConfig.ts` 中的 `DIRECT_UPLOAD_PORT`

## 3. HTTP 协议和接收端信号

### 图片上传

使用 `XMLHttpRequest`，`POST multipart/form-data`。

FormData 字段：

- `image`：图片文件。
- `audio`：仅原控制上传流程可能携带，快速上传流程不携带。

发送位置：

- 原控制上載：`http://{ip}:8080`
- 快速拍照上載：`http://{ip}:11701`

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
| 删除作品槽位 | `GameObjectDelete:{index}` | `GameObjectDelete:7` |

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

- `無`
- `1`
- `2`
- `3`
- `4`
- `5`

默认：`無`

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

注意：快速上传没有“無”遮罩选项，也不使用原 `MaskTexture` 里的旧遮罩。

## 5. 关键源码文件

### `src/App.tsx`

负责页面路由和流程分流。

当前重点：

- 初始页面是 `entry`。
- 原流程进入 `home`。
- 快速上传进入 `directUpload`。
- 快速上传现在先进入 `directSelect`，选择主题后进入 `directUpload`。
- 原上传成功后显示 handoff 动效，然后进入 `edit`。
- 快速上传成功后直接进入 `directComplete`。

### `src/components/EntryPage.tsx`

新增入口页。

职责：

- 填写/保存目标 IP，界面显示为 `藝術畫廊 IP`。
- 选择原控制流程或快速上載流程。
- 两个入口均显示主图，`8080` 使用 `/MainIcon/8080.png`，`11701` 使用 `/MainIcon/畫境成真.png`。
- 展示两个大触控入口。

### `src/components/DirectUploadSelectPage.tsx`

快速上載主题选择页。

职责：

- 展示 `魔幻森林1`、`魔幻森林2`、`畫境成真`、`美麗海洋` 四个主题。
- 点击主题后进入 `UploadPage(mode="direct")`。
- 主题和遮罩分组来自 `src/services/directUploadThemes.ts`。

### `src/components/HomePage.tsx`

原 20 格作品槽位页。

职责：

- 读取当前 IP 下的缩略图缓存。
- 点击槽位发送 `GameObject:{index}`。
- 有缓存图时直接进入控制页。
- 空槽位进入上传页。
- 顶部有“返回入口”按钮。

### `src/components/UploadPage.tsx`

共用上載页，通过 `mode` 区分两套流程。

重要 props：

```ts
mode?: 'control' | 'direct'
uploadPort?: number
shouldCacheArtwork?: boolean
maskOptions?: UploadMaskOption[]
directThemeName?: string
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
maskOptions={getDirectMasksForTheme(selectedDirectTheme)}
directThemeName={selectedDirectTheme.label}
```

差异：

- `control`：旧遮罩、默认 `無`、可录音、写入作品缓存、上載后进控制页。
- `direct`：按当前主题传入 A/B/C 分组遮罩、无录音区、不写作品缓存、上載后进完成页。
- 两套上传页都支持遮罩缩略图预览和用户图片双指缩放；缩放只影响用户图片，不影响遮罩。

### `src/components/DirectUploadCompletePage.tsx`

新增快速上載完成页。

职责：

- 显示上传后的预览图。
- 显示文件名和目标 IP/端口。
- 底部两个按钮：
  - `返回首頁`
  - `重新上載`

### `src/components/EditPage.tsx`

原控制页。

职责：

- 显示作品在舞台中的位置。
- 单指拖动移动图片并实时发送网格坐标。
- 双指缩放和旋转，实时发送缩放/旋转信号。
- 双击打开工具抽屉。
- 支持动画、场景、水平翻转、释放物件等控制。
- 支持删除当前作品槽位：先发送 `GameObjectDelete:{selectedObjectIndex}`，再清除当前 IP 下该槽位的本地缓存并返回首页。

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
- `removeArtworkFromIp(ip, index)` 用于删除单个作品槽位，会清除缩略图、图片元数据，并尽量删除 Filesystem 文件或 IndexedDB Blob。

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
  MainIcon/
    8080.png
    Magic_floor_UI_art.png
    畫境成真.png
    美麗海洋.jpg
    魔幻森林1.jpg
    魔幻森林2.jpg
  animations/
    0.gif ... 9.gif
  MaskTexture/
    Mask1.png ... Mask5.png
  Mask/
    A-02.png ... A-06.png
    B-01_revised.png ... B-08_revised.png
    C-01.png ... C-09.png
  DirectMaskTexture/
    C-01.png
    A-02.png
    A-03.png
```

说明：

- `animations/0.gif` 到 `animations/9.gif` 用于控制页动画示例。
- `MainIcon` 用于入口页和快速上載主题选择页。
- `MaskTexture` 只给原控制上传用。
- `Mask` 是当前快速上載遮罩来源，按 A/B/C 前缀分组。
- `DirectMaskTexture` 是旧快速上传遮罩目录，当前代码不再引用。

## 10. 后续大改建议

为了继续降低污染风险，建议后续保持下面的边界：

- 原控制流程只改 `home -> upload(control) -> edit`。
- 快速上传流程只改 `entry -> directSelect -> upload(direct) -> directComplete`。
- 端口统一从 `src/services/networkConfig.ts` 读取。
- 遮罩选项继续在 `UploadPage.tsx` 顶部按 `CONTROL_MASK_OPTIONS` 和 `DIRECT_MASK_OPTIONS` 分开维护。
- 如果以后快速上传还要增加自己的参数，优先继续通过 `mode="direct"` 和独立 props 隔离，不要复用控制页状态。

## 11. 2026-07-29 行走动画与作品档案视觉修复

### 行走动画编号与实现

- 控制页第 10 个动画按钮显示为「行走」，协议仍发送 `animationId: 9`。
- iPad 预览和 Windows 播放端共用 `desktop-runtime/renderer/walk-animation-core.js`。
- Unity 曲线时长、循环与 Hermite 插值已复现；当前网片是 `7 x 9` 的程序化后备网格。
- 工程仍没有原 Unity `photo_plane.fbx` 或保留 Morph Target 的 GLB，因此当前变形轨迹不是原模型逐顶点数据的 1:1 复刻。

### 本轮修复

- 修复行走预览图上的横线、竖线和三角斜线：每个 Canvas 三角裁切区只向外扩约 `0.75 CSS px`，覆盖相邻网片抗锯齿产生的透明缝隙，不改变顶点、动画曲线、图片尺寸或协议。
- 修复选中「行走」或其他动画后按钮看似空白：补齐最终 CSS 选中态的深绿色背景、白色图标与白色文字。
- 「作品档案」页面移除背景图上的白色半透明渐层，直接显示原始 `magic-floor-background.webp`；卡片、顶部操作区、菜单和弹窗背景保持不变。

### 同步与产物

已执行：

```bash
npx tsc --noEmit
node --check desktop-runtime/renderer/walk-animation-core.js
npm run build
npm run sync:ios
cd desktop-runtime
npm run pack:dir
npm run pack:portable
```

结果：

- TypeScript、Vite 构建与 JavaScript 语法检查通过。
- iOS 同步完成；`dist` 共 56 个 Web 文件，与 `ios/App/App/public` 对应文件的 SHA-256 全部一致。iOS 目录额外生成 `cordova.js` 和 `cordova_plugins.js`，属于 Capacitor 正常产物。
- Windows 目录版：`desktop-runtime/release/win-unpacked/MagicFloor Dynamic Player.exe`。
- Windows 便携版：`desktop-runtime/release/MagicFloor Dynamic Player 0.1.0.exe`。

## 12. 2026-07-29 iPad 舞台动画补齐

### 问题原因

控制页的动画按钮、参数保存和 `ItemAnimation` 发送本来都是正常的，但舞台预览只有 `animationId: 9` 使用 `WalkAnimationCanvas`。`animationId: 1-8` 仍然只渲染普通 `<img>`，因此工具栏下方的小人示例会动，舞台中的实际图片不会动。

### 当前实现

- 新增 `desktop-runtime/renderer/item-animation-core.js`，集中保存 PC 原有 `animationId: 1-8` 的时间公式与输出参数。
- PC `renderer/player.js` 改为调用该共用核心，避免 PC 与 iPad 维护两套动画公式。
- 新增 `src/components/DynamicStageItemAnimation.tsx`，预览模式下通过单一 `requestAnimationFrame` 订阅直接更新舞台物件的 `transform` 与 `opacity`，不触发 React 每帧重渲染。
- 动画层位于移动方式、出现淡入层与实际图片之间，用户设置的大小、旋转、水平翻转和垂直翻转仍在图片层生效。
- `1-8` 的位移会按当前 iPad 舞台相对于 `1920 x 1080` 的比例缩放，与 PC 运行端的视觉幅度一致。
- 编辑模式保持静止；预览模式播放 `1-8`；`animationId: 9` 继续使用行走 Canvas；`animationId: 0` 保持无动画。

### 验证

```bash
npx tsc --noEmit
node --check desktop-runtime/renderer/item-animation-core.js
node --check desktop-runtime/renderer/player.js
npm run sync:ios
cd desktop-runtime
npm run pack:dir
npm run pack:portable
```

结果：

- TypeScript、核心 JavaScript 语法检查和 Vite 构建通过。
- `dist` 56 个 Web 文件与 iOS public 目录对应文件 SHA-256 全部一致。
- PC ASAR 已包含 `renderer/item-animation-core.js`、`renderer/player.js`、`renderer/walk-animation-core.js`。
- iOS 已同步，可在 Xcode 中重新运行或 Archive。

## 13. 2026-07-29 互动藝術重新上載與 iPad 全螢幕

### 互動藝術完成頁重新上載

- `src/App.tsx` 新增 `directUploadOpenMaskSelector` 狀態。
- 從互動藝術完成頁點擊「重新上載」時，會清除上一筆完成結果，回到 `directUpload`，並將遮罩工作區直接打開。
- `src/components/UploadPage.tsx` 新增 `openMaskSelector` prop。
- 重新上載初始沒有新圖片時，仍可先查看目前主題的遮罩預覽；舞台顯示「選擇圖片」，選取圖片後沿用原本的拖曳、雙指縮放、遮罩切換、合成與發送流程。
- 遮罩仍由 `getDirectMasksForTheme(selectedDirectTheme)` 決定，只影響互動藝術快速上載，不影響動態藝術、原版控制上載或其他主題。
- 從首頁重新選擇互動藝術主題時會重置這個狀態，避免把完成頁的重新上載入口帶入一般首次上載流程。

### iPad 隱藏系統狀態列

- `ios/App/App/AppDelegate.swift` 新增 `FullscreenBridgeViewController`，覆寫 `prefersStatusBarHidden`。
- `ios/App/App/Base.lproj/Main.storyboard` 的根控制器改為 `FullscreenBridgeViewController`，module 為 `App`。
- `ios/App/App/Info.plist` 保留 `UIViewControllerBasedStatusBarAppearance`，並加入 `UIStatusBarHidden = true`。
- `capacitor.config.ts` 的 iOS `contentInset` 改為 `never`，讓 WebView 延伸至全螢幕；網頁本身的 `env(safe-area-inset-*)` 仍負責內容安全邊距。
- iPad 橫屏限制維持不變。這會隱藏時間、Wi-Fi、電池等頂部狀態列資訊，但不會移除系統 Home Indicator 或控制中心等系統手勢；展覽機若需鎖定操作，仍應配合 iPad「引導使用」或單 App 模式。

### 本輪驗證

已執行：

```bash
npx tsc --noEmit
npm run build
npm run sync:ios
git diff --check
```

結果：

- TypeScript、Vite 生產構建與 iOS Capacitor 同步通過。
- `ios/App/App/capacitor.config.json` 已確認為 `contentInset: "never"`。
- storyboard 自訂控制器與 `Info.plist` 全螢幕設定已確認存在。
- `npm run lint` 未能執行，原因是目前專案沒有 ESLint 設定檔，並非本輪程式碼 lint 錯誤。

## 14. 2026-07-31 動態藝術極端長圖顯示與手勢修復

### 問題與修復

- 修復去背人物、細長瓶子等極端長寬比 PNG 偶爾在進場或預覽時消失的問題。
- 圖片改為保持掛載，預覽重播不再重建圖片節點；進場會等待圖片載入與解碼，並包含逾時放行及一次自動重試。
- 行走動畫會先保留原圖，Canvas 繪出第一個有效畫面後才切換，避免短暫空白。
- 將移動、出現、物件動畫、使用者縮放旋轉與圖片顯示拆成獨立渲染層，降低 iPad WebKit 多重 transform 互相覆蓋或裁切的風險。
- 極窄圖片只增加不可見的最小合成平面，不改變圖片實際視覺尺寸、位置、比例或傳送參數。
- 舞台加入依圖片實際顯示尺寸、縮放、旋轉與圖層順序計算的命中區；最小觸控範圍為 64px，方便單指拖曳及雙指縮放旋轉。
- 第一指命中後會鎖定目前物件，第二指可落在舞台任意位置，不會因碰到另一個物件而切換控制目標。
- 移除舞台重複的 `clip-path` / WebKit mask，只保留既有圓角與 overflow 裁切，降低透明細長圖層偶發被 GPU 剔除的機率。

### 影響範圍

- 未修改 Unity / PC 通訊協定、事件名稱、座標網格、圖層順序、背景、移動軌跡、動畫定義及任何已儲存參數。
- 未修改互動藝術、登入、Supabase 或其他上載流程。

### 驗證

```bash
npm run build
npm run sync:ios
git diff --check
```

結果：TypeScript、Vite 生產構建、Capacitor iOS 同步與 SPM 路徑修正均通過。`dist` 的 58 個檔案與 `ios/App/App/public` 對應檔案 SHA-256 全部一致；iOS 只額外包含 Capacitor 必需的 `cordova.js` 與 `cordova_plugins.js`。仍需在 iPad Air 以一般橫圖、一般直圖、`896 x 2896` 與 `84 x 1046` 樣本重複驗證進場、預覽、拖曳、縮放、旋轉及動畫 `0-9`。

## 15. 2026-07-31 互動藝術主題進入快速上載轉場

### 完成內容

- 將測試頁確認的「柔光畫布接管」轉場正式接入 iPad 互動藝術流程。
- 使用者在主題選擇頁點擊任一主題後，選中卡片保持比例移至中央，其他卡片與導覽列柔和淡出。
- 米白色畫布由下方接管舊場景，主題卡片再縮小並歸入真實快速上載頁中央的黑色圓形 `+`。
- 轉場完成後才顯示正式 `UploadPage` 的選圖入口；選圖前不載入或顯示遮罩，選圖後沿用既有遮罩調整流程。
- 正式轉場會等待真實上載頁 DOM 完成掛載，再以實際 `+`、標題、返回按鈕位置完成共享位置銜接。
- 加入重複點擊鎖定、圖片解碼等待、`prefers-reduced-motion` 簡化過場，以及找不到目標元素時的清理回退。

### 影響範圍

- 主題原有 `launcherAppId` 指令與 `11701` 通訊邏輯保持不變。
- 未修改圖片上載、拍照、檔案選擇、遮罩合成、完成頁、動態藝術或 PC 同步協定。
- 新增正式元件：`src/components/interactiveTransitions/DirectThemeUploadTransition.tsx`。
- 修改主流程：`src/App.tsx`、`src/components/DirectUploadSelectPage.tsx`、`src/index.css`。
- 測試頁仍保留於 `transition-portal-preview`，方便後續比較和回退。

### 驗證與預覽

- `npm run build` 通過，TypeScript 與 Vite 生產構建正常。
- `git diff --check` 通過；目前僅有換行格式提示，沒有空白錯誤。
- 正式預覽：`http://localhost:5175/`。
- 轉場測試頁：`http://localhost:5188/`。
- 正式頁目前會先顯示登入頁，需登入後進入「互動藝術 → 選擇主題」查看實機流程；仍建議在 iPad Air 橫屏實機確認 WebKit 下的細節和流暢度。
- `npm run lint` 仍無法執行，原因是專案沒有 ESLint 設定檔，並非本輪程式碼錯誤。

## 16. 2026-08-03 五語介面與語言設定

### 完成內容

- 新增繁體中文、簡體中文、英文、葡萄牙文（葡萄牙）與波蘭文五種介面語言，繁體中文為預設及後備語言。
- 首頁設定選單新增「介面語言」入口；語言頁使用各語言的原生名稱、單選狀態與勾選標記，選取後立即套用，不必另外按保存。
- 語言選擇保存於 `localStorage` 的 `magicfloor_locale_v1`，重新開啟 App 後會沿用上次選擇。
- 語言切換只更新靜態介面文字與無障礙標籤，不會重建頁面，也不會清除目前頁面、所選作品、編輯參數或 IndexedDB 快取。
- 已覆蓋登入、首頁、設定、互動藝術主題選擇、圖片上載、完成頁、作品檔案、資料夾、素材、背景、動態藝術控制頁、舊版控制頁、動畫名稱、確認視窗、錯誤訊息與同步狀態。
- 帳號沒有名稱或電郵時，由介面按目前語言顯示本地化的「使用者」兜底，不會把翻譯字串寫入 Supabase。

### 技術結構

- i18n 初始化：`src/i18n/index.ts`，並在 `src/main.tsx` 於 React 渲染前載入。
- 五份字典位於 `src/i18n/locales/`；`zh-Hant.ts` 定義完整鍵型別，其他語言缺少任何鍵時 TypeScript 會報錯。
- 主題、遮罩、動畫與移動方式改用穩定的 `labelKey` 顯示翻譯；原有 ID、檔名、A/B/C 前綴及通訊值保持不變。
- 接收端同步狀態改用穩定階段值保存，畫面顯示時才翻譯，避免切換語言後殘留舊語言文字。

### 不變範圍

- 未修改 `8080` / `11701` 行為、Unity / PC / EXE 事件名稱、HTTP 欄位、作品檔案與素材資料結構、Supabase 表名與欄位名。
- 未翻譯使用者自行命名的作品、資料夾、物件及背景，也未改名任何素材檔案或遮罩資源。
- `MagicFloor`、`HTTP`、IP 位址、埠號及 JPEG / PNG / GIF / WebP 等格式名稱保持原樣。

### 驗證

- `npx tsc --noEmit` 通過。
- `npm run build` 通過；Vite 僅保留既有的大型 chunk 提示。
- `npm run sync:ios` 通過，最新 Web 資源已同步到 `ios/App/App/public`，SPM 本機路徑修正成功。
- 已以 `1180 x 820` 與 `1024 x 768` iPad 橫屏尺寸檢查繁體中文、葡萄牙文及波蘭文登入頁，沒有文字溢出或重疊。
- `npm run lint` 仍無法執行，原因是專案沒有 ESLint 設定檔。

## 17. 2026-08-10 EXE 上下移動同步與作品檔案返回修正

### 完成內容

- 桌面 EXE 的 `verticalWave` 改用與 iPad 相同的上、中、下軌道邊界與幅度規則。
- 統一 `0%`、`50%`、`100%` 幅度語意、移動速度、關鍵幀緩動與逐個出現延遲；上下移動不再使用桌面端獨立的固定舞台振幅與隨機初始相位。
- iPad 上下移動的邊界改為 16:9 舞台歸一化計算，避免不同預覽尺寸造成 EXE 與 iPad 的軌跡比例偏差。
- 動態藝術作品檔案返回首頁時，先以首頁紙雕背景作為根層底色，覆蓋頁面淡入期間的白色空檔，避免出現整屏白閃。

### 不變範圍

- 未修改左右移動、360 回環、隨機移動、動畫效果、預覽協定欄位或圖片資料結構。
- 未修改互動藝術、上載流程、11701 通訊或登入與設定功能。

### 驗證與構建

- `npx tsc --noEmit` 通過。
- `npm run build` 通過。
- `node --check desktop-runtime/renderer/player.js` 通過。
- `git diff --check` 通過。
- `npm run lint` 仍因專案沒有 ESLint 設定檔而無法執行。
- 新桌面構建：`desktop-runtime/release-build-20260810-motion-sync/win-unpacked/MagicFloor Dynamic Player.exe`。
- 網頁預覽：`http://localhost:5175/`。

## 18. 2026-08-11 控制頁返回作品檔案效能優化

### 完成內容

- 控制頁返回作品檔案時，同時保留控制頁並預先掛載隱藏的作品檔案頁；目標頁完成首輪版面配置與可見縮圖解碼後，才開始既有的立體書返回動畫。
- 路由切換改為同一幀同步提交，並移除頁面容器的強制重新掛載，避免控制頁卸載與作品檔案建立之間露出根層白底。
- 動畫期間停用通用頁面入場動畫；過場完成後使用中性路由狀態，避免 GSAP 結束後又播放一次 CSS 淡入而產生尾幀閃爍。
- 過場舞台代理只擷取目前背景，不再複製整個控制舞台與所有物件；影片背景優先擷取目前畫面，減少 iPad WebKit 的 DOM、影片與合成負擔。
- 畫框尺寸變化改用 FLIP 位移與 GPU transform，保留原有時間、緩動、立體書摺疊與卡片歸位視覺。
- 返回前只在確實存在待寫入的位置或變形計時器時完成最後一次保存，避免無效的同步資料寫入佔用動畫首幀。
- 圖片與影片等待均加入逾時放行；動畫結束後等待兩個繪製幀再卸載控制頁，避免壞素材阻塞流程或過早清空畫面。
- 移除所有可選 GSAP 元素的空目標呼叫，控制台不再出現 `GSAP target not found` 警告。

### 不變範圍

- 未改動立體書動畫的視覺流程、時長、緩動、物件掉落、工具列與圖層面板出場方式。
- 未修改作品檔案、背景或物件資料結構，也未修改圖片位置、變形、動畫參數與 IndexedDB 儲存格式。
- 未修改互動藝術、圖片上載、`11701`、Supabase、Unity / PC 協定或桌面 EXE。

### 驗證

- `npm run build` 通過：TypeScript、1731 個模組與 Vite 生產構建正常；僅保留既有的大型 chunk 提示。
- `git diff --check` 通過，沒有空白錯誤。

- 使用真實登入狀態、IndexedDB 素材、`1180 x 820`、DPR 2、觸控模式與 4 倍 CPU 降速，連續完成 3 輪「進入控制頁 -> 返回作品檔案」。
- 三輪逐幀結果均為 `blankSamples: 0`、`whiteExposureSamples: 0`；返回後 `pageAnimation` 與 `libraryAnimation` 均為 `none`，控制頁與過場層均正確卸載。
- 控制台沒有 GSAP 警告；測試中的 `ERR_CONNECTION_REFUSED` 來自未啟動的本地 PC 接收端，與頁面動畫無關。
- 桌面模擬與 CPU 降速可以確認白屏路徑已修復並降低主執行緒負擔；仍需在目標 iPad Air 以大背景、影片背景及 20 至 30 個物件連續往返做最終實機壓力測試。

## 19. 2026-08-11 互動藝術完成頁返回與主題卡偏移修正

### 完成內容

- 互動藝術上載完成頁左側按鈕由「返回首頁」改為「返回選項」，點擊後回到四個互動藝術主題的選擇頁，不再跳回 App 首頁。
- 返回選項時會清除本次上載結果、遮罩自動展開狀態及相關過場狀態；目前所選主題仍會保留，方便使用者辨認剛才操作的項目。
- 「重新上載」流程保持原樣，仍回到目前主題的上載頁並直接顯示遮罩選擇。
- 新增繁體中文、簡體中文、英文、葡萄牙文與波蘭文的完成頁返回文案。
- 四張主題卡新增獨立動畫外層；GSAP 只控制外層，按鈕本身只處理點擊、焦點與按壓回饋，避免兩套 transform 互相覆蓋。
- 主題卡向上浮起的 hover 效果只在支援滑鼠懸停與精細指標的裝置啟用；iPad 觸控不再因 Safari 保留 hover 狀態而讓「魔幻森林1／2」重複進入後向上偏移。
- 主題頁入場、前往上載頁與返回主題頁的既有動畫時間、緩動與視覺效果保持不變；動畫結束時會清除外層的行內 transform、opacity 與 filter。

### 不變範圍

- 未修改四個主題的順序、圖片、遮罩資料、`launcherAppId` 或 `11701` 通訊格式。
- 未修改拍照、檔案選擇、遮罩合成、圖片發送或「重新上載」功能。
- 未修改動態藝術、Supabase、PC 同步協定或桌面 EXE。

### 驗證

- `npm run build` 通過：TypeScript、1731 個模組與 Vite 生產構建正常；僅保留既有的大型 chunk 提示。
- 在 `1180 x 820`、五點觸控、粗指標且無 hover 的 iPad 模擬環境中，連續 6 輪由首頁進入互動藝術，四張卡片每輪頂邊差均為 `0px`。
- 依次完成「美麗海洋、魔幻森林1、魔幻森林2、畫境成真 -> 上載頁 -> 返回」四條路徑；每輪四張卡片頂邊差均為 `0px`，動畫外層與按鈕的 computed transform 均為 `none`，沒有行內樣式、hover 或焦點殘留。
- 使用真實圖片完成一次完整快速上載；完成頁顯示「返回選項 / 重新上載」，點擊「返回選項」後回到四主題頁，返回前後 `11701` 請求數不變。
- `git diff --check` 通過，沒有空白錯誤。

## 20. 2026-08-11 互動藝術首頁入口共用數碼門戶過場

### 完成內容

- 首頁「互動藝術」入口改用已確認的動態藝術數碼門戶時間線，保留卡片啟動、紙雕場景解構、門戶推進、粒子重構與目標頁級聯呈現。
- 互動藝術門戶中央圖騰改為四張青、紫、粉、綠的全息主題卡；動態藝術仍使用原有的全息筆記本圖騰。
- 目標頁掛載後才依序呈現標題與四張主題卡，過場完成時清除臨時透明度、位移與濾鏡，避免尾幀閃白、卡片高低錯位或 hover 殘留。
- 首頁互動藝術卡片補齊與動態藝術一致的門戶網格及發光角框；舊互動藝術過場元件保留，方便後續回退。
- `prefers-reduced-motion` 使用精簡淡出與淡入流程，不播放 WebGL 推進效果。

### 不變範圍

- 未修改互動藝術四個選項的順序、圖片、遮罩、上載流程、拍照流程、`11701` 通訊或完成頁行為。
- 未修改動態藝術既有入口視覺、作品檔案流程、資料結構、Supabase、PC 同步或桌面 EXE。

### 驗證

- `npm run build` 通過；只有既有的大型 chunk 提示。
- 已在 `1194 x 834` 與 `1024 x 768` 橫向尺寸驗證：四張主題卡最終等高等位、透明度為 `1`、transform 正確清除，頁面與控制台無異常。
- 動態藝術回歸驗證仍顯示原筆記本圖騰；互動藝術門戶中間幀 Canvas 有正常內容，過場及落地頁沒有白屏幀。

## 21. 2026-08-14 動態藝術進階出場、物件聯動與桌面同步

### 完成內容

- 設定頁的「進階功能」仍是唯一功能開關；未開啟時，控制頁維持原有四個物件屬性選項與既有預覽行為。關閉進階功能不會刪除已儲存的進階參數。
- 進階物件屬性保持原面板寬度，選項分成兩行：`移動方式 / 動畫 / 變形` 與 `物件音源 / 物件背景 / 屬性複製`。
- 目標點編輯按鈕顯示「完成」，不再顯示 `common.done`；切換物件、切換頁籤、開始預覽、關閉或收起面板、開啟背景或出場設定時，會自動退出目標點編輯狀態。
- 選擇上方任一移動方式時，下方目標點與循環按鈕不顯示選中；選擇「移動到目標點」時，上方移動按鈕取消選中，預設只執行一次，另行開啟「循環移動」才會往返。切換模式不會刪除已設定的目標座標、上方移動參數或上次的 `targetLoop` 選擇。
- 動畫頁新增物件聯動。可設定「無」、「指定時間出現」或「指定時間隱藏」，計時點是觸發物件完成自身進場之後；聯動物件不佔用逐個出場的排序時間。
- 聯動編輯採用控制方視角：開啟觸發物件 A 的屬性後選擇受控物件 B，介面、圖層徽章與舞台關係線均明確顯示 `A -> B`。一個 A 可控制多個物件；一個 B 同一時間只可由一個 A 控制，替換控制方前會顯示警告。
- 聯動支援連鎖關係，禁止綁定自己與形成循環。建立 `A -> B` 後，B 的 `backgroundIds` 會立即鎖定並持久化為 A 的背景範圍；A 之後修改背景時會同步傳播到 B，`A -> B -> C` 則沿整條鏈繼承。B 不會再單獨出現在 A 不屬於的背景，也不會產生關係鎖指向未顯示 A 的情況。
- 關係鎖只表示物件之間存在聯動，不會鎖住位置、縮放、旋轉、變形或圖層拖曳。刪除觸發物件時，依賴它的聯動設定會自動清除；屬性複製不會複製聯動關係。
- 作品的物件出場動畫由組級 `appearAnimation` 統一控制：淡入、上方掉落或按軌道左右進場，不再由背景資料覆蓋。
- 每張背景可獨立指定背景轉場：直接切換、舞台窗簾、拍照閃白或皮影戲。背景編輯器可套用到已勾選背景；沒有勾選時則套用目前背景，切入時讀取目標背景綁定的轉場。
- iPad 與 Windows EXE 共用 `desktop-runtime/renderer/advanced-appearance-timeline.js`：淡入 `420ms`、上方掉落 `620ms`、左右進場 `560ms`，聯動延遲限制為 `0-600000ms`。
- 在多個背景持續存在且已真正可互動的物件會沿用同一播放 epoch，不會在背景切換首幀消失，也不會重播物件音源；真正重新出場的物件會建立新 epoch，可再次依設定播放音源。
- 指定時間隱藏後，物件不再接受點擊，尚未觸發的物件音源會取消。移動、目標點、物件動畫與音源均從同一出場 epoch 起算。
- iPad 傳送的 `GroupStateSync` / `GroupSelectAndSync` 已包含 `advancedFeaturesEnabled`、組級 `appearAnimation`、每張背景的 `backgroundTransition`，以及每個物件的 `linkedAppearance`；EXE 以相同資料和共享時間線播放。
- 繁體中文、簡體中文、英文、葡萄牙文及波蘭文均已補齊目標點、物件聯動、物件出場和背景轉場相關文字。

### 資料與協定

物件聯動儲存在 `DynamicItem.linkedAppearance`：

```text
triggerItemId: 觸發物件 ID
mode: showAfter | hideAfter
delayMs: 0-600000
```

介面顯示的是控制方關係 `A -> B`，同步協定則由受控物件 B 保存上述欄位，其中 `B.linkedAppearance.triggerItemId = A.id`。目前 `linkedAppearanceModelVersion` 為 `3`；舊版方向錯置的本機與桌面快取只會遷移一次，之後不再反轉。關閉進階功能時不顯示也不執行聯動，但會保留已儲存的關係資料。

作品的物件出場方式儲存在 `DynamicGroup.appearAnimation`：

```text
none       淡入
drop       上方掉落
trackSlide 按軌道左右進場
```

每張背景的轉場儲存在 `DynamicBackground.backgroundTransition`：

```text
none        直接切換
curtain     舞台窗簾
cameraFlash 拍照閃白
shadowPlay  皮影戲
```

### 驗證與交付

- `npm run test:appearance` 通過，覆蓋逐個出場排序、延遲顯示、延遲隱藏、互動狀態、受控背景強制繼承、多級關係傳播、解除關係後保留最後繼承值、關係方向、循環聯動及 600 秒上限。
- 關係介面仍維持兩行屬性頁籤、圖層關係鎖、舞台 `A -> B` 輔助線與居中毛玻璃關係彈窗；舊的「跨背景暫時帶入」說明已替換為「背景跟隨」，受控物件的背景控制會顯示鎖定狀態。
- `npm run build` 通過；TypeScript 與 Vite 生產構建正常，僅保留既有的大型 chunk 提示。
- `node --check desktop-runtime/main.js`、`player.js` 與 `advanced-appearance-timeline.js` 全部通過。
- `npm run sync:ios` 通過；最新 Web 資源已同步至 `ios/App/App/public`，Capacitor 插件與 SPM 本機路徑同步成功。
- `npm run lint` 無法執行，原因仍是專案沒有 ESLint 設定檔，並非本輪程式錯誤。
- 標準與完整翻轉便攜 EXE 均已直接啟動驗證：`8080` 為 `listening`、冷啟動頁為 `archive`、預覽預設關閉；測試後所有進程均已關閉且 `8080` 已釋放。

2026-08-14 新交付版本：

```text
desktop-runtime/release-background-transitions-final-20260814/MagicFloor Dynamic Player 0.1.0.exe
SHA-256: 20C35357B45A48883DCD03B22BEFABAB27F42D5F8D6D023D4255344B91F470DA

desktop-runtime/release-background-transitions-vertical-final-20260814/MagicFloor Dynamic Player Vertical Flip 0.1.0.exe
SHA-256: 418A50DCDFF7531F42D80FE65B50F10C53729B744A8843514BE15D43C51FEA38
```

兩個版本都監聽 `8080`，不可同時運行。原有四個 `release-advanced-*` 目錄仍完整保留作回退版本。本輪未執行任何 Git 操作。

此段為 2026-08-14 當時狀態：本輪物件聯動方向、關係鎖和跨背景暫時帶入已更新至 `desktop-runtime` 原始碼並通過共享時間線測試，但當時尚未重新打包 Windows EXE。2026-08-18 已完成標準版與完整翻轉版重新打包，最新交付路徑與 SHA-256 以第 25 節為準。

## 22. 2026-08-14 背景轉場音效與 BGM 自動避讓

### 完成內容

- 新增跨 iPad / EXE 共用的 `desktop-runtime/renderer/background-transition-audio.js`，三種背景轉場現在都有獨立的程序合成音效，不依賴外部音檔或網路載入。
- `cameraFlash` 使用雙段機械快門、高頻葉片與低頻鏡箱落定聲，取代原本容易被 BGM 掩蓋的弱快門聲。
- `curtain` 使用左右立體聲布料收攏、中央閉合落定及向兩側拉開的聲音，總時長約 `1200ms`。
- `shadowPlay` 使用布幕橫向拖動、木質杆件敲擊、換景後反向拉開及木質收尾聲，總時長約 `1400ms`。
- 背景轉場聲開始時，iPad BGM 會由正常 `0.72` 快速壓低到 `0.10`；EXE BGM 會由正常 `0.62` 壓低到 `0.10`。轉場完成後，依物件音源是否仍在播放恢復至物件避讓音量或正常音量。
- 背景切換時的新 BGM 會從壓低後的音量開始，不會在轉場中途突然升高；停止預覽、切換轉場或開始下一個轉場時會立即停止上一條轉場聲，避免疊音與殘音。
- 三種既有背景轉場的視覺、時序、背景綁定資料與同步協定均未改動。

### 驗證與交付

- `npm run build`、三份 EXE 腳本 `node --check`、`npm run test:appearance` 與 `npm --prefix transition-portal-preview run verify:linkage` 均通過。
- 新增 `npm --prefix desktop-runtime run test:transition-audio`，覆蓋三種音效時長、分層聲源建立、立即停止，以及 iOS AudioContext 尚未解鎖時取消舊聲音的行為。
- `npm run sync:ios` 通過，且 `dist` 全部檔案與 `ios/App/App/public` 對應檔案的 SHA-256 完全一致。
- 標準版與完整翻轉版的 `app.asar` 均確認包含 `background-transition-audio.js`、`interaction-audio.js` 與最新 `player.js`。
- 兩個 EXE 均已冷啟動驗證：`8080` 正常監聽、初始頁為 `archive`、預覽預設關閉；測試進程已全部結束，`8080` 已釋放。
- `npm run lint` 仍因專案沒有 ESLint 設定檔而無法啟動，並非本輪程式錯誤。

本輪最新交付版本已包含前一輪物件聯動修正與本輪背景轉場音效：

```text
desktop-runtime/release-transition-audio-final-20260814/MagicFloor Dynamic Player 0.1.0.exe
SHA-256: 54D0ED1B9CE99217DAF95B75E74DA1E3D17D1198BE013D871FDF9DE7E0B092E3

desktop-runtime/release-transition-audio-vertical-final-20260814/MagicFloor Dynamic Player Vertical Flip 0.1.0.exe
SHA-256: 7397D97BA7E579F4B38A16F2ABF1DB49C0B5DEB189689BC8F25EE2EF16D6C053
```

兩個版本都監聽 `8080`，不可同時運行。本輪未執行任何 Git 操作。

## 23. 2026-08-17 控制頁雙向過場、目標點循環與完整屬性複製

### 完成內容

- `作品檔案 → 控制頁` 與 `控制頁 → 作品檔案` 的雙向過場改為提前掛載目標頁、預先解碼舞台圖片、保留作品檔案頁快取，並把網路同步與影片播放延後到過場完成；原有 GSAP 時長、順序、緩動、視覺關鍵幀、物件落地及反向收攏均未改動，用於減少 iPad Air / iPad Pro 的掉幀與白屏。
- 目標點移動新增獨立 `targetLoop`：選擇「移動到目標點」後預設只執行 `起點 → 目標點` 並停留；開啟「循環移動」後才執行 `起點 → 目標點 → 起點` 往返。舊作品沒有該欄位時按不循環處理。
- 上方既有移動方式與下方目標點模式只做選中狀態互斥，不會互相刪除設定；切回目標點模式會恢復上次的目標座標與循環選擇。iPad 與 EXE 使用同一速度及單次／往返計算，循環期間「到達目標」音源只在首次到達時觸發一次。
- 「移動到目標點」與「循環移動」按鈕重新分配寬度、圖示、間距及勾選位置；中文完整顯示，英文、葡萄牙文與波蘭文過長時可自然換行，不再以省略號裁切。
- 進階功能開啟時，屬性複製擴充為 `移動方式 / 動畫 / 大小 / 變形 / 物件音源 / 物件背景 / 物件聯動` 七類；基礎模式仍只顯示原有四類，不改既有介面。
- 複製「移動方式」會同時複製來源物件的 `position`、`gridIndex`、一般移動參數、`targetMode`、`targetLoop` 與 `targetPosition`，完整保留 `來源起點 → 來源目標點` 軌跡；音源、背景與聯動的空值也會覆蓋目標舊值，陣列與座標均為獨立深複製。
- EXE 的屬性複製事件與完整組同步已支援上述進階欄位，並新增 `desktop-runtime/renderer/item-settings-copy-core.cjs` 作為可獨立驗證的桌面複製核心。

### 驗證與交付

- `npm run build`、`npm --prefix desktop-runtime run test:item-copy`、`npm --prefix desktop-runtime run test:target-motion`、`npm --prefix desktop-runtime run test:appearance`、`npm --prefix desktop-runtime run test:transition-audio`、`node --check desktop-runtime/main.js` 均通過。
- `npm run sync:ios` 通過，當輪 `dist` 的 58 個正式檔案與 `ios/App/App/public` 對應內容逐一一致；iOS 額外的 `cordova.js` 與 `cordova_plugins.js` 為 Capacitor 正常執行檔。
- 當輪曾生成 `release-target-loop-*` 標準版與完整翻轉版；這兩個目錄其後已被第 25 節的背景繼承最終版本覆蓋，因此交付時不得使用本節歷史中間哈希。
- `npm run lint` 仍因倉庫沒有 ESLint 設定檔而無法啟動，並非本輪程式錯誤；本輪未執行任何 Git 操作。

## 24. 2026-08-17 首頁品牌與背景播放順序

### 完成內容

- 首頁「動態藝術」卡片圖像改為根目錄 `ArtDisplay.jpg`，以 Vite 資源匯入並預先解碼，Web 與 Capacitor iOS 產物均包含該圖片；作品檔案、控制頁、互動藝術卡片及首頁門戶轉場結構不受影響。
- 英文首頁專用名稱改為 `ArtDisplay`，只作用於首頁卡片，不會把作品檔案頁的 Dynamic Art 標題一併改名；其他語言沿用既有名稱。
- 首頁 Logo 在一般橫屏放大至約 `128px`，較矮或較窄裝置回退至約 `96px`，並保留 safe area 與頂欄空間；登入頁 Logo 不受影響。
- 背景播放方式選擇 `sequence / 全部切換` 時，每次預覽都從持久化背景陣列第 1 張開始，嚴格依背景卡片拖曳順序循環；勾選順序只用於批量套用轉場、BGM 或刪除，不再影響播放。`fixed` 與 `random` 行為保持不變。
- 新增 `desktop-runtime/renderer/background-playback-core.js` 與型別檔，iPad 控制頁及 EXE 共用相同的順序起點規則；新增 `npm --prefix desktop-runtime run test:background-order` 防止播放順序回歸。
- 首輪背景編輯已能按目前背景篩選舞台物件；關閉背景面板後仍出現其他背景物件的問題，已在第 25 節改為持續活動背景範圍。
- 首頁 `DynamicPortalTransition` 的約 `2.18s` GSAP / Three.js 時間線、紙片解構、代碼流與目標頁揭示均未修改；獨立測試頁 `http://localhost:5188/` 曾以 `1194 × 834`、WebGL 可用且非 reduced-motion 條件確認完整播放。

### 驗證與交付

- `npm run build`、`npm run sync:ios`、`npm --prefix desktop-runtime run test:background-order`、`npm --prefix desktop-runtime run test:appearance`、`npm --prefix desktop-runtime run test:transition-audio`、`npm --prefix desktop-runtime run test:item-copy`、`npm --prefix desktop-runtime run test:target-motion` 均通過；`desktop-runtime/main.js`、`renderer/player.js` 與 `renderer/background-playback-core.js` 的 `node --check` 亦通過。
- `ArtDisplay.jpg` 已進入 Web 與 iOS 產物；當輪 `dist` 59 個檔案均在 iOS 中逐一 SHA-256 一致，iOS 額外兩個 Capacitor 執行檔屬正常差異。
- 當輪兩版 EXE 其後均被第 25 節的最終背景繼承版本覆蓋，最新交付只認第 25 節列出的路徑與哈希。
- Vite 仍只保留既有主 chunk 大於 500KB 的提示；本輪未執行任何 Git 操作。

## 25. 2026-08-18 活動背景篩選與聯動背景強制繼承

### 完成內容

- 開啟進階功能且存在 `activeBackgroundId` 時，控制頁舞台與圖層列表會持續只顯示目前背景適用的物件，不再依賴預覽狀態或「編輯背景」面板是否開啟；未指定背景的物件仍貫穿所有背景。
- 切換背景後，若原選中物件不屬於新背景，控制頁會切換至可見物件並關閉舊物件屬性與目標點編輯；全選及批量刪除只作用於目前可見圖層。圖層拖曳與鍵盤調層仍以完整作品順序計算，其他背景的隱藏物件不會遺失或被意外重排。
- 建立 `A -> B` 聯動後，B 的 `backgroundIds` 會立即鎖定並持久化為 A 的有效背景範圍；A 後續修改背景會同步傳播到 B，`A -> B -> C` 沿整條鏈繼承，最上游 A 貫穿所有背景時下游也全部貫穿。
- B 的「物件背景」頁仍可查看，但範圍按鈕與背景勾選全部停用，介面顯示「背景跟隨 A」；B 不會再單獨出現在 A 不存在的背景，舞台關係鎖也只連接目前背景中實際可見的物件。
- 解除聯動後，B 保留解除前最後一次繼承的背景範圍並恢復獨立編輯；舊作品若已保存 A/B 衝突背景，載入、儲存、屬性複製及同步至 PC 時會自動正規化，不需要使用者重新綁定。
- `advanced-appearance-timeline.js` 新增有效背景解析與聯動背景同步，播放過濾改為使用繼承後的範圍；`dynamicArtStorage.ts`、`DynamicControlPage.tsx`、`GroupStateSync` 及 `desktop-runtime/main.js` 均使用相同規則，取代舊的「只在預覽中暫時帶入且不持久化」行為。
- 五語文案已由「跨背景暫時帶入」統一改為「背景跟隨」與鎖定說明；首頁、背景播放、目標點、音源、背景轉場及其他既有進階功能均未移除。

### 驗證與交付

- `npm run build`、`npm --prefix desktop-runtime run test:appearance`、`npm --prefix desktop-runtime run test:item-copy`、`npm --prefix desktop-runtime run test:target-motion`、`npm --prefix desktop-runtime run test:background-order`、`npm --prefix desktop-runtime run test:transition-audio` 均通過；外觀測試已覆蓋強制繼承、多級傳播、全背景繼承、非突變播放過濾、持久化同步及解除關係後保留最後背景值。
- `node --check desktop-runtime/main.js`、`node --check desktop-runtime/renderer/player.js` 與 `node --check desktop-runtime/renderer/advanced-appearance-timeline.js` 均通過。
- `npm run sync:ios`、最後一次 `npx cap sync ios` 與 `npm run fix:ios-spm` 均通過；最終 `dist` 的 59 個應用檔案與 iOS 對應檔案 SHA-256 全部一致，額外兩個 Capacitor 執行檔為正常差異。
- 兩個便攜 EXE 都已重新打包；包內 `main.js`、`player.js`、`advanced-appearance-timeline.js`、`background-playback-core.js` 與 `target-motion-core.js` 已核對為本輪最新版本。兩個版本都監聽 `8080`，不可同時運行。

最終標準版：

```text
desktop-runtime/release-target-loop-final-20260817/MagicFloor Dynamic Player 0.1.0.exe
Size: 85,302,382 bytes
SHA-256: 196C0E8354B2DDBFF9B12E6F32E1D7CC36C7B6327C708DA989504AACEDD57F5B
```

最終完整翻轉版：

```text
desktop-runtime/release-target-loop-vertical-final-20260817/MagicFloor Dynamic Player Vertical Flip 0.1.0.exe
Size: 85,289,448 bytes
SHA-256: 8AFCC25FD43938688BE46EF2AD5E54F003ACE0413C7FEAC8B19EC9758447257F
```

兩個 release 目錄同時保留 electron-builder 產生的 `win-unpacked`，便攜 EXE 本身可正常交付。`desktop-runtime/README.md` 仍保留「跨背景暫時帶入且不修改 backgroundIds」的舊描述，後續維護時應以本節、目前原始碼與測試為準並同步修正文檔。`npm run lint` 仍因沒有 ESLint 設定檔而無法啟動；本輪未執行任何 Git 操作。

## 26. 2026-08-18 EXE 發佈整理、Git 回退節點與動態藝術線性創作流程

### EXE 發佈整理

- 按交付要求清除 8 個已被最終版本取代的舊發佈目錄，共釋放約 `3.135 GiB`：
  - `release-advanced-final-20260813`
  - `release-advanced-vertical-final-20260813`
  - `release-advanced-linked-final-20260814`
  - `release-advanced-linked-vertical-final-20260814`
  - `release-background-transitions-final-20260814`
  - `release-background-transitions-vertical-final-20260814`
  - `release-transition-audio-final-20260814`
  - `release-transition-audio-vertical-final-20260814`
- `desktop-runtime` 目前只保留最新標準版與完整翻轉版兩個發佈目錄：
  - `release-target-loop-final-20260817`
  - `release-target-loop-vertical-final-20260817`
- 新增 `desktop-runtime/scripts/clean-release-directories.cjs`；所有正式打包命令現在都會在建立 EXE 前自動刪除同類型舊發佈目錄。
- `prepack:dir` 與 `prepack:portable` 只清理舊標準版；`prepack:vertical-flip` 只清理舊完整翻轉版；`pack:all` 依序產生兩個版本，不會在生成第二個版本時誤刪剛完成的第一個版本。
- 可使用 `npm --prefix desktop-runtime run clean:releases` 手動清空全部受管理的發佈目錄。清理腳本只檢查 `desktop-runtime` 的直接子目錄，並驗證目錄名稱，不會觸及 `.codex-build`、`node_modules`、`ffmpegbin` 或其他依賴與原始碼目錄。
- `.gitignore` 已補上 `.codex-build/`、`.codex-panel-build/`、`test-artifacts/`、`test-results/`、`*.log` 與桌面驗收截圖等生成內容；既有誤追蹤的 Vite 快取、套件鎖快取與開發日誌已從 Git 追蹤中移除，但沒有刪除本機依賴。

清理後保留的最新標準版：

```text
desktop-runtime/release-target-loop-final-20260817/MagicFloor Dynamic Player 0.1.0.exe
Size: 85,302,382 bytes
SHA-256: 196C0E8354B2DDBFF9B12E6F32E1D7CC36C7B6327C708DA989504AACEDD57F5B
```

清理後保留的最新完整翻轉版：

```text
desktop-runtime/release-target-loop-vertical-final-20260817/MagicFloor Dynamic Player Vertical Flip 0.1.0.exe
Size: 85,289,448 bytes
SHA-256: 8AFCC25FD43938688BE46EF2AD5E54F003ACE0413C7FEAC8B19EC9758447257F
```

兩個版本都監聽 `8080`，不可同時運行。本輪線性創作流程沒有修改 EXE 協定，因此沒有另外產生新版本；桌面交付仍以上述兩個目錄及 SHA-256 為準。

### Git 回退節點

- 在線性創作流程實作前，已建立並推送基線提交：

```text
93e50c67e87ad522db94173cf57d7b68b45ba1f4
chore: checkpoint before linear creation flow
```

- 遠端 `origin/main` 已指向上述提交。
- 已建立並推送回退標籤 `rollback-pre-linear-flow-20260818`；標籤解引用後同樣指向 `93e50c67e87ad522db94173cf57d7b68b45ba1f4`。
- 此回退節點包含 EXE 舊版本清理、自動清理打包鉤子及此前已完成的功能，但不包含其後新增的線性創作流程，可用作流程改版前的完整回退基線。
- 線性創作流程目前仍是上述基線之後的工作樹修改；若後續需要把目前效果另作正式版本，應建立新的提交或標籤，不要移動既有回退標籤。

### 動態藝術線性創作流程

- iPad 動態藝術控制頁新增正式的「創作流程」體驗；這不是新手教學、氣泡提示或刪減功能的簡易模式，而是把現有完整功能重新整理成單一路徑的作品建立流程。
- 控制頁同時保留「創作流程」與「自由編輯」兩種體驗，使用者可隨時切換。兩種體驗共用同一個 `DynamicControlPage`、舞台、手勢、圖層、屬性面板、背景編輯器、音源、預覽、保存與 PC 同步邏輯，不建立第二套作品編輯器。
- 新建作品預設進入「創作流程」；既有作品預設維持「自由編輯」，若該作品曾經選擇過編輯體驗，則恢復本機保存的上次模式及步驟。從作品物件卡明確開啟某個物件時，該入口物件優先於 session 上次選取，避免錯誤跳回第一個物件。
- 創作流程依照實際建立順序分為六步：
  1. `物件`
  2. `佈局與動作`
  3. `出場編排`
  4. `背景`
  5. `聲音`
  6. `檢查與預覽`
- 「物件」步驟沿用既有圖層、上載、刪除、多選及排序；點選圖層只切換目前物件，不會提前展開全部自由編輯屬性。點擊「屬性」會線性前往「佈局與動作」並開啟該物件。
- 「佈局與動作」集中顯示移動方式、目標點、動畫、大小與變形及屬性複製等既有功能，不改變舞台手勢或屬性資料。
- 「出場編排」把原本分散在出場設定、圖層順序及物件聯動中的操作整理為同一工作區，可設定全部／逐個出場、出場間隔、統一出場動畫、主要出場順序及接續動作。
- 主要出場順序仍使用既有 `DynamicItem.order`，因此調整出場主順序也會同步調整圖層層級；介面已明確提示這項既有資料限制。`showAfter` 與 `hideAfter` 不會被假裝成一般排序，而是以「接續出現／接續隱藏」關係獨立呈現。
- 新增接續動作與點擊既有接續關係均會開啟原有物件聯動編輯器；使用者可修改受控物件、出現／隱藏模式、延遲或移除關係，並繼續沿用原有循環防護、背景強制繼承及 `A -> B` 規則。舞台在「出場編排」步驟會持續顯示既有關係輔助線。
- 流程的「物件／佈局與動作／出場編排」三步會顯示作品全部物件，不會被目前活動背景誤過濾；「背景／聲音」仍可選取並編輯目前背景未顯示的物件。自由編輯與正式預覽仍維持原有按活動背景過濾的行為。
- 「背景」與「聲音」步驟提供作品層級總覽及逐物件摘要；需要修改時會進入既有背景編輯器、物件背景或物件音源屬性，不複製或縮減現有功能。詳情關閉或底部返回會回到同一步總覽。
- 背景與聲音均為可選步驟；點擊「稍後設定」或在未配置時直接按主要「下一步」都會寫入跳過狀態並完成線性前進。若後來新增真實配置，完成態重新以實際資料和阻塞問題為準，不會被舊跳過標記掩蓋。
- 聲音總覽只會在「已有音源、觸發方式為到達目標點、但尚未設定目標點」時提示返回佈局；普通循環物件、一般出現音源及無音源物件不再誤報。
- 「檢查與預覽」集中顯示物件、背景、音源及接續關係數量，並把缺少物件、目標點未完成、無效背景／音源引用、關係遺失、自我聯動或循環等問題分成阻塞項與提醒。可修復問題的「去處理」會返回對應步驟及物件；只能告知狀態的歷史資料提醒改為靜態卡，不再顯示點擊後無反應的假操作。
- 點擊「開始完整預覽」會使用原有正式預覽；停止預覽後會回到第六步。存在使用者可處理的阻塞問題時不會直接開始預覽。
- 關閉進階功能時，既有接續關係只讀顯示且不可點擊；進階專屬但在基礎模式中無入口的目標點、音源、背景與關係問題不會阻斷基礎流程預覽。
- 流程底部固定提供「上一步／下一步」、可選步驟跳過、詳情返回及自動儲存狀態；最後一步以「完成編輯」返回作品檔案。
- 流程模式、目前步驟、已選物件、佈局子步驟、已檢查物件及跳過步驟只保存在本機：

```text
localStorage key: magicfloor_dynamic_creation_flow_v1
```

- 流程狀態按作品 ID 分開保存；作品被刪除時會一併移除相應流程會話。損壞 JSON、舊版 session、已刪除物件及不可用的 `localStorage` 均會安全回退。
- 自由編輯修改作品後，流程摘要、播放順序、接續關係及問題清單會重新從真實作品資料推導，不依賴一份容易過期的流程副本。
- 本輪沒有新增或修改 `DynamicGroup`、`DynamicItem`、`DynamicBackground` 的持久化欄位，也沒有修改 IndexedDB 作品格式、`GroupStateSync`、`GroupSelectAndSync`、`PreviewMode`、Unity／PC 通訊或 EXE 播放協定。
- 流程會話只存在 iPad／瀏覽器本機，不會傳送至 Windows EXE；現有作品在「創作流程」和「自由編輯」之間切換時使用完全相同的作品資料。
- 繁體中文、簡體中文、英文、葡萄牙文與波蘭文已補齊流程、步驟、出場編排、背景、聲音、檢查及問題提示文案。
- 新面板保留最小 `44px` 觸控目標、鍵盤／螢幕閱讀器狀態、`aria-current` 步驟標記、`prefers-reduced-motion` 及 iPad 橫向響應式版面。

### 驗證與測試頁

- `npm run test:creation-flow` 通過，覆蓋損壞及舊版 session、已刪除物件恢復、空作品、播放順序轉換、分支／連鎖／隱藏關係、循環關係、目標點音源、可選背景與聲音，以及自由編輯後重新推導。
- `npm run build` 通過；其中包含 TypeScript 與 Vite 生產構建，共完成 `1760` 個模組，只保留既有的大型 chunk 提示。
- `npm --prefix desktop-runtime run test:appearance`、`test:item-copy`、`test:target-motion`、`test:background-order` 與 `test:transition-audio` 均通過，確認新增流程沒有改變既有 EXE 時間線、屬性複製、目標點、背景播放順序及轉場音效。
- 隔離瀏覽器驗收已覆蓋：創作／自由模式切換資料不變、第 1 步三個圖層且不可折疊、第 2 步只顯示四個允許屬性、跨背景物件背景／聲音詳情、既有與新增接續關係、可選步驟由主要按鈕或稍後設定跳過、Review 完整預覽、停止後返回 Review、基礎模式隱藏進階問題，以及靜態提醒不再呈現假按鈕。全程無瀏覽器執行錯誤。
- 已產生兩種 iPad 橫向尺寸的出場編排與檢查頁驗收截圖：

```text
test-artifacts/dynamic-flow-20260818/appearance-1024x768.png
test-artifacts/dynamic-flow-20260818/review-1024x768.png
test-artifacts/dynamic-flow-20260818/appearance-1366x1024.png
test-artifacts/dynamic-flow-20260818/review-1366x1024.png
```

- 截圖尺寸分別為 `1024 × 768` 與 `1366 × 1024`；四張圖均確認 `documentWidth === viewportWidth`、頁面高度固定於視口、圖片完整載入、流程面板與底部導覽無重疊，瀏覽器錯誤陣列為空。`test-artifacts/` 已被忽略，不會意外提交至 Git。
- 主應用測試頁已啟動並監聽所有網路介面：本機 `http://127.0.0.1:5173/`、同網路 iPad `http://192.168.1.39:5173/`；兩個地址檢查時均回傳 HTTP `200`，頁面標題為 `MagicFloor`。
- 過場預覽頁仍運行於本機 `http://127.0.0.1:5188/`、同網路 `http://192.168.1.39:5188/`；兩個地址檢查時均回傳 HTTP `200`，頁面標題為 `MagicFloor Portal Transition Preview`。

## 27. 2026-08-18 出場父子樹、物件背景分配與固定 Steps 導航

### 出場編排改為父物件／子物件結構

- 「出場編排」不再同時顯示一份全部物件平鋪清單及另一份獨立接續關係清單，而是直接使用 `flowSummary.relationTree` 遞迴顯示真實的父子關係。
- 未綁定物件維持原有完整頂層卡片；已綁定物件會以完整卡片收進父物件下方，保留縮圖、名稱、移動、動畫、目標點狀態及繼續新增下一層子物件的能力。
- 子物件上方新增可點擊的關係列，明確顯示「幾秒後出現」或「幾秒後隱藏」；點擊後仍開啟原有物件聯動編輯器，可更換受控物件、修改模式／延遲或解除關係。
- `showAfter` 使用青綠色關係提示，`hideAfter` 使用琥珀色關係提示，狀態同時由圖示與文字表達，不只依靠顏色。
- 主出場順序只對沒有父物件的根節點編號及顯示上下按鈕；綁定子物件不再被錯誤暗示為主順序的一部分。同一父物件的子節點依 `delayMs`、再依作品順序排列。
- 根節點上下移動會交換相鄰根節點在完整 `DynamicItem.order` 中的位置；子節點即使夾在兩個根節點的全域順序之間，也不會造成按下後畫面看似沒有變化。
- 支援 `A → B → C` 多級遞迴；視覺縮排最多累積三層，更深關係維持相同可用寬度，避免 iPad 窄右欄因深鏈產生橫向溢出。
- 父子樹已移到出場步驟首屏，先讓使用者看見目前出場結構與「接在此物件後」操作；全部／依序出場、間隔及統一動畫保留完整功能，改放在父子編排之後。
- 刪除右側面板內已被隱藏的舊四節點步驟軌道及全部殘留樣式，整個流程只保留頂部一套六步導航。

### 背景步驟改為兩段式線性操作

- 背景步驟第一屏改為兩個明確任務：`1 選擇物件`、`2 選擇出現背景`，不再要求使用者先進入舊屬性面板才理解「指定背景」的含義。
- 物件清單同時顯示目前背景範圍；目前物件以勾號及高亮表達，被聯動的子物件以鎖圖示及「背景跟隨父物件」文字表達。
- 選中一般物件後，可直接選擇「所有背景」或「指定背景」：
  - 「所有背景」繼續寫入既有 `backgroundIds=[]`，代表目前及日後新增的全部背景。
  - 「指定背景」原位展開兩欄背景縮圖選擇；至少保留一個背景，避免空陣列被既有資料語義重新解讀為全部背景。
- 選中綁定子物件時，不顯示一組難以理解的灰色控制項，而是顯示完整鎖定原因及「設定父物件」按鈕；按下後直接切換到其直接父物件。父物件背景變更仍由 `synchronizeDynamicLinkedBackgrounds()` 遞迴同步至子／孫物件。
- 沒有任何背景時，主要提示改為「先加入舞台背景」；背景素材、排序、播放方式、轉場與背景音樂保留在頁面底部支援區，繼續開啟原有完整背景編輯器。
- 新增流程內背景更新 handler 仍使用既有 `updateItemLocal(..., { persist: true, emit: false })`、IndexedDB／本地作品保存及 `GroupStateSync`，沒有新增作品欄位或 PC 訊息。

### Ant Design Steps 風格頂部導航

- 頂部六步導航改為 `nav > ol > li > button` 的固定圓形節點與五條連接線，視覺參考 Ant Design `Steps`，但沒有新增 Ant Design 依賴，繼續使用現有青綠色設計語言。
- 六個節點始終固定在等寬欄位中；切換目前步驟時不再改變按鈕寬度或造成整條導航左右跳動。
- 狀態分為目前 `process`、已完成 `finish`、已經過但有阻塞問題 `error`、未到達 `wait` 及前置條件不足 `disabled`；未來步驟不會因自由編輯已有資料而提前顯示完成。
- `1366 × 1024` 顯示六個完整標題；導航容器小於 `660px`（包含 `1024 × 768` iPad 橫向配置）時仍保留六個節點及連接線，只隱藏非目前步驟的視覺標題，完整名稱仍保留在可存取名稱中。
- 支援左右方向鍵、Home、End、Enter／Space；禁用步驟使用 `aria-disabled` 保持可聚焦及可讀，當前步驟使用 `aria-current="step"`。
- 步驟切換後焦點移至新頁面標題，而不是停留在導航按鈕；焦點框統一為青綠色，避免瀏覽器預設黑色外框破壞視覺，同時保留鍵盤焦點可見性。
- 所有主要觸控操作維持至少 `44px`，保留 `prefers-reduced-motion`，並在 1024／1366 iPad 橫向尺寸中維持右欄、舞台與底部流程列不重疊。

### 五語、相容性與驗收

- 簡體中文、繁體中文、英文、葡萄牙文及波蘭文新增父子出場、關係出現／隱藏、兩段式背景選擇、背景繼承、設定父物件及無背景首要操作文案；五語靜態鍵均無缺漏或重複，插值參數一致。
- `flow.step3Description` 已明確說明「主物件順序＋父子接續關係」；`flow.step4Description` 已明確說明「先選物件，再選背景；綁定子物件跟隨父物件」。
- 本輪只重組流程 UI 與操作入口；`DynamicGroup`、`DynamicItem`、`linkedAppearance`、`backgroundIds`、IndexedDB 格式、PC／EXE 播放時間線及同步協定均未修改，因此沒有重新生成 EXE。最新標準版及完整翻轉版仍以第 25／26 節列出的兩個 `release-target-loop-*` 目錄及 SHA-256 為準。
- 隔離 Edge／CDP 真實互動驗收通過：
  - `Paper Plane` 為唯一根卡，`Starlight` 與 `Blue Dancer` 依 `0.4s hideAfter → 0.7s showAfter` 嵌套顯示，子卡沒有主順序箭頭。
  - 點擊子物件關係列成功開啟原有「物件聯動」對話框。
  - `Paper Plane → Starlight → Blue Dancer` 三級鏈完整遞迴顯示，兩層關係列均存在，孫物件沒有主順序箭頭。
  - 三個未綁定根物件按下向下按鈕後，根順序由 `Blue Dancer / Paper Plane / Starlight` 立即改為 `Paper Plane / Blue Dancer / Starlight`。
  - 背景頁顯示 `1 / 2` 任務號、兩個子物件鎖定狀態；選中 `Blue Dancer` 會顯示跟隨 `Paper Plane` 的完整說明，按「設定父物件」後正確切回 `Paper Plane`；切換「所有背景」後其 `aria-checked` 為 `true`。
  - 全程 `window.__flowHarnessErrors=[]`。
- 已重新產生六張最新驗收截圖：

```text
test-artifacts/dynamic-flow-20260818/appearance-1024x768.png
test-artifacts/dynamic-flow-20260818/backgrounds-1024x768.png
test-artifacts/dynamic-flow-20260818/review-1024x768.png
test-artifacts/dynamic-flow-20260818/appearance-1366x1024.png
test-artifacts/dynamic-flow-20260818/backgrounds-1366x1024.png
test-artifacts/dynamic-flow-20260818/review-1366x1024.png
```

- 六張截圖均確認 `documentWidth === viewportWidth`、`documentHeight === viewportHeight`、圖片完整載入、目前面板步驟正確且瀏覽器錯誤陣列為空；隔離 Edge 驗收完成後已關閉，不影響使用者原有瀏覽器資料。
- 驗證命令全部通過：

```text
npm run test:creation-flow
npm run build
npm --prefix desktop-runtime run test:appearance
npm --prefix desktop-runtime run test:item-copy
npm --prefix desktop-runtime run test:target-motion
npm --prefix desktop-runtime run test:background-order
npm --prefix desktop-runtime run test:transition-audio
git diff --check
```

- 生產構建完成 `1760` 個模組，只保留既有主 chunk 大於 `500 kB` 的提示；沒有新增建置錯誤。
- 主測試頁 `5173` 與過場預覽頁 `5188` 仍在運行。本輪改動仍位於 `93e50c67e87ad522db94173cf57d7b68b45ba1f4` 回退基線之後的未提交工作樹中；既有 `rollback-pre-linear-flow-20260818` 標籤沒有移動。

## 28. 2026-08-18 流程文字減量、父子鏈收合與舞台背景入口簡化

### 文字與資訊層級減量

- 依第二輪實機回饋，流程面板由「以說明文字解釋操作」調整為「由畫面結構與按鈕本身表達操作」。
- 右側流程面板 Header 現在只保留可聚焦的目前步驟 `h2`；刪除重複的「創作流程」、播放端同步字樣、步驟數字、大圖示及標題下說明。頂部六步 Steps、內容區任務標題及固定底部保存狀態已能分別承擔導航、操作及狀態資訊。
- 出場頁刪除父子關係說明卡、物件順序標題說明及整體出場說明；第一屏直接從「物件順序」和父／子卡片開始。
- 子物件關係列的可見文字由完整句子縮減為「`0.4 秒後隱藏`／`0.7 秒後出現`」；完整父物件、子物件及觸發關係仍保留在 `aria-label`，不犧牲 VoiceOver 資訊。
- 背景頁刪除「選擇物件」及「選擇出現背景」下方的重複說明，並移除「目前物件＋物件名稱＋已選背景」摘要卡；第二步標題直接改為「`Paper Plane` 出現在哪些背景？」。
- 「所有背景／指定背景」只保留一行短說明；背景繼承提示縮減為「跟隨父物件／由 `Paper Plane` 統一設定」，操作按鈕縮減為「設定父物件」。
- 簡體中文、繁體中文、英文、葡萄牙文及波蘭文同步完成極簡文案；五語新增展開／收起子物件的可存取名稱，插值參數一致且沒有重複鍵。

### 父子鏈展開／收起

- 每個實際擁有子物件的父節點新增展開／收起按鈕，顯示鏈結圖示、子物件數量及方向箭頭；預設全部展開。
- 收合狀態只保存在 `DynamicCreationFlowPanel` 本地 `Set<string>`，不寫入作品、不進 IndexedDB、不發送至 PC／EXE，也不改變真正的 `linkedAppearance` 關係。
- 按鈕維持至少 `44px` 觸控區，使用原生 `button`、`aria-expanded`、`aria-controls` 及五語 `aria-label`；收起時子樹使用標準 `hidden`，焦點仍停留在同一按鈕。
- 點擊「接在此物件後」會先自動展開目前父節點，再開啟原有聯動編輯器，避免新建立的子物件被使用者先前的收合狀態遮住。
- 多級 `A → B → C` 每一層均可獨立收合；只改畫面呈現，不改延遲排序、循環檢查、背景繼承或播放時間線。

### 舞台背景區簡化

- 背景步驟底部「舞台背景」區已完全移除小型背景縮圖、名稱卡及 BGM 狀態卡；使用者需要查看素材時直接按「編輯背景」進入原有完整背景編輯器。
- 有背景時只保留一條緊湊管理入口：舞台背景圖示、背景數量及「編輯背景」按鈕；沒有背景時隱藏這條次要入口，避免與第二步內的「先加入舞台背景」主要操作重複。
- 「指定背景」模式內的背景縮圖選擇網格仍保留，因為該縮圖直接承擔勾選物件出現範圍的任務；被刪除的只有使用者指出的舞台背景重複預覽區。
- 編輯背景入口新增 `aria-haspopup="dialog"`；背景素材、順序、播放方式、轉場及背景音樂功能均未刪除。

### 驗收與相容性

- 隔離 Edge／CDP 已驗證父節點初始 `aria-expanded="true"`，收起後子清單 `hidden=true` 且按鈕名稱為「展開 2 個子物件」，再次展開後完整恢復；父節點原有兩條關係仍存在。
- 背景頁驗證 `.dynamic-flow-background-card` 數量為 `0`，舞台背景管理區內圖片／影片數量為 `0`，只保留「舞台背景／共 1 個背景／編輯背景」。
- 面板 Header 可見文字在背景步驟只剩「背景」，不再重複播放端同步、步驟數字或說明。
- 重新產生 `1024 × 768` 與 `1366 × 1024` 六張流程截圖；全部保持 `documentWidth === viewportWidth`、`documentHeight === viewportHeight`、零壞圖及 `window.__flowHarnessErrors=[]`。測試 harness 因刻意沒有連接播放端，已在 harness 專用 HTML 隱藏無關的同步錯誤 toast，不影響正式應用錯誤提示。
- `npm run build` 通過，完成 `1760` 個模組，只保留既有大 chunk 提示；以下回歸命令全部通過：

```text
npm run test:creation-flow
npm --prefix desktop-runtime run test:appearance
npm --prefix desktop-runtime run test:item-copy
npm --prefix desktop-runtime run test:target-motion
npm --prefix desktop-runtime run test:background-order
npm --prefix desktop-runtime run test:transition-audio
git diff --check
```

- 本輪仍只調整流程 JSX、CSS 與五語文案，沒有修改 `DynamicGroup`、`DynamicItem`、`linkedAppearance`、`backgroundIds`、IndexedDB 或 PC／EXE 協定，因此不需要重新生成 EXE；最新標準版及完整翻轉版仍以第 25／26 節記錄為準。

## 29. 2026-08-18 聲音步驟線性化、共享音源上載與原位選擇

### 背景音樂入口減量

- 聲音步驟的「背景音樂」不再遍歷舞台背景，也不再顯示背景圖片／影片圖示、UUID、圖片檔名或背景音樂狀態摘要。先前畫面中的兩個奇怪名稱其實是 `background.name`，不是音樂名稱，資訊層級已完全移除。
- 背景音樂區現在只保留「背景音樂」標題與「設定」按鈕，不顯示用途說明或空狀態文案；按鈕繼續開啟原有完整背景編輯器，背景素材、排序、轉場、播放方式及逐背景 BGM 功能均未刪除。
- 「設定」維持至少 `44px` 觸控區，使用 `aria-label` 及 `aria-haspopup="dialog"`；在 `1024 × 768` 窄右欄仍保留可見文字，不會退化成只有箭頭的無意義圖示。

### 物件音源改為同頁三步操作

- 「物件音源」不再顯示會跳入二級屬性抽屜的假選擇卡；整個設定改為同一頁面的三個連續任務：
  1. 選擇物件。
  2. 為目前物件選擇音源。
  3. 選擇播放時機。
- 物件卡現在只負責選取，使用 `role="radiogroup"`、`role="radio"`、`aria-checked`、勾號與邊框共同表達狀態；點擊後右側流程面板保持在「聲音」，不再打開自由編輯的物件音源抽屜。
- 第二步標題會直接顯示「`Paper Plane` 使用哪個音源？」；其下第一項固定為「無音源」，再列出目前作品共享音源庫中的所有音源。音源名稱、時長、選取勾號及獨立試聽按鈕均在原位可見。
- 「無音源」本身已清楚表達聲音可選，因此刪除原有綠色「無音源是有效設定，可直接繼續」說明卡。選擇「無音源」只解除目前物件的 `audioId`，不刪除共享音源資產，也不影響背景或其他物件。
- 選中有效音源後才顯示第三步「播放時機」；可直接選擇「出現時／延遲播放／到達目標」。只有「延遲播放」會顯示秒數輸入，仍沿用 `0–600000ms` 限制；「到達目標」但未設定目標點時只顯示必要的短警告。
- 聲音面板沒有新增刪除共享音源的高風險快捷鍵；原有自由編輯音源庫仍保留試聽與刪除功能，避免流程首屏增加視覺噪音或誤刪被多個背景／物件共用的資產。

### 共享音源上載語義

- 第二步提供可見的「新增音源」按鈕及專用隱藏檔案輸入，接受 `audio/*`、MP3、M4A、WAV 及 OGG；上載中按鈕會顯示既有進度文字及 `aria-busy`。
- 流程頁上載只呼叫既有 `addAudioFile()`，因此格式驗證、IndexedDB／本機媒體保存、時長讀取、Unity／Receiver 資產上載、錯誤 toast 與 `GroupStateSync` 全部沿用原邏輯。
- 與自由編輯的「上載並立即套用」入口不同，流程頁「新增音源」只把檔案加入目前作品的共享 `group.audioLibrary`，不暗中修改任何物件 `audioId` 或背景 `bgmAudioId`。新音源出現在下方列表後，必須由使用者明確點選才建立綁定。
- 背景音樂與物件音源繼續使用同一個作品級音源庫；同一資產可同時被多個背景和物件引用，不建立重複資料。自由編輯中新增的音源會立即出現在流程頁，流程頁新增的音源也可在背景編輯器與自由編輯物件音源中選取。
- 流程頁按明確 `itemId` 更新 `audioId`、`audioTrigger` 及 `audioDelayMs`，不依賴可能尚未完成切換的全域 `selectedItem`，避免快速切換兩個物件時把音源綁到上一個物件。

### 五語、相容性與驗收

- 簡體中文、繁體中文、英文、葡萄牙文及波蘭文新增「設定背景音樂／選擇物件／目前物件使用哪個音源」結構文案；`flow.step5Description` 同步縮短為「選擇音源與播放時機」，聲音面板內不再渲染背景音樂或物件音源的長說明。
- `DynamicCreationFlowItem` 流程視圖模型只增加既有欄位的讀取：`audioId`、`audioTrigger`、`audioDelayMs`；另加入只供畫面使用的共享音源摘要。沒有新增或修改 `DynamicGroup`、`DynamicItem`、`DynamicBackground` 的持久化欄位。
- IndexedDB 格式、作品資料、`GroupStateSync`、Unity／PC 協定、背景音樂切換及物件音源播放時間線均未修改，因此不需要重新生成 EXE。最新標準版與完整翻轉版仍是：

```text
desktop-runtime/release-target-loop-final-20260817
desktop-runtime/release-target-loop-vertical-final-20260817
```

## 35. 2026-08-19 作品档案进入控制页后的转场末尾闪帧修复

### 根因与修复

- 从作品档案进入控制页时，自定义作品转场会暂时通过 `.dynamic-story-route-active` 禁用控制工作区的通用入场动画。转场结束后该类名被移除，而页面同时进入 `page-portal` 状态，原先缺少对应保护，导致 `.dynamic-control-workspace` 的 `dynamic-page-content-in` 从 `opacity: 0`、`translateY(6px)` 再播放一次，形成肉眼可见的完整透明帧。
- 在 `src/index.css` 为 `.page-frame.page-portal.page-view-dynamicControl .dynamic-control-workspace` 增加 `animation: none !important`，让作品转场完成态无缝接管旧保护。普通 `page-forward` 进入控制页时仍保留原有轻量入场动画，不影响其他导航路径。
- 视频舞台背景原先在转场完成时无条件执行 `video.load()`，可能把已经显示的当前视频帧重置。现在仅在 `readyState < HTMLMediaElement.HAVE_CURRENT_DATA` 时加载；已有可绘制帧时直接继续播放。
- `scripts/verify-dynamic-creation-flow.mjs` 增加两项静态回归断言，分别约束 `page-portal` 的动画保护与视频按就绪状态加载，防止后续重构重新引入闪帧。

### 实机复测与当前状态

- 修复前逐帧观测到转场完成时 `opacity: 1 → 0`、`transform: none → translateY(6px)`，并在约 `247ms` 后恢复；修复后通过 Edge／CDP 连续采样 8 帧，全部保持 `opacity: 1`、`transform: none`、`animationName: none`，没有透明帧或位移。
- 单独验证普通 `page-forward` 路径仍会得到 `opacity: 0`、`translateY(6px)` 与 `dynamic-page-content-in`，说明修复只针对作品转场交接，不会删除正常页面入场体验。
- 本轮通过 `npx tsc --noEmit --pretty false`、`npm run test:creation-flow` 及目标文件 `git diff --check`。`5173`、`5188` 测试页均保持运行并返回 HTTP `200`。
- 本轮没有新增 Git 提交或推送，没有生成 EXE，也没有修改 `dist`；修复仍与前述 UI 调整共同位于现有未提交工作树中。

## 36. 2026-08-19 进阶功能关闭后的基础编辑收敛与预览尺寸一致性

### 关闭进阶功能后的单一编辑体验

- 「进阶功能」关闭后不再只是隐藏部分属性，而是统一进入单一的基础自由编辑体验。`App.tsx` 对新建作品、从作品档案打开作品及从物件页进入控制页三条入口统一解析：关闭时一律使用 `free`；开启时继续使用新建作品默认创作流程或旧作品保存的上次模式。
- 控制页增加最终兜底：会话中原有 `experience: 'flow'` 不会被删除或改写，但关闭进阶功能时实际界面强制按自由编辑渲染，因此不显示「创作流程／自由编辑」切换器、创作步骤导航、流程专用面板或流程页脚。重新开启后仍可恢复原来的流程步骤和选择状态。
- 舞台图层在进阶开启时继续读取既有出场关系树；关闭时把当前全部物件转换为没有子节点的同级卡片。基础模式不显示父子缩进、连接线、来源锁定提示、子物件数量或展开／收起按钮，但选择、多选、删除、属性、触控拖曳及键盘排序保持不变。
- 关闭开关不会删除 `linkedAppearance`、音源、背景绑定、目标点、出场动画或流程会话等已有数据；只隐藏并停用进阶操作。重新开启后，原有父子关系和进阶配置完整恢复。
- 设置页五语说明同步更新；简中使用「创作流程、出场编排、音源、背景与进阶转场」，让开关范围与实际能力一致。

### 04 号物件在舞台与预览中大小不一致

- 截图中的 04 号物件使用「360 回环」。编辑态不播放移动，所以只显示用户设置的 `item.scale`；旧预览会在回环轨迹外层额外乘约 `0.76–1.24` 的景深缩放，桌面播放器则再乘 `0.82–1.20`，因此同一物件在预览中会周期性变大或缩小。
- Web 预览的 `dynamic-preview-orbit` 关键帧现只改变 X／Y 位置，不再附加 `scale(...)`；相关 `--move-orbit-scale-*` 变量和计算已经删除。`desktop-runtime/renderer/player.js` 的回环移动同步固定返回 `scale: 1`，保证 iPad 编辑、iPad 预览及实际播放器使用相同的作者尺寸。
- 本次只移除「移动方式」暗中附加的大小变化。用户设置的大小、翻转、旋转以及呼吸、弹跳等明确属于物件动画的缩放效果均保持不变。
- Edge 在 `1180 × 820` 对同一回环物件完整采样 24 次：宽度保持 `56.12244–56.12256px`，仅有 `0.00012px` 浮点误差；高度始终为 `38.58093px`，运动矩阵全程 `scale=1`。

### 实机与回归状态

- 基础模式真实页面使用一个已保存 `experience: 'flow'`、且含 1 父 2 子关系的旧会话验收：保存值仍为 `flow`，但界面中模式切换器、步骤导航和流程页脚均为 `0`；3 个物件全部显示为 3 个根节点，子节点、展开按钮和来源提示均为 `0`。`1024 × 768`、`1180 × 820`、`1366 × 1024` 三个 iPad 横向尺寸均无页面 X／Y 溢出。
- 同一作品重新以进阶模式打开后，模式切换器、步骤导航和流程页脚各恢复为 `1`；图层恢复为 1 个根节点、2 个子节点及 1 个展开按钮。两种模式均无 JavaScript 错误，`documentWidth === viewportWidth`。
- 基础模式从真实 UI 把物件切换为「360 回环」并进入预览，待出场动画结束后连续采样 24 次：运动外层 X／Y 缩放始终为 `1`，物件宽高占舞台比例的波动小于 `0.0000002`。图层键盘上移会正常交换真实 `order`，两条隐藏的 `linkedAppearance` 关系逐字段保持不变；验收后测试作品已重新载入初始数据。
- 自动回归新增基础模式入口／控制页兜底／平铺图层／模式切换器条件、Web 回环关键帧无缩放及桌面播放器回环 `scale: 1` 检查。
- 本轮最终通过：`npx tsc --noEmit --pretty false`、`npm run test:creation-flow`、桌面端 `test:target-motion`、`test:appearance`、`test:item-copy`、`test:background-order`、`test:transition-audio` 及 `git diff --check`。Vite 临时目录生产构建完成 `1761` 个模组，仅有既有主 chunk 大于 `500 kB` 的提示；临时构建目录已删除，没有修改现有 `dist`。
- 本轮没有新增 Git 提交或推送，没有生成 EXE，也没有修改 `dist`；所有修改仍保留在现有未提交工作树中。

- 創作流程核心測試新增三組聲音語義回歸：共享庫已有資產但未綁定時聲音步驟仍未配置；同一音源可同時供背景與物件引用；物件與背景懸空音源 ID 均維持可修復提醒。
- 隔離 Edge／CDP 真實互動驗收通過：切換到 `Starlight` 後原位選擇 `Stage Music` 只更新該物件；播放時機與 `1.2s` 延遲正確寫入；上載 `flow-upload.wav` 後音源庫由 `2` 增至 `3`，全部物件與背景綁定保持不變；明確點選後才綁定，選擇「無音源」後共享庫仍保留 `3` 個資產。
- `1024 × 768` 與 `1366 × 1024` 驗收均確認：
  - `documentWidth === viewportWidth`
  - `documentHeight === viewportHeight`
  - 背景檔名卡數量為 `0`
  - 背景音樂說明段落數量為 `0`
  - 「新增音源」高度為 `44px`
  - 三個物件與「無音源＋兩個共享音源」均具備正確單選語義
  - 流程面板與固定 footer 保持 `8px` 間距
  - 最後一個音源控制可完整滾動至面板可視範圍
  - `window.__flowHarnessErrors=[]`
- 已新增兩張聲音步驟驗收截圖：

```text
test-artifacts/dynamic-flow-20260818/audio-1024x768.png
test-artifacts/dynamic-flow-20260818/audio-1366x1024.png
```

- 最終回歸全部通過：

```text
npm run test:creation-flow
npm run build
npm --prefix desktop-runtime run test:appearance
npm --prefix desktop-runtime run test:item-copy
npm --prefix desktop-runtime run test:target-motion
npm --prefix desktop-runtime run test:background-order
npm --prefix desktop-runtime run test:transition-audio
git diff --check
```

- 生產構建完成 `1760` 個模組，只保留既有主 chunk 大於 `500 kB` 的提示；五語共 `679` 個靜態鍵，沒有缺漏、重複或 `flow.audioChooseSource` 插值參數不一致。
- 本輪聲音改版仍位於 `93e50c67e87ad522db94173cf57d7b68b45ba1f4` 回退基線之後的未提交工作樹；`rollback-pre-linear-flow-20260818` 標籤沒有移動。

## 30. 2026-08-18 聲音頁單層工作區、橫向物件軌道與空音源極簡化

### 取消聲音頁內第二套流程

- 實機回饋否定了第 29 節的縱向 `1／2／3` 版面：全域已位於第 5 步「聲音」，頁內再放一套編號流程會製造重複層級，三張大型物件卡也會把真正的音源選擇推到首屏以下。
- 聲音頁已改為單層屬性工作區，只保留「背景音樂」與「物件音源」兩個區域；頁內全部 `1／2／3` 任務號、重複問題句及大型嵌套 assignment 卡片均已移除。
- 背景音樂降為一條 `56px` 的整行入口，只顯示音樂圖示、`背景音樂` 與方向箭頭；不顯示背景縮圖、檔名、數量、狀態或用途說明，按下後仍進入原有完整背景編輯器。
- 「物件音源」內依序直接呈現橫向物件軌道、`選擇音源＋新增音源`、音源列表及有音源時才出現的播放時機，讓使用者在同一視線與同一捲動區完成設定。

### 橫向物件切換與統一音源列表

- 物件由縱向大卡改為單行 `82px` 縮圖軌道；目前物件使用邊框、淡色背景及勾號共同標示，已綁定有效音源與缺少目標點改以縮圖角標呈現，不再增加第二行狀態文字。
- 軌道使用 `flex + nowrap + overflow-x:auto + scroll-snap`；物件增多時可自然橫向滑動，不建立第二個縱向捲動區，也不使用會阻斷 iPad 頁面上下手勢的 `touch-action: pan-x`。
- 從其他步驟帶入目前物件或外部切換物件時，選中卡會自動以 `inline: nearest` 進入可視範圍；孤兒 `audioId` 不會再錯誤顯示「已有音源」角標。
- 可見標題由「`Paper Plane` 使用哪個音源？」縮短為固定的「選擇音源」；目前物件已由上方選中卡表達，完整物件名稱仍保留在音源 `radiogroup` 的可存取名稱中。
- `新增音源` 固定放在「選擇音源」右側、音源單選群組之外；上載只加入作品共享音源庫，仍不自動綁定任何物件或背景，必須明確點選新音源後才寫入目前物件 `audioId`。
- 音源選項合併為一個帶分隔線的統一列表，不再把每個音源做成獨立卡片；整行負責選擇，右側獨立 `44px` 按鈕負責試聽／停止，避免嵌套互動元素。
- 共享音源庫為空時只顯示一個已選中的「無音源」及右上「新增音源」；刪除重複的「尚未加入音源」虛線空狀態。上載完成後仍保持「無音源」選中，直到使用者明確選擇。
- 播放時機改為純文字分段控制 `出現時／延遲播放／到達目標`，刪除三個重複圖示；只有選中真實有效音源時才顯示，延遲輸入維持至少 `44px` 觸控高度。

### 可存取性、五語與相容性

- 物件軌道、音源列表與播放時機均使用 `radiogroup / radio`、唯一 `aria-checked` 與 roving `tabIndex`；橫向群組支援左右方向鍵，直向音源群組支援上下方向鍵，並共同支援 Home／End 與循環切換。
- 物件軌道加入 `aria-orientation="horizontal"`、足夠的焦點框留白及自動捲入視野；目標點警告會寫入物件的完整可存取名稱，不只依賴角標顏色。
- 刪除只重複播報物件檔名的額外 live region；背景音樂入口補齊禁用狀態與「背景音樂，設定」可存取名稱，試聽停止圖示改為清楚的方形停止符號。
- 音源時長及目標點警告改用更深文字色，維持小字對比度；所有上載、試聽、音源選擇、播放時機與輸入控制均維持至少 `44px` 觸控基線。
- 簡體中文、繁體中文、英文、葡萄牙文及波蘭文的 `flow.audioChooseSource` 均改為不含物件名稱插值的短標題，畫面不再殘留 `{{name}}` 或舊「使用哪個音源？」問句。
- 本輪只重組 iPad 創作流程的 JSX、CSS 與五語顯示文案；共享音源資料、`DynamicItem.audioId/audioTrigger/audioDelayMs`、IndexedDB、`GroupStateSync`、Unity／PC 協定及 EXE 播放語義均未修改，因此不重新生成 EXE。最新標準版與完整翻轉版仍是：

```text
desktop-runtime/release-target-loop-final-20260817
desktop-runtime/release-target-loop-vertical-final-20260817
```

### 雙場景、雙尺寸驗收

- `test-artifacts/dynamic-flow-20260818/verify-audio-flow.mjs` 已更新為單次覆蓋 `complete` 與 `audio-empty` 兩種資料場景，以及 `1024 × 768`、`1366 × 1024` 兩種 iPad 橫向尺寸。
- 四組真實 Edge／CDP 驗收均確認 `documentWidth === viewportWidth`、`documentHeight === viewportHeight`、流程面板與 footer 保持 `8px` 間距、首個音源選項可見且最後控制可完整捲入、`window.__flowHarnessErrors=[]`。
- 完整音源庫場景固定驗證三個物件 radio、`無音源＋兩個共享音源`、兩個獨立試聽按鈕及三個播放時機 radio；空音源庫場景固定驗證只剩一個已選中的「無音源」、上載入口仍可見且播放時機不渲染。
- 鍵盤驗收覆蓋 ArrowLeft／ArrowRight、Home、End、焦點跟隨、唯一 Tab 停靠點及切換物件後留在聲音頁原位更新。
- 空庫上載驗收確認共享庫由 `0 → 1` 後所有物件 `audioId` 與背景 `bgmAudioId` 完全不變；明確點選後才綁定，切回「無音源」只解除目前物件且不刪除共享資產。
- 已產生四張本輪專用截圖：

```text
test-artifacts/dynamic-flow-20260818/audio-complete-1024x768.png
test-artifacts/dynamic-flow-20260818/audio-complete-1366x1024.png
test-artifacts/dynamic-flow-20260818/audio-empty-1024x768.png
test-artifacts/dynamic-flow-20260818/audio-empty-1366x1024.png
```

- 驗證命令全部通過：

```text
npx tsc --noEmit
npm run test:creation-flow
node test-artifacts/dynamic-flow-20260818/verify-audio-flow.mjs
npm run build
npm --prefix desktop-runtime run test:appearance
npm --prefix desktop-runtime run test:item-copy
npm --prefix desktop-runtime run test:target-motion
npm --prefix desktop-runtime run test:background-order
npm --prefix desktop-runtime run test:transition-audio
git diff --check
```

- 生產構建仍完成 `1760` 個模組，只保留既有主 chunk 大於 `500 kB` 的提示；本輪修改仍在既有回退基線 `93e50c67e87ad522db94173cf57d7b68b45ba1f4` 之後的未提交工作樹中，`rollback-pre-linear-flow-20260818` 標籤沒有移動。

## 31. 2026-08-18 目標點編輯辨識、起點殘影與無障礙操作

### Git 備份節點與遠端狀態

- 在修改目標點編輯器之前，已先把第 27–30 節的線性創作流程、背景／出場編排及聲音頁版本提交為本地 Git 回退節點：

```text
630f281f13721b8120c7116c5870474ea88a103f
feat: add linear creation flow and streamlined audio editor
```

- 提交前的回退基線仍為 `93e50c67e87ad522db94173cf57d7b68b45ba1f4`，既有 `rollback-pre-linear-flow-20260818` 標籤沒有移動。
- 已兩次嘗試 `git push origin main`；目前環境第一次無法連接 GitHub `443`，本輪重試則收到 `Recv failure: Connection was reset`。因此本地 `HEAD` 已在 `630f281f`，但 `origin/main` 仍停在 `93e50c67`，不可把這個節點誤記為已上傳。網路恢復後只需再次執行 `git push origin main`。

### 紅色起點、青色終點與原位物件殘影

- 「設定／修改目標點」期間，起始點由原本的深綠色圓點改為高辨識度紅色 `#d64545`，終點維持品牌青綠色 `#0a9a91`；兩者同時使用白色描邊、不同柔光、不同文字標籤，不只依賴顏色區分。
- 起始點上方新增「起始點」，終點上方新增「終點」。標籤使用高對比白色半透明膠囊、彩色圓點及 `12px` 粗體，在舞台背景明暗變化下仍可閱讀。
- 標籤位置依物件實際預覽尺寸、縮放與旋轉後包圍盒計算，預設放在物件上方；接近舞台上沿時自動翻到物件下方，左右位置會依各語言文字寬度夾在舞台安全區內，不會被 `overflow: hidden` 裁切。
- 當起點與終點完全重合或距離很近時，圓點改為紅色外環＋青綠色內點；文字碰撞不再只看固定距離，而是依簡體／繁體／英文／葡萄牙文／波蘭文標籤的保守矩形判斷，再把兩個標籤成對移入舞台安全區。`10px`、`30px`、`70px` 近距離均不重疊。
- 原始 `item.position` 位置保留同一物件的靜態半透明殘影：沿用同一圖片、未縮放尺寸、縮放、旋轉、水平翻轉與垂直翻轉，透明度為 `0.36`。殘影使用空 `alt`、`aria-hidden`、`pointer-events:none`，不播放第二份動畫、不進入拖拽命中、不出現在 Tab 順序，也不顯示選中框。
- 殘影／路徑 underlay 與目標物件使用相同 `10 + item.order` 層級，但先於真實物件渲染，因此真實可拖物件始終在殘影上方，而更低圖層物件不會反過來遮住該殘影。起終點標記與文字使用 `z-index:70`；目標編輯期間暫時隱藏 `z-index:68` 的物件聯動線，避免兩套關係圖同時出現。
- 路徑由紅色漸變至青綠色並在終點加入箭頭，使用者可直接理解「從起點移動到終點」；起終點完全重合時隱藏零長度路徑，避免雜訊。

### 觸控、鍵盤與資料安全

- 目標編輯期間點擊舞台空白處不再暗中關閉右側工具及取消草稿；只允許使用明確的「取消／完成」或鍵盤 `Escape／Enter` 結束操作。
- 實際終點物件在進入編輯時取得鍵盤焦點：方向鍵每次移動 `1%`，`Shift + 方向鍵` 每次移動 `5%`，所有座標仍限制在 `0–1` 舞台範圍內。
- 終點物件以 `aria-describedby` 連接五語鍵盤說明；每次鍵盤移動會用 `aria-live="polite"` 回報目前橫向／縱向百分比。`Escape` 或 `Enter` 結束後，焦點會回到重新出現的「設定／修改目標點」按鈕，不會遺留在失去語義的舞台節點。
- 「設定／修改目標點」、「取消」及「完成」按鈕均提升至至少 `44px` 觸控高度，文字提升至 `12px`；滑鼠／觸控拖動物件本體、鍵盤微調及原有完成／取消流程可共同使用。
- 拖動與鍵盤調整期間只更新 `targetDraftPosition`；React 作品狀態、`magicfloor_dynamic_groups_v1` 及 IndexedDB 均不提前改變。取消後資料完全不變；完成後只寫入既有 `targetMode: 'target'`、`targetPosition` 及相關時間戳，原始 `position`、縮放、旋轉、翻轉、背景、音源、聯動關係及其他物件保持不變。
- 簡體中文、繁體中文、英文、葡萄牙文及波蘭文新增「起始點／終點」、鍵盤操作說明及終點百分比回報；五語型別檢查無缺鍵。

### 雙尺寸瀏覽器驗收與相容性

- 新增本機隔離 Edge／CDP 驗收腳本：

```text
test-artifacts/dynamic-flow-20260818/verify-target-editor.mjs
```

- 腳本覆蓋 `1024 × 768` 與 `1366 × 1024`，驗證既有目標物件與新建目標物件兩種情境，包括：紅／青標記、半透明殘影、完整變形、標籤邊界、重合及近距離避碰、`44px` 操作、空白誤觸、指針拖動、方向鍵步進、草稿不持久化、取消不變、完成最小寫入、焦點回返、讀屏說明、零頁面溢出及 `window.__flowHarnessErrors=[]`。
- 已重新產生四張專用截圖：

```text
test-artifacts/dynamic-flow-20260818/target-editor-1024x768.png
test-artifacts/dynamic-flow-20260818/target-editor-1366x1024.png
test-artifacts/dynamic-flow-20260818/target-editor-overlap-1024x768.png
test-artifacts/dynamic-flow-20260818/target-editor-overlap-1366x1024.png
```

- 本輪驗證命令全部通過：

```text
npx tsc --noEmit
npm run test:creation-flow
node --no-warnings test-artifacts\dynamic-flow-20260818\verify-target-editor.mjs
npm run build
npm --prefix desktop-runtime run test:appearance
npm --prefix desktop-runtime run test:item-copy
npm --prefix desktop-runtime run test:target-motion
npm --prefix desktop-runtime run test:background-order
npm --prefix desktop-runtime run test:transition-audio
git diff --check
```

- 生產構建完成 `1760` 個模組，只保留既有主 chunk 大於 `500 kB` 的提示；驗證產生的 `dist` 哈希檔已恢復，沒有把生成物混入本輪工作樹。
- 本輪只修改 iPad 控制頁 JSX、CSS 與五語顯示／可存取文案；沒有修改 `DynamicGroup`、`DynamicItem`、IndexedDB 格式、`GroupStateSync`、Unity／PC 協定或 EXE 播放語義，因此不重新生成 EXE。最新標準版與完整翻轉版仍是：

```text
desktop-runtime/release-target-loop-final-20260817
desktop-runtime/release-target-loop-vertical-final-20260817
```

- 主測試頁 `5173` 與過場預覽頁 `5188` 仍在運行。本節目標點改動位於 `630f281f` 之後的未提交工作樹中，方便使用者先在 iPad 測試頁確認效果，再決定是否建立下一個 Git 節點。

## 32. 2026-08-19 目標點入口收斂、屬性短標籤與背景編輯器左右分欄

### 目標點預設收起與安全草稿

- 物件未進入目標點編輯時，不再渲染「移動到目標點／循環移動」兩個模式選項；右側只保留目標點狀態與單一「設定目標點／修改目標點」入口，避免使用者誤以為兩張模式卡可直接操作。
- 只有點擊「設定／修改目標點」後才展開兩個選項及「取消／完成」操作。非編輯狀態的隱藏選項不留在 DOM、Tab 順序或讀屏順序中；入口使用 `aria-expanded`、`aria-controls` 表達展開關係。
- 目標點是否為「已設定／修改」改以 `targetMode === 'target' && targetPosition` 判斷。若物件只保留舊目標座標、目前已切回普通移動模式，介面顯示「設定目標點」，但不刪除舊座標，完成設定後仍可沿用原位置。
- 「循環移動」在編輯期間改用 `targetDraftLoop` 草稿；切換時不寫入 React 作品狀態或 IndexedDB。按「完成」才一次寫入 `targetMode`、`targetPosition`、`targetLoop`，按「取消」則三者均維持進入編輯前的值。
- 編輯中再次點擊已選的「移動到目標點」不會重設終點草稿；完成、取消、`Enter` 或 `Escape` 後焦點都回到單一入口按鈕。既有紅色起始點、青綠色終點、半透明物件殘影、方向鍵微調及觸控拖動語義保持不變。

### 物件屬性導航

- 屬性導航顯示改為「移動／動畫／變形／音源／背景／複製」；面板內部仍保留「移動方式、物件音源、物件背景、屬性複製」等完整名稱，沒有改動資料欄位或功能語義。
- 「屬性複製」由容易被理解成旋轉／重做的順時針箭頭，改為兩張頁面疊放的 `Copy` 圖示；按鈕的完整 `aria-label` 與提示仍為複製屬性。
- 簡體中文、繁體中文、英文、葡萄牙文及波蘭文均補齊音源與背景短標籤；英文、葡萄牙文及波蘭文原有動畫／變形縮寫保留，避免六個屬性分頁在窄面板中擁擠。

### 背景編輯器左右分欄與單列卡片

- 「編輯背景」由原本上下堆疊改成左右分欄：左側為背景素材庫、全選、拖動排序與新增／刪除操作；右側為播放方式、切換間隔、背景轉場及背景音樂設定。
- 左右區域各自具備受控滾動；背景素材列表滾動時，右側設定不會被帶走，左側底部的新增／刪除操作也保持可見。標題、卡片文字、輸入框及主要觸控按鈕同步放大，關鍵操作高度至少 `44px`。
- 依使用者最終確認，背景素材列表固定為單列：最終層使用 `.dynamic-background-modal .background-library-list { grid-template-columns: minmax(0, 1fr) !important; }`，每張 `.background-library-card` 寬度為 `100%`，因此始終「一行一張」，不會恢復成一行兩張。
- iPad 橫向及一般桌面維持左右雙欄；窄螢幕與直向 iPad 自動退化為上下單欄，保留同一資訊順序、觸控尺寸與獨立滾動，不產生頁面級橫向捲動。
- 背景選取、設為目前背景、長按拖動排序、全選、上傳、刪除、切換模式、轉場與背景音樂套用邏輯全部沿用既有實作，沒有修改資料模型或播放語義。

### 瀏覽器實測、構建與目前狀態

- 已在真實 `5173` harness 頁打開「編輯背景」彈窗完成雙尺寸驗收：
  - `1024 × 768`：彈窗 `968 × 694`；左右欄計算寬度為 `509.594px / 400.406px`，間距 `16px`，重疊面積 `0`；背景列表只有一個 `458.594px` 列軌道，卡片完整佔滿該列。
  - `1366 × 1024`：彈窗 `1080 × 760`；左右欄計算寬度為 `572.312px / 449.688px`，間距 `16px`，重疊面積 `0`；背景列表只有一個 `521.312px` 列軌道，卡片完整佔滿該列。
- 兩個尺寸的彈窗均完整位於視口內，`document.scrollWidth/scrollHeight` 與視口相同，沒有頁面 X/Y 溢出，左右欄沒有交疊，`window.__flowHarnessErrors=[]`。
- 追加直向驗收 `768 × 1024` 與 `820 × 1180`：背景編輯器正確退化為「素材庫在上、設定在下」的單欄，列表仍只有一個列軌道（分別 `619px`、`627px`），卡片寬度與列表一致，兩個窗格無交疊，設定區滾動後背景音樂區可達，素材操作列可達，測試錯誤陣列為空。為避免控制頁在未掛載正式直向提示層的測試 harness 中繼承全域 `min-width: 960px`，本輪新增窄／直向 `.dynamic-control-screen { width: 100%; min-width: 0; min-height: 0; }` 覆蓋；兩個直向尺寸的頁面 `document.scrollWidth/scrollHeight` 現已與視口一致，沒有隱藏的頁面級 X 溢出。正式 App 原有的 `.portrait-lock` 仍保留。
- 本輪驗證通過：

```text
npx tsc --noEmit --pretty false
npm run test:creation-flow
node --no-warnings test-artifacts/dynamic-flow-20260818/verify-target-editor.mjs
node --no-warnings test-artifacts/dynamic-flow-20260818/verify-audio-flow.mjs
npm run build
git diff --check
```

- 生產構建完成 `1760` 個模組，只保留既有主 chunk 大於 `500 kB` 的提示。構建驗證後已清理／還原 `dist` 哈希生成物，不把機械產物混入本輪來源碼修改。
- `npm run lint` 目前無法執行，原因是倉庫本身沒有 ESLint 設定檔；命令在載入專案程式碼前即由 ESLint 終止，不能記成程式碼 lint 錯誤，也不能記成 lint 已通過。
- 修改前的本地 Git 備份節點仍是 `630f281f13721b8120c7116c5870474ea88a103f`（`feat: add linear creation flow and streamlined audio editor`）。本節修改仍在該節點之後的未提交工作樹；沒有新增提交，也沒有宣稱已推送，`origin/main` 仍是先前記錄的 `93e50c67`。
- 主測試頁 `http://localhost:5173/` 保持運行，同一區域網路可使用 `http://192.168.12.101:5173/`；兩個地址均已回傳 HTTP `200`。既有 `5188` 預覽服務也未被關閉。本輪只改 iPad 控制頁 JSX、CSS 與五語介面文字，沒有修改 Unity／PC 通訊協定、IndexedDB 格式或 EXE 播放語義，因此不重新生成 EXE；最新標準版與完整翻轉版仍為：

```text
desktop-runtime/release-target-loop-final-20260817
desktop-runtime/release-target-loop-vertical-final-20260817
```

## 33. 2026-08-19 背景編輯器右側設定欄防裁切重構

### 問題根因與介面重排

- 使用者回報「編輯背景」在 iPad 橫向時右側顯示不完整。檢查後確認，舊版高優先級 `.dynamic-background-modal.is-advanced .dynamic-background-playback:not(.fixed-mode)` 仍要求 `300px + 230px` 的橫向雙欄；右側實際可用寬度不足時，`切換間隔` 被父層 `overflow-x: hidden` 裁掉。
- 右側設定欄改為單一縱向設定流：`播放方式 → 切換間隔（非固定模式才顯示）→ 背景轉場 → 背景音樂`。播放方式維持三段式按鈕；轉場固定使用 `2 × 2` 選項，`應用轉場` 獨占一行；背景音樂拆成「音源選擇＋試聽」及「新增音源＋應用／清除音樂」兩行，避免四個控件在同一行互相擠壓。
- 右欄標題改為簡潔的「屬性」，每個設定概念以清楚的區塊標題呈現；轉場／音樂的套用範圍文字允許自然換行，不再被單行省略號截斷。所有主要按鈕與選擇控件維持至少 `44px` 觸控高度，音源下拉框維持 `16px` 字級以避免 iPad Safari 自動縮放。

### CSS 防溢出與觸控行為

- 背景編輯器雙欄比例調整為左側素材庫與右側設定欄約 `0.96fr / 1.04fr`，右側最小欄寬 `400px`；設定滾動容器及其子項明確設定 `width: 100%`、`min-width: 0`、`max-width: 100%`、`box-sizing: border-box`，並以單列 grid 讓所有內容沿欄寬收縮。
- 高優先級覆蓋舊版播放雙欄規則，避免未來級聯再次把間隔控件撐出欄外。背景音樂操作按鈕使用兩等分 grid，並對直接子按鈕補齊可收縮約束。
- 將背景彈窗祖先的 `touch-action: none` 改為 `pan-y`，設定滾動區使用 `touch-action: pan-y` 及 `-webkit-overflow-scrolling: touch`，確保真實 iPad／WebView 可以用手指捲到下方背景音樂區。未修改素材選取、拖曳排序、轉場套用、音源綁定或資料格式。
- 背景素材列表仍以 `.dynamic-background-modal .background-library-list { grid-template-columns: minmax(0, 1fr) !important; }` 固定單列，一行一張卡片；窄螢幕／直向仍維持素材庫在上、設定在下的順序。

### 三尺寸瀏覽器驗收

- 強制刷新 `5173` 測試頁後，在 `1024 × 768`、`1180 × 820`、`1366 × 1024` 驗證右欄：
  - 設定滾動區 `clientWidth / scrollWidth` 分別為 `428 / 428`、`486 / 486`、`486 / 486`；所有主要後代右邊界均不超出滾動區，沒有水平溢出。
  - 背景音樂面板及其 source／actions 兩列均無水平溢出；設定區可完整捲到底，`maxScrollTop` 分別為 `149`、`101`、`87`，背景音樂選擇、試聽、新增音源及應用音樂均可達。
  - 首次開啟 `1024 × 768` 時，右欄標題、三個播放模式、切換間隔與整個轉場 `2 × 2` 區塊均完整可見；向下捲動後背景音樂區完整呈現。
  - 三個尺寸的素材列表均只有一個 grid 列軌道，背景卡片保持一行一張；無欄位重疊，測試頁 `window.__flowHarnessErrors=[]`，沒有 JavaScript Runtime exception。驗收期間只見測試 harness 既有資源 `404`／外部連線拒絕訊息。

### 回歸、構建與目前狀態

- 本輪通過：

```text
npx tsc --noEmit --pretty false
npm run test:creation-flow
node --no-warnings test-artifacts/dynamic-flow-20260818/verify-target-editor.mjs
node --no-warnings test-artifacts/dynamic-flow-20260818/verify-audio-flow.mjs
npm run build
git diff --check
```

- `npm run build` 完成 `1760` 個模組；只保留既有主 chunk 大於 `500 kB` 的提示。構建後產生的 `dist` 哈希檔及 `dist/index.html` 已恢復，沒有把機械生成物留在工作樹。
- 本輪修改仍在本地 `630f281f` 之後的未提交工作樹，沒有新增提交或推送；未修改 Unity／PC 協定、IndexedDB 格式、EXE 或播放語義。`5173`（PID `15740`）及 `5188`（PID `9868`）均保持運行並回傳 HTTP `200`。

## 34. 2026-08-19 圖層／背景父子樹、流程聯動收斂與時間滾輪統一

### 舞台圖層與創作流程職責分離

- 「舞台結構／圖層」已由平鋪卡片改為沿用現有圖層視覺的父子樹。父子歸屬只讀取既有 `linkedAppearance`／`flowSummary.relationTree`；每個卡片仍顯示自己的真實 `item.order` 圖層編號，並以縮圖左上角角標呈現，因此父子分組不會被誤解為實際 Z 軸順序。
- 每個含子物件的圖層卡新增獨立 `44px` 展開／收起按鈕；收起時子分支會從 DOM 中卸載，拖曳命中不會抓到零尺寸隱藏卡。從舞台選中被收起的子物件時會自動展開其祖先，避免目前物件在圖層面板中消失。
- 圖層樹同級仍依真實圖層前後順序排列；拖曳與鍵盤上下移動只調整目前物件的單一 `item.order`，不攜帶整個子樹、不改 `linkedAppearance`。刪除父物件仍沿用既有單物件刪除／關係清理流程，不新增級聯刪除。
- 子物件使用連接線、較輕卡片背景、左側結構邊與「由父物件」短標籤共同表達層級，不只依賴顏色。每級總縮排控制在 `10–12px`，深度 3 後停止繼續縮排，避免 iPad 窄側欄壓縮名稱與摘要。
- 創作流程前期的動畫屬性不再顯示「物件聯動」卡；流程的物件佈局／動畫步驟也不再顯示舞台聯動虛線或屬性複製中的聯動選項。第三步「出場編排」維持唯一的流程關係設定入口；自由編輯仍保留完整關係編輯能力。

### 出場編排與背景父子繼承

- 第三步模式文案已在簡中、繁中、英文、葡萄牙文與波蘭文統一縮短；簡中由「全部同時出現／依主順序逐個出現」改為「全部出現／逐個出現」。兩個按鈕使用 roving `tabIndex`，支援左右方向鍵、Home、End 與至少 `44px` 觸控高度。
- 第四步「背景」的物件列表改為獨立可收起父子樹，收起狀態不與第三步共用。有效根物件可以選擇並設定背景；所有子物件改為只讀卡片，顯示鎖定圖示及「跟隨：父物件」，不再提供會誤導使用者的背景設定入口。
- 多層關係會解析到最上層根物件作為實際背景擁有者。若從其他步驟帶入子物件，背景設定區首幀即使用根物件資料，並同步把外部選中狀態切到根物件；循環、缺失父節點等異常資料維持鎖定兜底，不會錯誤開放編輯。
- 新增五語專用鍵 `flow.backgroundInheritedCardLabel` 與 `flow.backgroundFollowsNamed`，子物件的可見狀態及可存取名稱均包含父物件，不依賴縮排或鎖圖示才能理解。

### 背景／聲音時間輸入與自由編輯動畫

- `IntervalWheel` 新增相容參數 `allowDirectInput` 與 `className`；預設仍允許舊呼叫直接輸入，這輪三個指定位置均傳入 `allowDirectInput={false}`，因此完全不渲染 `input[type="number"]`，但保留上下拖動、滑鼠滾輪、方向鍵、相鄰值按鈕及 `spinbutton` 語義。
- 「編輯背景」的切換間隔只保留滑動滾輪，不再允許鍵盤數字輸入；秒／分鐘單位選擇保留，原有最小值、最大值、提交與背景播放資料語義均未改變。
- 創作流程聲音頁與自由編輯「音源」頁的延遲播放均改用同一滑動滾輪，範圍維持 `0–600` 秒、步長 `0.1` 秒。流程回調仍以毫秒寫入，自由編輯 handler 仍接收秒並轉為毫秒，沒有重複換算。
- 流程聲音延遲保持原 `86 × 44px` 區域；自由編輯延遲保持原 `78 × 30px` 視覺盒，實際拖動／鍵盤按鈕命中高度擴大到 `44px`。自由編輯數字視窗使用 `44 × 30px` 裁切與 `-7px` 軸心修正，長數值不會偏低或被水平裁切。
- 自由編輯動畫頁的「物件聯動」標題改為專用五語鍵 `control.appearanceOrder`（簡中「出場排序」），刪除重複的「由此物件觸發」標題行；既有關係卡、增加關係及「由其他物件控制」區域保留。
- 動畫預覽已擴展至左右切換按鈕原本佔用的整行寬度；兩個切換按鈕改為覆蓋在預覽左右邊緣的嚴格 `44 × 44px` 正圓，並分別覆蓋 hover、active 與 `ui-pressed` 變形，按下時不會垂直跳動。

### 三尺寸實機驗收、回歸與目前狀態

- 使用隔離 Edge／CDP harness 在 `1024 × 768`、`1180 × 820`、`1366 × 1024` 三個 iPad 橫向尺寸完成實測；一次性驗收腳本及臨時截圖已清理，不留在工作樹。
- 三個尺寸均確認：圖層根節點為 `Paper Plane`、兩個子節點按真實圖層方向排列、收起後 DOM 卡片由 `3 → 1`、真實圖層號可見、展開按鈕為 `44px`；背景樹只有 `1` 個可編輯根卡與 `2` 個只讀子卡，從子物件進入會解析至根物件。
- 三個尺寸均確認：流程佈局動畫頁沒有聯動卡／舞台虛線，流程複製彈窗沒有聯動複製項；「全部出現／逐個出現」文案與鍵盤單選語義正確；背景／流程聲音／自由聲音三處均沒有數字輸入框。
- 動畫預覽寬度與 carousel 寬度逐像素一致；左右按鈕均為 `44 × 44px` 且計算圓角為 `50%`。流程聲音滾輪為 `86 × 44px`；自由聲音滾輪視覺盒為 `78 × 30px`、命中高度為 `44px`。三個尺寸均有 `documentWidth === viewportWidth`、`window.__flowHarnessErrors=[]`。
- 本輪驗證通過：

```text
npx tsc --noEmit --pretty false
npm run test:creation-flow
node --no-warnings test-artifacts/dynamic-flow-20260818/verify-audio-flow.mjs
npm --prefix desktop-runtime run test:appearance
npm --prefix desktop-runtime run test:background-order
npm --prefix desktop-runtime run test:item-copy
npm run build
git diff --check
```

- `npm run build` 完成 `1760` 個模組，只保留既有主 chunk 大於 `500 kB` 的提示；構建後已恢復原有 `dist` 哈希產物，沒有把機械生成檔留在本輪工作樹。`npm run lint` 仍因倉庫沒有 ESLint 設定檔而在讀取專案程式碼前終止，不能記為 lint 通過或本輪程式碼錯誤。
- 本輪沒有新增 Git 提交或推送，修改仍位於本地回退節點 `630f281f13721b8120c7116c5870474ea88a103f` 之後的未提交工作樹；沒有改動 Unity／PC 協定、IndexedDB 格式、EXE 或播放語義，也沒有重新生成 EXE。最新標準版與完整翻轉版仍為：

```text
desktop-runtime/release-target-loop-final-20260817
desktop-runtime/release-target-loop-vertical-final-20260817
```

## 37. 2026-08-19 气泡物件、左右方向样式与标题遮罩

### Git 回退点与当前工作树

- 本功能开始前已经建立并推送远程回退点：`b903fe10 feat: checkpoint advanced editor and preview refinements`，当前 `origin/main` 仍指向该提交。
- 本地 `main` 另有未推送节点：`9b2ffc52 chore: checkpoint before bubble item experience`。不要重置、回退或删除该节点；当前气泡实现位于它之后的未提交工作树。
- 本轮最终实现尚未提交、尚未推送。`dist` 已随最新生产构建更新为新的哈希产物，这是正常构建结果，不是误删文件。

### 气泡作为舞台物件

- `DynamicItem` 现在兼容普通媒体物件与气泡物件；旧作品缺少 `kind` 时仍按普通媒体读取，不影响历史数据。
- 图层新增按钮保留两个清晰入口：「上传物件」继续调用原有文件输入与 iOS 原生来源选择，不替换相册、拍照或文件入口；「添加气泡」打开气泡编辑器。
- 气泡支持标题、正文、逐字显示／全部显示、字号、文字颜色、配色与逻辑尺寸。想象气泡额外支持图片，编辑器、Web 舞台与 EXE 播放端均使用 `contain + center`，任何长宽比都完整居中、不裁切、不拉伸。
- 没有增加独立的「左右翻转」属性或开关。左右方向直接作为同类型气泡的可选样式；方向只改变尾巴或想象圆点的位置，文字、标题和图片不会被镜像。

### 方向样式与旧数据迁移

- 对话气泡共有 3 种基础外观、每种左／右两个方向，共 6 种：

```text
dialogue-rounded-left
dialogue-rounded-right
dialogue-soft-left
dialogue-soft-right
dialogue-comic-left
dialogue-comic-right
```

- 想象气泡共有 2 种基础外观、每种左／右两个方向，共 4 种：

```text
thought-cloud-left
thought-cloud-right
thought-soft-left
thought-soft-right
```

- 旧的无方向样式仍可读取，并统一迁移为相同外观的右向版本：`dialogue-rounded`、`dialogue-soft`、`dialogue-comic`、`thought-cloud`、`thought-soft` 分别对应各自的 `*-right`。
- Web 编辑端与 EXE Canvas 播放端采用相同的方向语义；数据同步载荷与变更签名均包含新样式及标题遮罩字段。

### 标题遮罩与编辑器体验

- 新增 5 种标题遮罩：`rounded`（圆角）、`pill`（胶囊）、`ticket`（标签）、`underline`（下划线）、`none`（无）。旧气泡缺少该字段时默认使用 `rounded`，编辑已有气泡时不会因调用方省略字段而重置现有选择。
- 编辑器打开后先聚焦当前气泡类型，首屏直接呈现「气泡类型」与「气泡样式」；方向卡明确标注左／右。标准横屏使用预览与设置双栏，一般窄屏／直向切换为单栏；低高度窄横屏继续使用紧凑双栏，避免 `16:9` 预览把设置区压到不可见。方向样式在小屏为单列，标题遮罩为两列。
- 对话气泡显示 6 个方向样式，想象气泡显示 4 个方向样式；标题遮罩固定显示 5 个选择。主要操作按钮高度为 `48px`。新建取消会把焦点还给图层「+」，编辑已有气泡取消会恢复物件属性并聚焦缩略图入口，不再发生焦点争抢。

### 验收、构建与预览服务

- 浏览器专项验收已在 `1024 × 768`、`1366 × 1024`、`980 × 600` 与 `844 × 390` 通过：成功创建并重新编辑 `thought-cloud-left + ticket`，左右尾巴位置、五种遮罩计算样式、保存数据、超宽 `2400 × 300` 图片完整居中、文件输入、取消后的焦点恢复与页面溢出均已检查，`window.__flowHarnessErrors=[]`。最低的 `844 × 390` 尺寸仍保持双栏，设置区有 `223px` 可滚动高度。
- 验收截图：`test-artifacts/dynamic-flow-20260818/bubble-editor-thought-1024x768.png`。
- 本轮最终验证通过：

```text
npx tsc --noEmit --pretty false
npm run test:creation-flow
node --no-warnings desktop-runtime/renderer/bubble-render-core.test.mjs
npm --prefix desktop-runtime run test:appearance
npm --prefix desktop-runtime run test:item-copy
npm --prefix desktop-runtime run test:target-motion
npm --prefix desktop-runtime run test:background-order
npm --prefix desktop-runtime run test:transition-audio
node --no-warnings test-artifacts/dynamic-flow-20260818/verify-bubble-editor.mjs
npm run build
```

- `npm run build` 完成 `1766` 个模组，只保留既有主 chunk 大于 `500 kB` 的提示。当前构建产物为 `index-Ckx0mzz9.js`、`index-D4mqfaO5.css`、`web-C6xjBT6d.js`。
- Vite 测试服务继续由 PID `15740` 监听 `0.0.0.0:5173`；本机地址 `http://localhost:5173/` 与当前局域网地址 `http://192.168.1.39:5173/` 均返回 HTTP `200`。旧地址 `192.168.12.101` 已不属于当前网卡，请勿继续沿用。

## 38. 2026-08-19 标题遮罩改为第三种独立文字物件

### 对第 37 节标题遮罩理解的纠正

- 第 37 节把「标题遮罩」记录成了对话／想象气泡内部的标题配置，这不是使用者最终需要的结构。本节以最终实现为准：标题遮罩现在是「气泡类型」中的第三种独立舞台物件，与「对话气泡」「想象气泡」并列，不再附着在其他气泡内部。
- 编辑器中的类型结构现在是：

```text
气泡类型
├─ 对话气泡
├─ 想象气泡
└─ 标题遮罩（独立标题文字）
```

- 新建对话／想象气泡不再产生内嵌 `title`，界面也不再提供内嵌标题或标题遮罩设置。旧作品中的 `title`、`titleMaskId`、`paletteId` 仍保留读取、重新保存和播放兼容，避免编辑旧作品时静默丢失内容，但它们不再是新建标题的编辑入口；把只有旧 `title`、正文为空的气泡切换为独立标题时，会先把旧文字迁移到 `bodyText`。

### 独立标题的数据与样式约定

- 新增正式类型 `bubbleType: 'title'`，标题文字统一写入 `bodyText`，`title` 固定保存为空字符串。若旧标题类型数据只有 `title`、没有 `bodyText`，读取时会自动把旧文字回填到 `bodyText`。
- 独立标题默认逻辑尺寸为 `900 × 220`，支持「全部显示／逐字显示」、逐字速度、字号和文字颜色；标题类型会主动剥离图片，不会产生气泡面、对话尾巴、想象圆点或图片节点。
- 五种正式标题样式为：

```text
title-rounded    圆角
title-pill       胶囊
title-ticket     标签
title-underline  下划线
title-none       无（纯文字）
```

- `title-rounded` 在 Web 端使用仓库根目录的 `圆角矩形.png` 作为真实 CSS mask；EXE Canvas 端按同一视觉语义绘制。胶囊、标签、下划线和纯文字均有独立 Web／Canvas 实现。
- 新增 `maskColor` 与 `maskOpacity`。数据层和同步协议中的透明度范围为 `0..1`，编辑器显示为 `0..100%`，默认值为 `0.92`。透明度只作用于遮罩本身，不会降低文字透明度。
- 选择 `title-none` 时只显示文字，并从 DOM 和 Tab 顺序中移除无意义的遮罩颜色／透明度控件；切回其他样式后会恢复先前的遮罩设置。
- 对话仍有 6 个左右方向样式，想象仍有 4 个左右方向样式；旧无方向样式继续迁移到对应右向版本。同步端只会为想象气泡上传图片资源，标题与对话类型不会误传遗留图片。

### 编辑器、舞台与控制页体验

- 图层「+」菜单继续保留原有「上传物件」入口，文件输入没有强制 `capture`，因此 iOS 原生相册、拍照和文件选择流程不受影响；「添加气泡」入口现在可继续选择对话、想象或标题三种类型。
- 标题类型第二步直接显示五种标题样式，第三步只保留单行「标题文字」输入；后续显示方式、字号、文字颜色、遮罩颜色及遮罩透明度均在同一线性编辑器内完成。
- 控制页保存后以 `bodyText` 首行作为物件名称，空标题兜底名为「标题遮罩」；属性缩略图使用 `Type` 图标，并提供「编辑标题遮罩」入口。新建取消时焦点回到图层「+」，编辑取消时焦点回到物件属性缩略图。
- Web 舞台、图层缩略图和 EXE Canvas 播放端使用相同的独立标题结构。标题逐字播放、颜色、透明度、尺寸与五种外观在两端保持一致。
- `prefers-reduced-motion: reduce` 下原有规则只改 `transition-duration`，会意外为所有元素制造 `1ms` 的全属性过渡，导致胶囊样式切换首帧仍显示直角。本轮改为完整关闭 `animation` 与 `transition`，既消除错误帧，也符合减少动态效果的可及性语义。

### 专项验收、回归与生产构建

- `test-artifacts/dynamic-flow-20260818/verify-bubble-editor.mjs` 已在 `1024 × 768`、`1366 × 1024`、`980 × 600`、`844 × 390` 四种尺寸通过，覆盖三种类型、全部左右方向样式、五种标题样式、逐字显示、超宽 `2400 × 300` 图片完整居中、自定义遮罩色、`42%` 透明度、保存后重新编辑、焦点恢复、触控尺寸及页面无溢出。
- 标题专项截图：

```text
test-artifacts/dynamic-flow-20260818/title-mask-editor-1024x768.png
```

- 本轮最终验证全部通过：

```text
npx tsc --noEmit --pretty false
npm run test:creation-flow
node --no-warnings test-artifacts/dynamic-flow-20260818/verify-bubble-editor.mjs
node --no-warnings desktop-runtime/renderer/bubble-render-core.test.mjs
npm --prefix desktop-runtime run test:appearance
npm --prefix desktop-runtime run test:item-copy
npm --prefix desktop-runtime run test:target-motion
npm --prefix desktop-runtime run test:background-order
npm --prefix desktop-runtime run test:transition-audio
npm run build
git diff --check
```

- `npm run build` 完成 `1766` 个模组，只保留既有主 chunk 大于 `500 kB` 的提示。当前生产构建哈希为：

```text
dist/assets/index-a5ybb-Vg.js
dist/assets/index-DwPqOVwu.css
dist/assets/web-C70OfG2f.js
```

- 当前本地 `HEAD` 仍为 `9b2ffc52 chore: checkpoint before bubble item experience`，远程回退点仍为 `b903fe10 feat: checkpoint advanced editor and preview refinements`。本节实现位于未提交工作树，尚未新增提交或推送。
- Vite 测试服务继续由 PID `15740` 监听 `0.0.0.0:5173`；`http://localhost:5173/` 与 `http://192.168.1.39:5173/` 均已重新验证并返回 HTTP `200`。

## 39. 2026-08-20 登录、互动上载、舞台水印与高清 EXE 同步

### Git 回退点与本轮范围

- 开始修改前已把第 38 节独立标题物件版本提交并推送到 `origin/main`：

```text
4f2d024b feat: add standalone bubble and title items
```

- 本节修改位于该回退点之后的本地工作树，尚未再次提交或推送。修改同时覆盖 iPad/Web 控制端和 Windows 标准／完整翻转播放端。

### 登录与作品档案入口

- 登录邮箱与密码输入框统一使用纯白内容底色；WebKit `:-webkit-autofill` 与标准 `:autofill` 分开覆盖，保留 `autocomplete="email"`、`autocomplete="current-password"` 和系统密码管理能力。焦点只改变边框与焦点环，密码显示按钮触控区为 `44 × 44px`。
- 新增共享 `BrandLogo` 组件，首页与登录页使用同一张 `Right_Logo.png` 和同一组视觉尺寸：标准横屏 `128px`、紧凑屏幕 `96px`。
- “进阶功能”开关从设置页迁移到作品档案顶部工具栏。开关即时保存；关闭时强制进入自由编辑、隐藏创作流程并沿用平铺图层行为，但不会删除作品已有的联动、背景或音源数据。`1100px` 以下隐藏长标签，`900px` 以下进一步压缩，仍保留原生 checkbox、键盘焦点和至少 `44px` 触控语义。

### 互动艺术线性上载体验

- 已选主题的正式 `cover` 现在显示在快速上载页标题旁，尺寸会在 `44–52px` 间响应变化，固定圆角、完整参与主题卡进入上载页的共享转场，不会提前闪现。图片属于与标题重复的装饰识别信息，使用空替代文本避免读屏重复。
- 完成页主按钮统一为“重新上载”；确认后保留当前主题并直接返回图片／遮罩选择流程。“返回选项”同样保留当前主题，但关闭选择器并返回该主题的基础上载入口，不再退回主题列表。相关回调与五语 key 已从 `BackToThemes` 语义改为 `BackToOptions`。
- 新增原创程序化火箭发射音效服务，默认主音量为 `1`。声音由点火、上升滑音、低频发动机、带通气流和星点音组成，输出经过压缩器；重复触发会停止上一段，失败反向动画和组件卸载会清理全部节点。旧的短促 `artwork-send` 已移除，到达提示音继续保留。AudioContext 在用户点击的同步调用链中创建／恢复，iOS 首次点击可播放；音频异常不会阻断上载。

### 舞台水印与跨端协议

- `NetworkSettings` 新增独立 `watermarkEnabled`，旧设置缺少字段时默认开启。设置页原进阶功能位置改为“舞台水印”，内容固定为 `MagicFloor`；保存后会发送轻量 `DisplaySettings` 事件并标记接收端需要完整重同步。
- Web 控制页在舞台内部绘制斜向重复 SVG 水印，位于作品和背景转场之上，`pointer-events: none`、`aria-hidden=true`，不会覆盖工具栏或拦截编辑操作。
- `GroupStateSync`、`GroupSelectAndSync`、`PreviewMode` 均携带 `watermarkEnabled`。EXE 新增独立顶层持久化状态；只有显式 boolean 才会更新，旧消息缺字段或字段非法时保留当前值。
- EXE 使用缓存 Canvas 生成斜向重复水印，在物件与背景转场完成后绘制并剪裁到 `1920 × 1080` 舞台；作品档案镜像不绘制。标准版与完整翻转版共用同一 `player.js` 和显示核心，水印跟随整套最终翻转变换。

### 动态艺术图片质量

- 复核确认媒体链路没有二次压缩：原始 `File` 进入 Capacitor 文件／IndexedDB Blob，经 FormData 发送后由 EXE 按原始字节落盘并使用自然尺寸解码；控制页和 EXE 都不会拿作品档案缩略图代替正式物件素材。
- Web 行走和 Unity 动画 Canvas 不再固定封顶 `1.5×`。新像素比会综合设备 DPR 与物件缩放倍率，最高 `4×`，同时限制单 Canvas 为约 `8 Mi` 像素和 `4096px` 单边，兼顾 Retina 清晰度与 iPad 内存。
- Web 动画画布与 EXE 主舞台、背景源、档案转场 Canvas 均显式启用 `imageSmoothingEnabled=true`、`imageSmoothingQuality='high'`。静态物件继续直接显示原图，不新增 JPEG 转码或低质量中间层。

### 构建、同步、测试与最新 EXE

- Web 与桌面回归全部通过：

```text
npx tsc --noEmit --pretty false
npm run test:creation-flow
npm run build
npm run sync:ios
npm --prefix desktop-runtime run test:presentation
npm --prefix desktop-runtime run test:appearance
npm --prefix desktop-runtime run test:item-copy
npm --prefix desktop-runtime run test:target-motion
npm --prefix desktop-runtime run test:background-order
npm --prefix desktop-runtime run test:transition-audio
node --no-warnings desktop-runtime/renderer/bubble-render-core.test.mjs
node --check desktop-runtime/main.js
node --check desktop-runtime/renderer/player.js
git diff --check
```

- `test:presentation` 新增 9 项测试，覆盖水印默认值、开关、旧消息兼容、事件白名单、舞台剪裁、重复斜向绘制、绘制层级、高质量采样，以及标准／翻转构建清单。
- `npm run sync:ios` 已将本轮生产资源复制到 `ios/App/App/public`。当前生产文件为：

```text
dist/assets/index-B7x3wUhd.js
dist/assets/index-B14wo2Bm.css
dist/assets/web-Dp1DAus6.js
```

- 按“每次生成 EXE 自动删除旧版本”的规则，已移除：

```text
desktop-runtime/release-target-loop-final-20260817
desktop-runtime/release-target-loop-vertical-final-20260817
```

- 当前 `desktop-runtime/` 下只保留本轮两套发布目录。标准版：

```text
desktop-runtime/release/MagicFloor Dynamic Player 0.1.0.exe
85,310,958 bytes
SHA-256 348006C7BD5288D70A64927BFECD490D5739A01C3F37AB2B5EBBA5055C5A5D15
```

- 完整翻转版：

```text
desktop-runtime/release-vertical-flip/MagicFloor Dynamic Player Vertical Flip 0.1.0.exe
85,297,850 bytes
SHA-256 EE47C2CC5303BC3A1EA79F4753F4B627870345AF0B2B4ACEDFB6F9D63A921668
```

- 两套 `app.asar` 均已确认包含 `runtime-display-settings-core.cjs`、`renderer/stage-presentation-core.js` 和新版 `renderer/player.js`。标准版与完整翻转版分别实际启动；两者 `/status` 均返回 `server.status=listening`、`server.port=8080`、`view.mode=archive`、`watermarkEnabled=true`，退出后 `8080` 均已释放。
- 测试页服务继续运行：`5173`（PID `15740`）和 `5188`（PID `9868`）均返回 HTTP `200`；本机／局域网主测试地址为 `http://localhost:5173/`、`http://192.168.1.39:5173/`。

### 2026-08-20 水印透明度调整

- 根据实机视觉反馈，Web 控制页、标准 EXE 与完整翻转版 EXE 的 `MagicFloor` 水印主体及描边统一调整为 `44%` 不透明度，即 `56%` 透明度。桌面端使用共享常量 `DEFAULT_STAGE_WATERMARK_OPACITY = 0.44`，相关绘制测试会直接断言该值，避免双端后续再次出现不一致。
- 调整后重新执行 `npm run sync:ios` 和 `npm --prefix desktop-runtime run pack:all`；两个新 `app.asar` 均已直接读取并确认 `DEFAULT_STAGE_WATERMARK_OPACITY=0.44`。标准版与完整翻转版再次实际启动成功，退出后 `8080` 均正常释放；上方记录的生产文件名、EXE 大小与 SHA-256 已更新为本次 44% 版本。

### 2026-08-20 键盘控制页大旋钮中心按键

- 移除设备面板右下角的 `KEYBOARD CONTROLLED / Keyboard Controller` 雕刻文字。
- 底部大旋钮的 `MagicFloor` 中心标识由 `9px / 15px` 放大为 `18px / 30px`，维持原有金属盘纹理和旋转功能。
- 大旋钮中心金属圆盘新增独立按压热区；外圈刻度与齿圈仍只负责左右旋转。中心按下会显示与 4 × 4 键帽一致的整体下沉、变暗及回弹反馈，并复用键帽按下／释放音效。
- 中心按键发送与 4 × 4 第 16 键完全相同的 `MF|RemoteKeyboard|Press|{"keys":["LeftControl","LeftAlt","Alpha8"]}`，没有新增协议或 Unity 键名。
- 正式双视口测试覆盖 `1024 × 768` 与 `1366 × 1024`，验证右下角文字消失、中心按压／释放状态、下沉变换、双倍 Logo 字号、中心与第 16 键信号完全相同，以及原旋钮 Turn 行为不受影响。
- 已重新执行 `npm run sync:ios`，本轮生产资源为：

```text
dist/assets/index-CHlBZh7O.js
dist/assets/index-BZROWXVx.css
dist/assets/web-tNRFfU7g.js
```

- 已按自动清理旧发布目录的规则重新生成标准版与完整翻转版 EXE。标准版：

```text
desktop-runtime/release/MagicFloor Dynamic Player 0.1.0.exe
85,310,959 bytes
SHA-256 B0EBF4B963EF61F7E9757471CC4B736B0712D140175FE79035E1C4B93AF942BA
```

- 完整翻转版：

```text
desktop-runtime/release-vertical-flip/MagicFloor Dynamic Player Vertical Flip 0.1.0.exe
85,297,851 bytes
SHA-256 08AC9D0DEFC0888B1FBB9EFED263D5E4ED08E37689A84759B8E4F6A1D8593097
```

### 2026-08-20 固定自由编辑与跨端同步重构

- 回退节点已建立：`32c51fa7 chore: checkpoint before editor mode redesign`。本节之后的变更尚未提交，完成验收后再创建正式功能提交。
- 创作流程入口、流程导航、自由／流程切换和作品档案页进阶开关全部隐藏；`advancedFeaturesEnabled` 新旧设置统一迁移为 `true`，作品进入后固定使用进阶自由编辑。旧流程 session、字段和协议仍保留以兼容历史作品。
- 自由编辑图层、物件属性和舞台套用创作流程的玻璃卡片、圆角、间距与响应式宽度；父子图层树继续保留，可展开／收起，原有动画、目标点、音频、背景、气泡与标题遮罩数据不变。
- Web/iPad 控制页水印改为舞台中央两行 `MagicFloor`／`preview`，两条对角装饰线，SVG 使用 `xMidYMid meet`，整体不透明度 `0.44`（透明度 `0.56`），不拦截触控。EXE 永不创建或合成水印；协议字段仍保留，桌面状态额外报告 `watermarkVisible=false`。
- 背景转场改为作品级唯一设置，编辑器的“套用转场”始终写入全部背景；旧背景的单独转场值在读取、保存和桌面接收时统一归一化。
- 接收端同步签名纳入物件名称、位置、缩放、旋转、翻转、动画、移动、目标点、联动、音频、背景范围、气泡内容、背景转场／音乐与时间线。素材签名与状态签名分离，属性调整不会重复上载未变素材；同一作品的同步请求串行排队，预览启动前等待最新状态完成。
- EXE 的组状态与预览状态固定 `advancedFeaturesEnabled=true`，即使旧 iPad 发送 `false` 也按唯一自由模式播放。标准版与完整翻转版共用该行为。
- 键盘控制页 4×4 后两行预设文字使用专用响应式字号（数字约 `25–32px`、说明约 `10–13px`），最大旋钮中心复用首页 `BrandLogo`／`Right_Logo.png`，保留中心按压与 `Alpha8` 协议。
- 新增回归：`npm run test:receiver-sync`、更新 `test:creation-flow` 与双视口键盘／图层布局检查；旧图层测试改为验证父子卡片和子物件继承父背景。

### 2026-08-20 本轮最终验收补充

- 图层布局回归已在 `1024 × 768` 与 `1366 × 1024` 通过：右侧面板、舞台、背景编辑弹窗均在视口内，父子图层树可展开／收起，背景转场全量套用、预览淡入淡出和音频停止状态均符合预期。
- 已通过 `npx tsc --noEmit --pretty false`、`npm run test:receiver-sync`、`npm run test:creation-flow`、`npm --prefix desktop-runtime run test:presentation`、`test:appearance`、`test:background-order`、`test:transition-audio`、`test:target-motion`、`test:item-copy` 与 `git diff --check`。
- 标准版与完整翻转版 EXE 均在清除当前终端的 `ELECTRON_RUN_AS_NODE=1` 后实际启动；`/status` 返回 `server.status=listening`、`server.port=8080`、`preview.advancedFeaturesEnabled=true`、`watermarkVisible=false`，测试结束后端口已释放。若在本机直接双击 EXE，不应把 `ELECTRON_RUN_AS_NODE` 设为 `1`。
- 本轮最终发布文件：标准版 `desktop-runtime/release/MagicFloor Dynamic Player 0.1.0.exe`（85,310,945 bytes，SHA-256 `09671A87EF11126B4BF0B0689F8AE85A1F5378ACC7A74C8834AAB83261ECAB83`）；完整翻转版 `desktop-runtime/release-vertical-flip/MagicFloor Dynamic Player Vertical Flip 0.1.0.exe`（85,297,792 bytes，SHA-256 `CCE3F65423F77A24E7F6DA77A4AD332CAD35156042031D64704CBF441DBDCA34`）。
- 旧记录中关于“EXE 绘制水印／桌面端 44% 水印”的描述属于此前版本；自本节起以“EXE 永不绘制水印、仅 Web/iPad 控制页显示 44% 水印”为准。`watermarkEnabled` 协议字段仍保留，只用于兼容旧消息。

## 40. 2026-08-24 出场文案、气泡矢量重构、颜色编辑与双端同步

### 出场排序文案

- 控制页右上角入口由“出场设定”改为“出场排序”；出场面板自身标题与无障碍名称继续使用“出场设定”，没有改变页面结构或播放逻辑。
- 出场间隔文案由“间隔 {{value}} 秒”改为“指定 {{value}} 秒出场”；繁中、英文、葡萄牙文与波兰文同步使用自然对应文案。`appearMode`、`appearIntervalMs`、出场动画和 EXE 时间线逻辑均未改动。

### 气泡样式与编辑体验

- 根目录 `气泡.png` 只作为造型参考，不直接进入运行时资源；其白色噪点、锯齿和双重描边没有复制进 Web、iOS 或 EXE。
- 新增共享 `desktop-runtime/renderer/bubble-shape-catalog.js` 与类型声明，Web SVG 和 EXE Canvas 共同读取同一套路径、方向、安全内容区、默认尺寸、默认填色、默认外框色和外框宽度。
- 对话气泡保留三组、每组左右各一：圆角、长尾、硬朗漫画；想象气泡只保留经典想象云朵左右一对。尾巴与对话框使用同一闭合路径，缩放时不会出现接缝；想象圆点在非等比宽高下也会按同样的椭圆比例同步到 Web 与 EXE。
- 样式选择卡直接显示真实矢量缩略图，不再使用旧 CSS 方块模拟；简中、繁中、英文、葡萄牙文和波兰文已补齐样式、方向、颜色、恢复默认及对比度提示。
- 对话／想象气泡新增“气泡颜色”：样式默认、白色、暖白、柔黄、珊瑚、天蓝、薄荷绿、淡紫、自定义，以及“恢复样式默认”。用户只选择气泡填色，外框色自动推导；文字颜色继续独立编辑，低对比度时提示改用深色或浅色文字。
- 标题遮罩仍保留圆角、胶囊、标签、下划线、无五种，以及原有遮罩颜色和透明度设置，没有混入气泡填色逻辑。
- 气泡正文使用共享安全内容区；Web 与 EXE 的正文字号比例、字重、行高、水平留白、图文想象气泡 `48% / 52%` 分区、描边宽度、圆角连接和圆角端点已进一步统一。想象气泡图片继续使用 `contain + center`，任何横竖比例均完整显示且居中。
- 舞台上的气泡现在单指轻点即可直接打开气泡编辑器；普通图片仍打开物件属性。超过 `8px` 的拖动、双指缩放／旋转、`pointercancel`、丢失捕获、目标点编辑和预览模式均不会误开编辑器。

### 存储迁移与 EXE 协议

- 气泡内容升级为 `schemaVersion: 2`，新增必有字段 `surfaceColor`、`outlineColor`。旧档缺少颜色时按原样式补齐默认色，不会把历史作品全部改成同一种颜色。
- 旧 `thought-soft-left`、`thought-soft-right` 分别迁移为同方向的 `thought-cloud-left`、`thought-cloud-right`；旧无方向 `thought-soft` 回退为右向云朵。Web 存储、共享 catalog 和 EXE normalization 三层使用相同迁移规则。
- `GroupStateSync` 与单物件 payload 显式携带两种颜色；颜色进入状态签名但不进入素材签名，因此改色会立即同步 EXE，却不会重复上载未变化的图片。
- 标准版与完整翻转版继续共用 `player.js`、`bubble-render-core.js` 和共享 shape catalog；两份 `app.asar` 均已确认包含新目录。EXE 不显示水印，固定使用进阶自由编辑播放策略。

### 自动化、构建与正式发布

- 最终回归全部通过：

```text
npx tsc --noEmit --pretty false
npm run test:receiver-sync
npm run test:creation-flow
node --no-warnings desktop-runtime/renderer/bubble-render-core.test.mjs
node --no-warnings test-artifacts/dynamic-flow-20260818/verify-bubble-editor.mjs
npm --prefix desktop-runtime run test:presentation
npm --prefix desktop-runtime run test:appearance
npm --prefix desktop-runtime run test:background-order
npm --prefix desktop-runtime run test:transition-audio
npm --prefix desktop-runtime run test:target-motion
npm --prefix desktop-runtime run test:item-copy
node --check desktop-runtime/main.js
node --check desktop-runtime/renderer/player.js
node --check desktop-runtime/renderer/bubble-shape-catalog.js
git diff --check
```

- 气泡 CDP 端到端检查在 `1024 × 768`、`1366 × 1024`、`980 × 600`、`844 × 390` 全部通过，覆盖：对话六款、想象两款、左右方向、真实 SVG、预设／自定义／恢复默认、颜色与外框持久化、schema 2、图片完整居中、标题五款、舞台轻点编辑、拖动防误触、双指防误触、弹窗不裁切与页面无横向溢出。当前视觉截图为：

```text
test-artifacts/dynamic-flow-20260818/bubble-editor-thought-1024x768.png
test-artifacts/dynamic-flow-20260818/title-mask-editor-1024x768.png
```

- 已执行 `npm run sync:ios`；`dist` 与 `ios/App/App/public` 的对应 SHA-256 完全一致。本轮生产资源为：

```text
dist/assets/index-Dnb76Bpa.js
dist/assets/index-3TekHKR6.css
dist/assets/web-BO1NvTWE.js
```

- 已执行 `npm --prefix desktop-runtime run pack:all`；打包前自动删除旧 `release` 和 `release-vertical-flip`，当前只保留两套本轮发布目录。标准版：

```text
desktop-runtime/release/MagicFloor Dynamic Player 0.1.0.exe
85,312,916 bytes
SHA-256 08867849024DCA218C63B09B086C38A6DF79DDF51014A43B6260F4D0E4285D7F
```

- 完整翻转版：

```text
desktop-runtime/release-vertical-flip/MagicFloor Dynamic Player Vertical Flip 0.1.0.exe
85,300,159 bytes
SHA-256 AA895CA0BC75412E044198CDA367ED6C6A8328B4FF03D425EDB01FA421D1A63A
```

- 两套 EXE 均在清除 `ELECTRON_RUN_AS_NODE` 并设置隐藏测试窗口后实际启动成功；`/status` 返回 `server.status=listening`、`server.port=8080`、`view.mode=archive`、`preview.advancedFeaturesEnabled=true`、`watermarkVisible=false`。逐套退出后 `8080` 均已释放。
- 测试页服务已切换为局域网监听，PID `58260` 绑定 `0.0.0.0:5173`；`http://127.0.0.1:5173/` 与 `http://192.168.12.101:5173/` 均返回 HTTP `200`。
- 当前 `HEAD` 仍为回退节点 `32c51fa7 chore: checkpoint before editor mode redesign`；`main` 相对 `origin/main` 为 ahead 1。本节修改仍位于未提交工作树，没有擅自创建新的功能提交或推送。

## 41. 2026-08-24 水印、背景间隔与关联子物件属性收敛

### 舞台水印

- Web/iPad 舞台中央的 `MagicFloor`／`preview` 水印继续保持整体 `44%` 不透明度，EXE 继续永不绘制水印。
- 两条对角线此前只有半透明纯白实线，在浅色背景上会融入画面，而且实际上没有设置虚线。现在改为 `10px` 圆端点虚线，节奏为 `30px / 20px`，并加入深色双层阴影；白色、黑色、彩色图片及视频背景上都能辨识。
- SVG 继续使用 `vector-effect: non-scaling-stroke`、`pointer-events: none` 与 `aria-hidden=true`，缩放舞台时线宽稳定，也不会拦截物件编辑手势。

### 背景切换间隔

- 编辑背景页的“切换间隔”仍是全宽设置行，但数值与单位控制组收紧为约 `198px`：数值轮 `108px`、单位列 `82px`、间距 `8px`，右侧对齐；不再让数值输入区域横跨整个属性栏。
- `IntervalWheel` 的上下拖动、鼠标滚轮、键盘方向键、数值范围、单位换算、`onChange` 与 `onCommit` 均未改动；触控高度和展开邻值所需空间保持原样。

### 关联子物件背景

- 判断规则为 `Boolean(selectedItem.linkedAppearance?.triggerItemId)`。存在父物件的子物件会从物件属性导航中完全移除“背景”标签，对应背景内容也不渲染；不是置灰或禁用。
- 普通物件和父物件仍显示背景属性。若用户原本停留在背景页后切换到关联子物件，界面立即安全回到“移动”标签，不会出现空白面板；解除关联后背景标签自动恢复。
- 子物件自己的 `backgroundIds` 不再在作品加载、普通属性保存或建立联动时被父物件覆盖。存储保留其历史背景范围，舞台与 EXE 则通过运行时有效背景计算继续跟随父物件；解除关联后可恢复并继续编辑原有背景范围。
- `GroupStateSync` 的既有兼容载荷和 EXE 的背景继承播放逻辑保持可用，没有删除字段或更改协议版本。

### 验收、构建与同步

- `1024 × 768` 与 `1366 × 1024` 的真实 Edge/Playwright 回归均通过：父物件背景标签 `1` 个、关联子物件背景标签与内容均为 `0`；数值轮实际宽约 `105.84px`，键盘与向上拖动分别从 `5 → 6 → 7`；页面无横向溢出；子物件历史背景保持为 `bg-ocean`，真实解除关联并切换回该背景后，背景标签和内容均恢复为 `1`。
- 水印实际计算样式为 `opacity: 0.44`、`stroke-dasharray: 30px, 20px`，滤镜生效且 `pointer-events: none`。测试截图位于 `transition-portal-preview/test-artifacts/linkage/ipad-air-layers.png` 与 `ipad-pro-12-9-layers.png`。
- 已通过 `npx tsc --noEmit --pretty false`、`npm run test:creation-flow`、`npm run test:receiver-sync`、`npm --prefix desktop-runtime run test:appearance`、`test:background-order`、`test:presentation`、气泡渲染核心测试、双视口 `verify-linkage-layout.mjs` 与 `git diff --check`。
- 已重新执行 `npm run sync:ios`；`dist/index.html` 与 `ios/App/App/public/index.html` 的 SHA-256 均为 `F2234F549E819FE527D873C1957BCD23EDA7C0C4ABBA440DC002C091A1A3DA28`。当前正式资源为：

```text
dist/assets/index-D_b5WkUV.js
dist/assets/index-P2irPcYf.css
dist/assets/web-DnmLRCw3.js
```

- 本轮没有修改桌面渲染核心或 EXE 协议；现有标准版与完整翻转版已经具备运行时父背景继承能力，因此无需重复打包，继续使用第 40 节记录的两套 EXE。

## 42. 2026-08-24 返回首页确认与 Unity 关闭信号

### 返回流程

- 作品档案根目录的返回按钮现在先打开共享确认弹窗；位于子资料夹时仍只返回上一层，不弹窗也不发送关闭信号。
- 互动艺术选项页的返回首页按钮使用同一个确认弹窗。取消、关闭、遮罩点击和 `Escape` 都只关闭弹窗，不离开页面。
- 确认后按钮立即锁定，iPad 只发送一次关闭命令，再执行原有首页 backward／档案返场动画；同步 ref 防止快速双击重复发送。
- 弹窗使用 `alertdialog`、焦点陷阱、默认聚焦取消按钮、可访问名称与说明、至少 `48px` 触控目标、窄屏上下排列和减少动态模式。

### 五语翻译

- 新增 `homeReturn.*` 六组文案，已同步简体中文、繁体中文、英文、葡萄牙文和波兰文：标题、动态艺术说明、互动艺术说明、留在当前页、返回首页和返回中状态。
- 普通用户只看到“返回首页后会关闭当前体验”，不会看到 EXE、端口或网络协议等技术细节。

### Unity 关闭协议

- 新增两条 `text/plain` 指令：

```text
MF|AppLauncher|Close|dynamic-art
MF|AppLauncher|Close|interactive-art
```

- `interactive-art` 是四个互动艺术 EXE 共用的单一范围，由 Unity 根据当前运行状态自行判断关闭哪个程序；没有对应程序时按幂等无操作处理。
- `src/services/unityBridge.ts` 新增关闭范围类型、消息构造器和发送函数，仍使用设置中的 `wsIp` 与 `interactivePort`（默认 `11701`），沿用现有 fire-and-forget 行为。
- 根目录 `ImageFileSaveHttpServer.cs` 新增关闭命令解析队列及 `onDynamicArtClose`、`onInteractiveArtClose` 两个主线程 `UnityEvent`。脚本本身不直接杀进程，Unity Inspector 需将两个事件分别绑定到实际关闭方法。
- 现场 Unity 工程必须同步替换该 C# 脚本并重新检查 Inspector 事件绑定；只更新 iPad 构建不会让旧接收端识别 `Close` 指令。

### 本轮验证

- 已通过 `npx tsc --noEmit --pretty false`、`npm run build`、`npm run test:receiver-sync`、`npm run test:creation-flow` 与 `git diff --check`。
- 已在 `1024 × 768` 触控视口的真实 Edge 中逐一验证简体中文、繁体中文、英文、葡萄牙文和波兰文：标题、动态／互动说明、取消、确认与返回中状态均读取对应语言；`alertdialog`、默认取消焦点、`Escape` 取消、遮罩关闭及确认锁定行为正常。
- 真实交互已确认：作品档案子文件夹只返回上一层，不弹窗也不发送关闭命令；档案根目录与互动艺术选项页确认后分别只发送一次 `dynamic-art`／`interactive-art`，同步双击不会重复发送。
- 已执行 `npm run sync:ios`；焦点竞态修复后的当前生产资源为 `dist/assets/index-C1yA9Y3Q.js`、`dist/assets/index-2l8Wt32n.css`、`dist/assets/web-A1gN5mVB.js`，并已复制到 `ios/App/App/public`。
- 尚未生成新的 Windows EXE；关闭协议由 Unity 接收端处理，动态艺术渲染核心没有改变。

## 43. 2026-08-24 EXE 作品档案镜像底层背景

### 显示规则

- EXE 的作品档案页继续将 iPad 首页和作品档案截图以 `object-fit: contain` 完整居中显示，不放大裁切截图内容。
- 4:3 iPad 截图放入 1920 × 1080 的 16:9 画面时，中央截图宽度约为 `1440px`，左右各保留约 `240px`。这些区域现在显示当前 MagicFloor 首页背景 `magic-floor-background.webp`，不再显示纯色留白。
- 根因是两张全屏镜像 `<img>` 原有的不透明背景色覆盖了底层首页背景；现已将 `archive-source-image` 与 `archive-mirror-image` 的背景改为透明。既有层级保持为：首页背景 → 首页源截图 → 作品档案截图 → 门户转场，协议与动画逻辑未改动。
- Web 首页和 EXE 使用的两份背景文件均为 `136580` bytes，SHA-256 均为 `D32CB28BB6EBAE4721739D1A5DAAB4ED14EDBDC81E8ED94A2144C93E6C2F0C10`。
- 标准版与完整翻转版共用同一份 `renderer/styles.css` 和背景素材，因此两版同步生效；翻转版继续对底图和镜像整体应用既有翻转。

### 回归与发布

- `test:presentation` 新增档案镜像层级检查，验证底层引用首页背景、两张镜像保持 `contain`、镜像背景透明，并直接比较 Web／EXE 背景文件内容完全一致。
- 已在真实 Chromium `1920 × 1080` 视口放入 `1024 × 768` 的 4:3 镜像验证：中央画面完整、左右各约 `240px` 显示首页背景、前景最终不透明度为 `1`。
- 已通过桌面端 `test:appearance`、`test:item-copy`、`test:target-motion`、`test:transition-audio`、`test:background-order`、`test:presentation`，以及 `node --check desktop-runtime/main.js`、`node --check desktop-runtime/renderer/player.js`。
- 已执行 `npm --prefix desktop-runtime run pack:all`；打包前自动删除旧 `release` 和 `release-vertical-flip`。两份 `app.asar` 内的 `renderer/styles.css` 与源码 SHA-256 均为 `3E5083A3F21022C6EC840B9AF675C4AEC84765E927123A49E742ED87B1F94297`，背景素材哈希也与源码一致。
- 标准版：`desktop-runtime/release/MagicFloor Dynamic Player 0.1.0.exe`，`85,312,715` bytes，SHA-256 `1643F7E838D54AFED195734FED45BA3D16A26269D6EE311FB018797DAE593422`。
- 完整翻转版：`desktop-runtime/release-vertical-flip/MagicFloor Dynamic Player Vertical Flip 0.1.0.exe`，`85,299,980` bytes，SHA-256 `D7E5D58CBCB69F237AD231E7C1156C85CED4EF56232C670E6196109D7B168E6C`。
- 两套 unpacked 应用均已实际启动；`/status` 返回 `server.status=listening`、`server.port=8080`、`view.mode=archive`、`preview.advancedFeaturesEnabled=true`、`watermarkVisible=false`。测试结束后两套进程均已关闭，`8080` 端口已释放。

## 44. 2026-08-24 组合回归自检：动画、移动、目标点与绑定出场

### 本轮发现并修复

- 修复背景切换重建出场 epoch 的问题：`showAfter`、`hideAfter`、多级父子绑定不会因切换背景而重复出场、复活或重新计时；只有真正的新 epoch 或绑定参数改变才重置。EXE 固定背景模式现在通过 `fixedBackgroundEpochState` 在背景、作品、会话或重播变化时从当前时刻建立新时间轴。
- 修复 EXE 自动背景播放配置变化后的旧计时问题：背景播放模式、间隔、背景列表或当前背景改变时，`backgroundPlaybackScheduleState.startedAt` 会随新的 schedule key 重置，切换时间与 Web/iPad 保持一致。
- Web/iPad 与 EXE 共用出场时间轴采样、目标点 32 段采样，以及横向、垂直波形、轨道与环绕移动核心；图片解码、尺寸变化、Resize 后按当前 epoch seek，不会从透明起点重播。
- 修复快速连续编辑使用旧闭包的问题：移动模式、幅度、速度、轨道、出场模式/间隔均使用最新对象；变换滑杆在 `pointerup`、`pointercancel`、`blur` 强制发送最终状态。
- 完整同步改为深快照并按 group 串行；事件、上传和 `GroupStateSync` 共用 state revision，EXE 拒绝迟到旧状态/旧上传，删除背景时同步清理物件背景作用域。
- 完整同步明确发送 `isVisible`、气泡颜色/边框等字段；隐藏物件不渲染、不命中、不触发音效；`hideAfter` 开始后 Web/EXE 均不再播放目标到达音效。
- 音频时长变化会触发参数同步但不会重复上传相同音频文件；绑定关系版本 `3`、字符串 `"3"` 与未来版本均不再被错误反转。

### 回归与构建

- 已通过：`npm run test:receiver-sync`、`npm run test:creation-flow`、`npm run build`、`npm run sync:ios`、`npx tsc --noEmit --pretty false`、`git diff --check`；本次重建后的 Web/iOS 资源再次完成同样校验。
- 已通过桌面专项：`test:motion`、`test:appearance`、`test:target-motion`、`test:background-order`、`test:transition-audio`、`test:item-copy`、`test:presentation`（21 项全通过），以及 `node --check desktop-runtime/main.js`、`node --check desktop-runtime/renderer/player.js`。
- 当前 Web/iOS 生产资源为 `dist/assets/index-BhmbcIc2.js`、`dist/assets/index-DmEZP04Q.css`、`dist/assets/web-MA1DbJcN.js`，`dist/index.html` 与 `ios/App/App/public/index.html` SHA-256 均为 `AD18D7F32349A5C34F7160123F0767A44F9FCE306EAB7199FCFEB2E06BF25D9B`。
- 标准版：`desktop-runtime/release/MagicFloor Dynamic Player 0.1.0.exe`，`85,316,255` bytes，SHA-256 `E611C6FE2FDEC1FFAD05FCD229A450767A17AA05875EFB3902DAAC286009EF49`。
- 翻转版：`desktop-runtime/release-vertical-flip/MagicFloor Dynamic Player Vertical Flip 0.1.0.exe`，`85,303,313` bytes，SHA-256 `8F7A5F5022BE1B122B54A37C83F984978650C4369EB219C34BC980094073A276`。
- 两套 unpacked `app.asar` 均已用 `asar list` 核对，包含 `group-state-revision-core.cjs`、`advanced-appearance-timeline.js`、`dynamic-motion-core.js`、`target-motion-core.js`、`background-playback-core.js` 与更新后的 `player.js`。源码 Electron 标准/翻转环境均成功监听 `8080`，`/status` 返回 `archive`、进阶自由编辑与水印关闭；测试后端口已释放。便携 EXE 在当前无桌面会话环境中启动即退出，未将该环境现象判定为运行时逻辑失败。

### 待产品确认的语义边界

- 当前隐藏父物件是否应阻止其绑定子物件出场仍未擅自改变：现行为是 `isVisible` 只控制该物件显示/交互，绑定关系仍按配置触发；如需“隐藏父级即隐藏整棵子树”，应另行确认后统一 Web/EXE 语义。
- `dynamicArtStorage.ts` 已将媒体上传改为“完成媒体处理后重新读取最新 group”，删除操作改为“先落盘结构变更再清理文件”，因此动画/移动/目标/绑定编辑不会再被常见上传窗口覆盖；尚未引入全局按 group 写入队列，极端同字段并发仍建议后续补充更细粒度合并策略。

## 45. 2026-08-24 水印几何、档案背景与 iOS 预览非阻塞

### 舞台水印

- Web/iPad 水印继续保持 `44%` 不透明度，中心两行文字为 `MagicFloor` 与 `preview`，EXE 继续不绘制水印。
- 两条响应式 SVG 虚线改为贯穿舞台的交叉对角线：左上 `(160,90)` → 右下 `(1760,990)`，左下 `(160,990)` → 右上 `(1760,90)`；两线精确交于舞台中心 `(960,540)`，`MagicFloor / preview` 两行文字整体位于交叉点。线条继续使用 `10px` 圆端点、`30px 20px` 虚线节奏和深色阴影。
- 水印使用 `pointer-events: none`、`aria-hidden` 和非缩放线宽，不会挡住物件拖动或目标点编辑。

### 档案背景与遮罩

- iPad 作品档案、返回档案路由、EXE 档案镜像统一使用 `#69bbd6`、同一纵向渐变、同一 `magic-floor-background.webp`、`center / center bottom` 与 `cover` 参数。
- EXE 档案页移除常态 `.archive-view::before` 半透明暗层；转场期间所需滤镜和弹窗遮罩继续保留。iPad/EXE 镜像图片保持 `contain` 与透明背景，4:3 内容两侧显示固定底图。
- 档案截图 `html-to-image` 的 fallback 背景改为 `#69bbd6`，避免截图透明区域与 EXE 底图出现色差；截图专用 breadcrumbs 样式不变。

### iOS 预览

- 点击“预览”后先建立本地 `replayId`、立即进入 iPad 本地播放，再后台执行背景、物件、气泡图片和音频同步；EXE 未启动时不再阻塞动画。
- 同步请求增加 `15s` XMLHttpRequest 超时，预览层增加 `8s` 非阻塞同步保护；失败只显示可关闭的同步提示，不影响本地播放。
- `requestId`、`replayId` 与 `previewModeRef` 防止旧同步任务在快速“预览／停止”或重新编辑后覆盖新状态；EXE 恢复连接后会以同一 replay 号补发最新预览状态。

### 构建与验证

- `npx tsc --noEmit --pretty false`、`npm run test:creation-flow`、`npm run test:receiver-sync`、桌面 `test:appearance`、`test:motion`、`test:target-motion`、`test:background-order`、`test:presentation`（23/23）和 `git diff --check` 全部通过。
- `npm run sync:ios` 已重新执行；交叉水印修正后的 `dist/index.html` 与 `ios/App/App/public/index.html` SHA-256 均为 `09BE0579DFDAEF950A15AB2296073080BD5B0CAACEC6F7A2934A9F69407C770D`。当前 Web 资源为：

```text
dist/assets/index-C4Dny2sH.js
dist/assets/index-DAqEwegZ.css
dist/assets/web-wUuux34v.js
```

- 已执行 `npm --prefix desktop-runtime run pack:all`；打包前自动删除两个旧 release 目录。标准版 `desktop-runtime/release/MagicFloor Dynamic Player 0.1.0.exe` 为 `85,316,400` bytes，SHA-256 `C88FF6F090FA380B0760FFE553D9F7C92BFB379084D91156B9AABC77B2CF92D3`；翻转版 `desktop-runtime/release-vertical-flip/MagicFloor Dynamic Player Vertical Flip 0.1.0.exe` 为 `85,303,295` bytes，SHA-256 `0A375C9F073AA6BFD953944E605C7DCAB5080D5A1303953139EBA294A747A2F0`。
- `npm run lint` 未执行成功，原因是仓库当前没有 ESLint 配置文件；不是本轮代码规则错误。

## 46. 2026-08-25 水印中心留白、出场排序短文案与全部 BGM 清除

### 水印中心安全区

- 两条对角虚线继续使用完整交叉几何，但新增 `dynamic-stage-watermark-safe-zone-mask`：全舞台白色遮罩中以 `(660,420)`、`600 × 240`、圆角 `52` 的黑色区域挖空中心。虚线在 `MagicFloor / preview` 周围完全消失，中心仍显示真实舞台内容，不绘制任何底色卡片。
- 遮罩只应用于虚线组，中心文字不受影响；既有 `44%` 不透明度、虚线节奏、阴影、响应式 SVG 与 `pointer-events: none` 保持不变。EXE 按既定产品规则继续不显示水印。

### 出场排序文案

- “物件联动／触发物件／受控物件／物件关系”统一改为“出场排序／当前物件／随后物件／出场顺序”。新增与编辑标题分别为“添加出场顺序”和“编辑出场顺序”。
- 操作项缩短为“不设置／指定出场／指定隐藏／相隔时间”，结果摘要改为 `A → N 秒 → B 出场/隐藏`；背景继承、替换提示、空状态与循环错误均改为一行短句。
- 列表不再显示与当前任务无关的移动和动画编号，未排序物件只显示“可加入排序”；底部操作统一为“移出排序／保存排序／替换排序”。本轮没有修改绑定数据、延迟计算、显示/隐藏行为、背景继承、多级关系、循环检测或 Unity 协议。
- 简体中文、繁体中文、英文、葡萄牙文和波兰文已同步更新，不再让非中文界面回退到旧技术术语。

### 一键清除全部 BGM

- 编辑背景的“背景音乐”卡片新增全宽轻警示按钮“清除全部 BGM”。没有任何背景使用 BGM 时按钮禁用；点击后直接执行，不增加二次确认弹窗，并显示短暂状态“已清除全部 BGM”。
- 操作一次传入当前作品的全部背景 ID，通过既有 `setDynamicBackgroundBgm(..., undefined)` 清除每个背景的 `bgmAudioId`，同时停止音源试听与正在播放的 BGM、清空当前下拉草稿，再使用 `sendGroupStateSync(nextGroup)` 同步 EXE。
- 全清只解除背景与音乐的关联，不删除 `audioLibrary`，不影响物件音源，也不改变背景数量、顺序或当前背景。

### 构建与验证

- `npx tsc --noEmit --pretty false`、`npm run test:creation-flow`、`npm run test:receiver-sync`、桌面 `test:background-order`、`test:presentation`（23/23）与 `git diff --check` 全部通过。
- `test:creation-flow` 新增真实存储验证：三张背景全部清除 BGM 后，当前背景镜像、背景顺序与音源库保持完整；同时检查水印安全区覆盖中心且只遮虚线。
- Playwright 在 `1024 × 768` 与 `1366 × 1024` 两种 iPad 视口通过：中心文字区没有虚线、出场排序弹窗没有溢出、全清按钮可见且可用；点击后 3 张背景的 BGM 均为空，音源库数量保持 `1`，按钮随即变为禁用。
- 实测截图：`transition-portal-preview/test-artifacts/linkage/ipad-air-layers.png`、`ipad-air-modal.png`、`ipad-air-background-bgm.png` 及对应 `ipad-pro-12-9-*` 文件。
- `npm run sync:ios` 已执行；`dist/index.html` 与 `ios/App/App/public/index.html` SHA-256 均为 `EAD1ADA62EB1D4385BB1CFD4A4E3EE2187EFD49991815FAA6D822BC21E5A63E4`。当前资源为：

```text
dist/assets/index-CKhuX-7e.js
dist/assets/index-BgKvzNqv.css
dist/assets/web-B2G6A544.js
```

- 本轮没有修改桌面运行时代码或协议，现有标准版与翻转版 EXE 已能接收完整 group state 中清空后的 BGM 数据，因此无需重复打包。

## 47. 2026-08-25 出场排序“紧随其后”与物件 A/B 别名

### “紧随其后”的真实语义

- 出场排序弹窗原来的“不设置”不是单纯改字：该旧选项实际会解除关系，若只替换文案会造成严重误导。现在模式栏改为“紧随其后／指定出场／指定隐藏”，不再向用户暴露内部 `none` 删除模式。
- “紧随其后”保存为既有协议的 `mode: 'showAfter'` 与 `delayMs: 0`，表示物件 A 的出场动画完成后，物件 B 立即开始出场；没有新增存储字段、协议版本或 Unity 分支，iPad、本地预览与 EXE 可继续使用同一时间线语义。
- 新建排序默认选择“紧随其后”，此时不显示无意义的秒数输入。选择“指定出场”或“指定隐藏”时才显示相隔时间。
- 已有 `showAfter + 0ms` 关系重新打开时显示为“紧随其后”；非零 `showAfter` 仍显示“指定出场”，`hideAfter` 仍显示“指定隐藏”。“指定出场 0 秒”与“紧随其后”的持久化结果相同，因此重新打开会统一显示为“紧随其后”。
- 解除关系继续由弹窗底部独立的“移出排序”按钮负责，内部仍使用 `none` 作为删除哨兵；用户不会再把解除排序误认为一种出场方式。

### 物件 A / 物件 B

- 弹窗顶部关系示意和底部结果摘要不再显示长素材名称，固定显示“物件A”和“物件B”，例如 `物件A → 物件B 紧随其后`。
- 物件选择列表继续显示真实素材名称与缩略图，已有排序提示也继续引用真实名称，确保用户仍能准确选择目标物件。
- A/B 只是在当前关系弹窗中的视觉别名，不会重命名物件，不会修改作品档案数据，也不会改变发送给 Unity/EXE 的物件 ID 或名称。
- 关系示意增加只供辅助技术读取的真实名称映射，例如“物件A：原素材名；物件B：原素材名”；缩略图保持装饰性，读屏用户仍能知道 A/B 对应哪个素材。

### 五语与回归

- 简体中文、繁体中文、英文、葡萄牙文和波兰文均新增“紧随其后”、物件 A/B、即时摘要和无障碍真实名称映射；五种语言均移除误导性的“不设置／Not Set”等选项文案。
- `test:creation-flow` 新增编辑器模式与存储模式分离、零延时回填、`immediate → showAfter + 0ms`、模式栏不含 `none`、独立移出排序、A/B 别名及五语占位符检查。
- 桌面出场时间线新增零延时语义断言：物件 B 的 `entranceStartMs` 必须严格等于物件 A 的 `appearanceCompleteMs`。
- Playwright 在 `1024 × 768` 与 `1366 × 1024` 两种 iPad 视口通过：模式顺序为“紧随其后／指定出场／指定隐藏”，顶部为“物件A／物件B”，紧随其后不显示时间框，真实素材名仍在选择列表；保存后 localStorage 实测为 `showAfter + 0ms`，随后可重新打开并正常“移出排序”，弹窗没有溢出。
- 已通过 `npx tsc --noEmit --pretty false`、`npm run test:creation-flow`、`npm run test:receiver-sync`、`node desktop-runtime/scripts/verify-advanced-appearance.mjs` 与双视口 `verify-linkage-layout.mjs`。
- 已执行 `npm run sync:ios`；`dist/index.html` 与 `ios/App/App/public/index.html` 的 SHA-256 均为 `AE32B178B897B6384F69EC3762D38DCBE571F1A34E0EBCBDF75325DF495F1AEC`。当前资源为：

```text
dist/assets/index-_8PLZFNY.js
dist/assets/index-BgKvzNqv.css
dist/assets/web-DNMCaYcE.js
```

- 本轮没有修改桌面播放生产代码或 Unity 协议；EXE 已支持 `showAfter + 0ms`，无需为该文案与编辑器改动重新打包。

## 48. 2026-08-25 关联物件舞台命中与同背景候选过滤

### 舞台点击修复

- 关联覆盖线与节点原本已经是 `pointer-events: none`，并不是遮挡点击的来源。实际问题位于舞台几何命中：旧逻辑使用作品中的全部物件作为候选，当前背景没有渲染的高层物件仍可吞掉点击；同时旧逻辑会把当前已选物件强制放到命中首位，两个扩大触控区相交时，即使随后物件图层更高，也会反复选中原物件。
- 舞台命中候选现在只取当前真正渲染的 `displayedItems`，其中已经包含关联父子链的有效背景继承结果；其他背景的隐藏物件不再参与命中。
- 移除“当前已选物件强制优先”规则，恢复按 `order` 从高到低命中，与舞台实际 `z-index` 和视觉前后关系一致。关联物件可直接在舞台选中、拖动或缩放，不再需要先到图层列表选中。
- 既有最小 `64px` 触控范围和每边 `14px` 触控留白保持不变，修复没有缩小 iPad 点按区域；关联线仍不拦截手势。

### 随后物件背景规则

- “选择随后物件”现在要求当前物件与候选物件至少共享一个有效背景。示例：物件 A 只使用背景 A 时，物件 B 使用背景 A 或 `A+B` 会出现；物件 B 只使用背景 B 时不会出现。
- 任一物件设置为“所有背景”（`backgroundIds: []`）时可与任意背景范围匹配；作品尚未添加背景时，不会因此禁用出场排序。
- 比较的是运行时有效背景而不是原始存储值：已关联子物件递归继承父物件背景，当前物件本身若是子物件也使用继承后的范围。这样既有合法父子链在编辑时不会因为隐藏的历史背景配置而从列表消失。
- 背景交集只认可当前作品中真实存在的背景 ID，已删除或损坏的残留 ID 即使相同也不算匹配；循环检测仍独立生效。
- 候选按钮过滤之外，在点击候选和最终保存时还会基于 `latestGroupRef` 重新校验背景与循环，避免弹窗期间外部同步改变数据后写入无效关系。
- 如果存在其他物件但都没有共同背景，空状态显示“没有使用相同背景的物件”；异常保存请求显示“请选择使用相同背景的物件”。两条短文案已经同步简体中文、繁体中文、英文、葡萄牙文和波兰文。
- 本轮只限制编辑器可选目标，不修改物件自己的 `backgroundIds`、父子背景继承、解除关联后的历史背景恢复、GroupStateSync 或 Unity/EXE 协议。

### 验证与构建

- `test:creation-flow` 新增舞台只命中 `displayedItems`、不再提升当前选中物件、有效背景递归计算、真实背景交集、所有背景／无背景兼容、候选与保存双重校验以及五语短文案检查。
- Playwright 在 `1024 × 768` 与 `1366 × 1024` 两种 iPad 视口真实验证：A 与关联 B 的扩大命中区相交，且 B 同坐标存在一个图层更高但只属于背景 B 的隐藏物件；直接点舞台仍准确选中 B。关联覆盖层计算样式继续为 `pointer-events: none`。
- 同一真实弹窗验证：当前物件使用背景 A 时，只使用背景 B 的候选数量为 `0`，使用 `A+B` 的候选数量为 `1`，“所有背景”的候选数量为 `1`；既有 raw 背景不同但有效背景继承一致的子物件仍正常出现、编辑与保存。
- 已通过 `npx tsc --noEmit --pretty false`、`npm run test:creation-flow`、`npm run test:receiver-sync`、`node desktop-runtime/scripts/verify-advanced-appearance.mjs`、双视口 `verify-linkage-layout.mjs` 与生产构建。
- 已执行 `npm run sync:ios`；`dist/index.html` 与 `ios/App/App/public/index.html` 的 SHA-256 均为 `EC04DDE28FA0925E53B4712D191BB0C6E1008874EE04E1DFBBBFD62279E388E6`。当前资源为：

```text
dist/assets/index-Ct0KYw2H.js
dist/assets/index-BgKvzNqv.css
dist/assets/web-C2P8HtOP.js
```

- 本轮没有修改 EXE 播放生产代码或 Unity 协议，标准版与翻转版无需重新打包；iPad 保存的关系数据格式保持不变。

## 49. 2026-08-25 气泡新增／编辑页完整繁体化

### 简体残留修复

- 根因不是繁体词库内容错误，而是新增与编辑共用的 `DynamicBubbleEditor.tsx` 仍有大量简体中文直接写在组件中。现已把弹窗标题、说明、关闭按钮、舞台预览、气泡类型、气泡／标题样式、正文与图片、显示方式、文字外观、颜色、遮罩、校验错误、保存状态、提示文字、tooltip 与 `aria-label` 全部改为翻译键；该组件不再包含任何中文硬编码。
- 繁体界面统一使用“新增氣泡／編輯氣泡、想像氣泡、標題遮罩、膠囊、標籤、底線、圖片、檔案、完整置中顯示、逐字顯示、自訂、儲存”等繁体用语，不再混入“添加／编辑／想象／标题／下划线／文件／居中／保存”等简体词。
- 标题遮罩的五种样式、文字颜色与遮罩颜色选项由固定中文改为 `labelKey / descriptionKey`；切换语言时，样式名称、说明与颜色名会一起刷新。预览占位文字的 `useMemo` 也加入翻译依赖，弹窗打开期间切换语言不会保留旧文字。
- 图片类型错误、空正文／空标题／想像气泡缺少内容以及保存失败均使用当前语言；新增模式显示“新增氣泡”，编辑模式显示“編輯氣泡／儲存”，不再共用简体按钮。

### 控制页入口与五语

- 右侧图层“+”菜单的关闭说明、物件类型、上载物件、相簿／拍照／檔案、气泡入口与说明均接入翻译；繁体采用现有香港界面的“上載／相簿／檔案／選單”术语。
- 新建无正文名称的气泡，其系统默认名称现在跟随当前语言；气泡缩略图的编辑 `aria-label` 与“編輯標題遮罩／編輯氣泡”提示也已本地化。用户自行填写或修改的物件名称不会被改写。
- `zh-Hans`、`zh-Hant`、`en`、`pt-PT`、`pl-PL` 五套词库已同步补齐完整气泡编辑文案；`zh-Hant.ts` 继续作为 `TranslationResource` 的键集合来源，其他语言由 TypeScript 强制检查完整性。

### 验证与构建

- `test:creation-flow` 新增五语气泡键完整性、图片／物件名称占位符、繁体关键术语、共用新增／编辑模式以及气泡编辑组件零中文硬编码检查；控制页气泡入口也会拒绝重新引入指定简体字面量。
- 已通过 `npx tsc --noEmit --pretty false`、`npm run test:creation-flow`、`npm run test:receiver-sync`、生产构建与 `git diff --check`。测试页 `http://127.0.0.1:5173/` 返回 `200`。
- 已执行 `npm run sync:ios`；`dist/index.html` 与 `ios/App/App/public/index.html` 的 SHA-256 均为 `CE6520F367240658ADA8EDA9EE2A5D1505CB574A35100DDA001D1420A4B5ADD5`。当前资源为：

```text
dist/assets/index-BB8ct7LU.js
dist/assets/index-BgKvzNqv.css
dist/assets/web-3ui0Ni4Z.js
```

- 本轮只修改 iPad/Web 编辑界面文案与编译资源，没有改变气泡数据结构、图片选择方式、舞台渲染、同步协议或 EXE 播放逻辑，因此标准版与翻转版 EXE 无需重新打包。

## 50. 2026-08-26 独立出场时间、目标到达隐藏与 EXE 待机同步

### 可回退节点与编辑模型

- 执行前已将 `chore: checkpoint before independent appearance timing` 推送到 `origin/main`；提交为 `07a845e7db631981c6c4855e7bf05cd132e963f3`，可作为本轮修改前的完整回退节点。
- 创作流程继续雪藏，进阶功能固定开启且不显示开关；自由编辑顶部旧“出场排序”入口、全局出场面板、物件绑定弹窗、父子图层结构和绑定编辑 handler 已全部移除。图层恢复为平级列表，历史 `linkedAppearance` 字段只保留读取与迁移兼容，不再由新界面写入。
- 绑定模型升级为版本 `4`。旧作品的 `showAfter`／`hideAfter` 会在加载时转换为物件自己的绝对 `appearanceDelayMs`／`appearanceHideMs`，先固化原有继承背景，再清除绑定；逐个出场迁移严格按 `item.order` 计算，不受存储数组乱序影响，间隔统一限制在 `100–5000ms`。
- 每个物件的“出场时间”位于动画属性页，使用既有上下滑动时间轮，范围 `0–600` 秒、步进 `0.1` 秒。图层卡片直接显示出场、实际单轮移动、音源延时等秒数，不再以“基础移动”这类抽象模式作为主要摘要。
- 目标点编辑新增“到达后隐藏”；循环移动与到达隐藏互斥，完成目标编辑后会立即发送完整 `ItemMotion`。iPad 与 EXE 共用目标移动采样，到达后同时将物件设为不可见、不可点击。
- 自由编辑属性页原有大量 `7–9px` 文字已适度放大；六个属性选项、标题、状态标签、动画、复制、音源、背景与图层摘要均提高可读性。目标点选项改为“移动到目标点”独占一行，循环与到达隐藏并排显示，避免三个按钮挤在错误网格位置。

### 页面、转场与键盘

- 作品档案进入舞台、舞台返回作品档案改为直接切页，不再运行作品门户过场；进入控制页后原有物件上下进场表现继续保留。
- iPad 与 EXE 的帘幕、相机闪光、影幕背景转场均会在合理阶段显示共享首页 `Right_Logo.png`，随转场淡入淡出。
- 键盘控制页第一个小旋钮的 `−／+` 改为低／高音量图标，第二个小旋钮的字符箭头改为正式上／下方向图标；原有信号映射、旋钮手势与按键值未改变。

### EXE 待机、预览与防闪帧

- `GroupStateSync` 现在只缓存编辑数据，不再替换当前舞台；只有显式 `GroupSelectAndSync` 选择作品。进入控制页但尚未点击预览时，EXE 固定显示与首页一致的 `magic-floor-background.webp` 加居中 `Right_Logo.png`，不会提前展示全部物件或播放动画。
- 点击预览后 iPad 本地立即播放；receiver 完整同步结束后才向 EXE 发送 `PreviewMode(true)`。即使素材已经全部缓存、同步函数返回“无需上传”，也会正常启动 EXE 预览。EXE 会先预载当前背景和可见物件，准备完成后再原子切换真实 Canvas，避免蓝色占位、旧物件和半套数据闪现。
- 素材上传增加 SHA-256 内容比较；文件字节没有变化时不重写文件、不更新时间戳、不改变素材 URL revision。属性、秒数等微调只更新状态，不会反复解码相同图片或令 EXE 整体刷新。
- 标准版与上下翻转版继续共用同一套自由编辑、独立出场时间、目标到达隐藏、背景转场和待机逻辑；EXE 继续不绘制水印。

### 构建、同步与产物

- 已通过：`npm run build`、`npm run test:creation-flow`、`npm run test:receiver-sync`、桌面 `test:appearance`、`test:target-motion`、`test:presentation`（37/37）、`test:item-copy`、`test:motion`、`test:transition-audio`、`test:background-order`、`node --check desktop-runtime/main.js` 与 `git diff --check`。
- 已执行 `npm run sync:ios`；当前 Web/iOS 资源为 `index-lHlgmTml.js`、`index-Cf-oISyk.css`、`web-BmHIMzP7.js`。`dist/index.html` 与 `ios/App/App/public/index.html` SHA-256 均为 `0A98D6E088B2FF7A17573C16E19673A448AE481D96E924C2A9E68ADBB6EEE56A`。
- 已执行 `npm --prefix desktop-runtime run pack:all`，打包前自动删除两个旧 release 目录；当前仅保留 `release` 与 `release-vertical-flip`。
- 标准版：`desktop-runtime/release/MagicFloor Dynamic Player 0.1.0.exe`，`85,321,716` bytes，SHA-256 `6F702B9E0DDF0FB08698C0620916FB8BB443C36CABD0EE42A776F1C50CF7386A`。
- 上下翻转版：`desktop-runtime/release-vertical-flip/MagicFloor Dynamic Player Vertical Flip 0.1.0.exe`，`85,309,373` bytes，SHA-256 `2543AFD4CEB2EC095AE2A2E23C99AC1386817ED323C633973932A27A7D47A20E`。
- 两套 unpacked `app.asar` 均已核对，包含最新 `main.js`／`main.vertical-flip.js`、`renderer/player.js`、`renderer/styles.css`、`Right_Logo.png` 与 `magic-floor-background.webp`。
- `npm run lint` 仍无法启动，原因是仓库没有 ESLint 配置文件；这是既有工具链缺口，不是本轮新增 lint 报错。Vite 仅报告主 bundle 超过 `500kB` 的既有非阻塞警告。

## 51. 2026-08-26 出场设定恢复、双栏编辑器与公司 iOS 私有上架标识

### 出场设定与数据规则

- 自由编辑控制页右上角已恢复“出场设定”按钮；不恢复旧物件绑定、父子链或随后物件编辑，物件继续使用版本 `4` 的独立绝对 `appearanceDelayMs`。
- 新弹窗复用“编辑背景”的大型左右双栏容器。左侧物件固定一行一卡，显示图层顺序、完整居中的缩略图、物件名称与实际出场秒数；右侧集中设置出场方式、计时方式与原有出场动画。
- “全部出场”是立即出场快捷方式：所有物件 `appearanceDelayMs` 固定写为 `0`，界面隐藏统一间隔和单件时间轮，避免让用户误以为全部出场仍可延迟。
- “逐个出场”才显示计时方式。“统一间隔”用一个上下滑动时间轮，严格按 `item.order` 写入 `0 / N / 2N / ...`；“自定义时间”在每张物件卡片中提供 `0–600` 秒时间轮，只修改对应物件。
- 原有三种出场动画保持不变：淡入、上方掉落、左右进场。写入继续沿用 `GroupAppearMode`、`GroupStateSync` 与单件 `ItemMotion`，iPad、receiver 和 EXE 无需新增协定事件。
- 打开旧作品时会根据现有秒数判断为“统一间隔”或“自定义时间”；仅打开弹窗不会覆盖原数据。切换为全部出场或统一间隔属于明确编辑操作，会按上述规则重写秒数。

### UI、响应式与五语

- 弹窗在 iPad Air `1024 × 768` 与 iPad Pro 12.9 `1366 × 1024` 横屏下均为左右双栏，完整位于视口内，未产生横向溢出；左侧卡片始终单列，右侧按钮触控高度不低于约 `48px`。
- 物件自定义时间轮带物件名称无障碍标签；出场方式、计时方式和动画均使用 `radiogroup/radio` 语义，选择态、键盘焦点、触控按压态及 `prefers-reduced-motion` 均有对应样式。
- `zh-Hans`、`zh-Hant`、`en`、`pt-PT`、`pl-PL` 已同步补齐文案。简中统一使用“出场设定／全部出场／逐个出场”，繁中对应“出場設定／全部出場／逐個出場”；时间摘要使用 `{{value}}`，时间轮辅助名称使用 `{{name}}`，静态测试会锁定占位符。

### iOS 公司标识与私有发行

- Capacitor 与 Xcode Debug／Release 的 Bundle ID 已由 `com.artlab.web` 改为 `com.magicfloor.artlab.ipadcontrol`；全仓库已确认没有旧 Bundle ID 残留。
- Xcode 项目已移除私人账号 Team ID `J9P74M9AGJ`，保留自动签名；在 Mac 打包机上须于 Signing & Capabilities 选择公司 Apple Developer Team。
- `TARGETED_DEVICE_FAMILY = 2`，当前二进制为 iPad-only。应用显示名称继续为 `MagicFloor`，版本号继续从 `1.0 (1)` 起步。
- `Info.plist` 已加入 `NSLocalNetworkUsageDescription`：允许 MagicFloor 连接同一局域网中的舞台播放电脑与互动装置；原有 `NSAllowsLocalNetworking = true` 保留。
- 公司后台应注册 `App IDs > App > Explicit Bundle ID`，不要选择 App Clip；App Store Connect 新建 `iOS` App，建议主分类 `Utilities`、副分类 `Business`，SKU 可用 `MAGICFLOOR-IPAD-CONTROL-001`。
- 私有上架选择 `Private — Available as a custom app on Apple Business Manager or Apple School Manager`，填写接收方 Apple Business Manager Organization ID；不要选择 Public、Unlisted、Enterprise、Ad Hoc 或 Development。私有 Custom App 仍需 App Review，审核备注应提供测试账号、同网段 Windows／Unity／EXE 连接说明与演示视频或可复现步骤。
- 新 Bundle ID 会被 iOS 与 App Store Connect 视为全新 App，不能覆盖私人账号下旧 Bundle ID 的安装与本地数据；两个版本可并存。Bundle ID 最终是否可注册须由公司 Apple Developer 后台确认，若已被占用，应改用公司真实域名反写的唯一标识。

### 验证与同步

- 已通过：`npx tsc --noEmit --pretty false`、`npm run test:creation-flow`、`npm run test:receiver-sync`、`npm run build`、桌面 `test:appearance`、`test:target-motion`、`test:presentation`（37/37）、`test:item-copy`、`test:motion`、`test:transition-audio`、`test:background-order`、`node --check desktop-runtime/main.js`、`node --check desktop-runtime/renderer/player.js` 与 `git diff --check`。
- Chromium 真实交互检查确认：全部出场写入 `[0,0,0,0]`；统一间隔 `0.9` 秒按顺序写入 `[0,900,1800,2700]`；切换自定义后只将第二个物件改为 `1000ms`；动画可正常改为 `drop`。
- 已执行 `npm run sync:ios`；原生 `capacitor.config.json` 的 `appId` 为 `com.magicfloor.artlab.ipadcontrol`。当前 Web/iOS 资源为 `index-Bo--6qI7.js`、`index-Dr-zve_A.css`、`web-MEyoKZEh.js`，`dist/index.html` 与 `ios/App/App/public/index.html` SHA-256 均为 `8F43551F1C88E86D3AA7583B246FB7DC4C46B937A69825CDB03272AF4B572602`。
- 本轮没有修改桌面播放协议或 EXE 资源，因此没有重新打包 EXE；继续使用第 50 节记录的标准版与上下翻转版。`npm run lint` 仍因仓库没有 ESLint 配置而无法启动，属于既有工具链缺口。

## 52. 2026-08-26 出场设定去重与属性入口收敛

### 最新交互规则

- “全部出场”选中后，右侧不再额外显示带勾选图标的“立即出场”状态条；按钮本身已经完整表达当前模式，移除重复状态可避免用户误以为还需要点击或设置。左侧物件卡片仍保留“立即出场”只读摘要，用于说明每个物件当前结果。
- 物件属性的“动画”选项卡已移除“出场时间”字段与时间轮。出场时间现在只有一个编辑入口：控制页右上角“出场设定”；图层卡片仍可显示只读秒数摘要，但不能从属性页编辑。
- 旧属性页专用 `handleAppearanceDelayChange`、`dynamic-appearance-delay-field`、`dynamic-appearance-delay-wheel` 及全部出场状态条 `dynamic-appearance-immediate-status` 的 JSX／CSS 已全部删除，没有保留无引用死代码。
- 数据模型、`appearanceDelayMs`、全部／逐个出场规则、统一间隔、自定义时间、三种出场动画及 iPad／EXE 同步协议均未改变。

### 验证与同步

- 静态回归会明确拒绝属性动画页重新出现出场时间控件，也会拒绝全部出场模式重新加入额外“立即出场”状态条；同时继续验证专用弹窗的卡片、时间轮与同步 handler。
- Chromium 在 iPad Air `1024 × 768` 与 iPad Pro 12.9 `1366 × 1024` 下均已实际检查：全部出场右侧仅保留模式按钮和出场动画；动画属性页不再出现出场时间字段；弹窗尺寸和现有计时写入保持正常。
- 已通过 `npx tsc --noEmit --pretty false`、`npm run test:creation-flow`、`npm run test:receiver-sync`、桌面 `test:appearance`、生产构建与 `git diff --check`。
- 已执行 `npm run sync:ios`；当前资源为 `index-DiyeLm9q.js`、`index-BxSvjLu0.css`、`web-BcAipFgx.js`。`dist/index.html` 与 `ios/App/App/public/index.html` SHA-256 均为 `F0B34D1AD2DCDA5F7841AB999BA1E6942A2AE43DBFAFDCA6997B76F439DDCEA0`，原生 Bundle ID 继续为 `com.magicfloor.artlab.ipadcontrol`。
- 本轮只收敛 iPad/Web 编辑入口，没有修改 EXE 播放代码或资源，因此无需重新打包标准版与上下翻转版 EXE。

## 53. 2026-08-26 背景快捷切换、单景播放与互动上传音效替换

### 背景快捷切换入口

- 动态艺术控制页在舞台上方新增背景快捷条；只有作品包含两个或以上背景、且当前不在预览模式时才显示。零个或一个背景不会占用舞台空间。
- 快捷条最大宽度固定为 `920px`，背景轨道使用 `overflow-x: scroll`、iOS 惯性滚动与横向触控隔离；页面本身不会产生横向滚动。背景以 `58 × 58px` 圆角方卡显示，低高度紧凑布局为 `52 × 52px`，图片与视频缩略图统一 `object-fit: contain`、完整居中。
- 当前背景使用青绿色描边、外光与状态点明确标识；卡片具备触控按压、键盘焦点、高对比与 reduced-motion 状态。五语文案已补齐 `control.quickBackgroundSwitch` 与 `control.playSelectedBackground`。
- 点击卡片继续复用正式背景选择流程：写入 `activeBackgroundId`、立即更新 iPad 舞台与背景范围物件，并发送既有 `BackgroundSet` 给 EXE；不打开“编辑背景”弹窗，也不改变背景原有顺序、随机或固定播放设定。

### 只播放选中背景

- 快捷条右侧新增独立“播放选中背景”按钮。点击后进入完整预览，但本次会临时以 `PreviewMode.backgroundPlayMode = fixed` 播放当前背景；用户保存的 `backgroundPlayMode` 不会被改写，停止预览后普通“预览”仍按原来的固定／随机／顺序模式运行。
- iPad 本地与 EXE 使用同一个临时 fixed 语义，不新增 Unity／EXE 协议事件。完整 receiver 同步结束后才发送带临时模式的 `PreviewMode`；EXE 现有接收端已经支持该字段，因此无需更新或重新打包标准版与上下翻转版。
- 单景预览继续通过 `getDynamicPlaybackItemsForBackground` 过滤物件：只播放属于当前背景的物件，以及 `backgroundIds` 为空、适用于全部背景的通用物件；其他背景专属物件不会出现在舞台、图层、动画或音源时间轴中。当前背景 BGM、物件出场、移动、目标点、动画与音源逻辑保持原样。

### 互动艺术上传火箭音效

- 互动艺术直接上传的火箭发射动画已改用项目根目录 `466.mp3`，旧的 Web Audio 振荡器合成音效已移除；`UploadPage` 原有动画触发、失败返回、反向动画、重复播放与组件卸载清理时机均未改变。
- 默认音量／增益为 `1.3`。主播放链为 `HTMLAudioElement → MediaElementAudioSourceNode → GainNode(1.3) → DynamicsCompressorNode → destination`，既能实现大于 HTMLAudioElement 上限的实际增益，也通过 limiter 降低削波失真。Web Audio 不可用或启动失败时回退到合法的 `HTMLAudioElement.volume = 1`。
- 音频通过 Vite URL 管线进入 Web 与 iOS 包，生产资源为 `dist/assets/466-DTcHxBId.mp3`，`135,462` bytes，SHA-256 `2AA21DD90D682B1705704A492FEE0DD3EAA629F90A73F16DC993210D90218D86`。

### 验证、构建与同步

- 已通过：`npx tsc --noEmit --pretty false`、`npm run test:creation-flow`、`npm run test:receiver-sync`、`node --no-warnings scripts/verify-artwork-launch-audio.mjs`、桌面 `test:appearance`、`test:target-motion`、`test:presentation`（37/37）、`test:item-copy`、`test:motion`、`test:transition-audio`、`test:background-order`、`node --check desktop-runtime/main.js` 与 `node --check desktop-runtime/renderer/player.js`。
- Chromium 真实触控回归已覆盖 iPad Air `1024 × 768` 与 iPad Pro 12.9 `1366 × 1024`：单背景快捷条隐藏；18 张背景时卡片全部为方形，轨道 `scrollWidth = 1184px`，两视口 `clientWidth` 分别为 `511px` 与 `775px`；document/body 均无横向溢出，快捷条位于舞台上方且不覆盖右侧图层。
- 真实交互选择第 18 张背景后，舞台只保留通用物件与第 18 张背景物件；点击单景播放后捕获到 EXE `PreviewMode(enabled=true, backgroundPlayMode=fixed)`，停止后本地存储仍为原测试设定 `sequence`。零／单背景、选中态、物件过滤、EXE 临时模式与恢复行为均通过。
- 已执行 `npm run sync:ios`；当前 Web/iOS 资源为 `index-CvCfc3Rr.js`、`index-dWiyBRcl.css`、`web-wvxkFAWn.js` 与 `466-DTcHxBId.mp3`。`dist/index.html` 与 `ios/App/App/public/index.html` SHA-256 均为 `885F2D5D5104A0870B3443915F6ECF605CFD7D76C3186039921B8A8EBC04DBC9`；原生 Bundle ID 继续为 `com.magicfloor.artlab.ipadcontrol`。
- 本轮不需要重新打包 EXE；继续使用第 50 节记录的标准版与上下翻转版。Vite 仍仅报告主 bundle 超过 `500kB` 的既有非阻塞警告。

## 54. 2026-08-26 背景快捷切换条参考图样式重做

### 布局与视觉规格

- 本轮只重做动态艺术控制页舞台上方背景快捷条的样式，背景选择、选中态、横向滚动、单景播放、物件过滤、EXE 消息和显示条件均保持第 53 节的既有逻辑。
- 快捷条与舞台改为靠工作区顶部排列，不再将“快捷条＋舞台”整体垂直居中；快捷条顶部比右侧图层面板顶部低 `8px`，下方紧邻舞台。舞台自身尺寸没有修改。
- iPad Pro 12.9 `1366 × 1024` 下，快捷条为 `930 × 138px`，水平居中于 `943.53 × 530.73px` 舞台；背景卡为 `174px` 宽、`5:3` 横向圆角卡，播放按钮固定为 `156 × 80px`，快捷条与舞台间距为 `10px`。
- iPad Air `1024 × 768` 下启用紧凑档：快捷条与舞台同为 `656px` 宽，快捷条高 `112px`，背景卡为 `140 × 84px`，播放按钮固定为 `128 × 64px`，快捷条与舞台间距为 `8px`；舞台继续保持 `656 × 369px`。
- 背景轨道与右侧播放按钮成为两个清楚的固定分区：卡片区域继续单排横向触控滚动，播放按钮始终固定在最右侧；两区之间使用中性灰绿色竖向虚线分隔。参考图中的红框仅作为位置标注，没有被做成实际红色边框。
- 缩略图继续使用 `object-fit: contain` 与 `object-position: center`，不同尺寸的图片和视频都会在卡片中完整居中；当前背景继续使用青绿色描边、外光和状态点，不通过改变尺寸表达选中状态。

### 浏览器回归、构建与同步

- Chromium 真实触控回归覆盖 iPad Air `1024 × 768` 与 iPad Pro 12.9 `1366 × 1024`。两尺寸下快捷条与舞台水平中心误差均小于 `1px`，顶部偏移均为 `8px`，舞台与右栏没有重叠，document/body 均没有横向溢出。
- 18 张背景时，Air 轨道 `clientWidth = 484px`、`scrollWidth = 2660px`；Pro 轨道 `clientWidth = 720px`、`scrollWidth = 3306px`。卡片保持固定宽度并可横向滚动，播放按钮不会被轨道挤压；单背景仍不渲染快捷条。
- 真实交互继续确认：选择第 18 张背景后只显示通用物件与第 18 张背景专属物件；单景播放发送 `PreviewMode(enabled=true, backgroundPlayMode=fixed)`，停止后保存的 `sequence` 模式不被覆盖。
- 已通过 `npx tsc --noEmit --pretty false`、`npm run test:creation-flow`、`npm run test:receiver-sync`、`node --no-warnings .codex-build/verify-background-quick.mjs`、生产构建与 `git diff --check`。
- 已执行 `npm run sync:ios`；当前 Web/iOS 资源为 `index-BVFmZ9vD.js`、`index-DjMXCWLl.css`、`web-H7Aa8m_s.js` 与 `466-DTcHxBId.mp3`。`dist/index.html` 与 `ios/App/App/public/index.html` SHA-256 均为 `EFED020D32253DAFB477E87003D45AAEDA0C9A581A2214F5C188E2AC65CF6C9A`；原生 Bundle ID 继续为 `com.magicfloor.artlab.ipadcontrol`。
- 本轮没有修改桌面播放端代码或协议，不需要重新打包标准版与上下翻转版 EXE；Vite 仍只报告主 bundle 超过 `500kB` 的既有非阻塞警告。

## 55. 2026-08-26 首页进入动态艺术前白帧修复

### 根因与修复

- 白帧不是 WebGL、开场动画资源或路由目标页加载造成的。点击首页“动态艺术”后，应用会先截取首页前景并发送给 EXE；截图期间，可见的 `.entry-screen` 会临时加入 `dynamic-archive-snapshot-capture`，把背景色、背景图和伪元素清成透明，而开场动画 Portal 要等截图结束后才挂载，因此中间会短暂露出 `.page-frame` 原来的 `#f6f7f2` 浅色底。
- 已为首页专属外层 `.page-frame.page-view-entry` 增加与 `.entry-screen` 完全相同的品牌底图：`#69bbd6`、三层渐变、`magic-floor-background.webp`、`center bottom / cover`。正常状态下该底层被首页覆盖；截图期间首页变透明时，外层会无缝托住同一画面，不再出现白色首帧。
- EXE 前景截图规则没有改动：`dynamic-archive-snapshot-capture` 仍会清空首页自身背景，发送的 `ArchiveEnter.source.dataUrl` 仍为透明 PNG；新增底层只负责 iPad／Web 可见页面的连续性，不会被烘焙进 EXE 前景快照。
- 开场动画、WebGL 渲染、互动艺术入口、页面路由时序、Unity／EXE 消息与桌面播放端代码均未修改。本轮不需要重新打包标准版或上下翻转版 EXE，继续使用第 50 节记录的两套安装包。

### 回归、构建与同步

- 静态回归已锁定首页外层必须具备品牌蓝底、背景资源、固定定位和完整尺寸，同时锁定截图态必须继续保持透明，避免未来为消除白帧而破坏 EXE 前景图协议。
- Chromium 使用 `4× CPU throttling` 精确捕捉“截图类已启用、开场动画 Portal 尚未挂载”的原问题时段；在 `1024 × 768`、`1180 × 820`、`1366 × 1024` 三种尺寸下，点击前与截图期间三个无遮挡背景采样点 RGB 完全一致，未检测到白色或近白色全屏帧。
- 慢速时序确认修复覆盖真实空档：`1180 × 820` 截图阶段为 `552.5–1753.9ms`、Portal 于 `2523.1ms` 挂载；`1366 × 1024` 截图阶段为 `446.4–1447.2ms`、Portal 于 `2091.4ms` 挂载。截图结束到动画挂载仍有约 `644–769ms`，期间始终由同图外层托底。
- 已额外通过 `prefers-reduced-motion` 与 WebGL 初始化失败回退路径；互动艺术入口不会误触发动态艺术截图，也没有白底状态。EXE PNG 在两种独立尺寸下四角 Alpha 均为 `0`，证明透明前景语义保持不变。
- 已通过：`npx tsc --noEmit --pretty false`、`npm run test:creation-flow`、`npm run test:receiver-sync`、真实浏览器白帧回归与生产构建。
- 已执行 `npm run sync:ios`；当前 Web/iOS 资源为 `index-Bl3WpzVL.js`、`index-BMt1bJGx.css`、`web-DPsoDYp4.js` 与 `466-DTcHxBId.mp3`。`dist/index.html` 与 `ios/App/App/public/index.html` SHA-256 均为 `CFF80ECAF9A2F38887F491020B1E798F71FD5F18BF24F76DB6D2077787BB567A`；原生 Bundle ID 继续为 `com.magicfloor.artlab.ipadcontrol`。
- Vite 仍只报告主 bundle 超过 `500kB` 的既有非阻塞警告；本轮没有新增构建错误。

## 56. 2026-08-26 首页与作品档案重复进场动画修复

### 根因与修复

- 重复播放不是 React 重复挂载，也不是第 55 节新增的首页同图托底。`captureDynamicArchiveSnapshot()` 会在当前可见首页／作品档案页添加 `dynamic-archive-snapshot-capture`；旧规则对根节点、全部后代和伪元素使用 `animation: none !important`，添加截图类时会销毁现有 `CSSAnimation`，移除时浏览器便把同名进场动画当成新动画从头创建。
- 首页因此会在截图结束后重播根页面 `app-fade-in` 和两张入口卡片的 `entry-choice-in`；互动艺术卡片原有 `70ms` 延迟令两张卡看起来像依次重新加载。作品档案页在 Portal 到达后约 `700ms` 截图，移除截图类时又会重播 `dynamic-portal-library-reveal`，所以开场动画内已经出现过的档案页会在动画结束附近再加载一次。
- 截图态现改为 `animation-play-state: paused !important`：只暂停现有时间轴，不删除 `animation-name`，截图结束后继续原进度，不会重新从零播放。透明背景、关闭 `backdrop-filter` 与关闭 transition 的 EXE 截图兼容规则均保留，避免重新引入投影电脑曾出现的错误色块。
- 作品档案截图 effect 现在通过 `archivePortalArrivalRef` 读取 Portal 到达状态，不再因为 `portalArrival` 从 `true` 变成 `false` 而重新执行。每次从首页进入作品档案只截取并发送一次档案画面，Portal 完成后不会再做第二次相同截图或切换一次玻璃滤镜。
- 开场动画、首页和档案页原本应有的首次进场动画、`ArchiveEnter`／`ArchiveSnapshot` 协议、Unity／EXE 消息与桌面播放端均未改变。

### 实机回归、构建与同步

- Edge 真实时序回归覆盖 `1024 × 768` 与 `1180 × 820`。两种尺寸下，点击动态艺术后的首页 `entry-choice-in` 新增启动次数均为 `0`；作品档案顶栏和内容区的 `dynamic-portal-library-reveal` 均只启动并完成 `1` 次，没有第二次 start 或 cancel。
- `1180 × 820` 去重时序：Portal 为点击后 `+813–3024ms`；档案顶栏 Reveal 为 `+1977–2499ms`，内容区 Reveal 为 `+2098–2692ms`；档案截图仅一次，为 `+2620–2728ms`。Portal 与截图类最终均无残留。
- 网络侧仍收到一次有效 `ArchiveEnter` 和一次有效 `ArchiveSnapshot`；档案快照为 `version: 2`、`1180 × 820`、有效 `data:image/png;base64,...`。首页和档案透明 PNG 均已人工检查，前景按钮、标题、卡片及工具栏完整，背景透明语义没有改变。
- `4× CPU throttling` 下上一轮白帧回归继续通过：截图期间首页三个背景采样点逐通道一致，EXE 首页前景 PNG 左上角仍为 `[0,0,0,0]`，Portal 正常完成。
- 已通过：`npx tsc --noEmit --pretty false`、`npm run test:creation-flow`、`npm run test:receiver-sync`、两档真实浏览器回归、生产构建与相关 `git diff --check`。
- 已执行 `npm run sync:ios`；当前 Web/iOS 资源为 `index-CmWONPiQ.js`、`index-B62fdCoR.css`、`web-B1e8Zp6-.js` 与 `466-DTcHxBId.mp3`。`dist/index.html` 与 `ios/App/App/public/index.html` SHA-256 均为 `A810145C90E24DC0BA8F5B464F60072B8D9DCEDE385DF50F580BF127C0B45DCC`；原生 Bundle ID 继续为 `com.magicfloor.artlab.ipadcontrol`。
- 本轮没有修改桌面播放端代码或协议，无需重新打包标准版与上下翻转版 EXE；Vite 仍只报告主 bundle 超过 `500kB` 的既有非阻塞警告。

## 57. 2026-08-26 舞台中心水印改用首页 Logo

### Git 检查点与最终显示规则

- 修改前已将完整工作树提交为 Git 检查点 `10c5ca37`，提交说明为 `chore: checkpoint before stage watermark logo update`；该提交只作为本轮改动前的可回退基线，未推送远端。
- Web/iPad 动态艺术控制页舞台中心原有 `MagicFloor`／`preview` 两行文字已移除，现改为首页同一张 `Right_Logo.png`。`BrandLogo.tsx` 对外复用 `RIGHT_LOGO_URL`，控制页不复制第二套资源路径，首页和水印会始终引用同一 Logo 文件。
- Logo 继续位于 `1920 × 1080` 舞台 SVG 的精确中心：`x=660`、`y=420`、`width=600`、`height=240`，使用 `preserveAspectRatio="xMidYMid meet"`。中心安全区、两条交叉虚线、`(960,540)` 交点、mask、`pointer-events: none`、设置页开关，以及编辑态／预览态均显示的既有规则保持不变。
- 整组舞台水印的不透明度由 `0.44` 改为 `0.4`，即 40%；Logo 使用与虚线一致的深色双层阴影，确保白色透明底 Logo 在浅色舞台背景上仍可辨识。
- 舞台内部最终层级为背景 `z-index: 1`、水印 `z-index: 90`、背景切换动画 `z-index: 100`。水印位于舞台背景和作品上方，但背景切换动画始终覆盖水印，切换过程中不会被水印线条或 Logo 干扰。
- 最终产品边界不变：水印只在 Web/iPad 控制页绘制；Windows 标准版和上下翻转版 EXE 永远不绘制水印。桌面播放代码与协议没有修改，也无需重新打包 EXE；桌面端保留的禁用兼容代码不代表重新启用水印。

### 回归、构建与同步

- 已通过 `npx tsc --noEmit --pretty false`、`npm run test:creation-flow`、`npm run test:receiver-sync`、生产构建、`npm run sync:ios` 与 `git diff --check`。静态回归会锁定首页 Logo 资源复用、SVG 几何、40% 不透明度、中心安全区不遮挡 Logo、`背景 < 水印 < 背景切换动画` 的层级关系，以及旧 `<text>` 不得重新出现。
- `transition-portal-preview` 的浏览器脚本已成功进入控制页并读取到新的 `.dynamic-stage-watermark-logo`、水印样式与几何数据；脚本随后在与本轮无关的旧 `.dynamic-object-linkage-card` 等待步骤超时，因此未把整套联动布局流程记为通过。
- 已执行 `npm run sync:ios`；当前 Web/iOS 资源为 `index-qcNDnpOd.js`、`index-BjubkPSb.css`、`web-Dxi7gNwR.js` 与 `Right_Logo-NbNB79TN.png`。`dist/index.html` 与 `ios/App/App/public/index.html` SHA-256 均为 `69C30F269F15236FBAB183D713C69B224970F778EF370C52C2D1AAB8FB180E7F`；原生 Bundle ID 继续为 `com.magicfloor.artlab.ipadcontrol`。
- 已直接核对两套构建产物：均包含 `.dynamic-stage-watermark-logo`、`.dynamic-stage-watermark-mark{opacity:.4}`、水印层级 `90` 与背景切换动画层级 `100`，均不再包含旧中心 `<text>` 或水印专用 `opacity:.44`。Vite 仍只报告主 bundle 超过 `500kB` 的既有非阻塞警告。

## 58. 2026-08-27 舞台水印右上虚线补全

### 局部 Mask 修正

- 右上分支的明显空档并非 `30px 20px` 虚线相位造成，而是统一的 `x=660`、`y=420`、`600 × 240`、`rx=52` 矩形安全区没有贴合 Logo 右上方向的实际透明轮廓；直接缩小整个矩形会同时改变其他三条分支，并可能让下方虚线穿进 Logo，因此未采用全局缩小方案。
- 原安全区矩形、两条正式对角线、虚线相位与 Logo 几何全部保持不变。仅在同一 SVG mask 的黑色安全区之后增加白色 `.dynamic-stage-watermark-upper-right-mask-notch`，沿原右上对角线从 `(1082.021,471.363)` 开放到原边界交点 `(1173.333,420)`，使用 `strokeWidth=64` 与 `strokeLinecap=butt`。
- notch 两端继续满足原对角线方程 `9x + 16y = 17280`；起点距离舞台中心为 `140` viewBox 单位，终点距离约 `244.767`。因此右上虚线向 Logo 方向补近约 `104.77` viewBox 单位，折合 iPad Air 舞台约 `35.8px`、iPad Pro 12.9 舞台约 `51.5px`，同时为 Logo 及其阴影保留安全间距。
- 正式可见线仍由原第二条完整 `<line>` 绘制，mask notch 只局部重新开放已有虚线，不会重启 dash 相位；左上、左下、右下三个分支不变。40% 总不透明度、Logo、中心安全区主体、水印 `z-index: 90`、背景切换动画 `z-index: 100`、设置开关与触控穿透规则均保持不变。

### 回归、视觉检查与同步

- `test:creation-flow` 已增加 notch 结构和几何断言：必须位于 mask 内、指向右上、两端落在原对角线上、起点保持 `140` 单位安全距离、终点仍落在原矩形边界，并锁定白色 `64` 宽 butt 端帽。
- 已通过 `npx tsc --noEmit --pretty false`、`npm run test:creation-flow`、`npm run test:receiver-sync`、生产构建、`npm run sync:ios` 与 `git diff --check`。浏览器已重新生成 iPad Air 舞台截图并人工确认右上虚线明显补近、未触碰 Logo，其他三条分支不变；整套 linkage 脚本随后仍在与本轮无关的旧 `.dynamic-object-linkage-card` 等待步骤超时。
- 当前 Web/iOS 资源为 `index-C5HHwQJN.js`、`index-BjubkPSb.css`、`web-DDp26xo7.js` 与 `Right_Logo-NbNB79TN.png`。`dist/index.html` 与 `ios/App/App/public/index.html` SHA-256 均为 `E0E5D63A7447093C84E99245AD61E3F5CE77C710C7CEBF95E24BEE6B6B6C1FEF`；两端对应资源逐文件哈希一致，且 bundle 均包含新 notch 类及两端坐标。

## 59. 2026-08-27 编辑背景清除全部 BGM 按钮文字放大

- 前一版给 `.dynamic-background-bgm-clear-all` 单独设置 `20px` 没有实际生效：该选择器只有两个 class，而更高优先级的 `.dynamic-background-modal .dynamic-background-bgm-controls > .ipad-button` 含三个 class，并在 `max-width: 1100px` 响应式规则中将按钮压到 `8px`；因此截图中仍是小字。
- 最终改为让“套用转场”和“清除全部 BGM”共用同一条后置规则：`.dynamic-background-entrance-controls > .ipad-button` 与 `.dynamic-background-bgm-controls > .dynamic-background-bgm-clear-all` 都使用 `font-size: 14px`。两边选择器特异性同为 `(0,3,0)`，且位于旧规则之后，所以 iPad 窄视口下的实际计算字号也完全一致。
- 本轮只修正按钮文字的 CSS 级联。清除按钮原有全宽布局、`46px` 最小高度、内边距、危险操作配色、禁用态、换行规则、图标及清除行为均保持不变。
- `test:creation-flow` 已锁定两个按钮必须共用同一个 `14px` 规则；浏览器布局脚本会分别读取两个按钮的 computed `font-size`，要求清除按钮实际为 `14px` 且与“套用转场”一致。已通过 `npx tsc --noEmit --pretty false`、`npm run test:creation-flow`、`npm run test:receiver-sync`、相关脚本语法检查、生产构建、`npm run sync:ios` 与 `git diff --check`。
- 当前 Web/iOS 资源为 `index-C-kkD9KH.js`、`index-D66lmjim.css` 与 `web-DuGIYUnV.js`。`dist/index.html` 与 `ios/App/App/public/index.html` SHA-256 均为 `86125470DFDE128A6F4DB7301D5E4597EE6EF90F4DA2CBC2727D9856769FFDBC`；两端对应 CSS 哈希一致，生产 CSS 均包含两个按钮共享的 `font-size:14px` 最终规则。

## 60. 2026-08-27 舞台图层物件序号移除

- 舞台控制页右侧“图层”列表已移除每张物件卡片缩略图左上角的两位数序号徽标，例如 `01`、`02`、`03`。对应 `.dynamic-layer-order` JSX 节点及四处历史样式全部删除，基础卡片网格同步由“序号＋缩略图＋文字”三列收敛为“缩略图＋文字”两列，不会留下空白栏位。
- 本轮只移除可见标识，不删除 `item.order`。控制端舞台 `z-index`、列表前后顺序、拖拽排序、键盘上下排序、存储、GroupStateSync 与 Windows 播放端绘制顺序继续沿用原有层级数据；物件名称、缩略图、摘要、复选框、属性/删除按钮和图层标题旁的 `当前数量/上限` 统计均保持不变。
- `test:creation-flow` 已增加源码与 CSS 双重断言，禁止 `.dynamic-layer-order` 节点或死样式重新出现。已通过 `npx tsc --noEmit --pretty false`、`npm run test:creation-flow`、`npm run test:receiver-sync`、生产构建、`npm run sync:ios` 与 `git diff --check`。
- Chromium/Edge 已在 iPad Air `1024 × 768` 的真实控制页重新生成 `transition-portal-preview/test-artifacts/linkage/ipad-air-layers.png`，人工确认所有缩略图左上角序号消失，卡片内容与操作区正常；整套旧布局脚本随后仍在与本轮无关的 `.dynamic-object-linkage-card` 等待步骤超时。
- 当前 Web/iOS 资源为 `index-D3gHcuzl.js`、`index-CoeK4F4l.css` 与 `web-CijR1jPD.js`。`dist/index.html` 与 `ios/App/App/public/index.html` SHA-256 均为 `5B189CE90D41873C9394218DE7B882B63C226CD653917FF85F8ECA9475A714AB`；两端三项资源逐文件哈希一致，生产 JS/CSS 均不再包含 `dynamic-layer-order`。

## 61. 2026-08-27 App Store Bundle ID 与上架文案同步

- iOS 当前有效 Bundle Identifier 已由 `com.magicfloor.artlab.ipadcontrol` 改为 App Store Connect 既有记录对应的 `com.magicfloor.artlab`。`capacitor.config.ts`、Xcode App Target 的 Debug 与 Release `PRODUCT_BUNDLE_IDENTIFIER` 三处均已同步；`Info.plist` 继续使用 `$(PRODUCT_BUNDLE_IDENTIFIER)`，没有写死重复值。
- `npm run sync:ios` 已重新执行，生成且被 iOS `.gitignore` 忽略的 `ios/App/App/capacitor.config.json` 已确认 `appId=com.magicfloor.artlab`。三个有效配置文件中不再包含旧 ID；第 49、52–57 节记录的旧 ID 保留为当时构建历史，没有批量篡改。
- 根目录 README 的 Capacitor 初始化示例已同步为当前 `appId` 与 `MagicFloor` 名称。新增 `APP_STORE_SUBMISSION_ZH-HANS.md`，提供可直接粘贴的简体中文副标题、宣传文本、完整软件描述、App Review 审核备注模板及提交前必填清单。
- 上架文案明确说明账号登录、动态艺术编辑、本地预览、互动上传、远程控制、局域网配套接收端和本机资料保存边界，没有宣称尚未提供的作品云同步或公开社区。副标题 `13` 字符、宣传文本 `63` 字符、软件描述 `835` 字符，均在 App Store Connect 对应字段上限内。
- 已通过生产构建、Capacitor iOS 同步、SPM 路径修复、`npm run test:creation-flow`、`npm run test:receiver-sync` 与 `git diff --check`。当前 Web/iOS 资源继续为 `index-D3gHcuzl.js`、`index-CoeK4F4l.css` 与 `web-CijR1jPD.js`；两端 `index.html` SHA-256 均为 `5B189CE90D41873C9394218DE7B882B63C226CD653917FF85F8ECA9475A714AB`，三项资源逐文件哈希一致。
- Windows 环境不能完成 Xcode Archive、签名或上传。后续必须在 macOS/Xcode 选择拥有 `com.magicfloor.artlab` App ID 的 Apple Developer Team，确认 Release provisioning profile 与 App Store Connect 记录匹配，再 Archive；提交前还必须补入真实审核账号、隐私政策网址、技术支持网址及跨设备功能的审核测试方式。

## 62. 2026-08-27 App Store iPad 截图交付

- 已在 `app-store-assets/screenshots/ipad-pro-12-9/` 生成 10 张可直接上传 App Store Connect 的横屏 PNG。统一采用 Apple 接受的 `2732 × 2048 px`，对应 `1366 × 1024` CSS 视口与 `deviceScaleFactor=2`，没有后期拉伸或 AI 生成。
- 10 张内容依次为首页、作品档案、舞台控制、物件属性、背景编辑、出场设定、本地预览、互动主题、遮罩编辑和远程键盘控制。页面使用简体中文及专门的本地演示作品数据，不依赖线上账号内容，也没有显示测试文案、失败 Toast 或网络错误。
- 新增 `transition-portal-preview/scripts/capture-app-store-screenshots.mjs` 与 `npm --prefix transition-portal-preview run capture:app-store` 命令。脚本使用本机 Edge 访问真实应用，拦截截图期间的认证、资料读取与局域网接收端请求，逐页等待素材稳定后截图，并把页面异常、控制台错误和尺寸不符视为失败。
- 背景编辑截图会主动滚动到设置区底部，并验证 BGM 操作与 `清除全部 BGM` 按钮完整落在可见范围；互动遮罩截图使用现有 `fish.png` 导入并选择海龟遮罩。截图顺序、用途、重跑命令及验证说明记录于 `app-store-assets/screenshots/README.md`。
- 已逐张人工检查所有背景、作品缩略图、舞台物件、主题封面、互动遮罩与控制面板，确认 10 张内容明显不同且没有弹窗裁切。独立使用 `System.Drawing.Image` 读取最终文件，确认 PNG 恰好 10 张且每张真实尺寸均为 `2732 × 2048`；截图脚本运行期间 10 页的 `console`／`pageerror` 均为空。

## 63. 2026-08-27 出场设定按背景隔离与 iPad 窗帘水印修复

### 出场设定背景隔离

- “出场设定”页现在以当前活动背景或预览选中的背景作为唯一范围，左侧物件列表、标题数量、空状态和时间线都只读取该背景可见的物件；不会再把其他背景的物件混在同一页。
- `backgroundIds=[]` 仍代表物件贯穿全部背景；指定 `backgroundIds` 的物件只会在对应背景显示。播放端 `desktop-runtime/renderer/player.js` 与控制端使用同一筛选规则，确保编辑、iPad 预览和 Windows 播放一致。
- 每个背景独立保存 `appearMode`、`appearIntervalMs`、`appearAnimation`，每个物件可通过 `appearanceByBackground[backgroundId]` 保存独立的出场延迟和到达后隐藏时间。切换背景后重新进入出场设定会读取对应配置，不会覆盖其他背景。
- `ItemMotion` 同步现在先解析当前背景的出场时间；当前背景存在独立配置时优先发送并保留该配置，只有旧客户端没有对应 map 项时才回退旧的全局字段。这样修改移动速度或幅度不会再把某个背景的出场时间写回旧值，也不会用空 map 清掉接收端已有配置。
- “属性复制”选择“移动方式”时会同时复制旧版出场字段、逐背景 `appearanceByBackground` 和到达后隐藏设置；桌面端复制核心会对逐背景计时做独立对象复制，避免后续编辑互相引用。

### iPad 窗帘转场水印

- 已确认 `Right_Logo.png` 可见像素为纯白，iPad 变黑不是素材问题，而是旧 iOS bundle 中 `brightness(0) invert(1)` 在 WKWebView 动画合成层上的兼容差异；本机 Chromium 能执行完整滤镜，部分 iPad 会只执行 `brightness(0)`，于是白色 Logo 变黑。
- 舞台窗帘转场的 Logo 现在直接使用白色原图，仅保留阴影，`.is-curtain` 同时清除 `filter` 和 `-webkit-filter`；白底的 `cameraFlash` 仍保留黑色 Logo 滤镜以维持对比度。没有使用跨平台表现不稳定的 `mix-blend-mode`。
- 层级继续固定为背景 `z-index: 1`、普通舞台水印 `z-index: 90`、背景转场层 `z-index: 100`：普通水印位于背景上方，但转场动画会完整覆盖水印，不会被水印线条或 Logo 干扰。

### 回归、构建与交付边界

- 已通过 `npm run test:creation-flow`、`npx tsc --noEmit --pretty false`、`npm run test:receiver-sync`、`npm --prefix desktop-runtime run test:appearance`、`npm --prefix desktop-runtime run test:presentation`、`npm --prefix desktop-runtime run test:item-copy`、`node --test desktop-runtime/group-state-revision-integration.test.cjs`、三个运行时 `node --check` 和 `git diff --check`。
- 已重新执行 `npm run sync:ios`（包含 TypeScript/Vite 构建、Capacitor iOS 复制和 `fix:ios-spm-paths`）。当前 Web/iOS 资源为 `index-wvjcFhkt.js`、`index-D_JK92rf.css`、`web-Ce72dX2y.js` 与 `Right_Logo-NbNB79TN.png`；`dist/index.html` 与 `ios/App/App/public/index.html` SHA-256 均为 `10C6B6210E0DB7D9B67D0EF27ABE79A9AA7841997E690E06BD4D42C053001A69`，60 个 Web 文件全部逐文件一致，iOS 额外的 `cordova.js`／`cordova_plugins.js` 为 Capacitor 正常文件。
- 产物静态核对确认 curtain 规则同时包含 `filter:none!important` 与 `-webkit-filter:none!important`，水印透明度为 `.4`，转场层级为 `100`；iOS 配置和 Xcode Debug/Release Bundle ID 均为 `com.magicfloor.artlab`。
- 当前环境为 Windows，无法进行真实 iPad Pro/Air WKWebView、Xcode Archive、签名或 App Store 上传验证；需安装包含本次最新 bundle 的新包，单纯刷新旧安装包不会替换旧 CSS/缓存。

## 64. 2026-08-27 出场设定摘要按当前背景最终同步

### 摘要显示修正

- 图层卡片摘要现在通过 `getResolvedAppearanceTiming(item, displayedBackgroundId)` 读取当前活动背景或预览背景的出场延迟；切换背景后，列表摘要不会继续显示另一个背景或旧全局字段的时间。
- 出场设定左侧列表、时间线、舞台预览和 Windows 播放端继续共用有效活动背景解析与 `getDynamicPlaybackItemsForBackground(...)` 筛选；`backgroundIds=[]` 的全局物件仍在所有背景显示，指定背景的物件不会混入其他场景。
- 独立背景出场配置、接收端同步、旧数据兼容回退、窗帘转场白色 Logo 原图与 `filter`/`-webkit-filter` 清除规则均保持不变。
- `desktop-runtime/README.md` 已同步说明每张背景的独立出场参数、物件 `appearanceByBackground` 数据结构及当前 `linkedAppearanceModelVersion=4`。

### 最终构建与验证

- 已重新执行 `npm run sync:ios`，当前 Web/iOS 资源为 `index-BeoNexvg.js`、`index-D_JK92rf.css`、`web-CcZJMrrZ.js`、`Right_Logo-NbNB79TN.png`、`magic-floor-background-C-YGeMXK.webp`、`ArtDisplay-C-eGl2ju.jpg` 和 `466-DTcHxBId.mp3`。
- `dist/index.html` 与 `ios/App/App/public/index.html` SHA-256 均为 `79AE18226DAF394A3F91BEAB2B87A04E29377C707E98C242F295B99461CD785E`；`dist` 的 60 个 Web 文件与 iOS 公共目录逐文件 SHA-256 一致，iOS 额外的 `cordova.js`／`cordova_plugins.js` 为 Capacitor 正常文件。
- 已通过 `npx tsc --noEmit --pretty false`、`npm run test:creation-flow`、`npm run test:receiver-sync`、`npm --prefix desktop-runtime run test:appearance`、`npm --prefix desktop-runtime run test:presentation`、`npm --prefix desktop-runtime run test:item-copy`、`node --test desktop-runtime/group-state-revision-integration.test.cjs`、三个运行时 `node --check` 与 `git diff --check`。Vite 仅报告既有主 bundle 超过 `500kB` 的非阻塞提示。
- Windows 环境仍无法真实验证 iPad Pro/Air 的 WKWebView 合成、Xcode Archive、签名和 App Store 上传；必须安装包含上述最新 Web bundle 的新 iOS 包，单纯刷新旧安装包不会替换旧资源或缓存。

## 65. 2026-08-27 当前版本桌面 EXE 重新打包

### 构建产物

- 已执行 `npm --prefix desktop-runtime run pack:all`，标准版与竖屏翻转版均根据当前工作树重新打包；打包前分别清理了旧的 `release` 与 `release-vertical-flip` 目录。
- 标准版：`desktop-runtime/release/MagicFloor Dynamic Player 0.1.0.exe`，`85,323,981` bytes，SHA-256 为 `6FBE0272F5E716722B6ED150AE808474124CE15CE8468C9B2A10239EAD0D4038`。
- 竖屏翻转版：`desktop-runtime/release-vertical-flip/MagicFloor Dynamic Player Vertical Flip 0.1.0.exe`，`85,311,393` bytes，SHA-256 为 `51D603EEF724DC7619D046ED7076706338383E930D2D15090CA4F3FD4EC98DDE`。

### 包内核对

- 两份 `app.asar` 均已确认包含 `appearanceByBackground`、`getDynamicAppearanceTimingForBackground`、`background.appearance`、最新 `player.js` 和 `Right_Logo.png`；包内关键桌面源码与当前源码 SHA-256 一致。
- 两套包的 `main.js`、`renderer/player.js`、`renderer/advanced-appearance-timeline.js` 均通过 `node --check`；当前构建仍使用 Electron Builder 的默认图标配置。
- 当前环境无法可靠执行 GUI EXE 冷启动和真实舞台硬件联调；正式现场应先启动其中一套并确认 `8080` 监听，标准版与翻转版不能同时运行。
- 两份 EXE 当前均为 `NotSigned`；本机或内网测试可用，正式对外分发仍需配置 Windows 代码签名证书。`release*` 目录被 Git 忽略，交付时应直接复制 EXE 文件。

## 66. 2026-08-27 再次确认桌面 EXE 交付包

### 本次构建结果

- 在完成上一轮开发烟测清理后，再次执行 `npm --prefix desktop-runtime run pack:all`，命令返回退出码 `0`；标准版和竖屏翻转版均从当前工作树重新生成。
- 标准版：`desktop-runtime/release/MagicFloor Dynamic Player 0.1.0.exe`，`85,323,982` bytes，SHA-256 为 `05B7F958354186EB5554A1B5246C1BE66682CC9A5899BBCB273EE2BF075F36B`，生成时间 `2026-08-27 17:36:34`。
- 竖屏翻转版：`desktop-runtime/release-vertical-flip/MagicFloor Dynamic Player Vertical Flip 0.1.0.exe`，`85,311,392` bytes，SHA-256 为 `63298C0DD4AF5D02E653B928734DC02DE070F08B224A38262CCBFF53C3BDFBA6`，生成时间 `2026-08-27 17:38:11`。

### 包内和回归核验

- 两个 `app.asar` 均成功解包；`main.js`、`renderer/player.js`、`renderer/advanced-appearance-timeline.js` 和 `renderer/assets/Right_Logo.png` 与当前源码/素材 SHA-256 完全匹配。
- `npx tsc --noEmit --pretty false`、`npm run test:creation-flow`、`npm run test:receiver-sync`、桌面 `test:appearance`、`test:presentation`（38 项）、`test:item-copy`、三个运行时 `node --check` 与 `git diff --check` 全部通过。
- 已在清除开发终端遗留的 `ELECTRON_RUN_AS_NODE=1` 后分别冷启动两套 EXE；两套 `/status` 均返回 `server.status=listening`、`port=8080`、`view.mode=archive` 和 `watermarkVisible=false`，随后已正常退出并释放端口。`8080` 和 `5173` 当前均无监听。EXE 仍为 `NotSigned`，正式分发前需要 Windows 代码签名证书；真实 iPad、舞台硬件联调和 Xcode Archive 仍需在目标设备／macOS 上验证。

## 67. 2026-08-31 iPad 透明物件动画稳定性与完整预览声音隔离

### Git 回退点与素材核查

- 修改前已提交 Git 回退点 `d8e610cc`，提交说明为 `chore: checkpoint before iPad preview stability fixes`。根目录 `1 (1).png` 至 `1 (9).png` 九张参考素材继续保持未跟踪，没有纳入该提交或后续构建。
- 九张参考图均为正常的 `1728 × 2304`、8-bit RGBA、非交错 PNG，并非文件本身损坏，也不是用户描述中的 `8 × 1736`。九张图完整解码后的基础像素内存约为 `136.69 MiB`，实际播放时还会叠加原图、Canvas 位图与 GPU 合成面的占用。

### WebKit 根因与稳定性修复

- iPad 的问题主要来自 WKWebView 合成路径而非动画 `1～17` 的参数：动画 `1～8` 同时叠加移动、出场、目标点、动画变换、用户旋转缩放、`drop-shadow`、隐藏 backface 与多层 `will-change`；极端长宽比素材的真实 DOM 宽度可能低于 `1 CSS px`，在内存压力下容易被 WebKit 剔除。Windows EXE 使用单一舞台 Canvas，因此相同素材能持续完整绘制。
- 媒体物件的可合成外框现在至少为 `32 × 32 CSS px`，图片仍以 `object-fit: contain` 按原始比例绘制，所以物件的视觉尺寸、位置、缩放、旋转和同步协议参数不变；气泡物件继续使用原有 `itemPreviewSize`，不会被最小媒体合成面放大。
- 完整预览和“播放目前背景”期间会移除透明媒体的 `drop-shadow`、恢复可见 backface，并释放静态内层不必要的 `will-change`；真正负责动画的外层变换仍保留。Walk／Unity Canvas 在播放态同时取消原有 `80ms` opacity transition，避免原图隐藏后 Canvas 仍处于淡入过程形成空白；Unity 的 `155% × 172%` overscan 明确使用 `max-width: none`、`max-height: none`，不再被通用媒体尺寸规则截断。
- Walk／Unity Canvas 每两帧进行一次 alpha 探测、最多探测八次，并且每次探针必须至少采到 `4` 个非透明样本、alpha 总和至少为 `128`；只有连续两次探针有效才隐藏原图，不再由一个孤立像素或一次任意首帧结果决定 ready。Canvas 尺寸变化或绘制失败会恢复原图；context lost、`getContext()` 为空、`isContextLost()` 为真或绘制抛错时，都会通过 `requestCanvasRebuild` 请求使用新 React `key` 重建 Canvas。自动重建上限为 `2` 次，出现首个连续有效帧后清零计数，避免永久重建循环。
- 舞台播放会把已经加载、已经解码的 DOM `<img>` 直接作为 `sourceImage` 传给 Walk／Unity Canvas，不会再为同一舞台物件创建第二个 `Image` 解码；动画选择器等没有现成 DOM 图像的独立调用场景仍使用共享图片租约缓存。位图计算使用独立的 `scaleX`／`scaleY`，在倍率上限 `12`、iPad `4MP` 总像素和 `3072px` 边长预算内，尽量保证极端比例素材经过 contain 后的短轴至少拥有 `12` 个位图像素；Unity 使用扣除 overscan 后的实际内容宽高计算同一预算。

### 完整预览声音边界

- 完整“预览”顶栏新增 iPad 声音开关，每次进入完整预览默认关闭；按钮以 `aria-pressed` 暴露状态，简体中文、繁体中文、英文、葡萄牙文和波兰文均有独立的开／关文案。用户在预览中主动开启时，会在同一次点击手势内恢复当前 BGM、物件音频和背景视频播放，兼容 iOS 的媒体手势限制。
- 静音条件严格为 `previewModeRef.current && !previewAudioEnabledRef.current`，只覆盖完整预览中的 iPad 本地 BGM、淡出中的 BGM、物件音频、背景视频和背景转场声音。“播放目前背景”不是完整预览，不会被该开关静音；退出预览、切换作品或卸载页面后会恢复本地转场音效状态。
- 声音开关不写入 `PreviewMode` 消息，也没有修改任何 iPad／EXE 同步协议；EXE 的 BGM、物件音频、视频原声和背景转场声音全部保持原行为。按钮点击反馈使用独立 UI 音效通道，没有被预览静音开关关闭。

### 静态回归

- `test:creation-flow` 已锁定五语文案、完整预览专属顶栏与 `aria-pressed`、严格静音条件、新建 BGM／物件 Audio 的首播前静音、转场音效隔离、接收端消息边界、背景视频统一状态、媒体／气泡合成面、播放态 CSS、Walk／Unity transition 清除、Unity overscan、DOM 图像复用、独立双轴位图比例、八次上限／两帧间隔／每次至少四样本且 alpha 总和达标／连续两次可见的判定、`onFrameUnavailable` 回退、四类 Canvas 故障入口、最多两次的 generation 重建及 iPad Canvas 倍率／像素／边长预算。
- 已通过 `npx tsc --noEmit --pretty false`、`npm run test:creation-flow`、`npm run test:receiver-sync`、桌面 `test:transition-audio`、`test:appearance`、`test:presentation`（40 项）、两个转场音效脚本的 `node --check` 与 `git diff --check`；后者只报告仓库既有的 LF→CRLF 工作区换行提示，没有空白错误。
- 已执行 `npm run build` 与 `npm run sync:ios`。当前 Web/iOS 资源为 `index-Tn1C4z8-.js`、`index-CXE3gOZZ.css` 与 `web-CRwpcCX5.js`；`dist/index.html` 和 `ios/App/App/public/index.html` SHA-256 均为 `BDC51739E4E9F7F90DB2B4F6F08A132CC68F851DD21039CE6939C8DAA4D84951`，`dist` 的 60 个文件与 iOS 公共目录逐文件一致。Xcode Debug/Release 的 Bundle ID 均保持 `com.magicfloor.artlab`。Vite 只报告既有主 bundle 超过 `500kB` 的非阻塞提示。
- 当前 Windows 环境无法代替 iPad Pro/Air 的真实 WKWebView 合成与音频策略验证；必须安装包含上述最新 bundle 的新 iOS 包，并用 `8 × 1736` 极窄素材、九张 `1728 × 2304` PNG、多物件同时播放、完整预览默认静音／手势开启声音和“播放目前背景”保留声音这几组场景做最终真机回归。

## 68. 2026-09-01 舞台控制页首次入场定位稳定

### 根因与修复

- 舞台物件的 `left`／`top` 表示中心坐标，外层 `.dynamic-stage-item-motion` 必须长期保留 `translate(-50%, -50%)`。旧的 `is-stage-entering` 直接挂在该外层，并用 `translate3d(0, -120px, 0) → translate3d(0, 0, 0)` 覆盖完整 `transform`；配合 `fill: both` 和页面固定 `1400ms` 清理时间，会在单个物件动画结束后暂时把其左上角放到中心坐标，随后 class 清除才恢复正确位置。
- `DynamicStageMotion` 现在保留稳定的外层定位与运动动画层，新增始终存在的 `.dynamic-stage-item-entry` 内层承载首次进入页面的纵向位移和透明度动画。入场动画完成前后都不会再修改外层中心定位，也不会与预览移动、目标点、旋转缩放或 Canvas 动画争用同一个 `transform`。
- `prefers-reduced-motion` 规则已同步切换到新的内层选择器；物件保存坐标、舞台比例、EXE 同步协议和既有入场节奏均未修改。

### 回归

- `test:creation-flow` 新增静态约束：外层必须保留 `style={style}` 和中心定位，`stageEntering` 只能控制内层 `.dynamic-stage-item-entry`，CSS 不得重新出现 `.dynamic-stage-item-motion.is-stage-entering`。
- 已通过 `npx tsc --noEmit --pretty false`、`npm run test:creation-flow` 与 `git diff --check`；空白检查仅报告仓库既有的 LF→CRLF 工作区提示。
- 已执行 `npm run sync:ios`。当前 Web/iOS 资源为 `index-B4zQ6XKf.js`、`index-DbDWAtgA.css` 与 `web-CpUtInzI.js`；`dist/index.html` 和 `ios/App/App/public/index.html` SHA-256 均为 `962D2C5AEF7BD6F6904F04EE48E9196674F100491F39982CBBCC126AD87C6ADE`，`dist` 的 60 个文件与 iOS 公共目录逐文件一致（0 个差异）。

## 69. 2026-09-01 EXE 左右进场与退场倒飞修复

### 根因与桌面端修复

- 本轮按要求只修改 Windows EXE 播放端，没有修改 `src/`、iPad 控制页、同步协议或 iOS 构建资源。动画 `09` 继续只负责物件内部的行走网格形变，不参与舞台坐标计算。
- EXE 原本用纵向 `moveTrack` 判断横向进场方向：中轨一律从右侧进入，上／下轨一律从左侧进入。左侧起点物件若位于中轨，会先被放到舞台最右侧外，再横穿到左侧起点，随后才继续目标点路径。
- 新增桌面专用 `renderer/desktop-appearance-motion-core.js`。`position.x < 0.5` 的物件从舞台左边界外进入，`position.x >= 0.5` 的物件从右边界外进入；方向不再受上／中／下轨道影响。中心点 `0.5` 使用稳定的右侧默认值。
- EXE 原本把包含入场渐显与退场渐隐的总 `alpha` 同时当作入场位移进度；退场时 `alpha` 下降会倒放侧滑或掉落位移。桌面端现按 `entranceStartMs`／`entranceDurationMs` 独立采样只增不减的入场进度，退场只改变透明度，不再横向倒飞或向上回弹。
- 目标点、移动速度、顺序出场时间、动画 `09`、点击动画、图片旋转缩放及标准版／翻转版显示规则均保持原行为。

### 回归、构建与交付

- 新增九物件回归：`1／3／5／7／9` 的右侧起点从右边界外进入，`2／4／6／8` 的左侧起点从左边界外进入；同时覆盖动画 `09`、入场完成后的原始坐标和退场中途不得倒放位移。`test:appearance` 的 3 项新增测试全部通过。
- 已通过桌面 `test:appearance`、`test:target-motion`、`test:motion`、`test:presentation`（40 项）、`test:item-copy`、`test:transition-audio`、`test:background-order`、两个运行时 `node --check` 与 `git diff --check`；独立只读审查未发现数学或集成阻断问题。
- 已执行 `npm --prefix desktop-runtime run pack:all`，打包前自动清理旧 `release` 与 `release-vertical-flip`。标准版为 `desktop-runtime/release/MagicFloor Dynamic Player 0.1.0.exe`，`85,327,243` bytes，SHA-256 `D369D60FCD250A00C5E0E651F4257A61E3925F759A0F91E4BD1891DA8BC85F26`。
- 翻转版为 `desktop-runtime/release-vertical-flip/MagicFloor Dynamic Player Vertical Flip 0.1.0.exe`，`85,314,163` bytes，SHA-256 `B0AEC8DD924B25A65D3AAB9449A74BE6102E2C02617267DA183765ABB6A3C37C`。
- 两份 `app.asar` 内的 `renderer/player.js` 与 `renderer/desktop-appearance-motion-core.js` 均和当前源码 SHA-256 完全一致。两套 `win-unpacked` 已分别冷启动，`/status` 均返回 `server.status=listening`、`port=8080`、`view.mode=archive`、`watermarkVisible=false`；退出后端口已释放。两份 EXE 仍为 `NotSigned`。
