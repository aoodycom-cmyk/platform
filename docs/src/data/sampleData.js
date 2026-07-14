export const starterUniverse = [
  {
    ticker: "NVDA",
    name: "NVIDIA Corporation",
    sector: "Technology",
    industry: "Semiconductors",
    currency: "USD",
    exchange: "NASDAQ"
  },
  {
    ticker: "MSFT",
    name: "Microsoft Corporation",
    sector: "Technology",
    industry: "Software",
    currency: "USD",
    exchange: "NASDAQ"
  },
  {
    ticker: "AAPL",
    name: "Apple Inc.",
    sector: "Technology",
    industry: "Consumer Electronics",
    currency: "USD",
    exchange: "NASDAQ"
  },
  {
    ticker: "AMZN",
    name: "Amazon.com, Inc.",
    sector: "Consumer Discretionary",
    industry: "Internet Retail",
    currency: "USD",
    exchange: "NASDAQ"
  }
];

export const sampleUniverse = starterUniverse;

export function createCompanyShell(ticker = "NVDA") {
  const cleanTicker = String(ticker || "NVDA").trim().toUpperCase();
  const metadata = starterUniverse.find((company) => company.ticker === cleanTicker) || {
    ticker: cleanTicker,
    name: cleanTicker,
    sector: "Unknown",
    industry: "Unknown",
    currency: "USD",
    exchange: ""
  };
  return {
    ...metadata,
    quote: {
      price: null,
      marketCap: null,
      changePercent: null,
      enterpriseValue: null,
      updatedAt: null
    },
    consensus: {
      target: null,
      low: null,
      high: null,
      rating: ""
    },
    financials: [],
    qualitative: {
      moatSignals: [],
      riskSignals: [],
      managementNotes: []
    },
    researchProfile: {
      source: "Missing",
      updatedAt: null,
      businessSummary: null,
      businessModel: null,
      revenueSegments: [],
      geographicExposure: [],
      customers: [],
      competitiveAdvantages: [],
      keyProducts: [],
      management: [],
      competitors: [],
      marketShare: [],
      competitiveStrengths: [],
      competitiveWeaknesses: [],
      peerComparison: []
    },
    earningsCenter: {},
    analystResearch: {},
    researchTimeline: []
  };
}

export function getSampleCompany(ticker = "NVDA") {
  return createCompanyShell(ticker);
}
