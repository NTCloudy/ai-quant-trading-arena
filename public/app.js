import { ASSET_UNIVERSE, getAssetMeta } from './src/universe.mjs';
import { AI_TRADERS } from './src/traders.mjs';
import { runArenaSimulation, runSingleAssetSimulation } from './src/simulator.mjs';

const state = {
  lang: 'zh',
  marketData: null,
  syncHistory: [],
  periodDays: 22, // Default: 1 Month (22 trading days ~ 30 calendar days)
  initialCapital: 100000,
  marketFilter: 'all',
  feeRate: 0.001,
  selectedTraderId: 'sigma-reversion',
  selectedSymbol: 'NVDA',
  recentOpsFilter: 'all', // 'all' | 'BUY' | 'SELL' | 'OPEN'
  equityChartMode: 'return', // 'return' | 'dollar' | 'drawdown'
  ledgerTab: 'closed', // 'closed' | 'orders'
  arenaResult: null,
  klineResult: null,
  replayTimer: null,
  replayBarCount: null
};

const fmtMoney = (n, decimals = 2) => {
  if (!Number.isFinite(n)) return '$0.00';
  const sign = n < 0 ? '-' : '';
  return (
    sign +
    '$' +
    Math.abs(n).toLocaleString('en-US', {
      minimumFractionDigits: decimals,
      maximumFractionDigits: decimals
    })
  );
};

const fmtPct = (n, decimals = 2, showPlus = true) => {
  if (!Number.isFinite(n)) return '0.00%';
  const plus = showPlus && n > 0 ? '+' : '';
  return `${plus}${n.toFixed(decimals)}%`;
};

async function initApp() {
  try {
    const [snapRes, histRes] = await Promise.all([
      fetch(`./data/market-snapshot.json?t=${Date.now()}`),
      fetch(`./data/sync-history.json?t=${Date.now()}`).catch(() => null)
    ]);

    if (!snapRes.ok) {
      throw new Error(`HTTP ${snapRes.status} loading market-snapshot.json`);
    }
    state.marketData = await snapRes.json();

    if (histRes && histRes.ok) {
      state.syncHistory = await histRes.json();
    }
  } catch (err) {
    console.error('Failed to load market snapshot:', err);
    return;
  }

  bindControls();
  recomputeAndRender(true);

  window.addEventListener('resize', () => {
    drawEquityChart();
    drawKlineChart();
  });
}

function bindControls() {
  // Period pills
  document.getElementById('period-pills')?.addEventListener('click', (e) => {
    const btn = e.target.closest('[data-period]');
    if (!btn) return;
    stopReplay();
    state.periodDays = Number(btn.dataset.period);
    document
      .querySelectorAll('#period-pills .seg-pill')
      .forEach((el) => el.classList.toggle('active', el === btn));
    recomputeAndRender(true);
  });

  // Capital select
  document.getElementById('select-capital')?.addEventListener('change', (e) => {
    state.initialCapital = Number(e.target.value);
    recomputeAndRender(false);
  });

  // Market filter select
  document.getElementById('select-market-filter')?.addEventListener('change', (e) => {
    stopReplay();
    state.marketFilter = e.target.value;
    if (state.marketFilter === 'crypto' && !state.selectedSymbol.includes('-USD')) {
      state.selectedSymbol = 'BTC-USD';
    } else if (state.marketFilter === 'us-stock' && state.selectedSymbol.includes('-USD')) {
      state.selectedSymbol = 'NVDA';
    }
    recomputeAndRender(true);
  });

  // Fee rate select
  document.getElementById('select-fee-rate')?.addEventListener('change', (e) => {
    state.feeRate = Number(e.target.value);
    recomputeAndRender(false);
  });

  // Recent Operations filter pills
  document.getElementById('recent-ops-filter-pills')?.addEventListener('click', (e) => {
    const btn = e.target.closest('[data-ops-filter]');
    if (!btn) return;
    state.recentOpsFilter = btn.dataset.opsFilter;
    document
      .querySelectorAll('#recent-ops-filter-pills .seg-pill')
      .forEach((el) => el.classList.toggle('active', el === btn));
    renderRecentOperationsSection();
  });

  // Equity chart mode pills
  document.getElementById('equity-mode-pills')?.addEventListener('click', (e) => {
    const btn = e.target.closest('[data-equity-mode]');
    if (!btn) return;
    state.equityChartMode = btn.dataset.equityMode;
    document
      .querySelectorAll('#equity-mode-pills .seg-pill')
      .forEach((el) => el.classList.toggle('active', el === btn));
    drawEquityChart();
  });

  // Ledger tabs
  document.querySelectorAll('[data-ledger-tab]').forEach((btn) => {
    btn.addEventListener('click', () => {
      state.ledgerTab = btn.dataset.ledgerTab;
      document
        .querySelectorAll('[data-ledger-tab]')
        .forEach((el) => el.classList.toggle('active', el === btn));
      renderSelectedTraderLedger();
    });
  });

  // Replay button
  document.getElementById('btn-kline-replay')?.addEventListener('click', () => {
    if (state.replayTimer) {
      stopReplay();
      drawKlineChart();
    } else {
      startKlineReplay();
    }
  });

  // Language toggle
  document.getElementById('btn-lang-toggle')?.addEventListener('click', () => {
    state.lang = state.lang === 'zh' ? 'en' : 'zh';
    recomputeAndRender(false);
  });

  // Sync modal
  const modal = document.getElementById('sync-modal');
  const tokenInput = document.getElementById('input-gh-token');
  if (tokenInput) {
    tokenInput.value = localStorage.getItem('quant_gh_token') || '';
  }

  document.getElementById('btn-open-sync-modal')?.addEventListener('click', () => {
    modal?.classList.remove('hidden');
    renderSyncModal();
  });

  document.getElementById('btn-close-sync-modal')?.addEventListener('click', () => {
    modal?.classList.add('hidden');
  });

  modal?.addEventListener('click', (e) => {
    if (e.target === modal) modal.classList.add('hidden');
  });

  document.getElementById('btn-local-recalc')?.addEventListener('click', () => {
    const feedback = document.getElementById('sync-feedback-msg');
    recomputeAndRender(true);
    if (feedback) {
      feedback.textContent = `✓ 已使用最新真實股價快照 (${state.arenaResult?.config?.endDate}) 完成 3 位 AI 操盤手重新撮合！`;
    }
  });

  document.getElementById('btn-trigger-gh-sync')?.addEventListener('click', async () => {
    const feedback = document.getElementById('sync-feedback-msg');
    const token = tokenInput?.value.trim() || '';
    if (!token) {
      if (feedback) {
        feedback.textContent = '⚠ 請先輸入具有 workflow 權限的 GitHub PAT Token，或直接依賴每日 GitHub Actions 自動排程。';
      }
      return;
    }
    localStorage.setItem('quant_gh_token', token);
    if (feedback) feedback.textContent = '⏳ 正在向 GitHub Actions 發送 market-sync.yml 觸發請求...';

    try {
      const res = await fetch(
        'https://api.github.com/repos/NTCloudy/ai-quant-trading-arena/actions/workflows/market-sync.yml/dispatches',
        {
          method: 'POST',
          headers: {
            Authorization: `Bearer ${token}`,
            Accept: 'application/vnd.github+json'
          },
          body: JSON.stringify({ ref: 'main' })
        }
      );
      if (res.status === 204 || res.ok) {
        if (feedback) {
          feedback.textContent =
            '🚀 已成功觸發 GitHub Actions 雲端同步！約 40 秒後重新整理網頁即可看到最新收盤結果。';
        }
      } else {
        const txt = await res.text();
        if (feedback) feedback.textContent = `❌ 觸發失敗 (HTTP ${res.status}): ${txt.slice(0, 120)}`;
      }
    } catch (err) {
      if (feedback) feedback.textContent = `❌ 網路錯誤: ${err.message}`;
    }
  });
}

function recomputeAndRender(selectChampion = false) {
  if (!state.marketData) return;

  state.arenaResult = runArenaSimulation(state.marketData, {
    periodDays: state.periodDays,
    initialCapital: state.initialCapital,
    feeRate: state.feeRate,
    marketFilter: state.marketFilter
  });

  if (selectChampion && state.arenaResult.leaderboard.length > 0) {
    state.selectedTraderId = state.arenaResult.leaderboard[0].trader.id;
  }

  state.klineResult = runSingleAssetSimulation(
    state.marketData,
    state.selectedSymbol,
    state.selectedTraderId,
    Math.max(40, state.periodDays)
  );

  renderTopTickerTape();
  renderHeaderMeta();
  renderLeaderboard();
  renderRecentOperationsSection();
  renderEquityLegend();
  drawEquityChart();
  renderKlineAssetPills();
  renderKlineHeaderAndSignals();
  drawKlineChart();
  renderTraderSelectPills();
  renderSelectedTraderLedger();
  renderRadarTable();
}

