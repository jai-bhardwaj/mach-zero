"use client";

import { useState } from "react";
import useSWR, { mutate } from "swr";
import { cn } from "@/lib/utils";
import { Badge } from "@/components/ui/badge";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

const fetcher = (url: string) => fetch(url).then((r) => r.json());

type Tab = "channels" | "alerts" | "logs";

interface Channel {
  id: string;
  name: string;
  type: "EMAIL" | "WEBHOOK" | "SLACK";
  config: Record<string, unknown>;
  enabled: boolean;
  createdAt: string;
}

interface Alert {
  id: string;
  name: string;
  trigger: string;
  conditions: Record<string, unknown>;
  channelId: string;
  channel: { name: string; type: string };
  enabled: boolean;
}

interface LogEntry {
  id: string;
  subject: string;
  body: string;
  status: string;
  error: string | null;
  sentAt: string;
  channel: { name: string; type: string };
  alert: { name: string; trigger: string } | null;
}

const TRIGGER_LABELS: Record<string, string> = {
  RISK_BREACH: "Risk Breach",
  KILL_SWITCH: "Kill Switch",
  ORDER_FILL: "Order Fill",
  STRATEGY_STATUS_CHANGE: "Strategy Status",
  PNL_THRESHOLD: "P&L Threshold",
  DRAWDOWN_THRESHOLD: "Drawdown",
};

export function NotificationsClient() {
  const [tab, setTab] = useState<Tab>("channels");
  const [showChannelForm, setShowChannelForm] = useState(false);
  const [showAlertForm, setShowAlertForm] = useState(false);

  return (
    <div className="space-y-6 p-6">
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-semibold text-zinc-100">Notifications</h1>
        {tab === "channels" && (
          <button
            onClick={() => setShowChannelForm(true)}
            className="rounded-md bg-accent px-3 py-1.5 text-sm text-white hover:bg-accent/80"
          >
            Add Channel
          </button>
        )}
        {tab === "alerts" && (
          <button
            onClick={() => setShowAlertForm(true)}
            className="rounded-md bg-accent px-3 py-1.5 text-sm text-white hover:bg-accent/80"
          >
            Add Alert
          </button>
        )}
      </div>

      {/* Tabs */}
      <div className="flex gap-1 rounded-lg bg-zinc-900 p-1">
        {(["channels", "alerts", "logs"] as Tab[]).map((t) => (
          <button
            key={t}
            onClick={() => setTab(t)}
            className={cn(
              "flex-1 rounded-md px-3 py-1.5 text-sm font-medium transition-colors",
              tab === t
                ? "bg-zinc-800 text-zinc-100"
                : "text-zinc-500 hover:text-zinc-300"
            )}
          >
            {t.charAt(0).toUpperCase() + t.slice(1)}
          </button>
        ))}
      </div>

      {tab === "channels" && <ChannelsList />}
      {tab === "alerts" && <AlertsList />}
      {tab === "logs" && <LogsList />}

      <ChannelFormDialog
        open={showChannelForm}
        onClose={() => setShowChannelForm(false)}
      />
      <AlertFormDialog
        open={showAlertForm}
        onClose={() => setShowAlertForm(false)}
      />
    </div>
  );
}

function ChannelsList() {
  const { data, isLoading } = useSWR<Channel[]>(
    "/api/notifications/channels",
    fetcher
  );

  if (isLoading) return <Skeleton />;
  if (!data?.length)
    return (
      <p className="py-8 text-center text-sm text-zinc-500">
        No channels configured
      </p>
    );

  return (
    <div className="space-y-2">
      {data.map((ch) => (
        <div
          key={ch.id}
          className="flex items-center justify-between rounded-lg border border-border bg-card p-3"
        >
          <div className="flex items-center gap-3">
            <span
              className={cn(
                "h-2 w-2 rounded-full",
                ch.enabled ? "bg-green-400" : "bg-zinc-600"
              )}
            />
            <div>
              <p className="text-sm font-medium text-zinc-200">{ch.name}</p>
              <p className="text-xs text-zinc-500">{ch.type}</p>
            </div>
          </div>
          <ToggleButton channelId={ch.id} enabled={ch.enabled} />
        </div>
      ))}
    </div>
  );
}

