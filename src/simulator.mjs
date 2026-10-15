import { ASSET_UNIVERSE, BENCHMARK_SYMBOL, getAssetMeta } from './universe.mjs';
import { enrichBarsWithIndicators } from './indicators.mjs';
import { AI_TRADERS, evaluateTraderSignal } from './traders.mjs';

/**
 * Prepares enriched bar maps and aligned trading timeline across the asset universe.
 */
export function prepareEnrichedUniverse(rawMarketData) {
  const enrichedBySymbol = {};
  const barBySymbolAndDate = {};

  for (const [symbol, symbolData] of Object.entries(rawMarketData.symbols || {})) {
    const bars = enrichBarsWithIndicators(symbolData.bars || []);
    enrichedBySymbol[symbol] = bars;
    const dateMap = new Map();
    for (const b of bars) {
      dateMap.set(b.date, b);
    }
    barBySymbolAndDate[symbol] = dateMap;
  }

  return { enrichedBySymbol, barBySymbolAndDate };
}

/**
 * Runs the 3-AI-Traders Multi-Asset Paper Trading Arena over a specified period.
 *
 * @param {object} rawMarketData Market data snapshot containing `.symbols[ticker].bars`
 * @param {object} options
 * @param {number} [options.periodDays=30] Number of trading days to simulate (e.g. 22 ~ 30 for 1M, 60, 90, 180, 250)
 * @param {number} [options.initialCapital=100000] Starting virtual USD capital per AI trader
 * @param {number} [options.feeRate=0.001] Commission + slippage per trade leg (0.001 = 0.10%)
 * @param {string} [options.marketFilter='all'] 'all' | 'us-stock' | 'crypto'
 */