function renderTopTickerTape() {
  const container = document.getElementById('ticker-tape');
  const syncEl = document.getElementById('market-sync-timestamp');
  if (!container || !state.arenaResult) return;

  const radar = state.arenaResult.latestRadar;
  container.innerHTML = radar
    .map((item) => {
      const isUp = item.dailyReturnPct >= 0;
      const isSelected = item.symbol === state.selectedSymbol;
      return `
        <button type="button" class="ticker-item ${isSelected ? 'active' : ''}" data-ticker="${item.symbol}">
          <span class="ticker-sym">${item.symbol}</span>
          <span class="ticker-price">$${item.close.toLocaleString('en-US', {
            minimumFractionDigits: 2,
            maximumFractionDigits: 2
          })}</span>
          <span class="ticker-chg ${isUp ? 'up' : 'down'}">
            ${isUp ? '▲' : '▼'} ${fmtPct(item.dailyReturnPct, 2)}
          </span>
        </button>
      `;
    })
    .join('');

  container.querySelectorAll('[data-ticker]').forEach((btn) => {
    btn.addEventListener('click', () => {
      stopReplay();
      state.selectedSymbol = btn.dataset.ticker;
      state.klineResult = runSingleAssetSimulation(
        state.marketData,
        state.selectedSymbol,
        state.selectedTraderId,
        Math.max(40, state.periodDays)
      );
      renderTopTickerTape();
      renderKlineAssetPills();
      renderKlineHeaderAndSignals();
      drawKlineChart();
      document.getElementById('kline-section')?.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
    });
  });

  if (syncEl) {
    const dt = (state.marketData.fetchedAt || '').slice(0, 16).replace('T', ' ');
    syncEl.textContent =
      state.lang === 'zh'
        ? `最新真實收盤日: ${state.arenaResult.config.endDate} (UTC 同步: ${dt})`
        : `Latest Market Close: ${state.arenaResult.config.endDate} (${dt} UTC)`;
  }
}

function renderHeaderMeta() {
  const badge = document.getElementById('arena-date-range-badge');
  const summaryText = document.getElementById('leaderboard-summary-text');
  const benchPill = document.getElementById('benchmark-summary-pill');
  if (!state.arenaResult) return;

  const cfg = state.arenaResult.config;
  const bench = state.arenaResult.benchmark;
  const champ = state.arenaResult.leaderboard[0];

  if (badge) {
    badge.textContent =
      state.lang === 'zh'
        ? `實盤模擬區間：${cfg.startDate} → ${cfg.endDate}（共 ${cfg.tradingDaysCount} 個真實交易日）`
        : `Simulation Window: ${cfg.startDate} → ${cfg.endDate} (${cfg.tradingDaysCount} Trading Days)`;
  }

  if (summaryText && champ) {
    summaryText.innerHTML =
      state.lang === 'zh'
        ? `在 <strong>${cfg.startDate} 至 ${cfg.endDate}</strong> 期間，以虛擬本金 <strong>${fmtMoney(cfg.initialCapital, 0)}</strong> 投入真實市場：冠軍 <strong>${champ.trader.nameZh}</strong> 創造了 <strong class="${champ.metrics.totalReturnPct >= 0 ? 'pos-val' : 'neg-val'}">${fmtPct(champ.metrics.totalReturnPct)}</strong> 報酬率（期末淨值 <strong>${fmtMoney(champ.metrics.finalEquity)}</strong>），領先大盤基準 (${bench.symbol}) 達 <strong>${fmtPct(champ.metrics.alphaPct)}</strong>。`
        : `From <strong>${cfg.startDate} to ${cfg.endDate}</strong> with <strong>${fmtMoney(cfg.initialCapital, 0)}</strong> virtual capital: Champion <strong>${champ.trader.name}</strong> achieved <strong class="${champ.metrics.totalReturnPct >= 0 ? 'pos-val' : 'neg-val'}">${fmtPct(champ.metrics.totalReturnPct)}</strong> ROI (Final Equity <strong>${fmtMoney(champ.metrics.finalEquity)}</strong>), outperforming ${bench.symbol} by <strong>${fmtPct(champ.metrics.alphaPct)}</strong>.`;
  }

  if (benchPill) {
    const isUp = bench.finalReturnPct >= 0;
    benchPill.innerHTML = `📊 大盤基準 (${bench.symbol} 買進持有)：<strong>${fmtMoney(bench.finalEquity)}</strong> (<span class="${isUp ? 'pos-val' : 'neg-val'}">${fmtPct(bench.finalReturnPct)}</span>)`;
  }
}

function renderLeaderboard() {
  const grid = document.getElementById('traders-leaderboard-grid');
  if (!grid || !state.arenaResult) return;

  const rankLabelsZh = ['🥇 冠軍 #1', '🥈 亞軍 #2', '🥉 季軍 #3'];
  const rankLabelsEn = ['🥇 RANK #1', '🥈 RANK #2', '🥉 RANK #3'];

  grid.innerHTML = state.arenaResult.leaderboard
    .map((item, idx) => {
      const t = item.trader;
      const m = item.metrics;
      const isSelected = t.id === state.selectedTraderId;
      const isProfit = m.totalReturnPct >= 0;
      const isAlphaPos = m.alphaPct >= 0;
      const holdingsHtml =
        item.activePositions.length > 0
          ? item.activePositions
              .map(
                (p) =>
                  `<span class="holding-chip">${p.symbol} (${fmtPct(p.unrealizedPnlPct, 1)})</span>`
              )
              .join('')
          : `<span class="holding-chip">100% CASH (空手等待買點)</span>`;

      return `
        <article
          class="trader-card ${isSelected ? 'selected' : ''}"
          data-select-trader="${t.id}"
          style="${isSelected ? `border-color: ${t.color};` : ''}"
        >
          <div class="trader-card-top">
            <div>
              <div style="display:flex;align-items:center;gap:8px;margin-bottom:4px;">
                <span class="trader-rank-badge rank-${idx + 1}">
                  ${state.lang === 'zh' ? rankLabelsZh[idx] : rankLabelsEn[idx]}
                </span>
                <span class="mono" style="font-size:11px;color:${t.color};font-weight:700;">
                  ${t.badge}
                </span>
              </div>
              <h3 class="trader-name">${state.lang === 'zh' ? t.nameZh : t.name}</h3>
              <p class="trader-subtitle">${state.lang === 'zh' ? t.titleZh : t.titleEn}</p>
            </div>
          </div>

          <div class="trader-hero-stats">
            <div>
              <div class="hero-stat-label">${state.lang === 'zh' ? '期末虛擬總資產 (Equity)' : 'Final Virtual Equity'}</div>
              <div class="hero-stat-value" style="color:${t.color};">${fmtMoney(m.finalEquity)}</div>
              <div class="hero-stat-sub ${isProfit ? 'pos-val' : 'neg-val'}">
                ${state.lang === 'zh' ? '淨損益' : 'Net PnL'}: ${m.netProfit >= 0 ? '+' : ''}${fmtMoney(m.netProfit)}
              </div>
            </div>
            <div>
              <div class="hero-stat-label">${state.lang === 'zh' ? '累積報酬率 (ROI %)' : 'Cumulative ROI'}</div>
              <div class="hero-stat-value ${isProfit ? 'pos-val' : 'neg-val'}">
                ${fmtPct(m.totalReturnPct)}
              </div>
              <div class="hero-stat-sub ${isAlphaPos ? 'pos-val' : 'neg-val'}">
                vs SPY Alpha: ${fmtPct(m.alphaPct)}
              </div>
            </div>
          </div>

          <div class="trader-metrics-grid">
            <div class="mini-metric">
              <div class="mini-metric-lbl">${state.lang === 'zh' ? '勝率 (Win Rate)' : 'Win Rate'}</div>
              <div class="mini-metric-val">${m.winRatePct.toFixed(1)}%</div>
            </div>
            <div class="mini-metric">
              <div class="mini-metric-lbl">${state.lang === 'zh' ? '夏普值 (Sharpe)' : 'Sharpe Ratio'}</div>
              <div class="mini-metric-val">${m.sharpeRatio.toFixed(2)}</div>
            </div>
            <div class="mini-metric">
              <div class="mini-metric-lbl">${state.lang === 'zh' ? '最大回撤 (MaxDD)' : 'Max Drawdown'}</div>
              <div class="mini-metric-val neg-val">${m.maxDrawdownPct.toFixed(2)}%</div>
            </div>
            <div class="mini-metric">
              <div class="mini-metric-lbl">${state.lang === 'zh' ? '總交易數 (平倉/持倉)' : 'Trades (Closed/Open)'}</div>
              <div class="mini-metric-val">${m.totalTradesCount} (${m.closedTradesCount}/${m.openPositionsCount})</div>
            </div>
          </div>

          <p class="trader-strategy-desc">
            ${state.lang === 'zh' ? t.strategySummaryZh : t.strategySummaryEn}
          </p>

          <div class="trader-recent-ops">
            <div class="trader-recent-ops-title">
              <span>📌 ${state.lang === 'zh' ? '最近 3 筆進出場點位與操作標的' : 'Latest 3 Entry/Exit Executions'}</span>
              <span style="color:var(--accent-cyan);font-size:10.5px;">${state.lang === 'zh' ? '點選看K線 ↗' : 'View K-Line ↗'}</span>
            </div>
            ${item.orderEvents
              .slice(0, 3)
              .map((ev) => {
                const isBuy = ev.type === 'BUY';
                const pnlVal = Number.isFinite(ev.pnlPct) ? ev.pnlPct : 0;
                const priceFlow = isBuy
                  ? `$${ev.entryPrice.toFixed(2)} → 現價 $${(ev.currentPrice || ev.price).toFixed(2)}`
                  : `$${ev.entryPrice.toFixed(2)} → 退場 $${(ev.exitPrice || ev.price).toFixed(2)}`;
                return `
                  <div class="trader-op-row" data-jump-sym="${ev.symbol}" data-jump-trader="${t.id}">
                    <div style="display:flex;align-items:center;gap:6px;">
                      <span class="action-badge action-${ev.type}" style="padding:1px 6px;font-size:10px;">
                        ${isBuy ? '🟢 進場' : '🔴 退場'}
                      </span>
                      <strong>${ev.symbol}</strong>
                      <span style="color:var(--text-secondary);font-size:10.5px;">${ev.date.slice(5)}</span>
                    </div>
                    <div style="text-align:right;">
                      <span>${priceFlow}</span>
                      <strong class="${pnlVal >= 0 ? 'pos-val' : 'neg-val'}" style="margin-left:4px;">
                        (${fmtPct(pnlVal, 1)})
                      </strong>
                    </div>
                  </div>
                `;
              })
              .join('')}
          </div>

          <div class="trader-holdings-row">
            <span style="font-size:11px;color:var(--text-secondary);">
              ${state.lang === 'zh' ? '目前持倉：' : 'Holdings:'}
            </span>
            ${holdingsHtml}
          </div>
        </article>
      `;
    })
    .join('');

  grid.querySelectorAll('[data-jump-sym]').forEach((row) => {
    row.addEventListener('click', (e) => {
      e.stopPropagation();
      jumpToKlineAssetAndTrader(row.dataset.jumpSym, row.dataset.jumpTrader);
    });
  });

  grid.querySelectorAll('[data-select-trader]').forEach((card) => {
    card.addEventListener('click', () => {
      stopReplay();
      state.selectedTraderId = card.dataset.selectTrader;
      state.klineResult = runSingleAssetSimulation(
        state.marketData,
        state.selectedSymbol,
        state.selectedTraderId,
        Math.max(40, state.periodDays)
      );
      renderLeaderboard();
      renderKlineHeaderAndSignals();
      drawKlineChart();
      renderTraderSelectPills();
      renderSelectedTraderLedger();
    });
  });
}

