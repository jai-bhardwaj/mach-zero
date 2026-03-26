"use client";

import { useState, useCallback } from "react";
import { useRouter } from "next/navigation";
import { useSession } from "next-auth/react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { VENUE_SEGMENTS, VENUE_CREDENTIAL_FIELDS, type Venue } from "@/types";
import {
  Building2,
  Wallet,
  Cpu,
  Check,
  ArrowRight,
  Loader2,
  SkipForward,
  Eye,
  EyeOff,
} from "lucide-react";
import { cn } from "@/lib/utils";

interface StrategyTemplate {
  id: string;
  name: string;
  slug: string;
  description: string;
  category: string;
  riskLevel: string;
  symbolIds: number[];
  returnPct: number;
  winRate: number;
  sharpeRatio: number;
  featured: boolean;
  minCapital: number;
}

interface Props {
  templates: StrategyTemplate[];
}

type Step = 1 | 2 | 3 | 4;

const STEPS = [
  { number: 1, label: "Workspace", icon: Building2 },
  { number: 2, label: "Exchange", icon: Wallet },
  { number: 3, label: "Strategy", icon: Cpu },
] as const;

const VENUES: { value: Venue; label: string; description: string }[] = [
  { value: "Binance", label: "Binance", description: "Crypto exchange" },
  { value: "NSE", label: "NSE", description: "India equity" },
];

const RISK_STYLES: Record<string, { bg: string; text: string }> = {
  LOW: { bg: "bg-green-900/30", text: "text-green-400" },
  MEDIUM: { bg: "bg-yellow-900/30", text: "text-yellow-400" },
  HIGH: { bg: "bg-red-900/30", text: "text-red-400" },
};

