# Art Lab Web 應用

## 項目總覽
開發一款自適應 Web 應用，适配桌面 /iPad Web 端，核心流程：本機選圖/相機拍攝 → 即時預覽 → 上載至Supabase → 圖片編輯（縮放+拖放定位+動畫選擇） → WebSocket即時發送數據到Unity接收端。

## 技術棧
- React 18 + TypeScript + Vite
- Tailwind CSS（自適應适配桌面 /iPad）
- UDP 通訊（使用 capacitor-udp 插件）
- Axios（multipart/form-data 對接 Supabase）
- react-use-gesture（滑鼠 / 雙指縮放、拖放定位）
- Capacitor 6（打包 iPad，調用相機 / 網絡權限）

## 安裝依賴
```bash
npm install
```

## 本地啟動
```bash
npm run dev
```

## 構建生產版本
```bash
npm run build
```

## 預覽生產版本
```bash
npm run preview
```

## 功能說明

### 頁面 1：圖片上載 & 相機拍攝頁
- 支援本機檔案選擇、拖放上載、iPad / 相機拍攝
- 格式支援：JPEG/PNG/GIF/WebP，≤10MB
- 選擇 / 拍攝後即時全螢幕預覽圖片
- Supabase 上載功能
- UDP 伺服器 IP 設定

### 頁面 2：圖片編輯 & UDP 通訊
- 虛擬螢幕：1920×1080，16 列 × 9 行網格
- 圖片拖放定位：自動取得中心點對應的網格索引
- 圖片縮放控制：0.1 ~ 3.0 倍
- 動畫選擇：0~9 共 10 個動畫 ID
- UDP 即時發送數據到 Unity 接收端

## UDP 通訊規則
- 連線地址：{用戶輸入的IP}:8080
- 固定端口：8080
- 訊息格式：
  - 拖放定位：純數字（0-143）
  - 縮放：檔名_Scale: 值
  - 選擇動畫：檔名:動畫ID

## Capacitor 打包 iPad 配置步驟

### 1. 安裝 Capacitor CLI
```bash
npm install -g @capacitor/cli
```

### 2. 初始化 Capacitor
```bash
npx cap init
```

### 3. 安裝 iOS 平臺
```bash
npm install @capacitor/ios
npx cap add ios
```

### 4. 配置權限
編輯 `capacitor.config.ts` 文件：
```typescript
export default defineConfig({
  appId: 'com.artlab.app',
  appName: 'Art Lab',
  webDir: 'dist',
  bundledWebRuntime: false,
  ios: {
    contentInset: 'always',
  },
});
```

### 5. 配置 iOS 權限
編輯 `ios/App/App/Info.plist` 文件，添加以下權限：
```xml
<!-- 相機權限 -->
<key>NSCameraUsageDescription</key>
<string>需要使用相機拍攝照片</string>

<!-- 相簿權限 -->
<key>NSPhotoLibraryUsageDescription</key>
<string>需要訪問相簿選擇照片</string>
<string>需要訪問相簿保存照片</string>

<!-- 網絡權限 -->
<key>NSAppTransportSecurity</key>
<dict>
    <key>NSAllowsArbitraryLoads</key>
    <true/>
</dict>
```

### 6. 構建 Web 項目
```bash
npm run build
```

### 7. 同步到 iOS 項目
```bash
npx cap sync ios
```

### 8. 打開 Xcode
```bash
npx cap open ios
```

### 9. 在 Xcode 中配置和運行
- 選擇目標設備為 iPad
- 配置簽名和團隊
- 運行項目

## 注意事項
- 所有介面文案、提示語、按鈕文字均為港式繁體
- 僅使用 WebSocket，無任何 UDP 相關程式碼
- WebSocket 連接埠固定為 8080
- 網格規則、訊息格式嚴格按照需求實現
- 僅保留 Supabase 上載方式

## 開發說明
- 程式碼註釋清晰，模組化設計
- 完全自適應：桌面、iPad 橫豎屏完美适配
- 操作流暢：圖片縮放 / 拖放無卡頓
- 狀態提示：上載進度、WebSocket 連線狀態、錯誤提示
- 簡潔風格：操作區域足夠大，適合 iPad 觸控

## 禁止項
- 禁止添加任何 UDP 相關程式碼
- 禁止修改 WebSocket 連接埠（固定 8080）
- 禁止修改網格規則、訊息格式
- 禁止添加額外上載方式，僅保留 Supabase
- 禁止使用簡體中文、台灣繁體，必須使用香港繁體用字 + 港式術語