/**
 * Real-World Asset Universe (US Equities, Semiconductors/DRAM, ETFs, Gold XAUUSD & Crypto)
 * All symbols map to Yahoo Finance tickers for real OHLCV market data.
 */
export const ASSET_UNIVERSE = [
  {
    symbol: 'NVDA',
    yahooSymbol: 'NVDA',
    name: 'NVIDIA Corp.',
    nameZh: '輝達 (NVIDIA)',
    category: 'us-stock',
    subSector: 'semi',
    sector: 'AI GPU Leader',
    sectorZh: 'AI 算力晶片龍頭',
    color: '#76b900',
    lotStep: 1
  },
  {
    symbol: 'AMD',
    yahooSymbol: 'AMD',
    name: 'Advanced Micro Devices',
    nameZh: '超微半導體 (AMD)',
    category: 'us-stock',
    subSector: 'semi',
    sector: 'AI Accelerators & CPU',
    sectorZh: 'AI 晶片與伺服器處理器',
    color: '#ed1c24',
    lotStep: 1
  },
  {
    symbol: 'MU',
    yahooSymbol: 'MU',
    displayTicker: 'MU (DRAM)',
    name: 'Micron Technology (DRAM/HBM)',
    nameZh: '美光 DRAM 記憶體 (MU)',
    category: 'us-stock',
    subSector: 'semi',
    sector: 'DRAM & HBM3e Memory',
    sectorZh: 'DRAM 與 HBM 高頻寬記憶體',
    color: '#00b4d8',
    lotStep: 1
  },
  {
    symbol: 'TSLA',
    yahooSymbol: 'TSLA',
    name: 'Tesla Inc.',
    nameZh: '特斯拉 (Tesla)',
    category: 'us-stock',
    subSector: 'mag7',
    sector: 'EV & Robotics',
    sectorZh: '電動車與自駕機器人',
    color: '#e82127',
    lotStep: 1
  },
  {
    symbol: 'AAPL',
    yahooSymbol: 'AAPL',
    name: 'Apple Inc.',
    nameZh: '蘋果 (Apple)',
    category: 'us-stock',
    subSector: 'mag7',
    sector: 'Consumer Tech',
    sectorZh: '消費性科技巨頭',
    color: '#a2aaad',
    lotStep: 1
  },
  {
    symbol: 'MSFT',
    yahooSymbol: 'MSFT',
    name: 'Microsoft Corp.',
    nameZh: '微軟 (Microsoft)',
    category: 'us-stock',
    subSector: 'mag7',
    sector: 'Cloud & Enterprise AI',
    sectorZh: '雲端與企業 AI',
    color: '#00a4ef',
    lotStep: 1
  },
  {
    symbol: 'META',
    yahooSymbol: 'META',
    name: 'Meta Platforms Inc.',
    nameZh: 'Meta (臉書母公司)',
    category: 'us-stock',
    subSector: 'mag7',
    sector: 'Social & AI Ads',
    sectorZh: '社群與 AI 廣告巨頭',
    color: '#0668e1',
    lotStep: 1
  },
  {
    symbol: 'AMZN',
    yahooSymbol: 'AMZN',
    name: 'Amazon.com Inc.',
    nameZh: '亞馬遜 (Amazon)',
    category: 'us-stock',
    subSector: 'mag7',
    sector: 'Cloud & E-Commerce',
    sectorZh: 'AWS 雲端與電商',
    color: '#ff9900',
    lotStep: 1
  },
  {
    symbol: 'GOOGL',
    yahooSymbol: 'GOOGL',
    name: 'Alphabet Inc.',
    nameZh: 'Google (Alphabet)',
    category: 'us-stock',
    subSector: 'mag7',
    sector: 'Search & Cloud AI',
    sectorZh: '搜尋引擎與 Gemini AI',
    color: '#4285f4',
    lotStep: 1
  },
  {
    symbol: 'QQQ',
    yahooSymbol: 'QQQ',
    name: 'Invesco QQQ Trust',
    nameZh: '那斯達克 100 ETF (QQQ)',
    category: 'us-etf',
    subSector: 'etf',
    sector: 'Nasdaq-100 Index',
    sectorZh: '美股科技指數 ETF',
    color: '#00d2ff',
    lotStep: 1
  },
  {
    symbol: 'SPY',
    yahooSymbol: 'SPY',
    name: 'SPDR S&P 500 ETF',
    nameZh: '標普 500 大盤 ETF (SPY)',
    category: 'us-etf',
    subSector: 'etf',
    sector: 'S&P 500 Benchmark',
    sectorZh: '美股大盤基準 ETF',
    color: '#f59e0b',
    lotStep: 1,
    isBenchmark: true
  },
  {
    symbol: 'XAUUSD',
    yahooSymbol: 'GC=F',
    displayTicker: 'XAUUSD (Gold)',
    name: 'Gold Spot / Futures (XAU/USD)',
    nameZh: '黃金現貨 XAU/USD (Gold)',
    category: 'commodity',
    subSector: 'macro',
    sector: 'Precious Metal Safe Haven',
    sectorZh: '國際黃金避險資產',
    color: '#fbbf24',
    lotStep: 0.1
  },
  {
    symbol: 'BTC-USD',
    yahooSymbol: 'BTC-USD',
    name: 'Bitcoin / USD',
    nameZh: '比特幣 (Bitcoin)',
    category: 'crypto',
    subSector: 'macro',
    sector: 'Digital Gold (Crypto)',
    sectorZh: '加密貨幣龍頭',
    color: '#f7931a',
    lotStep: 0.001
  },
  {
    symbol: 'ETH-USD',
    yahooSymbol: 'ETH-USD',
    name: 'Ethereum / USD',
    nameZh: '以太幣 (Ethereum)',
    category: 'crypto',
    subSector: 'macro',
    sector: 'Smart Contracts (Crypto)',
    sectorZh: '智慧合約公鏈',
    color: '#627eea',
    lotStep: 0.01
  }
];

export const BENCHMARK_SYMBOL = 'SPY';

export function getAssetMeta(symbol) {
  return (
    ASSET_UNIVERSE.find((a) => a.symbol === symbol) || {
      symbol,
      yahooSymbol: symbol,
      displayTicker: symbol,
      name: symbol,
      nameZh: symbol,
      category: symbol.includes('-USD') ? 'crypto' : 'us-stock',
      subSector: 'other',
      sector: 'Market Asset',
      sectorZh: '市場標的',
      color: '#38bdf8',
      lotStep: symbol.includes('-USD') ? 0.001 : 1
    }
  );
}