function AlertsList() {
  const { data, isLoading } = useSWR<Alert[]>(
    "/api/notifications/alerts",
    fetcher
  );

  if (isLoading) return <Skeleton />;
  if (!data?.length)
    return (
      <p className="py-8 text-center text-sm text-zinc-500">
        No alert rules configured
      </p>
    );

  return (
    <div className="space-y-2">
      {data.map((alert) => (
        <div
          key={alert.id}
          className="flex items-center justify-between rounded-lg border border-border bg-card p-3"
        >
          <div className="flex items-center gap-3">
            <span
              className={cn(
                "h-2 w-2 rounded-full",
                alert.enabled ? "bg-green-400" : "bg-zinc-600"
              )}
            />
            <div>
              <p className="text-sm font-medium text-zinc-200">{alert.name}</p>
              <div className="flex items-center gap-2">
                <Badge variant="secondary" className="text-[10px]">
                  {TRIGGER_LABELS[alert.trigger] ?? alert.trigger}
                </Badge>
                <span className="text-xs text-zinc-500">
                  → {alert.channel.name}
                </span>
              </div>
            </div>
          </div>
        </div>
      ))}
    </div>
  );
}

function LogsList() {
  const { data, isLoading } = useSWR<LogEntry[]>(
    "/api/notifications/logs",
    fetcher
  );

  if (isLoading) return <Skeleton />;
  if (!data?.length)
    return (
      <p className="py-8 text-center text-sm text-zinc-500">
        No notifications sent yet
      </p>
    );

  return (
    <div className="space-y-2">
      {data.map((log) => (
        <div
          key={log.id}
          className="rounded-lg border border-border bg-card p-3"
        >
          <div className="flex items-center justify-between">
            <p className="text-sm font-medium text-zinc-200">{log.subject}</p>
            <Badge
              variant={log.status === "sent" ? "default" : "destructive"}
              className="text-[10px]"
            >
              {log.status}
            </Badge>
          </div>
          <div className="mt-1 flex items-center gap-2 text-xs text-zinc-500">
            <span>{log.channel.name}</span>
            <span>·</span>
            <span>{new Date(log.sentAt).toLocaleString()}</span>
            {log.error && (
              <span className="text-red-400">Error: {log.error}</span>
            )}
          </div>
        </div>
      ))}
    </div>
  );
}

function ToggleButton({
  channelId,
  enabled,
}: {
  channelId: string;
  enabled: boolean;
}) {
  const toggle = async () => {
    await fetch("/api/notifications/channels", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id: channelId, enabled: !enabled }),
    });
    mutate("/api/notifications/channels");
  };

  return (
    <button
      onClick={toggle}
      className={cn(
        "rounded px-2 py-1 text-xs",
        enabled
          ? "bg-green-900/30 text-green-400"
          : "bg-zinc-800 text-zinc-500"
      )}
    >
      {enabled ? "Enabled" : "Disabled"}
    </button>
  );
}