export function OnboardingWizard({ templates }: Props) {
  const router = useRouter();
  const { update: updateSession } = useSession();

  const [step, setStep] = useState<Step>(1);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Step 1 state
  const [workspaceName, setWorkspaceName] = useState("");

  // Step 2 state
  const [accountName, setAccountName] = useState("");
  const [venue, setVenue] = useState<Venue>("Binance");
  const [selectedSegments, setSelectedSegments] = useState<string[]>([]);
  const [credentials, setCredentials] = useState<Record<string, string>>({});
  const [showPasswords, setShowPasswords] = useState<Record<string, boolean>>(
    {}
  );
  const [accountId, setAccountId] = useState<string | null>(null);

  // Step 3 state
  const [selectedTemplate, setSelectedTemplate] = useState<string | null>(null);

  // Get segments and credential fields for current venue
  const venueSegments = VENUE_SEGMENTS[venue];
  const credentialFields = VENUE_CREDENTIAL_FIELDS[venue];

  const toggleSegment = useCallback((value: string) => {
    setSelectedSegments((prev) =>
      prev.includes(value)
        ? prev.filter((s) => s !== value)
        : [...prev, value]
    );
  }, []);

  const updateCredential = useCallback((key: string, value: string) => {
    setCredentials((prev) => ({ ...prev, [key]: value }));
  }, []);

  const togglePasswordVisibility = useCallback((key: string) => {
    setShowPasswords((prev) => ({ ...prev, [key]: !prev[key] }));
  }, []);

  // Check if all required credentials are filled
  const requiredCredsFilled = credentialFields
    .filter((f) => f.required)
    .every((f) => credentials[f.key]?.trim());

  const handleCreateWorkspace = async () => {
    if (!workspaceName.trim()) return;
    setLoading(true);
    setError(null);

    try {
      const res = await fetch("/api/onboarding/workspace", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: workspaceName.trim() }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error || "Failed to create workspace");
        return;
      }
      // Refresh session to pick up new tenantId and role
      await updateSession();
      setStep(2);
    } catch {
      setError("Something went wrong. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  const handleCreateAccount = async () => {
    if (!accountName.trim() || selectedSegments.length === 0) return;
    setLoading(true);
    setError(null);

    try {
      // Only send non-empty credentials
      const filledCredentials: Record<string, string> = {};
      for (const [key, value] of Object.entries(credentials)) {
        if (value.trim()) {
          filledCredentials[key] = value.trim();
        }
      }

      const res = await fetch("/api/onboarding/account", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: accountName.trim(),
          venue,
          segments: selectedSegments,
          credentials:
            Object.keys(filledCredentials).length > 0
              ? filledCredentials
              : undefined,
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error || "Failed to create account");
        return;
      }
      setAccountId(data.id);
      setStep(3);
    } catch {
      setError("Something went wrong. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  const handleSubscribe = async (templateId: string) => {
    if (!accountId) return;
    setLoading(true);
    setError(null);

    try {
      const res = await fetch("/api/marketplace/subscribe", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ templateId, accountId }),
      });
      if (!res.ok) {
        const data = await res.json();
        setError(data.error || "Failed to subscribe");
        return;
      }
      await completeOnboarding();
    } catch {
      setError("Something went wrong. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  const handleSkipStrategy = async () => {
    setLoading(true);
    await completeOnboarding();
    setLoading(false);
  };

  const completeOnboarding = async () => {
    try {
      await fetch("/api/onboarding/complete", { method: "POST" });
      await updateSession();
      setStep(4);
      // Hard navigation forces server to read the fresh JWT cookie
      // (router.push uses client-side cache which has the stale token)
      setTimeout(() => {
        window.location.href = "/dashboard";
      }, 1500);
    } catch {
      setError("Failed to complete onboarding");
    }
  };

  return (
    <div className="space-y-6">
      {/* Logo */}
      <div className="text-center">
        <div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-xl bg-primary">
          <span className="text-lg font-bold text-primary-foreground">M0</span>
        </div>
        <h1 className="text-xl font-semibold tracking-tight">
          {step === 4 ? "You're all set!" : "Set up your workspace"}
        </h1>
        {step < 4 && (
          <p className="mt-1 text-sm text-muted-foreground">
            Step {step} of 3
          </p>
        )}
      </div>

      {/* Step indicator */}
      {step < 4 && (
        <div className="flex items-center justify-center gap-2">
          {STEPS.map(({ number, label, icon: Icon }) => (
            <div key={number} className="flex items-center gap-2">
              <div
                className={cn(
                  "flex h-8 w-8 items-center justify-center rounded-full text-xs font-medium transition-colors",
                  step === number
                    ? "bg-primary text-primary-foreground"
                    : step > number
                      ? "bg-green-600 text-white"
                      : "bg-muted text-muted-foreground"
                )}
              >
                {step > number ? (
                  <Check className="h-4 w-4" />
                ) : (
                  <Icon className="h-4 w-4" />
                )}
              </div>
              <span
                className={cn(
                  "hidden text-xs sm:inline",
                  step === number
                    ? "font-medium text-foreground"
                    : "text-muted-foreground"
                )}
              >
                {label}
              </span>
              {number < 3 && (
                <div className="mx-2 h-px w-8 bg-border" />
              )}
            </div>
          ))}
        </div>
      )}

      {/* Error */}
      {error && (
        <div className="rounded-lg border border-red-500/30 bg-red-900/20 px-4 py-3 text-sm text-red-400">
          {error}
        </div>
      )}

      {/* Step 1: Create workspace */}
      {step === 1 && (
        <Card>
          <CardContent className="space-y-4 p-6">
            <div>
              <h2 className="text-base font-semibold">
                Name your workspace
              </h2>
              <p className="text-sm text-muted-foreground">
                This is where your team&apos;s strategies, accounts, and
                trades live.
              </p>
            </div>
            <div className="space-y-2">
              <label
                htmlFor="workspace-name"
                className="text-sm font-medium"
              >
                Workspace name
              </label>
              <input
                id="workspace-name"
                type="text"
                value={workspaceName}
                onChange={(e) => setWorkspaceName(e.target.value)}
                placeholder="e.g. Acme Trading, My Portfolio"
                maxLength={50}
                className="w-full rounded-lg border border-border bg-background px-4 py-3 text-sm text-foreground placeholder:text-muted-foreground focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary"
                autoFocus
                onKeyDown={(e) => {
                  if (e.key === "Enter" && workspaceName.trim().length >= 2) {
                    handleCreateWorkspace();
                  }
                }}
              />
              {workspaceName.trim().length > 0 && (
                <p className="text-xs text-muted-foreground">
                  Slug:{" "}
                  <code className="rounded bg-muted px-1.5 py-0.5 font-mono">
                    {workspaceName
                      .trim()
                      .toLowerCase()
                      .replace(/[^a-z0-9]+/g, "-")
                      .replace(/^-|-$/g, "")}
                  </code>
                </p>
              )}
            </div>
            <Button
              className="w-full gap-2"
              disabled={loading || workspaceName.trim().length < 2}
              onClick={handleCreateWorkspace}
            >
              {loading ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <ArrowRight className="h-4 w-4" />
              )}
              {loading ? "Creating..." : "Create workspace"}
            </Button>
          </CardContent>
        </Card>
      )}

      {/* Step 2: Connect exchange */}
      {step === 2 && (
        <Card>
          <CardContent className="space-y-4 p-6">
            <div className="flex items-center justify-between">
              <div>
                <h2 className="text-base font-semibold">
                  Connect your exchange
                </h2>
                <p className="text-sm text-muted-foreground">
                  Add a trading account, or skip and do it later.
                </p>
              </div>
              <Button
                variant="ghost"
                size="sm"
                className="gap-1 text-muted-foreground"
                onClick={async () => {
                  setLoading(true);
                  await completeOnboarding();
                  setLoading(false);
                }}
                disabled={loading}
              >
                <SkipForward className="h-3.5 w-3.5" />
                Skip
              </Button>
            </div>

            {/* Venue picker */}
            <div className="space-y-2">
              <label className="text-sm font-medium">Exchange</label>
              <div className="grid grid-cols-2 gap-3">
                {VENUES.map((v) => (
                  <button
                    key={v.value}
                    type="button"
                    onClick={() => {
                      setVenue(v.value);
                      setSelectedSegments([]);
                      setCredentials({});
                      setShowPasswords({});
                    }}
                    className={cn(
                      "rounded-lg border p-3 text-left transition-colors",
                      venue === v.value
                        ? "border-primary bg-primary/10"
                        : "border-border hover:border-muted-foreground/50"
                    )}
                  >
                    <p className="text-sm font-medium">{v.label}</p>
                    <p className="text-xs text-muted-foreground">
                      {v.description}
                    </p>
                  </button>
                ))}
              </div>
            </div>

            {/* Account name */}
            <div className="space-y-2">
              <label
                htmlFor="account-name"
                className="text-sm font-medium"
              >
                Account name
              </label>
              <input
                id="account-name"
                type="text"
                value={accountName}
                onChange={(e) => setAccountName(e.target.value)}
                placeholder={`e.g. ${venue} Main`}
                className="w-full rounded-lg border border-border bg-background px-4 py-3 text-sm text-foreground placeholder:text-muted-foreground focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary"
              />
            </div>

            {/* Segment picker */}
            <div className="space-y-2">
              <label className="text-sm font-medium">
                Market segments
              </label>
              <p className="text-xs text-muted-foreground">
                Select the markets you want to trade in. Strategies will handle
                individual symbols.
              </p>
              <div className="flex flex-wrap gap-2">
                {venueSegments.map((seg) => (
                  <button
                    key={seg.value}
                    type="button"
                    onClick={() => toggleSegment(seg.value)}
                    className={cn(
                      "rounded-md border px-3 py-1.5 text-left transition-colors",
                      selectedSegments.includes(seg.value)
                        ? "border-primary bg-primary/10 text-primary"
                        : "border-border text-muted-foreground hover:text-foreground"
                    )}
                  >
                    <span className="text-sm">{seg.label}</span>
                    <span className="ml-1.5 text-[11px] opacity-70">
                      {seg.description}
                    </span>
                  </button>
                ))}
              </div>
            </div>

            {/* Credentials */}
            <div className="space-y-3">
              <div>
                <label className="text-sm font-medium">
                  API Credentials
                </label>
                <p className="text-xs text-muted-foreground">
                  Stored securely. You can also add these later in Settings.
                </p>
              </div>
              {credentialFields.map((field) => (
                <div key={field.key} className="space-y-1">
                  <label
                    htmlFor={`cred-${field.key}`}
                    className="flex items-center gap-1 text-xs font-medium text-muted-foreground"
                  >
                    {field.label}
                    {!field.required && (
                      <span className="text-[10px] text-muted-foreground/60">
                        (optional)
                      </span>
                    )}
                  </label>
                  <div className="relative">
                    <input
                      id={`cred-${field.key}`}
                      type={
                        field.type === "password" && !showPasswords[field.key]
                          ? "password"
                          : "text"
                      }
                      value={credentials[field.key] ?? ""}
                      onChange={(e) =>
                        updateCredential(field.key, e.target.value)
                      }
                      placeholder={field.placeholder}
                      className="w-full rounded-lg border border-border bg-background px-4 py-2.5 pr-10 text-sm text-foreground placeholder:text-muted-foreground focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary font-mono"
                    />
                    {field.type === "password" && (
                      <button
                        type="button"
                        onClick={() => togglePasswordVisibility(field.key)}
                        className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                      >
                        {showPasswords[field.key] ? (
                          <EyeOff className="h-4 w-4" />
                        ) : (
                          <Eye className="h-4 w-4" />
                        )}
                      </button>
                    )}
                  </div>
                </div>
              ))}
            </div>

            <Button
              className="w-full gap-2"
              disabled={
                loading ||
                !accountName.trim() ||
                selectedSegments.length === 0
              }
              onClick={handleCreateAccount}
            >
              {loading ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <ArrowRight className="h-4 w-4" />
              )}
              {loading ? "Creating..." : "Connect account"}
            </Button>

            {!requiredCredsFilled && selectedSegments.length > 0 && (
              <p className="text-center text-[11px] text-muted-foreground">
                Credentials are optional during onboarding. You can add them
                later in Settings.
              </p>
            )}
          </CardContent>
        </Card>
      )}

      {/* Step 3: Pick a strategy */}
      {step === 3 && (
        <Card>
          <CardContent className="space-y-4 p-6">
            <div className="flex items-center justify-between">
              <div>
                <h2 className="text-base font-semibold">
                  Pick a strategy
                </h2>
                <p className="text-sm text-muted-foreground">
                  Start with a pre-built strategy, or skip and create your
                  own later.
                </p>
              </div>
              <Button
                variant="ghost"
                size="sm"
                className="gap-1 text-muted-foreground"
                onClick={handleSkipStrategy}
                disabled={loading}
              >
                <SkipForward className="h-3.5 w-3.5" />
                Skip
              </Button>
            </div>

            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              {templates.slice(0, 6).map((t) => {
                const risk =
                  RISK_STYLES[t.riskLevel] ?? RISK_STYLES.MEDIUM;
                const isSelected = selectedTemplate === t.id;

                return (
                  <button
                    key={t.id}
                    type="button"
                    onClick={() =>
                      setSelectedTemplate(isSelected ? null : t.id)
                    }
                    className={cn(
                      "rounded-lg border p-4 text-left transition-colors",
                      isSelected
                        ? "border-primary bg-primary/10"
                        : "border-border hover:border-muted-foreground/50"
                    )}
                  >
                    <div className="flex items-start justify-between">
                      <p className="text-sm font-medium">{t.name}</p>
                      {t.featured && (
                        <Badge
                          variant="secondary"
                          className="ml-1 text-[10px]"
                        >
                          Featured
                        </Badge>
                      )}
                    </div>
                    <p className="mt-1 line-clamp-2 text-xs text-muted-foreground">
                      {t.description}
                    </p>
                    <div className="mt-2 flex items-center gap-2">
                      <Badge
                        className={cn(
                          "text-[10px]",
                          risk.bg,
                          risk.text
                        )}
                      >
                        {t.riskLevel}
                      </Badge>
                      <span className="text-xs text-green-400">
                        +{t.returnPct}%
                      </span>
                      <span className="text-xs text-muted-foreground">
                        {t.winRate}% win
                      </span>
                    </div>
                  </button>
                );
              })}
            </div>

            {selectedTemplate && (
              <Button
                className="w-full gap-2"
                disabled={loading}
                onClick={() => handleSubscribe(selectedTemplate)}
              >
                {loading ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <ArrowRight className="h-4 w-4" />
                )}
                {loading ? "Setting up..." : "Start with this strategy"}
              </Button>
            )}
          </CardContent>
        </Card>
      )}

      {/* Step 4: Done */}
      {step === 4 && (
        <Card>
          <CardContent className="flex flex-col items-center gap-4 p-8 text-center">
            <div className="flex h-16 w-16 items-center justify-center rounded-full bg-green-600">
              <Check className="h-8 w-8 text-white" />
            </div>
            <div>
              <h2 className="text-lg font-semibold">
                Your workspace is ready
              </h2>
              <p className="mt-1 text-sm text-muted-foreground">
                Taking you to the dashboard...
              </p>
            </div>
            <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
          </CardContent>
        </Card>
      )}
    </div>
  );
}