function jumpToKlineAssetAndTrader(symbol, traderId) {
  stopReplay();
  if (symbol) state.selectedSymbol = symbol;
  if (traderId) state.selectedTraderId = traderId;
  state.klineResult = runSingleAssetSimulation(
    state.marketData,
    state.selectedSymbol,
    state.selectedTraderId,
    Math.max(40, state.periodDays)
  );
  renderTopTickerTape();
  renderLeaderboard();
  renderKlineAssetPills();
  renderKlineHeaderAndSignals();
  drawKlineChart();
  renderTraderSelectPills();
  renderSelectedTraderLedger();
  document.getElementById('kline-section')?.scrollIntoView({ behavior: 'smooth', block: 'start' });
}

function renderRecentOperationsSection() {
  const grid = document.getElementById('recent-ops-grid');
  if (!grid || !state.arenaResult) return;

  const filter = state.recentOpsFilter || 'all';
  let ops = state.arenaResult.recentOperations || [];

  if (filter === 'BUY') {
    ops = ops.filter((o) => o.type === 'BUY');
  } else if (filter === 'SELL') {
    ops = ops.filter((o) => o.type === 'SELL');
  } else if (filter === 'OPEN') {
    ops = ops.filter((o) => o.type === 'BUY' && o.status === 'OPEN');
  }

  const displayOps = ops.slice(0, 9);

  if (displayOps.length === 0) {
    grid.innerHTML = `<div class="panel-card" style="grid-column: 1 / -1; color: var(--text-secondary);">目前此篩選條件下無操作紀錄。</div>`;
    return;
  }

  grid.innerHTML = displayOps
    .map((op) => {
      const isBuy = op.type === 'BUY';
      const isOpen = op.status === 'OPEN';
      const pnlPct = Number.isFinite(op.pnlPct) ? op.pnlPct : 0;
      const pnlDollar = Number.isFinite(op.pnl) ? op.pnl : 0;
      const isPos = pnlPct >= 0;
      const entryP = Number(op.entryPrice || op.price || 0);
      const refP = Number(isBuy ? op.currentPrice || op.price : op.exitPrice || op.price);
      const slP = Number(op.stopLoss || entryP * 0.96);
      const tpP = Number(op.takeProfit || entryP * 1.15);

      const entryTickLeft = Number.isFinite(op.entryRangePct) ? op.entryRangePct : 25;
      const dotLeft = Number.isFinite(op.rangeProgressPct) ? op.rangeProgressPct : 50;

      const statusBadgeHtml = isBuy
        ? isOpen
          ? `<span class="action-badge action-HOLD">🔵 持倉續抱中 (${op.barsHeld || 0}日)</span>`
          : `<span class="action-badge action-WAIT">✓ 已完成平倉 (${op.exitDate?.slice(5) || ''})</span>`
        : `<span class="action-badge action-SELL">🔴 已退場結算 (${op.barsHeld || 0}日)</span>`;

      return `
        <article
          class="op-card ${isBuy ? 'op-buy' : 'op-sell'}"
          data-op-sym="${op.symbol}"
          data-op-trader="${op.traderId}"
        >
          <div class="op-card-head">
            <div>
              <div class="op-ticker-group">
                <span class="op-ticker-pill" style="border-left: 3px solid ${op.assetColor || '#00f0ff'};">
                  ${op.symbol}
                </span>
                <div>
                  <div style="font-weight:700;font-size:13px;color:#f8fafc;">
                    ${state.lang === 'zh' ? op.assetNameZh : op.assetName}
                  </div>
                  <div class="mono" style="font-size:11px;color:var(--text-secondary);">
                    📅 ${op.date} · ${op.shares} 股 (${fmtMoney(op.amount, 0)})
                  </div>
                </div>
              </div>
            </div>
            <div style="text-align:right;display:flex;flex-direction:column;align-items:flex-end;gap:4px;">
              <span class="action-badge action-${op.type}">
                ${isBuy ? '🟢 進場買點 BUY' : '🔴 退場賣點 SELL'}
              </span>
              <span class="op-trader-tag" style="color:${op.traderColor};border:1px solid ${op.traderColor}44;">
                ${state.lang === 'zh' ? op.traderNameZh : op.traderName}
              </span>
            </div>
          </div>

          <div class="op-price-matrix">
            <div class="op-price-cell">
              <span class="op-price-lbl">${state.lang === 'zh' ? '🟢 進場點位' : 'Entry Price'}</span>
              <span class="op-price-val">$${entryP.toFixed(2)}</span>
              <span style="font-size:10px;color:var(--text-secondary);">${op.entryDate?.slice(5) || op.date.slice(5)}</span>
            </div>
            <div class="op-price-cell">
              <span class="op-price-lbl">${isBuy ? (isOpen ? '⚡ 目前現價' : '🏁 退場結算價') : '🔴 退場點位'}</span>
              <span class="op-price-val ${isPos ? 'pos-val' : 'neg-val'}">$${refP.toFixed(2)}</span>
              <span class="${isPos ? 'pos-val' : 'neg-val'}" style="font-size:10.5px;font-weight:700;">
                ${fmtPct(pnlPct)} (${pnlDollar >= 0 ? '+' : ''}${fmtMoney(pnlDollar, 0)})
              </span>
            </div>
            <div class="op-price-cell">
              <span class="op-price-lbl">${state.lang === 'zh' ? '🛡️ 停損點 (SL)' : 'Stop-Loss'}</span>
              <span class="op-price-val neg-val">$${slP.toFixed(2)}</span>
              <span style="font-size:10px;color:var(--text-secondary);">
                ${(((slP - entryP) / entryP) * 100).toFixed(1)}%
              </span>
            </div>
            <div class="op-price-cell">
              <span class="op-price-lbl">${state.lang === 'zh' ? '🎯 目標價 (TP)' : 'Take-Profit'}</span>
              <span class="op-price-val pos-val">$${tpP.toFixed(2)}</span>
              <span style="font-size:10px;color:var(--text-secondary);">
                +${(((tpP - entryP) / entryP) * 100).toFixed(1)}%
              </span>
            </div>
          </div>

          <div class="op-ruler-wrap">
            <div class="op-ruler-labels">
              <span>SL $${slP.toFixed(1)}</span>
              <span>進場 $${entryP.toFixed(1)}</span>
              <span style="color:${isPos ? 'var(--bull-green)' : 'var(--bear-red)'};font-weight:700;">
                ${isBuy && isOpen ? `現價 $${refP.toFixed(1)}` : `退場 $${refP.toFixed(1)}`}
              </span>
              <span>TP $${tpP.toFixed(1)}</span>
            </div>
            <div class="op-ruler-track">
              <div class="op-ruler-entry-tick" style="left:${entryTickLeft}%;" title="進場點位"></div>
              <div
                class="op-ruler-current-dot"
                style="left:${dotLeft}%;background:${isPos ? 'var(--bull-green)' : 'var(--bear-red)'};color:${isPos ? 'var(--bull-green)' : 'var(--bear-red)'};"
              ></div>
            </div>
          </div>

          <div style="font-size:12px;color:#cbd5e1;line-height:1.4;">
            <strong style="color:#fff;">${state.lang === 'zh' ? op.tagZh : op.tagEn}：</strong>
            ${state.lang === 'zh' ? op.reasonZh : op.reasonEn}
          </div>

          <div class="op-card-footer">
            ${statusBadgeHtml}
            <span class="op-jump-link">🔍 點擊定位至 ${op.symbol} K線圖 ↗</span>
          </div>
        </article>
      `;
    })
    .join('');

  grid.querySelectorAll('[data-op-sym]').forEach((card) => {
    card.addEventListener('click', () => {
      jumpToKlineAssetAndTrader(card.dataset.opSym, card.dataset.opTrader);
    });
  });
}

