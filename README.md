# 工作管理助手

半導體濕製程機台維護用的 PWA。手機隨手記錄,離線可用。

沒有建置流程,`index.html` 就是整個 app(HTML + CSS + JS)。改完存檔重整就是新版。

## 開發

```
node serve.js     # http://localhost:8080
```

Service Worker 只在 https 或 localhost 底下註冊得起來,用 `file://` 直接開是測不到離線的。
`serve.js` 也會印出區網網址,手機連同一個 Wi-Fi 就能開來試手感。

網址參數:

| 參數 | 用途 |
|---|---|
| `?demo` | 灌一批示範資料(只在資料庫是空的時候) |
| `?import` | 匯入資料。先找同目錄的 `import.json`,找不到就跳出檔案選擇器 |
| `?dev` | 顯示「模擬斷線」按鈕 |

## 資料放哪

全部在瀏覽器的 IndexedDB,**跟著網址走**。換一個網址就是換一個資料庫。

廠內的實際資料不進版控(見 `.gitignore`),要匯入時用 `?import` 從本機挑檔案。

設計原則、資料結構、以及踩過的坑都寫在 [CLAUDE.md](CLAUDE.md)。
