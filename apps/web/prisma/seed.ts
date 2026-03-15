import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

async function main() {
  // Create default tenant
  const tenant = await prisma.tenant.upsert({
    where: { slug: "default" },
    update: {},
    create: {
      name: "Default",
      slug: "default",
    },
  });

  // Create super admin user (password not used — auth via Google/Apple/email)
  await prisma.user.upsert({
    where: { email: "0987sujals@gmail.com" },
    update: { role: "SUPER_ADMIN", onboardingComplete: true },
    create: {
      username: "sujal",
      email: "0987sujals@gmail.com",
      password: "",
      role: "SUPER_ADMIN",
      tenantId: tenant.id,
      onboardingComplete: true,
    },
  });

  // Create demo trading account
  const account = await prisma.tradingAccount.upsert({
    where: { tenantId_name: { tenantId: tenant.id, name: "Binance Main" } },
    update: {},
    create: {
      name: "Binance Main",
      venue: "Binance",
      segments: ["crypto-spot"],
      tenantId: tenant.id,
      config: {
        credentials: {
          apiKey: "demo-api-key-not-real",
          apiSecret: "demo-api-secret-not-real",
        },
      },
    },
  });

  // Create demo strategy config (uses new status field)
  const strategy = await prisma.strategyConfig.upsert({
    where: { tenantId_name: { tenantId: tenant.id, name: "spread-btcusdt" } },
    update: {},
    create: {
      name: "spread-btcusdt",
      type: "SimpleSpreadStrategy",
      symbolId: 1,
      symbolName: "BTCUSDT",
      venue: "Binance",
      status: "RUNNING",
      params: {
        spreadOffset: 100000000,
        orderQuantity: 1000000,
      },
      maxPositionLimit: 10.0,
      maxDrawdown: 5000,
      riskMultiplier: 1.0,
      tenantId: tenant.id,
      accountId: account.id,
    },
  });

  // Create capital pool for the account
  const pool = await prisma.capitalPool.upsert({
    where: {
      tenantId_accountId: { tenantId: tenant.id, accountId: account.id },
    },
    update: {},
    create: {
      tenantId: tenant.id,
      accountId: account.id,
      totalCapital: 100000,
      allocatedTotal: 25000,
      reservedMargin: 5000,
      currency: "USD",
    },
  });

  // Allocate capital to the strategy
  await prisma.capitalAllocation.upsert({
    where: { strategyId: strategy.id },
    update: {},
    create: {
      poolId: pool.id,
      strategyId: strategy.id,
      allocatedAmt: 25000,
      usedMargin: 5000,
    },
  });

  // Strategy marketplace templates
  const templates = [
    {
      name: "BTC Spread Maker",
      slug: "btc-spread-maker",
      description:
        "Automated market making on BTC/USDT with tight spreads. Profits from bid-ask spread capture in trending and range-bound markets.",
      longDescription:
        "A conservative market making strategy that places symmetric limit orders around the mid-price on BTC/USDT. Uses adaptive spread widening during high volatility periods and tightens during calm markets. Built-in inventory management prevents excessive directional exposure.",
      type: "SimpleSpreadStrategy",
      category: "MARKET_MAKING" as const,
      riskLevel: "LOW" as const,
      params: { spreadOffset: 80000000, orderQuantity: 500000 },
      symbolIds: [1],
      returnPct: 8.4,
      winRate: 72.3,
      maxDrawdown: 1200,
      sharpeRatio: 2.1,
      totalTrades: 15420,
      featured: true,
      minCapital: 10000,
      maxDrawdownPct: 5.0,
    },
    {
      name: "ETH Momentum Rider",
      slug: "eth-momentum-rider",
      description:
        "Captures ETH/USDT momentum breakouts using a 20-period moving window with adaptive thresholds.",
      longDescription:
        "Trend-following momentum strategy that identifies breakout patterns in ETH/USDT using statistical momentum indicators. Enters positions when price momentum exceeds the adaptive threshold and exits on mean reversion signals.",
      type: "MomentumStrategy",
      category: "MOMENTUM" as const,
      riskLevel: "MEDIUM" as const,
      params: { windowSize: 20, threshold: 50000000, orderQuantity: 1000000 },
      symbolIds: [2],
      returnPct: 15.7,
      winRate: 58.1,
      maxDrawdown: 3400,
      sharpeRatio: 1.65,
      totalTrades: 892,
      featured: true,
      minCapital: 15000,
      maxDrawdownPct: 10.0,
    },
    {
      name: "Cross-Pair Arbitrage",
      slug: "cross-pair-arbitrage",
      description:
        "Exploits price discrepancies between BTC/USDT and ETH/USDT pairs using statistical correlation analysis.",
      longDescription:
        "Statistical arbitrage strategy that monitors the price ratio between BTC and ETH. When the ratio deviates beyond historical norms, it simultaneously goes long the undervalued asset and short the overvalued one.",
      type: "SimpleSpreadStrategy",
      category: "ARBITRAGE" as const,
      riskLevel: "LOW" as const,
      params: { spreadOffset: 120000000, orderQuantity: 750000 },
      symbolIds: [1, 2],
      returnPct: 6.2,
      winRate: 81.5,
      maxDrawdown: 800,
      sharpeRatio: 2.8,
      totalTrades: 4210,
      featured: false,
      minCapital: 25000,
      maxDrawdownPct: 3.0,
    },
    {
      name: "Mean Reversion Alpha",
      slug: "mean-reversion-alpha",
      description:
        "Mean reversion strategy on BTC/USDT that fades extreme moves and profits from price normalization.",
      longDescription:
        "Identifies when BTC/USDT has moved significantly away from its short-term moving average and takes contrarian positions expecting a return to the mean. Uses Bollinger Band-like deviation thresholds and adaptive position sizing.",
      type: "MomentumStrategy",
      category: "MEAN_REVERSION" as const,
      riskLevel: "MEDIUM" as const,
      params: { windowSize: 30, threshold: 75000000, orderQuantity: 800000 },
      symbolIds: [1],
      returnPct: 11.3,
      winRate: 66.8,
      maxDrawdown: 2100,
      sharpeRatio: 1.92,
      totalTrades: 2340,
      featured: false,
      minCapital: 12000,
      maxDrawdownPct: 8.0,
    },
    {
      name: "RELIANCE Spread Engine",
      slug: "reliance-spread-engine",
      description:
        "Market making strategy optimized for RELIANCE on NSE with conservative risk parameters.",
      longDescription:
        "Designed specifically for Indian equity markets, this strategy provides liquidity on RELIANCE by maintaining two-sided quotes. Adapts to NSE trading hours and handles pre-open/close auction periods.",
      type: "SimpleSpreadStrategy",
      category: "MARKET_MAKING" as const,
      riskLevel: "LOW" as const,
      params: { spreadOffset: 50000000, orderQuantity: 1000000 },
      symbolIds: [100],
      returnPct: 5.8,
      winRate: 74.2,
      maxDrawdown: 950,
      sharpeRatio: 2.35,
      totalTrades: 8920,
      featured: false,
      minCapital: 50000,
      maxDrawdownPct: 4.0,
    },
    {
      name: "TCS Momentum Breakout",
      slug: "tcs-momentum-breakout",
      description:
        "Momentum strategy targeting TCS breakouts on NSE using intraday momentum signals.",
      longDescription:
        "Monitors TCS for intraday momentum breakouts using a combination of volume surge detection and price momentum. Enters positions on confirmed breakouts with tight stop-losses. Designed for single-session trading.",
      type: "MomentumStrategy",
      category: "TREND_FOLLOWING" as const,
      riskLevel: "HIGH" as const,
      params: { windowSize: 10, threshold: 30000000, orderQuantity: 2000000 },
      symbolIds: [101],
      returnPct: 22.1,
      winRate: 48.5,
      maxDrawdown: 5200,
      sharpeRatio: 1.15,
      totalTrades: 456,
      featured: true,
      minCapital: 30000,
      maxDrawdownPct: 15.0,
    },
    {
      name: "Multi-Asset Stat Arb",
      slug: "multi-asset-stat-arb",
      description:
        "Statistical arbitrage across crypto and equity pairs using z-score divergence signals.",
      longDescription:
        "Advanced statistical strategy that monitors price relationships across multiple asset classes. Computes rolling z-scores of price ratios and enters mean-reversion trades when divergence exceeds configurable thresholds.",
      type: "SimpleSpreadStrategy",
      category: "STATISTICAL" as const,
      riskLevel: "HIGH" as const,
      params: { spreadOffset: 150000000, orderQuantity: 500000 },
      symbolIds: [1, 2, 100, 101, 102],
      returnPct: 18.9,
      winRate: 55.3,
      maxDrawdown: 4800,
      sharpeRatio: 1.42,
      totalTrades: 1680,
      featured: false,
      minCapital: 50000,
      maxDrawdownPct: 12.0,
    },
    {
      name: "ETH Market Maker Pro",
      slug: "eth-market-maker-pro",
      description:
        "Professional-grade ETH/USDT market making with dynamic inventory management and volatility-adjusted spreads.",
      longDescription:
        "Enterprise-level market making strategy for ETH/USDT with sophisticated inventory skewing. Automatically widens spreads during high-volatility regimes and narrows during stable periods.",
      type: "SimpleSpreadStrategy",
      category: "MARKET_MAKING" as const,
      riskLevel: "MEDIUM" as const,
      params: { spreadOffset: 90000000, orderQuantity: 1500000 },
      symbolIds: [2],
      returnPct: 10.6,
      winRate: 69.7,
      maxDrawdown: 2800,
      sharpeRatio: 1.88,
      totalTrades: 22140,
      featured: false,
      minCapital: 20000,
      maxDrawdownPct: 7.0,
    },
  ];

  for (const t of templates) {
    await prisma.strategyTemplate.upsert({
      where: { name: t.name },
      update: {},
      create: t,
    });
  }

  console.log(
    "Seed complete: tenant, admin user, account, strategy, capital pool, allocation, 8 marketplace templates created."
  );
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