function renderEquityLegend() {
  const el = document.getElementById('equity-chart-legend');
  if (!el || !state.arenaResult) return;

  const traderItems = state.arenaResult.traderResults
    .map((r) => {
      const t = r.trader;
      const m = r.metrics;
      return `
        <div class="legend-item">
          <span class="legend-dot" style="background:${t.color};"></span>
          <span>${state.lang === 'zh' ? t.nameZh : t.name}:</span>
          <strong class="${m.totalReturnPct >= 0 ? 'pos-val' : 'neg-val'}">${fmtPct(m.totalReturnPct)} (${fmtMoney(m.finalEquity, 0)})</strong>
        </div>
      `;
    })
    .join('');

  const b = state.arenaResult.benchmark;
  el.innerHTML =
    traderItems +
    `
    <div class="legend-item">
      <span class="legend-dot" style="background:#f59e0b;border-bottom:2px dashed #f59e0b;"></span>
      <span>Benchmark (${b.symbol}):</span>
      <strong>${fmtPct(b.finalReturnPct)} (${fmtMoney(b.finalEquity, 0)})</strong>
    </div>
  `;
}

function drawEquityChart(hoverIndex = null) {
  const canvas = document.getElementById('equity-canvas');
  if (!canvas || !state.arenaResult) return;

  const rect = canvas.parentElement.getBoundingClientRect();
  const dpr = window.devicePixelRatio || 1;
  canvas.width = rect.width * dpr;
  canvas.height = rect.height * dpr;

  const ctx = canvas.getContext('2d');
  ctx.scale(dpr, dpr);

  const W = rect.width;
  const H = rect.height;
  const pad = { top: 20, right: 76, bottom: 32, left: 18 };
  const plotW = W - pad.left - pad.right;
  const plotH = H - pad.top - pad.bottom;

  ctx.clearRect(0, 0, W, H);

  const mode = state.equityChartMode;
  const traders = state.arenaResult.traderResults;
  const benchCurve = state.arenaResult.benchmark.curve;
  const n = benchCurve.length;
  if (n === 0) return;

  const getVal = (pt, isBench = false) => {
    if (mode === 'dollar') return pt.equity;
    if (mode === 'drawdown') return isBench ? 0 : pt.drawdownPct;
    return pt.returnPct;
  };

  let minVal = Infinity;
  let maxVal = -Infinity;

  for (const r of traders) {
    for (const pt of r.equityCurve) {
      const v = getVal(pt, false);
      if (v < minVal) minVal = v;
      if (v > maxVal) maxVal = v;
    }
  }
  if (mode !== 'drawdown') {
    for (const pt of benchCurve) {
      const v = getVal(pt, true);
      if (v < minVal) minVal = v;
      if (v > maxVal) maxVal = v;
    }
  }

  if (minVal === maxVal) {
    minVal -= 1;
    maxVal += 1;
  }
  const margin = (maxVal - minVal) * 0.1;
  minVal -= margin;
  maxVal += margin;

  const xAt = (i) => pad.left + (n > 1 ? (i / (n - 1)) * plotW : plotW / 2);
  const yAt = (v) => pad.top + ((maxVal - v) / (maxVal - minVal)) * plotH;

  // Horizontal grid lines
  const gridSteps = 5;
  ctx.font = '11px "JetBrains Mono", monospace';
  ctx.textAlign = 'left';
  for (let s = 0; s <= gridSteps; s++) {
    const val = minVal + ((maxVal - minVal) * s) / gridSteps;
    const y = yAt(val);
    ctx.strokeStyle = 'rgba(148, 163, 184, 0.1)';
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(pad.left, y);
    ctx.lineTo(pad.left + plotW, y);
    ctx.stroke();

    ctx.fillStyle = '#64748b';
    const label =
      mode === 'dollar'
        ? '$' + Math.round(val).toLocaleString('en-US')
        : `${val >= 0 ? '+' : ''}${val.toFixed(1)}%`;
    ctx.fillText(label, pad.left + plotW + 8, y + 4);
  }

  // Zero baseline for return mode
  if (mode === 'return' && minVal < 0 && maxVal > 0) {
    const y0 = yAt(0);
    ctx.strokeStyle = 'rgba(255, 255, 255, 0.2)';
    ctx.setLineDash([4, 4]);
    ctx.beginPath();
    ctx.moveTo(pad.left, y0);
    ctx.lineTo(pad.left + plotW, y0);
    ctx.stroke();
    ctx.setLineDash([]);
  }

  // X-axis date labels
  ctx.fillStyle = '#64748b';
  ctx.textAlign = 'center';
  const dateStep = Math.max(1, Math.floor(n / 6));
  for (let i = 0; i < n; i += dateStep) {
    ctx.fillText(benchCurve[i].date.slice(5), xAt(i), H - 10);
  }

  // Draw Benchmark line (dashed amber)
  if (mode !== 'drawdown') {
    ctx.strokeStyle = '#f59e0b';
    ctx.lineWidth = 1.8;
    ctx.setLineDash([5, 5]);
    ctx.beginPath();
    for (let i = 0; i < n; i++) {
      const x = xAt(i);
      const y = yAt(getVal(benchCurve[i], true));
      if (i === 0) ctx.moveTo(x, y);
      else ctx.lineTo(x, y);
    }
    ctx.stroke();
    ctx.setLineDash([]);
  }

  // Draw 3 AI Trader lines
  for (const r of traders) {
    const curve = r.equityCurve;
    const isSelected = r.trader.id === state.selectedTraderId;
    ctx.strokeStyle = r.trader.color;
    ctx.lineWidth = isSelected ? 3.0 : 2.0;
    ctx.beginPath();
    for (let i = 0; i < curve.length; i++) {
      const x = xAt(i);
      const y = yAt(getVal(curve[i], false));
      if (i === 0) ctx.moveTo(x, y);
      else ctx.lineTo(x, y);
    }
    ctx.stroke();
  }

  // Hover crosshair
  if (hoverIndex !== null && hoverIndex >= 0 && hoverIndex < n) {
    const hx = xAt(hoverIndex);
    ctx.strokeStyle = 'rgba(0, 240, 255, 0.45)';
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(hx, pad.top);
    ctx.lineTo(hx, pad.top + plotH);
    ctx.stroke();

    for (const r of traders) {
      const pt = r.equityCurve[hoverIndex];
      if (!pt) continue;
      const hy = yAt(getVal(pt, false));
      ctx.fillStyle = r.trader.color;
      ctx.beginPath();
      ctx.arc(hx, hy, 4.5, 0, Math.PI * 2);
      ctx.fill();
    }
  }

  // Bind hover listener once
  if (!canvas.dataset.bound) {
    canvas.dataset.bound = '1';
    const tooltip = document.getElementById('equity-tooltip');
    canvas.addEventListener('mousemove', (e) => {
      const r = canvas.getBoundingClientRect();
      const mx = e.clientX - r.left;
      const totalPts = state.arenaResult?.benchmark?.curve?.length || 0;
      if (totalPts === 0) return;
      const plotWidth = r.width - pad.left - pad.right;
      const ratio = Math.max(0, Math.min(1, (mx - pad.left) / plotWidth));
      const idx = Math.round(ratio * (totalPts - 1));
      drawEquityChart(idx);

      if (tooltip && state.arenaResult) {
        const bPt = state.arenaResult.benchmark.curve[idx];
        const rows = state.arenaResult.traderResults
          .map((tr) => {
            const p = tr.equityCurve[idx];
            if (!p) return '';
            return `<div style="display:flex;justify-content:space-between;gap:12px;margin-top:4px;">
              <span style="color:${tr.trader.color};">● ${tr.trader.nameZh}</span>
              <strong>${fmtMoney(p.equity, 0)} (${fmtPct(p.returnPct)})</strong>
            </div>`;
          })
          .join('');
        tooltip.innerHTML = `
          <div style="font-weight:700;border-bottom:1px solid rgba(255,255,255,0.12);padding-bottom:4px;margin-bottom:4px;">
            📅 ${bPt.date}
          </div>
          ${rows}
          <div style="display:flex;justify-content:space-between;gap:12px;margin-top:4px;color:#fcd34d;">
            <span>◆ SPY Benchmark</span>
            <strong>${fmtMoney(bPt.equity, 0)} (${fmtPct(bPt.returnPct)})</strong>
          </div>
        `;
        tooltip.classList.remove('hidden');
        const left = Math.min(r.width - 250, Math.max(10, mx + 14));
        tooltip.style.left = `${left}px`;
        tooltip.style.top = '18px';
      }
    });
    canvas.addEventListener('mouseleave', () => {
      drawEquityChart(null);
      document.getElementById('equity-tooltip')?.classList.add('hidden');
    });
  }
}

