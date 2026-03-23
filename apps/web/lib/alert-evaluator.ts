import "server-only";
import { prisma } from "@/lib/db";
import { sendNotification } from "@/lib/notifications";

type AlertTriggerType =
  | "RISK_BREACH"
  | "KILL_SWITCH"
  | "ORDER_FILL"
  | "STRATEGY_STATUS_CHANGE"
  | "PNL_THRESHOLD"
  | "DRAWDOWN_THRESHOLD";

interface AlertEvent {
  type: AlertTriggerType;
  tenantId: string;
  data: Record<string, unknown>;
}

/**
 * Evaluate all matching alerts for an event and send notifications.
 * Called from API routes when events occur (kill switch, risk breach, etc.)
 */
export async function evaluateAlerts(event: AlertEvent): Promise<void> {
  try {
    const alerts = await prisma.alert.findMany({
      where: {
        tenantId: event.tenantId,
        trigger: event.type,
        enabled: true,
      },
      include: {
        channel: true,
      },
    });

    for (const alert of alerts) {
      const conditions = alert.conditions as Record<string, unknown>;
      const matches = evaluateConditions(conditions, event.data);

      if (matches) {
        const subject = formatSubject(event.type, event.data);
        const body = formatBody(event.type, event.data, alert.name);

        await sendNotification(
          {
            id: alert.channel.id,
            tenantId: alert.tenantId,
            name: alert.channel.name,
            type: alert.channel.type as "EMAIL" | "WEBHOOK" | "SLACK",
            config: alert.channel.config as Record<string, unknown>,
            enabled: alert.channel.enabled,
          },
          subject,
          body,
          alert.id
        );
      }
    }
  } catch (err) {
    console.error("[alert-evaluator] Error evaluating alerts:", err);
  }
}

function evaluateConditions(
  conditions: Record<string, unknown>,
  data: Record<string, unknown>
): boolean {
  // If no conditions, always match (e.g., "notify on any kill switch")
  if (!conditions || Object.keys(conditions).length === 0) return true;

  const threshold = conditions.threshold as number | undefined;
  const comparison = (conditions.comparison as string) ?? "gt";
  const field = (conditions.field as string) ?? "value";
  const value = data[field] as number | undefined;

  if (threshold === undefined || value === undefined) return true;

  switch (comparison) {
    case "gt":
      return value > threshold;
    case "gte":
      return value >= threshold;
    case "lt":
      return value < threshold;
    case "lte":
      return value <= threshold;
    case "eq":
      return value === threshold;
    default:
      return true;
  }
}

function formatSubject(type: AlertTriggerType, data: Record<string, unknown>): string {
  switch (type) {
    case "KILL_SWITCH":
      return "Kill Switch Activated";
    case "RISK_BREACH":
      return `Risk Breach: ${data.reason ?? "limit exceeded"}`;
    case "ORDER_FILL":
      return `Order Filled: ${data.symbol ?? ""}`;
    case "PNL_THRESHOLD":
      return `P&L Threshold: ${data.value ?? ""}`;
    case "DRAWDOWN_THRESHOLD":
      return `Drawdown Alert: ${data.value ?? ""}`;
    case "STRATEGY_STATUS_CHANGE":
      return `Strategy ${data.status ?? "changed"}: ${data.name ?? ""}`;
    default:
      return `Alert: ${type}`;
  }
}

function formatBody(
  type: AlertTriggerType,
  data: Record<string, unknown>,
  alertName: string
): string {
  const timestamp = new Date().toISOString();
  const details = Object.entries(data)
    .map(([k, v]) => `  ${k}: ${v}`)
    .join("\n");

  return `Alert: ${alertName}\nType: ${type}\nTime: ${timestamp}\n\nDetails:\n${details}`;
}