export function runArenaSimulation(rawMarketData, options = {}) {
  const periodDays = Number(options.periodDays || 30);
  const initialCapital = Number(options.initialCapital || 100000);
  const feeRate = Number(options.feeRate ?? 0.001);
  const marketFilter = options.marketFilter || 'all';

  const { enrichedBySymbol, barBySymbolAndDate } = prepareEnrichedUniverse(rawMarketData);

  // Determine eligible tradeable symbols
  const eligibleAssets = ASSET_UNIVERSE.filter((asset) => {
    if (!enrichedBySymbol[asset.symbol] || enrichedBySymbol[asset.symbol].length === 0) {
      return false;
    }
    if (marketFilter === 'us-stock') {
      return asset.category === 'us-stock' || asset.category === 'us-etf';
    }
    if (marketFilter === 'crypto') {
      return asset.category === 'crypto';
    }
    return true;
  });

  // Build master trading date timeline from SPY (for stocks/all) or BTC-USD (for crypto-only)
  const timelineSymbol =
    marketFilter === 'crypto' && enrichedBySymbol['BTC-USD']?.length
      ? 'BTC-USD'
      : enrichedBySymbol[BENCHMARK_SYMBOL]?.length
        ? BENCHMARK_SYMBOL
        : Object.keys(enrichedBySymbol)[0];

  const fullTimeline = (enrichedBySymbol[timelineSymbol] || []).map((b) => b.date);
  const startIdx = Math.max(0, fullTimeline.length - periodDays);
  const timelineDates = fullTimeline.slice(startIdx);

  // Benchmark series (Buy & Hold SPY or BTC-USD)
  const benchmarkTicker = marketFilter === 'crypto' ? 'BTC-USD' : BENCHMARK_SYMBOL;
  const benchmarkBars = enrichedBySymbol[benchmarkTicker] || [];
  const benchmarkDateMap = barBySymbolAndDate[benchmarkTicker] || new Map();
  let firstBenchmarkPrice = null;
  const benchmarkCurve = [];

  for (const date of timelineDates) {
    const b = benchmarkDateMap.get(date) || benchmarkBars.find((x) => x.date >= date) || benchmarkBars.at(-1);
    const price = b ? b.close : 100;
    if (firstBenchmarkPrice === null) firstBenchmarkPrice = price;
    const equity = initialCapital * (price / firstBenchmarkPrice);
    const returnPct = ((equity - initialCapital) / initialCapital) * 100;
    benchmarkCurve.push({
      date,
      price,
      equity,
      returnPct
    });
  }

  const benchmarkFinalReturnPct =
    benchmarkCurve.length > 0 ? benchmarkCurve.at(-1).returnPct : 0;

  // Simulate each of the 3 AI Traders
  const traderResults = AI_TRADERS.map((trader) => {
    let cash = initialCapital;
    const openPositions = new Map(); // symbol -> position object
    const closedTrades = [];
    const orderEvents = []; // chronological log of every BUY and SELL execution
    const equityCurve = [];
    let peakEquity = initialCapital;
    let maxDrawdownPct = 0;

    // Track last close price for each asset in case a crypto/stock holiday differs
    const lastKnownClose = {};
    for (const asset of eligibleAssets) {
      const barsBefore = (enrichedBySymbol[asset.symbol] || []).filter(
        (b) => b.date <= timelineDates[0]
      );
      if (barsBefore.length > 0) {
        lastKnownClose[asset.symbol] = barsBefore.at(-1).close;
      }
    }

    for (let dayIdx = 0; dayIdx < timelineDates.length; dayIdx++) {
      const date = timelineDates[dayIdx];
      const spyBar = barBySymbolAndDate[BENCHMARK_SYMBOL]?.get(date);
      const regime = {
        spyBullish: spyBar
          ? spyBar.close >= spyBar.sma50 * 0.99 && spyBar.sma20 >= spyBar.sma50 * 0.985
          : true,
        spyShortTermBull: spyBar
          ? spyBar.close >= spyBar.sma20 * 0.99 || spyBar.ema8 >= spyBar.ema21
          : true,
        spyRsi: spyBar ? spyBar.rsi14 : 50,
        spyRoc10: spyBar ? spyBar.roc10 : 0,
        spyRoc20: spyBar ? spyBar.roc20 : 0
      };

      // Update last known prices & increment holding days
      for (const asset of eligibleAssets) {
        const bar = barBySymbolAndDate[asset.symbol]?.get(date);
        if (bar) {
          lastKnownClose[asset.symbol] = bar.close;
        }
        const pos = openPositions.get(asset.symbol);
        if (pos && bar) {
          pos.barsHeld += 1;
          pos.currentPrice = bar.close;
          pos.highestPrice = Math.max(pos.highestPrice, bar.high || bar.close);
        } else if (pos && lastKnownClose[asset.symbol]) {
          pos.currentPrice = lastKnownClose[asset.symbol];
        }
      }

      // STEP 1: Evaluate EXITS on currently held positions
      for (const [symbol, pos] of Array.from(openPositions.entries())) {
        const bar = barBySymbolAndDate[symbol]?.get(date);
        if (!bar) continue;

        const decision = evaluateTraderSignal(trader.id, bar, pos, regime);
        if (decision.action === 'SELL') {
          const grossProceeds = pos.shares * bar.close;
          const exitFee = grossProceeds * feeRate;
          const netProceeds = grossProceeds - exitFee;
          const totalFees = pos.entryFee + exitFee;
          const netPnl = netProceeds - pos.costBasis;
          const netPnlPct = (netPnl / pos.costBasis) * 100;

          cash += netProceeds;
          openPositions.delete(symbol);

          const tradeRecord = {
            id: `${trader.id}-${symbol}-${pos.entryDate}-${date}`,
            traderId: trader.id,
            traderName: trader.name,
            traderNameZh: trader.nameZh,
            traderColor: trader.color,
            symbol,
            assetNameZh: getAssetMeta(symbol).nameZh,
            category: getAssetMeta(symbol).category,
            status: 'CLOSED',
            entryDate: pos.entryDate,
            exitDate: date,
            barsHeld: pos.barsHeld,
            shares: pos.shares,
            entryPrice: pos.entryPrice,
            exitPrice: bar.close,
            stopLoss: pos.stopLoss,
            takeProfit: pos.takeProfit,
            costBasis: pos.costBasis,
            netProceeds,
            feesPaid: totalFees,
            netPnl,
            netPnlPct,
            entryTagZh: pos.entryTagZh,
            entryTagEn: pos.entryTagEn,
            entryReasonZh: pos.entryReasonZh,
            entryReasonEn: pos.entryReasonEn,
            exitTagZh: decision.tagZh,
            exitTagEn: decision.tagEn,
            exitReasonZh: decision.reasonZh,
            exitReasonEn: decision.reasonEn
          };

          closedTrades.push(tradeRecord);
          orderEvents.push({
            id: `SELL-${trader.id}-${symbol}-${date}`,
            traderId: trader.id,
            traderName: trader.name,
            traderNameZh: trader.nameZh,
            traderBadge: trader.badge,
            traderColor: trader.color,
            date,
            entryDate: pos.entryDate,
            exitDate: date,
            barsHeld: pos.barsHeld,
            type: 'SELL',
            status: 'CLOSED',
            symbol,
            assetName: getAssetMeta(symbol).name,
            assetNameZh: getAssetMeta(symbol).nameZh,
            assetColor: getAssetMeta(symbol).color,
            price: bar.close,
            entryPrice: pos.entryPrice,
            exitPrice: bar.close,
            currentPrice: bar.close,
            stopLoss: pos.stopLoss,
            takeProfit: pos.takeProfit,
            shares: pos.shares,
            amount: netProceeds,
            fee: exitFee,
            pnl: netPnl,
            pnlPct: netPnlPct,
            tagZh: decision.tagZh,
            tagEn: decision.tagEn,
            reasonZh: decision.reasonZh,
            reasonEn: decision.reasonEn
          });
        }
      }

      // STEP 2: Evaluate ENTRIES across eligible assets not currently in portfolio
      if (openPositions.size < trader.maxPositions) {
        const candidates = [];
        for (const asset of eligibleAssets) {
          if (openPositions.has(asset.symbol)) continue;
          const bar = barBySymbolAndDate[asset.symbol]?.get(date);
          if (!bar) continue;

          const decision = evaluateTraderSignal(trader.id, bar, null, regime);
          if (decision.action === 'BUY') {
            candidates.push({
              asset,
              bar,
              decision
            });
          }
        }

        // Rank by highest conviction
        candidates.sort((a, b) => b.decision.conviction - a.decision.conviction);

        // Compute current total equity before sizing new positions
        let currentInvested = 0;
        for (const pos of openPositions.values()) {
          currentInvested += pos.shares * pos.currentPrice;
        }
        const currentTotalEquity = cash + currentInvested;

        for (const cand of candidates) {
          if (openPositions.size >= trader.maxPositions) break;

          const allocPct = cand.decision.allocationPct || trader.baseAllocation;
          const targetDollar = Math.min(cash * 0.96, currentTotalEquity * allocPct);
          if (targetDollar < currentTotalEquity * 0.06 || targetDollar < 500) continue;

          const entryPrice = cand.bar.close;
          const rawShares = targetDollar / (entryPrice * (1 + feeRate));
          const shares =
            cand.asset.category === 'crypto'
              ? Math.floor(rawShares * 1000) / 1000
              : Math.max(1, Math.floor(rawShares));

          const grossCost = shares * entryPrice;
          const entryFee = grossCost * feeRate;
          const totalCost = grossCost + entryFee;

          if (shares <= 0 || totalCost > cash) continue;

          cash -= totalCost;
          openPositions.set(cand.asset.symbol, {
            symbol: cand.asset.symbol,
            assetNameZh: cand.asset.nameZh,
            category: cand.asset.category,
            entryDate: date,
            entryPrice,
            currentPrice: entryPrice,
            highestPrice: cand.bar.high || entryPrice,
            shares,
            costBasis: totalCost,
            entryFee,
            barsHeld: 0,
            stopLoss: cand.decision.stopLossPrice || entryPrice * 0.945,
            takeProfit: cand.decision.takeProfitPrice || entryPrice * 1.1,
            entryTagZh: cand.decision.tagZh,
            entryTagEn: cand.decision.tagEn,
            entryReasonZh: cand.decision.reasonZh,
            entryReasonEn: cand.decision.reasonEn
          });

          orderEvents.push({
            id: `BUY-${trader.id}-${cand.asset.symbol}-${date}`,
            traderId: trader.id,
            traderName: trader.name,
            traderNameZh: trader.nameZh,
            traderBadge: trader.badge,
            traderColor: trader.color,
            date,
            entryDate: date,
            type: 'BUY',
            status: 'OPEN',
            symbol: cand.asset.symbol,
            assetName: cand.asset.name,
            assetNameZh: cand.asset.nameZh,
            assetColor: cand.asset.color,
            price: entryPrice,
            entryPrice,
            currentPrice: entryPrice,
            shares,
            amount: totalCost,
            fee: entryFee,
            stopLoss: cand.decision.stopLossPrice || entryPrice * 0.945,
            takeProfit: cand.decision.takeProfitPrice || entryPrice * 1.1,
            tagZh: cand.decision.tagZh,
            tagEn: cand.decision.tagEn,
            reasonZh: cand.decision.reasonZh,
            reasonEn: cand.decision.reasonEn
          });
        }
      }

      // STEP 3: Mark-to-Market end-of-day portfolio valuation
      let investedValue = 0;
      for (const pos of openPositions.values()) {
        investedValue += pos.shares * pos.currentPrice;
      }
      const totalEquity = cash + investedValue;
      if (totalEquity > peakEquity) peakEquity = totalEquity;
      const drawdownPct = peakEquity > 0 ? ((totalEquity - peakEquity) / peakEquity) * 100 : 0;
      if (drawdownPct < maxDrawdownPct) maxDrawdownPct = drawdownPct;

      const returnPct = ((totalEquity - initialCapital) / initialCapital) * 100;
      const prevEquity = equityCurve.length > 0 ? equityCurve.at(-1).equity : initialCapital;
      const dailyReturn = prevEquity > 0 ? (totalEquity - prevEquity) / prevEquity : 0;

      equityCurve.push({
        date,
        equity: totalEquity,
        cash,
        investedValue,
        returnPct,
        drawdownPct,
        dailyReturn,
        openPositionsCount: openPositions.size
      });
    }

    // Build active open positions array with unrealized PnL
    const activePositions = Array.from(openPositions.values()).map((pos) => {
      const marketValue = pos.shares * pos.currentPrice;
      const unrealizedPnl = marketValue - pos.costBasis;
      const unrealizedPnlPct = (unrealizedPnl / pos.costBasis) * 100;
      const rangeSpan = Math.max(0.0001, pos.takeProfit - pos.stopLoss);
      const rangeProgressPct = Math.max(
        0,
        Math.min(100, ((pos.currentPrice - pos.stopLoss) / rangeSpan) * 100)
      );
      const entryRangePct = Math.max(
        0,
        Math.min(100, ((pos.entryPrice - pos.stopLoss) / rangeSpan) * 100)
      );
      const distToTpPct =
        pos.currentPrice > 0 ? ((pos.takeProfit - pos.currentPrice) / pos.currentPrice) * 100 : 0;
      const distToSlPct =
        pos.currentPrice > 0 ? ((pos.currentPrice - pos.stopLoss) / pos.currentPrice) * 100 : 0;
      return {
        ...pos,
        traderId: trader.id,
        traderName: trader.name,
        traderNameZh: trader.nameZh,
        traderBadge: trader.badge,
        traderColor: trader.color,
        assetColor: getAssetMeta(pos.symbol).color,
        status: 'OPEN',
        marketValue,
        unrealizedPnl,
        unrealizedPnlPct,
        rangeProgressPct,
        entryRangePct,
        distToTpPct,
        distToSlPct
      };
    });

    // Enrich BUY order events with current live mark-to-market status or closed status
    const activeMap = new Map(activePositions.map((p) => [`${p.symbol}-${p.entryDate}`, p]));
    const closedMap = new Map(closedTrades.map((c) => [`${c.symbol}-${c.entryDate}`, c]));
    for (const ev of orderEvents) {
      if (ev.type === 'BUY') {
        const key = `${ev.symbol}-${ev.entryDate}`;
        const activePos = activeMap.get(key);
        const closedTr = closedMap.get(key);
        if (activePos) {
          ev.status = 'OPEN';
          ev.currentPrice = activePos.currentPrice;
          ev.barsHeld = activePos.barsHeld;
          ev.pnl = activePos.unrealizedPnl;
          ev.pnlPct = activePos.unrealizedPnlPct;
          ev.rangeProgressPct = activePos.rangeProgressPct;
          ev.entryRangePct = activePos.entryRangePct;
          ev.distToTpPct = activePos.distToTpPct;
          ev.distToSlPct = activePos.distToSlPct;
        } else if (closedTr) {
          ev.status = 'CLOSED';
          ev.exitDate = closedTr.exitDate;
          ev.exitPrice = closedTr.exitPrice;
          ev.currentPrice = closedTr.exitPrice;
          ev.barsHeld = closedTr.barsHeld;
          ev.pnl = closedTr.netPnl;
          ev.pnlPct = closedTr.netPnlPct;
        }
      } else if (ev.type === 'SELL') {
        const rangeSpan = Math.max(0.0001, (ev.takeProfit || ev.price * 1.1) - (ev.stopLoss || ev.price * 0.95));
        ev.rangeProgressPct = Math.max(
          0,
          Math.min(100, ((ev.exitPrice - ev.stopLoss) / rangeSpan) * 100)
        );
        ev.entryRangePct = Math.max(
          0,
          Math.min(100, ((ev.entryPrice - ev.stopLoss) / rangeSpan) * 100)
        );
      }
    }

    // Compute summary metrics
    const finalPoint = equityCurve.at(-1) || {
      equity: initialCapital,
      cash: initialCapital,
      investedValue: 0,
      returnPct: 0
    };

    const allEvaluatedTrades = [
      ...closedTrades.map((t) => ({ pnl: t.netPnl, pnlPct: t.netPnlPct })),
      ...activePositions.map((p) => ({ pnl: p.unrealizedPnl, pnlPct: p.unrealizedPnlPct }))
    ];

    const winningCount = allEvaluatedTrades.filter((t) => t.pnl > 0).length;
    const losingCount = allEvaluatedTrades.filter((t) => t.pnl <= 0).length;
    const winRatePct =
      allEvaluatedTrades.length > 0 ? (winningCount / allEvaluatedTrades.length) * 100 : 0;

    const grossProfit = allEvaluatedTrades
      .filter((t) => t.pnl > 0)
      .reduce((acc, t) => acc + t.pnl, 0);
    const grossLoss = Math.abs(
      allEvaluatedTrades.filter((t) => t.pnl < 0).reduce((acc, t) => acc + t.pnl, 0)
    );
    const profitFactor =
      grossLoss > 0 ? grossProfit / grossLoss : grossProfit > 0 ? 9.99 : 1.0;

    // Annualized Sharpe Ratio from daily returns
    const dailyReturns = equityCurve.map((pt) => pt.dailyReturn);
    const meanDaily =
      dailyReturns.length > 0
        ? dailyReturns.reduce((a, b) => a + b, 0) / dailyReturns.length
        : 0;
    const varianceDaily =
      dailyReturns.length > 1
        ? dailyReturns.reduce((acc, r) => acc + (r - meanDaily) ** 2, 0) /
          (dailyReturns.length - 1)
        : 0;
    const stdDaily = Math.sqrt(varianceDaily);
    const sharpeRatio = stdDaily > 0.0001 ? (meanDaily / stdDaily) * Math.sqrt(252) : 0;

    const totalFeesPaid = orderEvents.reduce((acc, e) => acc + (e.fee || 0), 0);

    return {
      trader,
      metrics: {
        initialCapital,
        finalEquity: finalPoint.equity,
        netProfit: finalPoint.equity - initialCapital,
        totalReturnPct: finalPoint.returnPct,
        alphaPct: finalPoint.returnPct - benchmarkFinalReturnPct,
        cashBalance: finalPoint.cash,
        investedValue: finalPoint.investedValue,
        exposurePct:
          finalPoint.equity > 0 ? (finalPoint.investedValue / finalPoint.equity) * 100 : 0,
        winRatePct,
        totalTradesCount: allEvaluatedTrades.length,
        closedTradesCount: closedTrades.length,
        openPositionsCount: activePositions.length,
        winningCount,
        losingCount,
        profitFactor,
        maxDrawdownPct,
        sharpeRatio,
        totalFeesPaid
      },
      equityCurve,
      activePositions,
      closedTrades: closedTrades.slice().reverse(),
      orderEvents: orderEvents.slice().reverse()
    };
  });

  // Sort leaderboard by totalReturnPct descending
  const leaderboard = [...traderResults].sort(
    (a, b) => b.metrics.totalReturnPct - a.metrics.totalReturnPct
  );

  // Build "Today's Live AI Radar" for the latest market bar across all assets
  const latestRadar = eligibleAssets.map((asset) => {
    const bars = enrichedBySymbol[asset.symbol] || [];
    const latestBar = bars.at(-1);
    if (!latestBar) return null;

    const spyLatest = enrichedBySymbol[BENCHMARK_SYMBOL]?.at(-1);
    const regime = {
      spyBullish: spyLatest ? spyLatest.close >= spyLatest.sma50 * 0.985 : true
    };

    const signalsByTrader = {};
    for (const trResult of traderResults) {
      const openPos = trResult.activePositions.find((p) => p.symbol === asset.symbol) || null;
      signalsByTrader[trResult.trader.id] = evaluateTraderSignal(
        trResult.trader.id,
        latestBar,
        openPos,
        regime
      );
    }

    return {
      symbol: asset.symbol,
      name: asset.name,
      nameZh: asset.nameZh,
      category: asset.category,
      sectorZh: asset.sectorZh,
      color: asset.color,
      date: latestBar.date,
      close: latestBar.close,
      dailyReturnPct: latestBar.dailyReturnPct,
      roc5: latestBar.roc5,
      roc10: latestBar.roc10,
      rsi14: latestBar.rsi14,
      macdHist: latestBar.macdHist,
      bbPercentB: latestBar.bbPercentB,
      zScore20: latestBar.zScore20,
      atrPct: latestBar.atrPct,
      ema8: latestBar.ema8,
      ema21: latestBar.ema21,
      sma20: latestBar.sma20,
      sma50: latestBar.sma50,
      signalsByTrader
    };
  }).filter(Boolean);

  // Build unified cross-AI recent operations feed sorted newest date first
  const recentOperations = traderResults
    .flatMap((tr) => tr.orderEvents)
    .sort((a, b) => {
      const dateCmp = b.date.localeCompare(a.date);
      if (dateCmp !== 0) return dateCmp;
      // Put SELL before BUY on same date or sort by PnL %
      return (b.pnlPct || 0) - (a.pnlPct || 0);
    });

  return {
    generatedAt: new Date().toISOString(),
    marketUpdatedAt: rawMarketData.fetchedAt || new Date().toISOString(),
    config: {
      periodDays,
      initialCapital,
      feeRate,
      marketFilter,
      startDate: timelineDates[0] || '',
      endDate: timelineDates.at(-1) || '',
      tradingDaysCount: timelineDates.length
    },
    benchmark: {
      symbol: benchmarkTicker,
      nameZh: getAssetMeta(benchmarkTicker).nameZh,
      finalReturnPct: benchmarkFinalReturnPct,
      finalEquity: benchmarkCurve.at(-1)?.equity || initialCapital,
      curve: benchmarkCurve
    },
    traderResults,
    leaderboard,
    recentOperations,
    latestRadar
  };
}