function renderKlineAssetPills() {
  const bar = document.getElementById('kline-asset-pills');
  if (!bar || !state.arenaResult) return;

  bar.innerHTML = ASSET_UNIVERSE.map((asset) => {
    const active = asset.symbol === state.selectedSymbol;
    const radarItem = state.arenaResult.latestRadar.find((r) => r.symbol === asset.symbol);
    const priceStr = radarItem ? `$${radarItem.close.toFixed(2)}` : '';
    return `
      <button type="button" class="asset-pill ${active ? 'active' : ''}" data-kline-sym="${asset.symbol}">
        <span>${asset.symbol}</span>
        <span style="color:var(--text-secondary);font-size:11px;">${state.lang === 'zh' ? asset.nameZh.split(' ')[0] : asset.name.split(' ')[0]}</span>
        <span style="color:#94a3b8;font-size:11px;">${priceStr}</span>
      </button>
    `;
  }).join('');

  bar.querySelectorAll('[data-kline-sym]').forEach((btn) => {
    btn.addEventListener('click', () => {
      stopReplay();
      state.selectedSymbol = btn.dataset.klineSym;
      state.klineResult = runSingleAssetSimulation(
        state.marketData,
        state.selectedSymbol,
        state.selectedTraderId,
        Math.max(40, state.periodDays)
      );
      renderTopTickerTape();
      renderKlineAssetPills();
      renderKlineHeaderAndSignals();
      drawKlineChart();
    });
  });
}

function renderKlineHeaderAndSignals() {
  const headerEl = document.getElementById('kline-header-stats');
  const stripEl = document.getElementById('kline-signals-strip');
  if (!headerEl || !stripEl || !state.klineResult) return;

  const kr = state.klineResult;
  const trader = AI_TRADERS.find((t) => t.id === kr.traderId) || AI_TRADERS[0];
  const lastBar = kr.bars.at(-1);
  const buyCount = kr.markers.filter((m) => m.type === 'BUY').length;
  const sellCount = kr.markers.filter((m) => m.type === 'SELL').length;

  headerEl.innerHTML = `
    <div style="display:flex;align-items:center;gap:14px;flex-wrap:wrap;">
      <strong style="font-size:16px;color:#fff;">
        ${kr.symbol} · ${state.lang === 'zh' ? kr.meta.nameZh : kr.meta.name}
      </strong>
      <span style="color:var(--accent-cyan);">
        操盤手視角：${state.lang === 'zh' ? trader.nameZh : trader.name}
      </span>
      <span>最新收盤：<strong>$${lastBar?.close?.toFixed(2) || '-'}</strong></span>
      <span>RSI(14)：<strong>${lastBar?.rsi14?.toFixed(1) || '-'}</strong></span>
      <span>SMA50：<strong>$${lastBar?.sma50?.toFixed(2) || '-'}</strong></span>
    </div>
    <div style="display:flex;align-items:center;gap:14px;flex-wrap:wrap;">
      <span style="color:#38bdf8;">● 布林上下軌 (BB 20,2)</span>
      <span style="color:#f59e0b;">● 50日生命線 (SMA50)</span>
      <span class="pos-val">▲ 進場買點 (BUY: ${buyCount})</span>
      <span class="neg-val">▼ 退場賣點 (SELL: ${sellCount})</span>
    </div>
  `;

  if (kr.markers.length === 0) {
    stripEl.innerHTML = `
      <div class="signal-event-card">
        <strong>此區間內 ${state.lang === 'zh' ? trader.nameZh : trader.name} 對此標的維持紀律觀望</strong>
        <p style="color:var(--text-secondary);margin-top:4px;">
          原因：${lastBar ? evaluateReasonPreview(kr, lastBar) : '等待趨勢與指標共振訊號。'}
        </p>
      </div>
    `;
    return;
  }

  stripEl.innerHTML = kr.markers
    .slice()
    .reverse()
    .map((m) => {
      const isBuy = m.type === 'BUY';
      return `
        <div class="signal-event-card ${isBuy ? 'buy' : 'sell'}">
          <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:4px;">
            <span class="action-badge action-${m.type}">
              ${isBuy ? '🟢 進場 BUY' : '🔴 退場 SELL'} @ $${m.price.toFixed(2)}
            </span>
            <span class="mono" style="color:var(--text-secondary);font-size:11px;">📅 ${m.date}</span>
          </div>
          <div style="font-weight:700;color:#f8fafc;margin-bottom:3px;">
            ${state.lang === 'zh' ? m.tagZh : m.tagEn}
            ${!isBuy && Number.isFinite(m.pnlPct) ? `<span class="${m.pnlPct >= 0 ? 'pos-val' : 'neg-val'}">(${fmtPct(m.pnlPct)})</span>` : ''}
          </div>
          <p style="color:#cbd5e1;font-size:11.5px;line-height:1.4;">
            ${state.lang === 'zh' ? m.reasonZh : m.reasonEn}
          </p>
        </div>
      `;
    })
    .join('');
}

function evaluateReasonPreview(kr, lastBar) {
  return `最新價 $${lastBar.close.toFixed(2)} vs SMA50 $${lastBar.sma50.toFixed(2)}（RSI=${lastBar.rsi14.toFixed(1)}, Z-Score=${lastBar.zScore20.toFixed(2)}），AI 嚴守趨勢與風險濾網不強行出手。`;
}

