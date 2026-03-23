import "server-only";
import { prisma } from "@/lib/db";

interface NotificationChannel {
  id: string;
  tenantId: string;
  name: string;
  type: "EMAIL" | "WEBHOOK" | "SLACK";
  config: Record<string, unknown>;
  enabled: boolean;
}

/**
 * Send a notification through a channel and log the result.
 */
export async function sendNotification(
  channel: NotificationChannel,
  subject: string,
  body: string,
  alertId?: string
): Promise<boolean> {
  if (!channel.enabled) return false;

  let status = "sent";
  let error: string | undefined;

  try {
    switch (channel.type) {
      case "EMAIL":
        await sendEmail(channel.config, subject, body);
        break;
      case "WEBHOOK":
        await sendWebhook(channel.config, subject, body);
        break;
      case "SLACK":
        await sendSlack(channel.config, subject, body);
        break;
      default:
        throw new Error(`Unknown channel type: ${channel.type}`);
    }
  } catch (err) {
    status = "failed";
    error = err instanceof Error ? err.message : "Unknown error";
  }

  // Log the notification
  await prisma.notificationLog.create({
    data: {
      tenantId: channel.tenantId,
      channelId: channel.id,
      alertId,
      subject,
      body,
      status,
      error,
    },
  });

  return status === "sent";
}

// Email via Resend API
async function sendEmail(
  config: Record<string, unknown>,
  subject: string,
  body: string
) {
  const apiKey = process.env.RESEND_API_KEY;
  if (!apiKey) throw new Error("RESEND_API_KEY not configured");

  const to = config.email as string;
  if (!to) throw new Error("No email address configured");

  const response = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${apiKey}`,
    },
    body: JSON.stringify({
      from: (config.from as string) || "Mach-Zero <alerts@machzero.io>",
      to: [to],
      subject,
      text: body,
    }),
  });

  if (!response.ok) {
    const err = await response.text();
    throw new Error(`Resend API error: ${err}`);
  }
}

// Webhook via POST
async function sendWebhook(
  config: Record<string, unknown>,
  subject: string,
  body: string
) {
  const url = config.webhookUrl as string;
  if (!url) throw new Error("No webhook URL configured");

  const response = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      event: "mach_zero_alert",
      subject,
      body,
      timestamp: new Date().toISOString(),
    }),
    signal: AbortSignal.timeout(10000),
  });

  if (!response.ok) {
    throw new Error(`Webhook returned ${response.status}`);
  }
}

// Slack via incoming webhook
async function sendSlack(
  config: Record<string, unknown>,
  subject: string,
  body: string
) {
  const url = config.slackWebhookUrl as string;
  if (!url) throw new Error("No Slack webhook URL configured");

  const response = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      blocks: [
        {
          type: "header",
          text: { type: "plain_text", text: `⚡ ${subject}` },
        },
        {
          type: "section",
          text: { type: "mrkdwn", text: body },
        },
      ],
    }),
    signal: AbortSignal.timeout(10000),
  });

  if (!response.ok) {
    throw new Error(`Slack webhook returned ${response.status}`);
  }
}