/**
 * Runs a focused Single-Asset K-Line Simulation for a selected ticker & AI trader
 * so the user can inspect every exact BUY/SELL arrow on the candlestick chart.
 */
export function runSingleAssetSimulation(rawMarketData, symbol, traderId, periodDays = 60) {
  const symbolData = rawMarketData.symbols?.[symbol];
  if (!symbolData || !symbolData.bars || symbolData.bars.length === 0) {
    return null;
  }

  const allBars = enrichBarsWithIndicators(symbolData.bars);
  const startIdx = Math.max(0, allBars.length - periodDays);
  const windowBars = allBars.slice(startIdx);

  const spyBars = enrichBarsWithIndicators(rawMarketData.symbols?.[BENCHMARK_SYMBOL]?.bars || []);
  const spyMap = new Map(spyBars.map((b) => [b.date, b]));

  let position = null;
  const markers = [];
  const roundTrips = [];

  for (let i = 0; i < windowBars.length; i++) {
    const bar = windowBars[i];
    const spyBar = spyMap.get(bar.date);
    const regime = {
      spyBullish: spyBar ? spyBar.close >= spyBar.sma50 * 0.985 : true
    };

    if (position) {
      position.barsHeld += 1;
      position.highestPrice = Math.max(position.highestPrice, bar.high || bar.close);
    }

    const decision = evaluateTraderSignal(traderId, bar, position, regime);

    if (!position && decision.action === 'BUY') {
      position = {
        entryIndex: i,
        entryDate: bar.date,
        entryPrice: bar.close,
        highestPrice: bar.high || bar.close,
        barsHeld: 0,
        stopLoss: decision.stopLossPrice || bar.close * 0.945,
        takeProfit: decision.takeProfitPrice || bar.close * 1.1,
        entryTagZh: decision.tagZh,
        entryTagEn: decision.tagEn,
        entryReasonZh: decision.reasonZh,
        entryReasonEn: decision.reasonEn
      };
      markers.push({
        index: i,
        date: bar.date,
        type: 'BUY',
        price: bar.close,
        stopLoss: position.stopLoss,
        takeProfit: position.takeProfit,
        tagZh: decision.tagZh,
        tagEn: decision.tagEn,
        reasonZh: decision.reasonZh,
        reasonEn: decision.reasonEn
      });
    } else if (position && decision.action === 'SELL') {
      const pnlPct = ((bar.close - position.entryPrice) / position.entryPrice) * 100;
      markers.push({
        index: i,
        date: bar.date,
        type: 'SELL',
        price: bar.close,
        pnlPct,
        barsHeld: position.barsHeld,
        tagZh: decision.tagZh,
        tagEn: decision.tagEn,
        reasonZh: decision.reasonZh,
        reasonEn: decision.reasonEn
      });
      roundTrips.push({
        symbol,
        status: 'CLOSED',
        entryDate: position.entryDate,
        exitDate: bar.date,
        barsHeld: position.barsHeld,
        entryPrice: position.entryPrice,
        exitPrice: bar.close,
        pnlPct,
        entryTagZh: position.entryTagZh,
        entryReasonZh: position.entryReasonZh,
        exitTagZh: decision.tagZh,
        exitReasonZh: decision.reasonZh
      });
      position = null;
    }
  }

  // If still holding at the end of window, add active hold info
  let openPositionSummary = null;
  if (position && windowBars.length > 0) {
    const lastBar = windowBars.at(-1);
    const pnlPct = ((lastBar.close - position.entryPrice) / position.entryPrice) * 100;
    openPositionSummary = {
      ...position,
      status: 'OPEN',
      currentDate: lastBar.date,
      currentPrice: lastBar.close,
      pnlPct
    };
  }

  const assetBuyHoldPct =
    windowBars.length > 1
      ? ((windowBars.at(-1).close - windowBars[0].close) / windowBars[0].close) * 100
      : 0;

  return {
    symbol,
    meta: getAssetMeta(symbol),
    traderId,
    bars: windowBars,
    markers,
    roundTrips: roundTrips.slice().reverse(),
    openPositionSummary,
    assetBuyHoldPct
  };
}