function drawKlineChart(hoverIdx = null) {
  const canvas = document.getElementById('kline-canvas');
  if (!canvas || !state.klineResult) return;

  const rect = canvas.parentElement.getBoundingClientRect();
  const dpr = window.devicePixelRatio || 1;
  canvas.width = rect.width * dpr;
  canvas.height = rect.height * dpr;

  const ctx = canvas.getContext('2d');
  ctx.scale(dpr, dpr);

  const W = rect.width;
  const H = rect.height;
  const pad = { top: 22, right: 78, bottom: 28, left: 16 };
  const mainH = Math.floor((H - pad.top - pad.bottom) * 0.72);
  const rsiTop = pad.top + mainH + 18;
  const rsiH = H - rsiTop - pad.bottom;
  const plotW = W - pad.left - pad.right;

  ctx.clearRect(0, 0, W, H);

  const allBars = state.klineResult.bars;
  const limit = state.replayBarCount !== null ? Math.min(state.replayBarCount, allBars.length) : allBars.length;
  const bars = allBars.slice(0, limit);
  const n = bars.length;
  if (n === 0) return;

  let minP = Infinity;
  let maxP = -Infinity;
  for (const b of bars) {
    minP = Math.min(minP, b.low, b.bbLower || b.low, b.sma50 || b.low);
    maxP = Math.max(maxP, b.high, b.bbUpper || b.high, b.sma50 || b.high);
  }
  const margin = (maxP - minP) * 0.1 || 1;
  minP -= margin;
  maxP += margin;

  const xAt = (i) => pad.left + ((i + 0.5) / allBars.length) * plotW;
  const yAt = (p) => pad.top + ((maxP - p) / (maxP - minP)) * mainH;
  const yRsi = (r) => rsiTop + ((100 - r) / 100) * rsiH;

  // Price grid lines
  ctx.font = '11px "JetBrains Mono", monospace';
  ctx.textAlign = 'left';
  for (let s = 0; s <= 4; s++) {
    const p = minP + ((maxP - minP) * s) / 4;
    const y = yAt(p);
    ctx.strokeStyle = 'rgba(148, 163, 184, 0.09)';
    ctx.beginPath();
    ctx.moveTo(pad.left, y);
    ctx.lineTo(pad.left + plotW, y);
    ctx.stroke();

    ctx.fillStyle = '#64748b';
    ctx.fillText('$' + p.toFixed(p > 500 ? 0 : 2), pad.left + plotW + 8, y + 4);
  }

  // Bollinger Bands shaded channel
  ctx.fillStyle = 'rgba(56, 189, 248, 0.05)';
  ctx.beginPath();
  for (let i = 0; i < n; i++) {
    const x = xAt(i);
    const y = yAt(bars[i].bbUpper);
    if (i === 0) ctx.moveTo(x, y);
    else ctx.lineTo(x, y);
  }
  for (let i = n - 1; i >= 0; i--) {
    ctx.lineTo(xAt(i), yAt(bars[i].bbLower));
  }
  ctx.closePath();
  ctx.fill();

  // Bollinger Upper & Lower lines
  for (const key of ['bbUpper', 'bbLower']) {
    ctx.strokeStyle = 'rgba(56, 189, 248, 0.32)';
    ctx.lineWidth = 1;
    ctx.beginPath();
    for (let i = 0; i < n; i++) {
      const x = xAt(i);
      const y = yAt(bars[i][key]);
      if (i === 0) ctx.moveTo(x, y);
      else ctx.lineTo(x, y);
    }
    ctx.stroke();
  }

  // SMA50 lifeline (Amber)
  ctx.strokeStyle = '#f59e0b';
  ctx.lineWidth = 1.8;
  ctx.beginPath();
  for (let i = 0; i < n; i++) {
    const x = xAt(i);
    const y = yAt(bars[i].sma50);
    if (i === 0) ctx.moveTo(x, y);
    else ctx.lineTo(x, y);
  }
  ctx.stroke();

  // Candlesticks
  const candleW = Math.max(3, Math.min(13, (plotW / allBars.length) * 0.66));
  for (let i = 0; i < n; i++) {
    const b = bars[i];
    const x = xAt(i);
    const isUp = b.close >= b.open;
    const color = isUp ? '#00e676' : '#ff3b5c';

    // Wick
    ctx.strokeStyle = color;
    ctx.lineWidth = 1.2;
    ctx.beginPath();
    ctx.moveTo(x, yAt(b.high));
    ctx.lineTo(x, yAt(b.low));
    ctx.stroke();

    // Body
    const yOpen = yAt(b.open);
    const yClose = yAt(b.close);
    const top = Math.min(yOpen, yClose);
    const height = Math.max(2, Math.abs(yClose - yOpen));
    ctx.fillStyle = color;
    ctx.fillRect(x - candleW / 2, top, candleW, height);
  }

  // Draw BUY and SELL Markers on K-Line
  for (const m of state.klineResult.markers) {
    if (m.index >= n) continue;
    const x = xAt(m.index);
    const bar = bars[m.index];
    const isBuy = m.type === 'BUY';
    const y = isBuy ? yAt(bar.low) + 18 : yAt(bar.high) - 18;

    // Glowing marker circle + arrow
    ctx.fillStyle = isBuy ? '#00e676' : '#ff3b5c';
    ctx.beginPath();
    if (isBuy) {
      ctx.moveTo(x, y - 11);
      ctx.lineTo(x - 7, y + 3);
      ctx.lineTo(x + 7, y + 3);
    } else {
      ctx.moveTo(x, y + 11);
      ctx.lineTo(x - 7, y - 3);
      ctx.lineTo(x + 7, y - 3);
    }
    ctx.closePath();
    ctx.fill();

    // Tag pill
    const label = isBuy
      ? `BUY $${m.price.toFixed(0)}`
      : `SELL ${m.pnlPct >= 0 ? '+' : ''}${m.pnlPct.toFixed(1)}%`;
    ctx.font = 'bold 10.5px "JetBrains Mono", monospace';
    const textW = ctx.measureText(label).width + 10;
    const pillX = Math.max(pad.left + 4, Math.min(pad.left + plotW - textW - 4, x - textW / 2));
    const pillY = isBuy ? y + 6 : y - 22;

    ctx.fillStyle = isBuy ? 'rgba(0, 230, 118, 0.92)' : 'rgba(255, 59, 92, 0.92)';
    ctx.fillRect(pillX, pillY, textW, 16);
    ctx.fillStyle = '#04070e';
    ctx.textAlign = 'center';
    ctx.fillText(label, pillX + textW / 2, pillY + 11.5);
  }

  // RSI(14) Sub-panel
  ctx.strokeStyle = 'rgba(148, 163, 184, 0.18)';
  ctx.beginPath();
  ctx.moveTo(pad.left, rsiTop);
  ctx.lineTo(pad.left + plotW, rsiTop);
  ctx.stroke();

  // RSI 70 / 30 bands
  for (const lvl of [70, 30]) {
    const ry = yRsi(lvl);
    ctx.strokeStyle = 'rgba(148, 163, 184, 0.14)';
    ctx.setLineDash([3, 3]);
    ctx.beginPath();
    ctx.moveTo(pad.left, ry);
    ctx.lineTo(pad.left + plotW, ry);
    ctx.stroke();
    ctx.setLineDash([]);
    ctx.fillStyle = '#64748b';
    ctx.textAlign = 'left';
    ctx.font = '10px "JetBrains Mono", monospace';
    ctx.fillText(`RSI ${lvl}`, pad.left + plotW + 8, ry + 3);
  }

  ctx.strokeStyle = '#a855f7';
  ctx.lineWidth = 1.6;
  ctx.beginPath();
  for (let i = 0; i < n; i++) {
    const x = xAt(i);
    const y = yRsi(bars[i].rsi14);
    if (i === 0) ctx.moveTo(x, y);
    else ctx.lineTo(x, y);
  }
  ctx.stroke();

  // X-axis dates
  ctx.fillStyle = '#64748b';
  ctx.textAlign = 'center';
  const step = Math.max(1, Math.floor(allBars.length / 7));
  for (let i = 0; i < n; i += step) {
    ctx.fillText(bars[i].date.slice(5), xAt(i), H - 8);
  }

  // Hover crosshair
  if (hoverIdx !== null && hoverIdx >= 0 && hoverIdx < n) {
    const hx = xAt(hoverIdx);
    ctx.strokeStyle = 'rgba(0, 240, 255, 0.45)';
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(hx, pad.top);
    ctx.lineTo(hx, rsiTop + rsiH);
    ctx.stroke();
  }

  // Bind hover tooltip once
  if (!canvas.dataset.bound) {
    canvas.dataset.bound = '1';
    const tooltip = document.getElementById('kline-tooltip');
    canvas.addEventListener('mousemove', (e) => {
      const r = canvas.getBoundingClientRect();
      const mx = e.clientX - r.left;
      const total = state.klineResult?.bars?.length || 0;
      if (total === 0) return;
      const plotWidth = r.width - pad.left - pad.right;
      const idx = Math.max(0, Math.min(total - 1, Math.floor(((mx - pad.left) / plotWidth) * total)));
      drawKlineChart(idx);

      const b = state.klineResult.bars[idx];
      const marker = state.klineResult.markers.find((m) => m.index === idx);
      if (tooltip && b) {
        const markerHtml = marker
          ? `<div style="margin-top:6px;padding-top:6px;border-top:1px solid rgba(255,255,255,0.15);color:${marker.type === 'BUY' ? '#00e676' : '#ff3b5c'};">
              <strong>${marker.type === 'BUY' ? '🟢 AI 進場 BUY' : '🔴 AI 退場 SELL'}: ${marker.tagZh}</strong>
              <div style="color:#e2e8f0;font-size:11px;margin-top:2px;">${marker.reasonZh}</div>
            </div>`
          : '';
        tooltip.innerHTML = `
          <div style="font-weight:700;margin-bottom:4px;">📅 ${b.date} · ${state.klineResult.symbol}</div>
          <div>Open: $${b.open.toFixed(2)} | High: $${b.high.toFixed(2)}</div>
          <div>Low: $${b.low.toFixed(2)} | Close: <strong>$${b.close.toFixed(2)}</strong> (${fmtPct(b.dailyReturnPct)})</div>
          <div>RSI(14): ${b.rsi14.toFixed(1)} | SMA50: $${b.sma50.toFixed(2)} | Z: ${b.zScore20.toFixed(2)}</div>
          ${markerHtml}
        `;
        tooltip.classList.remove('hidden');
        const left = Math.min(r.width - 280, Math.max(10, mx + 14));
        tooltip.style.left = `${left}px`;
        tooltip.style.top = '16px';
      }
    });
    canvas.addEventListener('mouseleave', () => {
      drawKlineChart(null);
      document.getElementById('kline-tooltip')?.classList.add('hidden');
    });
  }
}

