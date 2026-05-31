import { NextRequest, NextResponse } from "next/server";
import { requireAuth, isAuthError } from "@/lib/require-auth";
import { spawn } from "child_process";

const BACKTEST_CLI = process.env.BACKTEST_CLI_PATH ?? "backtest_cli";
const TIMEOUT_MS = 60_000;
const MAX_OUTPUT = 10 * 1024 * 1024; // 10MB

// Run the backtest CLI, piping the JSON config to its stdin. backtest_cli reads
// its config from stdin (`echo '{...}' | backtest_cli`). The promisified
// execFile can't supply stdin, so the previous code ran the CLI with no input —
// the binary then blocked on an empty stdin until the 60s timeout and the
// user's parameters never reached it, so every run silently fell back to random
// simulated data. spawn + write-to-stdin delivers the config and lets the CLI
// return immediately.
function runBacktestCli(input: string): Promise<string> {
  return new Promise((resolve, reject) => {
    const child = spawn(BACKTEST_CLI, [], { env: { ...process.env } });
    let stdout = "";
    let stderr = "";
    let settled = false;
    const finish = (fn: () => void) => {
      if (settled) return;
      settled = true;
      clearTimeout(timer);
      fn();
    };
    const timer = setTimeout(() => {
      child.kill("SIGKILL");
      finish(() => reject(new Error(`backtest timed out after ${TIMEOUT_MS}ms`)));
    }, TIMEOUT_MS);

    child.stdout.on("data", (d) => {
      stdout += d;
      if (stdout.length > MAX_OUTPUT) {
        child.kill("SIGKILL");
        finish(() => reject(new Error("backtest output exceeded limit")));
      }
    });
    child.stderr.on("data", (d) => {
      stderr += d;
    });
    child.on("error", (err) => finish(() => reject(err)));
    child.on("close", (code) =>
      finish(() => {
        if (stderr) console.warn("[backtest] stderr:", stderr);
        if (code !== 0) reject(new Error(`backtest exited with code ${code}`));
        else resolve(stdout);
      })
    );

    // Pipe the config to the CLI and signal EOF.
    child.stdin.on("error", () => {
      /* ignore EPIPE if the child exits before we finish writing */
    });
    child.stdin.end(input);
  });
}

// POST /api/backtest — run a backtest via C++ CLI
export async function POST(request: NextRequest) {
  try {
    const session = await requireAuth("SUPER_ADMIN", "ADMIN", "TRADER");
    if (isAuthError(session)) return session;

    const body = await request.json();
    const {
      strategy,
      symbolId,
      symbolName,
      startTime,
      endTime,
      params,
      numTrades,
    } = body;

    if (!strategy || !symbolId) {
      return NextResponse.json(
        { error: "strategy and symbolId are required" },
        { status: 400 }
      );
    }

    const input = JSON.stringify({
      strategy,
      symbolId,
      symbolName: symbolName ?? "BTCUSDT",
      startTime: startTime ?? 0,
      endTime: endTime ?? Date.now(),
      params: params ?? {},
      numTrades: numTrades ?? 500,
    });

    try {
      const stdout = await runBacktestCli(input);
      const results = JSON.parse(stdout);
      return NextResponse.json(results);
    } catch (cliError) {
      // Fallback: generate simulated backtest results for development
      console.warn(
        "[backtest] CLI not available, using simulated results:",
        cliError instanceof Error ? cliError.message : cliError
      );

      const results = generateSimulatedResults(
        strategy,
        symbolName ?? "BTCUSDT",
        numTrades ?? 500,
      );
      return NextResponse.json(results);
    }
  } catch {
    return NextResponse.json(
      { error: "Backtest failed" },
      { status: 500 }
    );
  }
}

// Simulated results for development when C++ CLI isn't available
function generateSimulatedResults(
  strategy: string,
  symbol: string,
  numTrades: number,
) {
  const trades: Array<{
    timestamp: number;
    side: string;
    price: number;
    quantity: number;
    pnl: number;
  }> = [];

  let equity = 10000;
  let maxEquity = equity;
  let maxDrawdown = 0;
  let grossProfit = 0;
  let grossLoss = 0;
  const equityCurve: Array<{ timestamp: number; equity: number }> = [];
  const basePrice = symbol.includes("BTC") ? 50000 : symbol.includes("ETH") ? 3000 : 100;

  for (let i = 0; i < numTrades; i++) {
    const timestamp = Date.now() - (numTrades - i) * 60000;
    const pnl = (Math.random() - 0.48) * basePrice * 0.002;
    const side = Math.random() > 0.5 ? "BUY" : "SELL";
    const price = basePrice * (1 + (Math.random() - 0.5) * 0.02);

    equity += pnl;
    if (equity > maxEquity) maxEquity = equity;
    const dd = (maxEquity - equity) / maxEquity;
    if (dd > maxDrawdown) maxDrawdown = dd;
    if (pnl > 0) grossProfit += pnl;
    else grossLoss += Math.abs(pnl);

    trades.push({
      timestamp,
      side,
      price: Math.round(price * 100) / 100,
      quantity: Math.round(Math.random() * 10 * 1000) / 1000,
      pnl: Math.round(pnl * 100) / 100,
    });

    equityCurve.push({ timestamp, equity: Math.round(equity * 100) / 100 });
  }

  const wins = trades.filter((t) => t.pnl > 0).length;
  const totalPnl = equity - 10000;

  return {
    strategy,
    symbol,
    simulated: true,
    totalPnl: Math.round(totalPnl * 100) / 100,
    winRate: Math.round((wins / numTrades) * 10000) / 100,
    sharpeRatio:
      Math.round(
        (totalPnl /
          Math.max(
            1,
            Math.sqrt(
              trades.reduce((s, t) => s + t.pnl * t.pnl, 0) / numTrades
            )
          )) *
          100
      ) / 100,
    maxDrawdown: Math.round(maxDrawdown * 10000) / 100,
    profitFactor:
      grossLoss > 0
        ? Math.round((grossProfit / grossLoss) * 100) / 100
        : 999,
    totalTrades: numTrades,
    wins,
    losses: numTrades - wins,
    equityCurve,
    trades: trades.slice(-100), // Last 100 trades
  };
}
