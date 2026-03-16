# Mach-Zero Web Dashboard

Next.js 16 web dashboard for the Mach-Zero algorithmic trading system. Manages strategies, trading accounts, risk controls, and real-time market data visualization.

## Quick Start

```bash
npm install --legacy-peer-deps
cp .env.example .env.local    # Fill in your env vars
npx prisma db push
npx tsx prisma/seed.ts
npm run dev
```

Open [http://localhost:3000](http://localhost:3000).

## Features

- **Dashboard** — Live market data, P&L, positions via WebSocket
- **Strategies** — Create, configure, start/stop with mock/live trading modes
- **Marketplace** — Pre-built strategy templates with backtest performance metrics
- **Risk Management** — Kill switch, square-off positions, risk event log
- **Accounts** — Connect Binance (API keys) and NSE (broker credentials)
- **Capital Management** — Pool-based allocation per strategy with margin tracking
- **Settings** — Theme customization, workspace configuration

## Tech Stack

- **Framework**: Next.js 16 (App Router, React Server Components)
- **Styling**: Tailwind CSS 4, dark mode
- **Database**: Prisma ORM + PostgreSQL (Aiven)
- **Auth**: NextAuth.js (Google OAuth + magic link email)
- **Real-time**: SWR polling + WebSocket (Python bridge)
- **UI**: Base UI components, Lucide icons

## Deployment

Deployed on **Vercel** (free tier). Root directory set to `apps/web`.

```bash
npx vercel --yes --prod
```

See the [main README](../../README.md) for environment variable reference.

## Scripts

| Command | Description |
|---|---|
| `npm run dev` | Start dev server |
| `npm run build` | Production build |
| `npm run lint` | Run ESLint |
| `npm test` | Run Vitest tests |
| `npm run db:push` | Push Prisma schema to DB |
| `npm run db:seed` | Seed database |
| `npm run db:generate` | Generate Prisma client |