function startKlineReplay() {
  if (!state.klineResult) return;
  const btn = document.getElementById('btn-kline-replay');
  const total = state.klineResult.bars.length;
  state.replayBarCount = 5;
  if (btn) btn.textContent = '⏹ 停止回放動畫';

  state.replayTimer = setInterval(() => {
    state.replayBarCount += 1;
    drawKlineChart();
    if (state.replayBarCount >= total) {
      stopReplay();
      drawKlineChart();
    }
  }, 55);
}

function stopReplay() {
  if (state.replayTimer) {
    clearInterval(state.replayTimer);
    state.replayTimer = null;
  }
  state.replayBarCount = null;
  const btn = document.getElementById('btn-kline-replay');
  if (btn) btn.textContent = '▶ 逐日回放進出場動畫';
}

function renderTraderSelectPills() {
  const container = document.getElementById('trader-select-pills');
  if (!container || !state.arenaResult) return;

  container.innerHTML = state.arenaResult.traderResults
    .map((r) => {
      const t = r.trader;
      const active = t.id === state.selectedTraderId;
      return `
        <button type="button" class="seg-pill ${active ? 'active' : ''}" data-pill-trader="${t.id}">
          ${state.lang === 'zh' ? t.nameZh : t.name}
        </button>
      `;
    })
    .join('');

  container.querySelectorAll('[data-pill-trader]').forEach((btn) => {
    btn.addEventListener('click', () => {
      stopReplay();
      state.selectedTraderId = btn.dataset.pillTrader;
      state.klineResult = runSingleAssetSimulation(
        state.marketData,
        state.selectedSymbol,
        state.selectedTraderId,
        Math.max(40, state.periodDays)
      );
      renderLeaderboard();
      renderKlineHeaderAndSignals();
      drawKlineChart();
      renderTraderSelectPills();
      renderSelectedTraderLedger();
    });
  });
}

function renderSelectedTraderLedger() {
  if (!state.arenaResult) return;
  const trResult =
    state.arenaResult.traderResults.find((r) => r.trader.id === state.selectedTraderId) ||
    state.arenaResult.traderResults[0];
  if (!trResult) return;

  const titleEl = document.getElementById('ledger-section-title');
  if (titleEl) {
    titleEl.textContent = `💼 ${state.lang === 'zh' ? trResult.trader.nameZh : trResult.trader.name} — 虛擬持倉帳本 ＆ 進出場決策理由日誌`;
  }

  // 1. Open Positions
  const openBadge = document.getElementById('open-positions-badge');
  const openContainer = document.getElementById('open-positions-container');
  if (openBadge) {
    openBadge.textContent = `${trResult.activePositions.length} 檔持倉中`;
  }

  if (openContainer) {
    if (trResult.activePositions.length === 0) {
      openContainer.innerHTML = `<div style="padding:20px;color:var(--text-secondary);">目前無未平倉部位（100% 持有現金等待下一波進場訊號）。</div>`;
    } else {
      openContainer.innerHTML = `
        <table class="quant-table">
          <thead>
            <tr>
              <th>標的</th>
              <th>進場日 (持有天數)</th>
              <th>買進價 → 現價</th>
              <th>股數 / 市值</th>
              <th>未實現損益</th>
              <th>停損價 / 目標價</th>
              <th>AI 進場決策理由</th>
            </tr>
          </thead>
          <tbody>
            ${trResult.activePositions
              .map((p) => {
                const isUp = p.unrealizedPnl >= 0;
                return `
                  <tr>
                    <td class="mono"><strong>${p.symbol}</strong><br/><span style="color:var(--text-secondary);font-size:11px;">${p.assetNameZh}</span></td>
                    <td class="mono">${p.entryDate}<br/><span style="color:var(--text-secondary);font-size:11px;">持有 ${p.barsHeld} 交易日</span></td>
                    <td class="mono">$${p.entryPrice.toFixed(2)} → <strong>$${p.currentPrice.toFixed(2)}</strong></td>
                    <td class="mono">${p.shares} 股<br/><strong>${fmtMoney(p.marketValue)}</strong></td>
                    <td class="mono ${isUp ? 'pos-val' : 'neg-val'}">
                      <strong>${isUp ? '+' : ''}${fmtMoney(p.unrealizedPnl)}</strong><br/>
                      (${fmtPct(p.unrealizedPnlPct)})
                    </td>
                    <td class="mono">
                      <span class="neg-val">SL: $${p.stopLoss.toFixed(2)}</span><br/>
                      <span class="pos-val">TP: $${p.takeProfit.toFixed(2)}</span>
                    </td>
                    <td>
                      <div style="font-weight:600;color:var(--accent-cyan);margin-bottom:2px;">${state.lang === 'zh' ? p.entryTagZh : p.entryTagEn}</div>
                      <div class="reason-box">${state.lang === 'zh' ? p.entryReasonZh : p.entryReasonEn}</div>
                    </td>
                  </tr>
                `;
              })
              .join('')}
          </tbody>
        </table>
      `;
    }
  }

  // 2. Capital Allocation Breakdown
  const expBadge = document.getElementById('exposure-badge');
  const allocContainer = document.getElementById('allocation-breakdown-container');
  const m = trResult.metrics;
  if (expBadge) {
    expBadge.textContent = `股票倉位 ${m.exposurePct.toFixed(1)}% · 現金 ${(100 - m.exposurePct).toFixed(1)}%`;
  }
  if (allocContainer) {
    const rows = trResult.activePositions.map((p) => {
      const pct = m.finalEquity > 0 ? (p.marketValue / m.finalEquity) * 100 : 0;
      const meta = getAssetMeta(p.symbol);
      return `
        <div class="alloc-row">
          <div class="alloc-row-head">
            <span><strong>${p.symbol}</strong> (${meta.nameZh})</span>
            <span>${fmtMoney(p.marketValue)} (${pct.toFixed(1)}%)</span>
          </div>
          <div class="alloc-track">
            <div class="alloc-fill" style="width:${Math.min(100, pct)}%;background:${meta.color};"></div>
          </div>
        </div>
      `;
    });
    const cashPct = Math.max(0, 100 - m.exposurePct);
    rows.push(`
      <div class="alloc-row">
        <div class="alloc-row-head">
          <span><strong>USD CASH</strong> (可用虛擬現金儲備)</span>
          <span>${fmtMoney(m.cashBalance)} (${cashPct.toFixed(1)}%)</span>
        </div>
        <div class="alloc-track">
          <div class="alloc-fill" style="width:${Math.min(100, cashPct)}%;background:#64748b;"></div>
        </div>
      </div>
    `);

    allocContainer.innerHTML = `
      <div class="alloc-bar-list">
        ${rows.join('')}
      </div>
      <div style="margin-top:16px;padding-top:12px;border-top:1px solid var(--border-subtle);display:grid;grid-template-columns:1fr 1fr;gap:10px;font-family:var(--font-mono);font-size:12px;">
        <div>盈虧比 (Profit Factor): <strong>${m.profitFactor.toFixed(2)}x</strong></div>
        <div>累計交易手續費: <strong>${fmtMoney(m.totalFeesPaid)}</strong></div>
        <div>獲利筆數 / 虧損筆數: <strong class="pos-val">${m.winningCount} 勝</strong> / <strong class="neg-val">${m.losingCount} 敗</strong></div>
        <div>年化夏普值 (Sharpe): <strong>${m.sharpeRatio.toFixed(2)}</strong></div>
      </div>
    `;
  }

  // 3. Closed Round-Trip Trades or Order Events
  const closedBadge = document.getElementById('closed-trades-badge');
  const closedContainer = document.getElementById('closed-trades-container');
  if (!closedContainer) return;

  if (state.ledgerTab === 'closed') {
    if (closedBadge) {
      closedBadge.textContent = `共 ${trResult.closedTrades.length} 筆已平倉來回交易`;
    }
    if (trResult.closedTrades.length === 0) {
      closedContainer.innerHTML = `<div style="padding:20px;color:var(--text-secondary);">此期間內所有建倉部位皆仍在順勢續抱中（請查看上方「目前持倉中部位」或切換為「逐筆委託成交流水帳」）。</div>`;
    } else {
      closedContainer.innerHTML = `
        <table class="quant-table">
          <thead>
            <tr>
              <th>標的</th>
              <th>進場日期 → 退場日期</th>
              <th>進場價 → 退場價</th>
              <th>股數 / 手續費</th>
              <th>實現淨損益 (Net PnL)</th>
              <th>🟢 當初進場理由 (Entry Signal)</th>
              <th>🔴 最終退場理由 (Exit Signal)</th>
            </tr>
          </thead>
          <tbody>
            ${trResult.closedTrades
              .map((t) => {
                const isWin = t.netPnl >= 0;
                return `
                  <tr>
                    <td class="mono"><strong>${t.symbol}</strong><br/><span style="color:var(--text-secondary);font-size:11px;">${t.assetNameZh}</span></td>
                    <td class="mono">${t.entryDate} → ${t.exitDate}<br/><span style="color:var(--text-secondary);font-size:11px;">持有 ${t.barsHeld} 交易日</span></td>
                    <td class="mono">$${t.entryPrice.toFixed(2)} → <strong>$${t.exitPrice.toFixed(2)}</strong></td>
                    <td class="mono">${t.shares} 股<br/><span style="color:var(--text-secondary);font-size:11px;">費: ${fmtMoney(t.feesPaid)}</span></td>
                    <td class="mono ${isWin ? 'pos-val' : 'neg-val'}">
                      <strong>${isWin ? '+' : ''}${fmtMoney(t.netPnl)}</strong><br/>
                      (${fmtPct(t.netPnlPct)})
                    </td>
                    <td>
                      <div style="font-weight:600;color:var(--bull-green);margin-bottom:2px;">${state.lang === 'zh' ? t.entryTagZh : t.entryTagEn}</div>
                      <div class="reason-box">${state.lang === 'zh' ? t.entryReasonZh : t.entryReasonEn}</div>
                    </td>
                    <td>
                      <div style="font-weight:600;color:${isWin ? 'var(--accent-cyan)' : 'var(--bear-red)'};margin-bottom:2px;">${state.lang === 'zh' ? t.exitTagZh : t.exitTagEn}</div>
                      <div class="reason-box">${state.lang === 'zh' ? t.exitReasonZh : t.exitReasonEn}</div>
                    </td>
                  </tr>
                `;
              })
              .join('')}
          </tbody>
        </table>
      `;
    }
  } else {
    if (closedBadge) {
      closedBadge.textContent = `共 ${trResult.orderEvents.length} 筆委託成交紀錄`;
    }
    closedContainer.innerHTML = `
      <table class="quant-table">
        <thead>
          <tr>
            <th>成交日期</th>
            <th>動作</th>
            <th>標的</th>
            <th>成交價 / 股數</th>
            <th>成交總金額 (含手續費)</th>
            <th>單筆結算損益</th>
            <th>AI 量化決策依據</th>
          </tr>
        </thead>
        <tbody>
          ${trResult.orderEvents
            .map((e) => {
              const isBuy = e.type === 'BUY';
              return `
                <tr>
                  <td class="mono">${e.date}</td>
                  <td><span class="action-badge action-${e.type}">${isBuy ? '🟢 買進 BUY' : '🔴 賣出 SELL'}</span></td>
                  <td class="mono"><strong>${e.symbol}</strong></td>
                  <td class="mono">$${e.price.toFixed(2)} × ${e.shares}</td>
                  <td class="mono">${fmtMoney(e.amount)}</td>
                  <td class="mono ${!isBuy && e.pnl >= 0 ? 'pos-val' : !isBuy ? 'neg-val' : ''}">
                    ${isBuy ? '建倉部位' : `${e.pnl >= 0 ? '+' : ''}${fmtMoney(e.pnl)} (${fmtPct(e.pnlPct)})`}
                  </td>
                  <td>
                    <div style="font-weight:600;margin-bottom:2px;">${state.lang === 'zh' ? e.tagZh : e.tagEn}</div>
                    <div class="reason-box">${state.lang === 'zh' ? e.reasonZh : e.reasonEn}</div>
                  </td>
                </tr>
              `;
            })
            .join('')}
        </tbody>
      </table>
    `;
  }
}

