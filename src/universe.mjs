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

/**
 * External US Stock Discovery Pool (清單外潛力美股探索池)
 * Strictly separate from ASSET_UNIVERSE so the AI can scan real US stocks NOT in the active watchlist
 * and forecast the Top 5 Most Promising External US Stocks for the next 30 days.
 */
export const DISCOVERY_CANDIDATE_UNIVERSE = [
  {
    symbol: 'PLTR',
    yahooSymbol: 'PLTR',
    displayTicker: 'PLTR',
    name: 'Palantir Technologies Inc.',
    nameZh: '帕蘭泰爾 (Palantir AI)',
    category: 'us-stock',
    subSector: 'discovery',
    sector: 'Enterprise & Defense AI Software',
    sectorZh: 'AI 國防與企業決策軟體龍頭',
    thesisZh: 'AIP 生成式 AI 決策平台商業化加速，美國政府與企業大單帶動獲利爆發',
    color: '#38bdf8',
    lotStep: 1,
    isExternalDiscovery: true
  },
  {
    symbol: 'TSM',
    yahooSymbol: 'TSM',
    displayTicker: 'TSM (台積電ADR)',
    name: 'Taiwan Semiconductor ADR',
    nameZh: '台積電美股 ADR (TSMC)',
    category: 'us-stock',
    subSector: 'discovery',
    sector: 'Foundry & CoWoS Packaging Leader',
    sectorZh: '全球先進製程與 CoWoS 獨佔晶圓代工',
    thesisZh: '全球 AI 晶片 2nm/3nm 與 CoWoS 先進封裝唯一核心樞紐，定價權極強',
    color: '#ef4444',
    lotStep: 1,
    isExternalDiscovery: true
  },
  {
    symbol: 'AVGO',
    yahooSymbol: 'AVGO',
    displayTicker: 'AVGO',
    name: 'Broadcom Inc.',
    nameZh: '博通 (Broadcom ASIC)',
    category: 'us-stock',
    subSector: 'discovery',
    sector: 'Custom AI ASIC & Networking',
    sectorZh: '雲端客製化 AI ASIC 與高速網通晶片',
    thesisZh: 'CSP 雲端巨頭自研 AI ASIC (XPU) 與乙太網路交換晶片最大受惠霸主',
    color: '#dc2626',
    lotStep: 1,
    isExternalDiscovery: true
  },
  {
    symbol: 'CRWD',
    yahooSymbol: 'CRWD',
    displayTicker: 'CRWD',
    name: 'CrowdStrike Holdings Inc.',
    nameZh: 'CrowdStrike (AI 雲端資安)',
    category: 'us-stock',
    subSector: 'discovery',
    sector: 'AI Cybersecurity Platform',
    sectorZh: '全球 AI 端點資安與雲端防禦龍頭',
    thesisZh: 'Falcon 平台整合 Charlotte AI 自動化資安防禦，大型企業訂閱續約率領先全產業',
    color: '#f43f5e',
    lotStep: 1,
    isExternalDiscovery: true
  },
  {
    symbol: 'ARM',
    yahooSymbol: 'ARM',
    displayTicker: 'ARM',
    name: 'Arm Holdings plc',
    nameZh: '安謀 (Arm 矽智財霸主)',
    category: 'us-stock',
    subSector: 'discovery',
    sector: 'Semiconductor IP & Edge AI',
    sectorZh: '全球 CPU 架構矽智財與邊緣 AI 核心',
    thesisZh: 'Armv9 架構權利金費率翻倍，並快速滲透雲端資料中心伺服器與邊緣 AI 手機',
    color: '#0091bd',
    lotStep: 1,
    isExternalDiscovery: true
  },
  {
    symbol: 'VST',
    yahooSymbol: 'VST',
    displayTicker: 'VST (AI電力)',
    name: 'Vistra Corp.',
    nameZh: 'Vistra (北美 AI 核能電力巨頭)',
    category: 'us-stock',
    subSector: 'discovery',
    sector: 'AI Data Center Nuclear & Power',
    sectorZh: 'AI 資料中心核能與基載電力供應商',
    thesisZh: 'AI 算力中心用電需求激增，具備零碳核能發電資產與高溢價長約優勢',
    color: '#22c55e',
    lotStep: 1,
    isExternalDiscovery: true
  },
  {
    symbol: 'APP',
    yahooSymbol: 'APP',
    displayTicker: 'APP',
    name: 'AppLovin Corp.',
    nameZh: 'AppLovin (AXON AI 廣告引擎)',
    category: 'us-stock',
    subSector: 'discovery',
    sector: 'AI AdTech & Monetization Engine',
    sectorZh: 'AI 演算法廣告變現高成長黑馬',
    thesisZh: 'AXON 2.0 AI 推薦引擎推升廣告轉換率與自由現金流，業務擴張至電商領域',
    color: '#8b5cf6',
    lotStep: 1,
    isExternalDiscovery: true
  },
  {
    symbol: 'NFLX',
    yahooSymbol: 'NFLX',
    displayTicker: 'NFLX',
    name: 'Netflix Inc.',
    nameZh: 'Netflix (全球串流與廣告巨頭)',
    category: 'us-stock',
    subSector: 'discovery',
    sector: 'Global Streaming & Ad Tier',
    sectorZh: '全球影音串流與廣告變現霸主',
    thesisZh: '廣告訂閱層級與體育直播賽事帶動訂戶與 ARPU 雙成長，具備極強抗景氣韌性',
    color: '#e50914',
    lotStep: 1,
    isExternalDiscovery: true
  },
  {
    symbol: 'NET',
    yahooSymbol: 'NET',
    displayTicker: 'NET',
    name: 'Cloudflare Inc.',
    nameZh: 'Cloudflare (邊緣 AI 雲端網路)',
    category: 'us-stock',
    subSector: 'discovery',
    sector: 'Edge AI Inference & Zero Trust',
    sectorZh: '全球邊緣 AI 推論與零信任網路平台',
    thesisZh: 'Workers AI 讓企業在全球邊緣節點低延遲執行 AI 模型推論，開發者生態高速擴張',
    color: '#f97316',
    lotStep: 1,
    isExternalDiscovery: true
  },
  {
    symbol: 'COIN',
    yahooSymbol: 'COIN',
    displayTicker: 'COIN',
    name: 'Coinbase Global Inc.',
    nameZh: 'Coinbase (合規加密金融樞紐)',
    category: 'us-stock',
    subSector: 'discovery',
    sector: 'Institutional Crypto & Base L2',
    sectorZh: '全美最大合規加密交易所與鏈上基建',
    thesisZh: '華爾街現貨 ETF 託管龍頭、USDC 穩定幣分潤與 Base 二層網路手續費多元成長',
    color: '#2563eb',
    lotStep: 1,
    isExternalDiscovery: true
  }
];

export const ALL_SYNC_ASSETS = [...ASSET_UNIVERSE, ...DISCOVERY_CANDIDATE_UNIVERSE];

export const BENCHMARK_SYMBOL = 'SPY';

export function getAssetMeta(symbol) {
  return (
    ASSET_UNIVERSE.find((a) => a.symbol === symbol) ||
    DISCOVERY_CANDIDATE_UNIVERSE.find((a) => a.symbol === symbol) || {
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
