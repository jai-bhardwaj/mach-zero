import "server-only";
import { prisma } from "@/lib/db";

/**
 * Attach strategy/account/mode attribution to QuestDB execution rows.
 *
 * QuestDB stores only the integer strategy_id (the engine strategy id carried
 * on the SBE hot path). This joins it back to Postgres — scoped to the given
 * tenant so one tenant can never resolve another tenant's strategy names — and
 * fills in strategy_name, account_name, and the authoritative trading_mode.
 */
export async function attachStrategyInfo<
  T extends { strategy_id?: string; trading_mode?: string }
>(rows: T[], tenantId: string): Promise<(T & { strategy_name?: string; account_name?: string })[]> {
  const engineIds = [
    ...new Set(
      rows
        .map((r) => Number(r.strategy_id))
        .filter((n) => Number.isFinite(n) && n > 0)
    ),
  ];
  if (engineIds.length === 0) return rows;

  const strategies = await prisma.strategyConfig.findMany({
    where: { tenantId, engineId: { in: engineIds } },
    select: {
      engineId: true,
      name: true,
      tradingMode: true,
      account: { select: { name: true } },
    },
  });
  const byEngineId = new Map(strategies.map((s) => [s.engineId, s]));

  return rows.map((r) => {
    const s = byEngineId.get(Number(r.strategy_id));
    return s
      ? { ...r, strategy_name: s.name, account_name: s.account?.name, trading_mode: s.tradingMode }
      : r;
  });
}
