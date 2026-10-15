# 📈 AI Quant Trading Arena — 3 Autonomous AI Traders on Real US Stocks & Crypto

> 🌐 **[Live Quant Terminal (GitHub Pages)](https://ntcloudy.github.io/ai-quant-trading-arena/)** | 🇹🇼 **[繁體中文說明文件 (README.zh-TW.md)](./README.zh-TW.md)**

> 🔗 **Portfolio Series**:
> - 🛒 **Project 1 (E-Commerce Web + API QA)**: [`NTCloudy/playwright-e2e-dashboard`](https://github.com/NTCloudy/playwright-e2e-dashboard) — [Live Site](https://ntcloudy.github.io/playwright-e2e-dashboard/)
> - 🎰 **Project 2 (iGaming Baccarat & Seamless Wallet QA)**: [`NTCloudy/baccarat-e2e-dashboard`](https://github.com/NTCloudy/baccarat-e2e-dashboard) — [Live Site](https://ntcloudy.github.io/baccarat-e2e-dashboard/)
> - 📈 **Project 3 (Real-Market AI Paper Trading Arena — Current Repo)**: [`NTCloudy/ai-quant-trading-arena`](https://github.com/NTCloudy/ai-quant-trading-arena) — [Live Site](https://ntcloudy.github.io/ai-quant-trading-arena/)

---

## 🎯 Overview

**AI Quant Trading Arena** is an autonomous paper-trading simulation terminal powered by **100% real-world market prices (Yahoo Finance OHLCV feed)** across **US Tech Megacaps (`NVDA`, `TSLA`, `AAPL`, `MSFT`, `META`, `AMZN`, `GOOGL`)**, **Index ETFs (`SPY`, `QQQ`)**, and **Cryptocurrencies (`BTC-USD`, `ETH-USD`)**.

Three distinct quantitative AI Traders start with **$100,000 USD virtual capital** and compete head-to-head against the **S&P 500 (`SPY`) Buy & Hold Benchmark**, automatically executing `BUY`, `SELL`, `HOLD`, and `STOP-LOSS / TAKE-PROFIT` orders with full human-readable reasoning logs.

---

## 🤖 Meet the 3 Competing AI Traders

| AI Trader | Style | Core Entry Logic (`BUY`) | Exit & Risk Management (`SELL`) |
| :--- | :--- | :--- | :--- |
| **⚡ Alpha Pulse AI**<br>(`alpha-momentum`) | **Momentum & Trend Follower** | Enters high relative-strength leaders above rising `SMA50` when `EMA8 > EMA21`, `MACD` expands, and `20D ROC` outperforms. | Asymmetric trailing profit lock + `SMA50` breakdown exit + strict `-4.2%` stop-loss. |
| **🎯 Sigma Contrarian AI**<br>(`sigma-reversion`) | **Mean-Reversion Swing Trader** | Buys tactical oversold pullbacks (`Bollinger %B <= 0.34` or `Z-Score <= -0.6`, `RSI` hooking up) inside macro uptrends (`rising SMA50`). | Harvests swing profits at the upper Bollinger Band (`%B >= 0.88` or `RSI >= 68`) with `-3.8%` stop protection. |
| **🛡️ Titan Quant AI**<br>(`titan-multifactor`) | **Institutional Multi-Factor & Compounding** | Scores assets 0–100 across `SMA50 Slope (45%) + Sharpe Momentum ROC20/ATR (35%) + Low-Volatility Quality (20%)` + `SPY` regime filter. | Compounds core winners long-term; rotates out when structural trend breaks below `SMA50` or hits `-4.0%` risk stop. |

---

## ✨ Key Features

- **📡 100% Real Market Prices (Daily Auto-Sync via GitHub Actions Cron)**:
  - Automatically syncs real OHLCV daily bars from Yahoo Finance after every US trading session (`cron: '30 21 * * 1-5'`) and redeploys the live terminal.
- **⏱️ Multi-Horizon Performance Verification (`1M / 2M / 3M / 6M / 1Y`)**:
  - Instantly inspect ROI, Net Profit (`$`), Alpha vs. `SPY`, Win Rate, Sharpe Ratio, and Max Drawdown over **1 Month (22 trading days)**, **2 Months**, **3 Months**, **6 Months**, or **1 Full Year**.
- **🕯️ Interactive Candlestick Chart with `🟢 BUY` & `🔴 SELL` Markers + Replay Animation**:
  - Click any stock or crypto ticker to inspect its real candlestick chart, `Bollinger Bands (20, 2)`, `SMA50` lifeline, `RSI(14)` sub-chart, and exact AI entry/exit pins—or click **▶ Replay Animation** to watch trades unfold day by day.
- **🔒 Verified Zero Look-Ahead Bias & Accounting Invariants (`npm test`)**:
  - Automated test suite mathematically verifies that modifying future bars `[t+1 ... N]` never alters any indicator or AI decision at bar `[t]`, and `cash + investedValue === totalEquity` holds on every single day.

---

## 🚀 Quick Start (Local)

```bash
# 1. Fetch latest real market OHLCV data from Yahoo Finance
npm run sync:market

# 2. Run zero-lookahead-bias & accounting invariant tests
npm test

# 3. Build static site & launch local server at http://localhost:4200
npm run build
npm run serve
```
