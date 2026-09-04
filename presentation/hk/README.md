# 香港版 MagicFloor 現場演講大綱

- `香港版_MagicFloor_現場演講稿.md`：香港繁體中文大綱，只保留演講順序與主題。
- `香港版_MagicFloor_現場演講長圖.png`：簡潔長圖，適合在 iPad、微信或演示軟件中直接上下滾動。
- `香港版_MagicFloor_現場演講長圖.svg`：內嵌真實截圖的可編輯矢量版本。

長圖使用專案內的真實 iPad／EXE 截圖；圖片只作段落視覺參考，不包含按鈕標註或逐步操作教學。

如需重新排版：

```powershell
node scripts/generate-hk-presentation.mjs
$env:NODE_PATH = (Join-Path (Get-Location) 'desktop-runtime/node_modules')
Remove-Item Env:ELECTRON_RUN_AS_NODE -ErrorAction SilentlyContinue
& 'desktop-runtime/node_modules/.bin/electron.cmd' scripts/render-hk-presentation.cjs
```
