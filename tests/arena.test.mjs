import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { ASSET_UNIVERSE } from '../src/universe.mjs';
import { enrichBarsWithIndicators } from '../src/indicators.mjs';
import { AI_TRADERS, evaluateTraderSignal } from '../src/traders.mjs';
import { runArenaSimulation, runSingleAssetSimulation } from '../src/simulator.mjs';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const SNAPSHOT_PATH = path.resolve(__dirname, '..', 'data', 'market-snapshot.json');

test('Zero Look-Ahead Bias: modifying future bars never changes historical indicators or AI decisions', async () => {
  const raw = JSON.parse(await fs.readFile(SNAPSHOT_PATH, 'utf8'));
  const nvdaBars = raw.symbols.NVDA.bars.slice(0, 120);

  const enrichedFull = enrichBarsWithIndicators(nvdaBars);

  // Mutate future bars [80..119] drastically and verify bar [79] is 100% identical
  const mutatedBars = nvdaBars.map((b, idx) =>
    idx >= 80
      ? { ...b, open: b.open * 5, high: b.high * 5, low: b.low * 5, close: b.close * 5 }
      : { ...b }
  );
  const enrichedMutated = enrichBarsWithIndicators(mutatedBars);

  for (let i = 0; i < 80; i++) {
    assert.equal(enrichedFull[i].sma20, enrichedMutated[i].sma20);
    assert.equal(enrichedFull[i].sma50, enrichedMutated[i].sma50);
    assert.equal(enrichedFull[i].ema8, enrichedMutated[i].ema8);
    assert.equal(enrichedFull[i].rsi14, enrichedMutated[i].rsi14);
    assert.equal(enrichedFull[i].macdHist, enrichedMutated[i].macdHist);
    assert.equal(enrichedFull[i].zScore20, enrichedMutated[i].zScore20);

    for (const trader of AI_TRADERS) {
      const sigA = evaluateTraderSignal(trader.id, enrichedFull[i], null);
      const sigB = evaluateTraderSignal(trader.id, enrichedMutated[i], null);
      assert.equal(sigA.action, sigB.action);
      assert.equal(sigA.conviction, sigB.conviction);
    }
  }
});

test('Virtual Portfolio Accounting Invariant: cash + investedValue === equity and cash >= 0', async () => {
  const raw = JSON.parse(await fs.readFile(SNAPSHOT_PATH, 'utf8'));
  const sim = runArenaSimulation(raw, {
    periodDays: 63,
    initialCapital: 100000,
    feeRate: 0.001,
    marketFilter: 'all'
  });

  assert.equal(sim.traderResults.length, 3);

  for (const tr of sim.traderResults) {
    assert.ok(tr.equityCurve.length > 0, `${tr.trader.id} should have equity curve points`);
    for (const pt of tr.equityCurve) {
      assert.ok(pt.cash >= -1e-6, `Cash balance must never be negative (${pt.cash})`);
      assert.ok(
        Math.abs(pt.cash + pt.investedValue - pt.equity) < 1e-4,
        `Accounting identity cash + invested === equity violated on ${pt.date}`
      );
    }
  }
});

test('14-Asset Universe includes AMD, MU (DRAM), and XAUUSD (Gold) with real OHLCV bars', async () => {
  const raw = JSON.parse(await fs.readFile(SNAPSHOT_PATH, 'utf8'));
  assert.equal(ASSET_UNIVERSE.length, 14);

  for (const requiredSym of ['AMD', 'MU', 'XAUUSD', 'NVDA', 'BTC-USD']) {
    assert.ok(raw.symbols[requiredSym], `Snapshot should contain ${requiredSym}`);
    assert.ok(raw.symbols[requiredSym].bars.length > 200, `${requiredSym} should have >200 bars`);
  }
});

