# 📈 AI 量化模擬交易競技場 (AI Quant Trading Arena)

> 🌐 **[線上實盤模擬戰情室 (GitHub Pages)](https://ntcloudy.github.io/ai-quant-trading-arena/)** | 🇺🇸 **[English Documentation (README.md)](./README.md)**

> 🔗 **個人作品集導覽 (Portfolio Series)**：
> - 🛒 **專案 ①：電商全端 E2E 自動化測試平台** — [`NTCloudy/playwright-e2e-dashboard`](https://github.com/NTCloudy/playwright-e2e-dashboard)（[線上戰情室](https://ntcloudy.github.io/playwright-e2e-dashboard/)）
> - 🎰 **專案 ②：博弈百家樂 ＆ 無縫錢包全端 QA 平台** — [`NTCloudy/baccarat-e2e-dashboard`](https://github.com/NTCloudy/baccarat-e2e-dashboard)（[線上戰情室](https://ntcloudy.github.io/baccarat-e2e-dashboard/)）
> - 📈 **專案 ③：AI 量化美股與加密貨幣模擬交易競技場（本專案）** — [`NTCloudy/ai-quant-trading-arena`](https://github.com/NTCloudy/ai-quant-trading-arena)（[線上戰情室](https://ntcloudy.github.io/ai-quant-trading-arena/)）

---

## 🎯 專案簡介

**AI Quant Trading Arena** 是一套 **100% 同步現實金融市場股價（串接 Yahoo Finance OHLCV 真實報價）** 的全自動 AI 模擬交易平台。涵蓋 **8 檔熱門美股與大盤 ETF（`NVDA`, `TSLA`, `AAPL`, `MSFT`, `META`, `AMZN`, `GOOGL`, `QQQ`, `SPY`）** 以及 **2 檔主流加密貨幣（`BTC-USD`, `ETH-USD`）**。

系統內建 **3 位不同量化流派的 AI 操盤手**，各自管理 **$100,000 USD 虛擬本金**，每日自動根據真實股價與技術指標決定 **何時進場 (`BUY`)、何時退場 (`SELL`)、何時停損停利**，並與 **標普 500 大盤基準 (`SPY` 買進持有)** 同台 PK 檢驗 **1 個月、2 個月、3 個月、半年與 1 年** 的真實累積報酬率與超額報酬（Alpha）。

---

## 🤖 3 位同台 PK 的 AI 操盤手介紹

| AI 操盤手 | 操盤流派 | 進場條件 (`BUY`) | 退場與風控機制 (`SELL`) |
| :--- | :--- | :--- | :--- |
| **⚡ Alpha 動能突破型 AI**<br>(`Alpha Pulse AI`) | **強勢領頭羊 ＆ 順勢突破** | 鎖定站穩上揚 `50日生命線 (SMA50)`、`EMA8 > EMA21` 多頭排列、MACD 擴張且 20 日相對強度領先大盤之標的順勢建倉。 | 波段高點移動保利機制 ＋ 跌破季線結構出場 ＋ 嚴格 `-4.2%` 停損防線。 |
| **🎯 Sigma 波段抄底型 AI**<br>(`Sigma Contrarian AI`) | **均值回歸 ＆ 布林支撐狙擊** | 嚴格篩選長線趨勢向上（`SMA50` 斜率為正）之強勢標的，當短線拉回布林通道支撐區（`Z-Score <= -0.6` 或 `%B <= 0.34`）且 RSI 低檔勾頭時逢低承接。 | 反彈至布林通道上軌區（`%B >= 0.88` 或 `RSI >= 68`）精準停利收割；跌破 `-3.8%` 支撐立即停損。 |
| **🛡️ Titan 多因子風控型 AI**<br>(`Titan Quant AI`) | **機構級多因子權重 ＆ 長線複利** | 綜合計算 `季線趨勢斜率 (45%) + 夏普動能比 ROC20/ATR (35%) + 低波動品質因子 (20%)` 並搭配 `SPY` 大盤氣候濾網，滿 72 分配置 25% 核心倉位。 | 長線複利續抱核心強勢股，僅於趨勢結構跌破 `SMA50`、觸發高檔保利或 `-4.0%` 風控線時換股。 |

---

## ✨ 核心功能亮點

1. **📡 股價 100% 與現實同步（GitHub Actions 每日收盤自動盯盤）**：
   - 透過 `.github/workflows/market-sync.yml` 定時排程（`cron: '30 21 * * 1-5'`），每個美股交易日收盤後自動抓取 Yahoo Finance 最新日 K 線、執行 3 位 AI 交易決策並更新線上戰情室。
2. **⏱️ 一鍵切換檢視「1 個月 / 2 個月 / 3 個月 / 半年 / 1 年」真實報酬率**：
   - 可自由調整 **追蹤期間（30天～1年）**、**初始虛擬本金（`$10,000`～`$1,000,000`）**、**市場範圍（美股＋加密貨幣 / 純美股 / 純加密貨幣）** 與 **手續費滑價（0.10%）**，毫秒級即時重算淨值曲線。
3. **🕯️ 互動式 K 線圖 ＋ AI 進退場箭頭標記 ＋ 逐日回放動畫**：
   - 點選任一檔股票或比特幣，直接在真實日 K 線圖（含布林通道、`SMA50` 生命線、`RSI(14)` 副圖）上查看每一筆 **🟢 `BUY` 進場點** 與 **🔴 `SELL` 退場點**，並支援 **「▶ 逐日回放進出場動畫」**。
4. **📓 完整虛擬持倉帳本與白話決策日記**：
   - 清楚列出每一筆交易的進場日、退場日、買賣價格、股數、手續費、實現/未實現損益，以及 **AI 當下決定買進與賣出的完整指標數據理由**。
5. **🔒 嚴格「零未來函數（Zero Look-Ahead Bias）」與帳務守恆自動化測試**：
   - 內建 `npm test` 自動驗證：修改未來任何一根 K 線絕對不會影響過去任何一天的指標與 AI 決策，且每日 `現金 + 持倉市值 === 總資產` 100% 精準守恆。
