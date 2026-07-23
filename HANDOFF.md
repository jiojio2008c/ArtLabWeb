# MagicFloor 当前交接文档

更新时间：2026-07-23
当前状态：新版双入口和动态艺术工作台已经完成。首页为 `動態藝術` / `互動藝術` 双入口；端口和 IP 由设置页管理；`互動藝術` 继续沿用 11701 快速上載流程；`動態藝術` 已具备背景上載、作品檔案、档案内图片、16:9 多物件舞台、固定图层、物件属性、选择性属性复制、移动与动画预览，以及独立持久化和 PC 重同步能力。大改前可用功能基线仍保留在下方，作为回退和协议对照。

## 近期修改记录

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