function ChannelFormDialog({
  open,
  onClose,
}: {
  open: boolean;
  onClose: () => void;
}) {
  const [name, setName] = useState("");
  const [type, setType] = useState("EMAIL");
  const [configValue, setConfigValue] = useState("");
  const [loading, setLoading] = useState(false);

  const configField =
    type === "EMAIL"
      ? "email"
      : type === "WEBHOOK"
        ? "webhookUrl"
        : "slackWebhookUrl";
  const placeholder =
    type === "EMAIL"
      ? "alerts@example.com"
      : type === "WEBHOOK"
        ? "https://hooks.example.com/..."
        : "https://hooks.slack.com/...";

  const submit = async () => {
    setLoading(true);
    await fetch("/api/notifications/channels", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name, type, config: { [configField]: configValue } }),
    });
    mutate("/api/notifications/channels");
    setName("");
    setConfigValue("");
    setLoading(false);
    onClose();
  };

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="max-w-sm">
        <DialogHeader>
          <DialogTitle>Add Channel</DialogTitle>
        </DialogHeader>
        <div className="space-y-3">
          <input
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="Channel name"
            className="w-full rounded-md border border-border bg-zinc-900 px-3 py-2 text-sm text-zinc-100"
          />
          <select
            value={type}
            onChange={(e) => setType(e.target.value)}
            className="w-full rounded-md border border-border bg-zinc-900 px-3 py-2 text-sm text-zinc-100"
          >
            <option value="EMAIL">Email</option>
            <option value="WEBHOOK">Webhook</option>
            <option value="SLACK">Slack</option>
          </select>
          <input
            value={configValue}
            onChange={(e) => setConfigValue(e.target.value)}
            placeholder={placeholder}
            className="w-full rounded-md border border-border bg-zinc-900 px-3 py-2 text-sm text-zinc-100"
          />
          <button
            onClick={submit}
            disabled={!name || !configValue || loading}
            className="w-full rounded-md bg-accent px-3 py-2 text-sm text-white hover:bg-accent/80 disabled:opacity-50"
          >
            {loading ? "Creating..." : "Create Channel"}
          </button>
        </div>
      </DialogContent>
    </Dialog>
  );
}

function AlertFormDialog({
  open,
  onClose,
}: {
  open: boolean;
  onClose: () => void;
}) {
  const [name, setName] = useState("");
  const [trigger, setTrigger] = useState("KILL_SWITCH");
  const [channelId, setChannelId] = useState("");
  const [loading, setLoading] = useState(false);

  const { data: channels } = useSWR<Channel[]>(
    open ? "/api/notifications/channels" : null,
    fetcher
  );

  const submit = async () => {
    setLoading(true);
    await fetch("/api/notifications/alerts", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name, trigger, channelId, conditions: {} }),
    });
    mutate("/api/notifications/alerts");
    setName("");
    setLoading(false);
    onClose();
  };

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="max-w-sm">
        <DialogHeader>
          <DialogTitle>Add Alert Rule</DialogTitle>
        </DialogHeader>
        <div className="space-y-3">
          <input
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="Alert name"
            className="w-full rounded-md border border-border bg-zinc-900 px-3 py-2 text-sm text-zinc-100"
          />
          <select
            value={trigger}
            onChange={(e) => setTrigger(e.target.value)}
            className="w-full rounded-md border border-border bg-zinc-900 px-3 py-2 text-sm text-zinc-100"
          >
            {Object.entries(TRIGGER_LABELS).map(([val, label]) => (
              <option key={val} value={val}>
                {label}
              </option>
            ))}
          </select>
          <select
            value={channelId}
            onChange={(e) => setChannelId(e.target.value)}
            className="w-full rounded-md border border-border bg-zinc-900 px-3 py-2 text-sm text-zinc-100"
          >
            <option value="">Select channel</option>
            {channels?.map((ch) => (
              <option key={ch.id} value={ch.id}>
                {ch.name} ({ch.type})
              </option>
            ))}
          </select>
          <button
            onClick={submit}
            disabled={!name || !channelId || loading}
            className="w-full rounded-md bg-accent px-3 py-2 text-sm text-white hover:bg-accent/80 disabled:opacity-50"
          >
            {loading ? "Creating..." : "Create Alert"}
          </button>
        </div>
      </DialogContent>
    </Dialog>
  );
}

function Skeleton() {
  return (
    <div className="space-y-2">
      {[...Array(3)].map((_, i) => (
        <div key={i} className="h-14 animate-pulse rounded-lg bg-zinc-800" />
      ))}
    </div>
  );
}
