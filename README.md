# 台北小巨蛋 3D 地圖儀表板

1. 至 https://account.mapbox.com/ 取得 Mapbox public access token（pk. 開頭）。
2. 編輯 app.js 第一段，將 YOUR_MAPBOX_ACCESS_TOKEN 改成你的 token。
3. 在本資料夾開啟終端機，執行：python -m http.server 8000
4. 用瀏覽器開啟 http://localhost:8000

請勿直接雙擊 index.html：瀏覽器可能阻擋 fetch 讀取本機 JSON。
地圖須連線網路才能顯示；3D 建築在 zoom >= 15 時可見。
租用資料來自 2026 年 5–9 月主場館活動使用空間及廣場 CSV，並非整座主場館的完整預約狀態。