function renderRadarTable() {
  const tbody = document.getElementById('radar-table-body');
  if (!tbody || !state.arenaResult) return;

  tbody.innerHTML = state.arenaResult.latestRadar
    .map((r) => {
      const isUp = r.dailyReturnPct >= 0;
      const aboveSma50 = r.close >= r.sma50;
      const renderSig = (tid) => {
        const s = r.signalsByTrader[tid];
        if (!s) return '-';
        const labelMap = {
          BUY: '🟢 進場 BUY',
          SELL: '🔴 退場 SELL',
          HOLD: '🔵 續抱 HOLD',
          WAIT: '⚪ 觀望 WAIT'
        };
        return `
          <div>
            <span class="action-badge action-${s.action}">${labelMap[s.action] || s.action}</span>
            <div style="font-size:11px;color:var(--text-secondary);margin-top:4px;">
              ${state.lang === 'zh' ? s.tagZh : s.tagEn}
            </div>
          </div>
        `;
      };

      return `
        <tr>
          <td class="mono">
            <strong>${r.symbol}</strong><br/>
            <span style="color:var(--text-secondary);font-size:11px;">${state.lang === 'zh' ? r.nameZh : r.name}</span>
          </td>
          <td class="mono"><strong>$${r.close.toFixed(2)}</strong><br/><span style="color:var(--text-secondary);font-size:11px;">${r.date}</span></td>
          <td class="mono ${isUp ? 'pos-val' : 'neg-val'}"><strong>${fmtPct(r.dailyReturnPct)}</strong></td>
          <td class="mono">
            5D: <span class="${r.roc5 >= 0 ? 'pos-val' : 'neg-val'}">${fmtPct(r.roc5, 1)}</span><br/>
            10D: <span class="${r.roc10 >= 0 ? 'pos-val' : 'neg-val'}">${fmtPct(r.roc10, 1)}</span>
          </td>
          <td class="mono">${r.rsi14.toFixed(1)}</td>
          <td class="mono">%B: ${(r.bbPercentB * 100).toFixed(0)}%<br/>Z: ${r.zScore20.toFixed(2)}</td>
          <td class="mono">
            <span class="${aboveSma50 ? 'pos-val' : 'neg-val'}">${aboveSma50 ? '▲ 站上生命線' : '▼ 跌破生命線'}</span><br/>
            <span style="color:var(--text-secondary);font-size:11px;">SMA50: $${r.sma50.toFixed(2)}</span>
          </td>
          <td>${renderSig('alpha-momentum')}</td>
          <td>${renderSig('sigma-reversion')}</td>
          <td>${renderSig('titan-multifactor')}</td>
        </tr>
      `;
    })
    .join('');
}

function renderSyncModal() {
  const timeEl = document.getElementById('modal-last-sync-time');
  const listEl = document.getElementById('sync-history-list');
  if (timeEl && state.marketData) {
    timeEl.textContent = `${state.marketData.fetchedAt.replace('T', ' ').slice(0, 19)} UTC`;
  }
  if (listEl) {
    if (!state.syncHistory || state.syncHistory.length === 0) {
      listEl.innerHTML = `<div class="sync-history-item">尚無歷史紀錄</div>`;
    } else {
      listEl.innerHTML = state.syncHistory
        .map(
          (item) => `
          <div class="sync-history-item">
            <span>📅 市場日: <strong>${item.marketDate}</strong> (${item.trigger})</span>
            <span>SPY: $${Number(item.spyClose).toFixed(2)} | NVDA: $${Number(item.nvdaClose).toFixed(2)}</span>
            <span class="pos-val">1M 冠軍: ${item.leader1M?.nameZh} (${fmtPct(item.leader1M?.returnPct)})</span>
          </div>
        `
        )
        .join('');
    }
  }
}

initApp();