test('Past-Week Operations, Top 5 Promising Forecast, Next Entry Watchlist, Daily Briefing & Calendar', async () => {
  const raw = JSON.parse(await fs.readFile(SNAPSHOT_PATH, 'utf8'));
  const sim = runArenaSimulation(raw, {
    periodDays: 22,
    initialCapital: 100000,
    feeRate: 0.001,
    marketFilter: 'all'
  });

  // 1. Recent week operations have explicit AI trader identity and isWithinPastWeek === true
  assert.ok(Array.isArray(sim.recentWeekOperations));
  assert.ok(sim.recentWeekOperations.length > 0, 'Should have operations within past 1 week');
  for (const op of sim.recentWeekOperations) {
    assert.equal(op.isWithinPastWeek, true);
    assert.ok(op.traderId);
    assert.ok(op.traderNameZh);
    assert.ok(op.type === 'BUY' || op.type === 'SELL');
  }

  // 2. Top 5 Promising Forecast must be 100% external US stocks NOT in ASSET_UNIVERSE
  const activeWatchlistSet = new Set(ASSET_UNIVERSE.map((a) => a.symbol));
  assert.equal(sim.top5Promising.length, 5);
  for (let i = 0; i < 5; i++) {
    const pick = sim.top5Promising[i];
    assert.equal(pick.rank, i + 1);
    assert.equal(
      activeWatchlistSet.has(pick.symbol),
      false,
      `${pick.symbol} must NOT be in the current ASSET_UNIVERSE watchlist`
    );
    assert.equal(pick.isExternalDiscovery, true);
    assert.ok(pick.outlookScore >= 40 && pick.outlookScore <= 99);
    // Target/stop are anchored to the weekly (Monday) price; the live price can move past them mid-week.
    assert.ok(pick.stopLossPrice > 0 && pick.targetPrice30d > pick.stopLossPrice);
    assert.ok(Array.isArray(pick.catalystsZh) && pick.catalystsZh.length >= 2);
  }

  // 3. Next Entry Watchlist
  assert.ok(Array.isArray(sim.nextEntryWatchlist) && sim.nextEntryWatchlist.length > 0);
  for (const w of sim.nextEntryWatchlist) {
    assert.ok(w.triggerPrice > 0);
    assert.ok(w.readinessPct > 0 && w.readinessPct <= 100);
    assert.ok(w.traderNameZh);
  }

  // 4. Daily Briefing & Daily Calendar
  assert.ok(sim.dailyBriefing.marketClimateZh.length > 10);
  assert.ok(sim.dailyBriefing.topForecastZh.length > 10);
  for (const tr of sim.traderResults) {
    assert.ok(Array.isArray(tr.dailyCalendar));
    assert.equal(tr.dailyCalendar.length, sim.config.tradingDaysCount);
  }

  // 5. Custom Watchlist Filter (enabledSymbols)
  const customSim = runArenaSimulation(raw, {
    periodDays: 22,
    initialCapital: 100000,
    enabledSymbols: ['NVDA', 'AMD', 'MU', 'XAUUSD']
  });
  assert.deepEqual(customSim.config.enabledSymbols, ['NVDA', 'AMD', 'MU', 'XAUUSD']);
});

test('Single-Asset K-Line Simulation produces valid bars and trade markers for AMD, MU, XAUUSD', async () => {
  const raw = JSON.parse(await fs.readFile(SNAPSHOT_PATH, 'utf8'));
  for (const sym of ['NVDA', 'AMD', 'MU', 'XAUUSD', 'BTC-USD']) {
    for (const trader of AI_TRADERS) {
      const res = runSingleAssetSimulation(raw, sym, trader.id, 90);
      assert.ok(res, `Result should exist for ${sym} / ${trader.id}`);
      assert.equal(res.bars.length, 90);
      for (const m of res.markers) {
        assert.ok(m.type === 'BUY' || m.type === 'SELL');
        assert.ok(m.price > 0);
        assert.ok(m.reasonZh.length > 5);
      }
    }
  }
});

test('live forward mode: fresh account, no orders before tradeFromDate', async () => {
  const { runArenaSimulation: run } = await import('../src/simulator.mjs');
  const fs = await import('node:fs');
  const raw = JSON.parse(fs.readFileSync(new URL('../data/market-snapshot.json', import.meta.url), 'utf8'));
  const sym = Object.keys(raw.symbols)[0];
  const dates = raw.symbols[sym].bars.map((b) => b.date);
  const from = dates.at(-15);
  const r = run(raw, { tradeFromDate: from });
  assert.equal(r.config.startDate, from);
  for (const t of r.leaderboard) {
    assert.ok(t.equityCurve[0].equity === r.config.initialCapital, 'baseline day equals capital');
    for (const e of t.orderEvents) assert.ok(e.date >= from, `order ${e.date} before ${from}`);
  }
  const future = run(raw, { tradeFromDate: '2999-01-01' });
  for (const t of future.leaderboard) {
    assert.equal(t.orderEvents.length, 0);
    assert.ok(Number.isFinite(t.metrics.totalReturnPct));
  }
});

test('my portfolio mode: starts from real holdings with zero cash; buys only funded by sells', async () => {
  const { MY_PORTFOLIO } = await import('../src/universe.mjs');
  const raw = JSON.parse(await fs.readFile(path.join(__dirname, '..', 'data', 'market-snapshot.json'), 'utf8'));
  const dates = raw.symbols.SPY.bars.map((b) => b.date);
  const r = runArenaSimulation(raw, { tradeFromDate: dates.at(-40), initialHoldings: MY_PORTFOLIO.holdings });
  assert.equal(r.leaderboard.length, 4);
  const base = r.leaderboard[0].equityCurve[0].equity;
  for (const t of r.leaderboard) {
    assert.ok(Math.abs(t.equityCurve[0].equity - base) < 1e-6, 'all start from the same holdings value');
    assert.equal(t.equityCurve[0].cash, 0);
    for (const e of t.equityCurve) assert.ok(e.cash >= -1e-6, 'cash never negative (no extra money)');
    if (t.trader.id === 'hold-as-is') assert.equal(t.orderEvents.length, 0);
  }
});
