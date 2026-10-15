/**
 * Real-World Asset Universe (US Equities, ETFs & Crypto)
 * All symbols map directly to Yahoo Finance tickers for real OHLCV market data.
 */
export const ASSET_UNIVERSE = [
  {
    symbol: 'NVDA',
    name: 'NVIDIA Corp.',
    nameZh: '輝達 (NVIDIA)',
    category: 'us-stock',
    sector: 'AI & Semiconductors',
    sectorZh: 'AI 與半導體',
    color: '#76b900',
    lotStep: 1
  },
  {
    symbol: 'TSLA',
    name: 'Tesla Inc.',
    nameZh: '特斯拉 (Tesla)',
    category: 'us-stock',
    sector: 'EV & Robotics',
    sectorZh: '電動車與機器人',
    color: '#e82127',
    lotStep: 1
  },
  {
    symbol: 'AAPL',
    name: 'Apple Inc.',
    nameZh: '蘋果 (Apple)',
    category: 'us-stock',
    sector: 'Consumer Tech',
    sectorZh: '消費性科技巨頭',
    color: '#a2aaad',
    lotStep: 1
  },
  {
    symbol: 'MSFT',
    name: 'Microsoft Corp.',
    nameZh: '微軟 (Microsoft)',
    category: 'us-stock',
    sector: 'Cloud & Enterprise AI',
    sectorZh: '雲端與企業 AI',
    color: '#00a4ef',
    lotStep: 1
  },
  {
    symbol: 'META',
    name: 'Meta Platforms Inc.',
    nameZh: 'Meta (臉書母公司)',
    category: 'us-stock',
    sector: 'Social & AI Ads',
    sectorZh: '社群與 AI 廣告',
    color: '#0668e1',
    lotStep: 1
  },
  {
    symbol: 'AMZN',
    name: 'Amazon.com Inc.',
    nameZh: '亞馬遜 (Amazon)',
    category: 'us-stock',
    sector: 'Cloud & E-Commerce',
    sectorZh: 'AWS 雲端與電商',
    color: '#ff9900',
    lotStep: 1
  },
  {
    symbol: 'GOOGL',
    name: 'Alphabet Inc.',
    nameZh: 'Google (Alphabet)',
    category: 'us-stock',
    sector: 'Search & Cloud AI',
    sectorZh: '搜尋引擎與雲端 AI',
    color: '#4285f4',
    lotStep: 1
  },
  {
    symbol: 'QQQ',
    name: 'Invesco QQQ Trust',
    nameZh: '那斯達克 100 ETF (QQQ)',
    category: 'us-etf',
    sector: 'Nasdaq-100 Index',
    sectorZh: '美股科技指數 ETF',
    color: '#00d2ff',
    lotStep: 1
  },
  {
    symbol: 'SPY',
    name: 'SPDR S&P 500 ETF',
    nameZh: '標普 500 大盤 ETF (SPY)',
    category: 'us-etf',
    sector: 'S&P 500 Benchmark',
    sectorZh: '美股大盤基準 ETF',
    color: '#f59e0b',
    lotStep: 1,
    isBenchmark: true
  },
  {
    symbol: 'BTC-USD',
    name: 'Bitcoin / USD',
    nameZh: '比特幣 (Bitcoin)',
    category: 'crypto',
    sector: 'Digital Gold (Crypto)',
    sectorZh: '加密貨幣龍頭',
    color: '#f7931a',
    lotStep: 0.001
  },
  {
    symbol: 'ETH-USD',
    name: 'Ethereum / USD',
    nameZh: '以太幣 (Ethereum)',
    category: 'crypto',
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
      name: symbol,
      nameZh: symbol,
      category: symbol.includes('-USD') ? 'crypto' : 'us-stock',
      sector: 'Market Asset',
      sectorZh: '市場標的',
      color: '#38bdf8',
      lotStep: symbol.includes('-USD') ? 0.001 : 1
    }
  );
}
