"use client";

import { useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
  DialogClose,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import {
  VENUE_SEGMENTS,
  VENUE_CREDENTIAL_FIELDS,
  type Venue,
  type TradingAccountWithRelations,
  type AccountValidationResult,
} from "@/types";
import { cn } from "@/lib/utils";
import {
  EyeIcon,
  EyeOffIcon,
  CheckCircle2Icon,
  XCircleIcon,
  LoaderIcon,
} from "lucide-react";

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  account?: TradingAccountWithRelations | null;
  onSaved: () => void;
}

const VENUES: Venue[] = ["Binance", "NSE"];

export function AccountDialog({ open, onOpenChange, account, onSaved }: Props) {
  const isEditing = !!account;

  const [name, setName] = useState(account?.name ?? "");
  const [venue, setVenue] = useState<Venue>(
    (account?.venue as Venue) ?? "Binance"
  );
  const [selectedSegments, setSelectedSegments] = useState<string[]>(
    account?.segments ?? []
  );
  const [credentials, setCredentials] = useState<Record<string, string>>({});
  const [showSecrets, setShowSecrets] = useState<Record<string, boolean>>({});
  const [loading, setLoading] = useState(false);
  const [validating, setValidating] = useState(false);
  const [validationResult, setValidationResult] =
    useState<AccountValidationResult | null>(null);
  const [error, setError] = useState<string | null>(null);

  const credentialFields = VENUE_CREDENTIAL_FIELDS[venue] ?? [];
  const segments = VENUE_SEGMENTS[venue] ?? [];

  function toggleSegment(value: string) {
    setSelectedSegments((prev) =>
      prev.includes(value)
        ? prev.filter((s) => s !== value)
        : [...prev, value]
    );
  }

  function handleCredentialChange(key: string, value: string) {
    setCredentials((prev) => ({ ...prev, [key]: value }));
    setValidationResult(null);
  }

  async function handleValidate() {
    setValidating(true);
    setValidationResult(null);
    setError(null);
    try {
      const res = await fetch("/api/accounts/validate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          apiKey: credentials.apiKey,
          apiSecret: credentials.apiSecret,
          testnet: true,
        }),
      });
      const data: AccountValidationResult = await res.json();
      setValidationResult(data);
    } catch {
      setValidationResult({ valid: false, error: "Validation request failed" });
    } finally {
      setValidating(false);
    }
  }

  async function handleSave(withValidation: boolean) {
    setLoading(true);
    setError(null);

    // Validate if requested and not already validated
    if (withValidation && venue === "Binance" && !validationResult?.valid) {
      await handleValidate();
      // Re-check after validation
      setLoading(false);
      return;
    }

    try {
      const body: Record<string, unknown> = {
        name: name.trim(),
        venue,
        segments: selectedSegments,
        testnet: true,
      };

      // Only include credentials if user entered values
      const hasCredentials = Object.values(credentials).some(
        (v) => v.length > 0
      );
      if (hasCredentials) {
        body.credentials = credentials;
      }

      if (isEditing) {
        body.id = account.id;
        if (validationResult?.valid) {
          body.status = "connected";
          body.statusMessage = null;
          body.permissions = validationResult.permissions ?? [];
        }
      }

      const res = await fetch("/api/accounts", {
        method: isEditing ? "PUT" : "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });

      if (!res.ok) {
        const data = await res.json();
        setError(data.error ?? "Failed to save account");
        return;
      }

      // If we validated and created, update status
      if (!isEditing && validationResult?.valid) {
        const created = await res.json();
        await fetch("/api/accounts", {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            id: created.id,
            status: "connected",
            statusMessage: null,
            permissions: validationResult.permissions ?? [],
          }),
        });
      }

      onOpenChange(false);
      resetForm();
      onSaved();
    } catch {
      setError("Failed to save account");
    } finally {
      setLoading(false);
    }
  }

  function resetForm() {
    if (!isEditing) {
      setName("");
      setVenue("Binance");
      setSelectedSegments([]);
      setCredentials({});
      setShowSecrets({});
      setValidationResult(null);
      setError(null);
    }
  }

  const canValidate =
    venue === "Binance" &&
    credentials.apiKey?.length > 0 &&
    credentials.apiSecret?.length > 0;

  const canSave =
    name.trim().length >= 2 && selectedSegments.length > 0;

  return (
    <Dialog
      open={open}
      onOpenChange={(o) => {
        onOpenChange(o);
        if (!o) resetForm();
      }}
    >
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>
            {isEditing ? "Edit Trading Account" : "Add Trading Account"}
          </DialogTitle>
          <DialogDescription>
            {isEditing
              ? "Update your exchange account credentials."
              : "Connect an exchange account to start trading."}
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          {/* Account Name */}
          <div className="space-y-1.5">
            <Label htmlFor="account-name">Account Name</Label>
            <Input
              id="account-name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="e.g. My Binance Testnet"
              disabled={isEditing}
              required
              minLength={2}
            />
          </div>

          {/* Venue Selection */}
          {!isEditing && (
            <div className="space-y-1.5">
              <Label>Exchange</Label>
              <div className="flex gap-2">
                {VENUES.map((v) => (
                  <button
                    key={v}
                    type="button"
                    onClick={() => {
                      setVenue(v);
                      setSelectedSegments([]);
                      setCredentials({});
                      setValidationResult(null);
                    }}
                    className={cn(
                      "rounded-lg border px-3 py-1.5 text-sm transition-colors",
                      venue === v
                        ? "border-accent bg-accent/10 text-accent"
                        : "border-border text-muted-foreground hover:text-foreground"
                    )}
                  >
                    {v}
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* Segments */}
          {!isEditing && (
            <div className="space-y-1.5">
              <Label>Market Segments</Label>
              <div className="flex flex-wrap gap-2">
                {segments.map((seg) => (
                  <button
                    key={seg.value}
                    type="button"
                    onClick={() => toggleSegment(seg.value)}
                    className={cn(
                      "rounded-lg border px-2.5 py-1 text-xs transition-colors",
                      selectedSegments.includes(seg.value)
                        ? "border-accent bg-accent/10 text-accent"
                        : "border-border text-muted-foreground hover:text-foreground"
                    )}
                  >
                    {seg.label}
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* Testnet Badge */}
          <div className="flex items-center gap-2">
            <Badge variant="mock">Testnet</Badge>
            <span className="text-[11px] text-muted-foreground">
              All accounts use testnet by default
            </span>
          </div>

          {/* Credential Fields */}
          <div className="space-y-3">
            <Label>API Credentials</Label>
            {credentialFields.map((field) => (
              <div key={field.key} className="space-y-1">
                <label
                  htmlFor={`cred-${field.key}`}
                  className="text-xs text-muted-foreground"
                >
                  {field.label}
                  {field.required && (
                    <span className="text-red-400 ml-0.5">*</span>
                  )}
                </label>
                <div className="relative">
                  <Input
                    id={`cred-${field.key}`}
                    type={
                      field.type === "password" && !showSecrets[field.key]
                        ? "password"
                        : "text"
                    }
                    value={credentials[field.key] ?? ""}
                    onChange={(e) =>
                      handleCredentialChange(field.key, e.target.value)
                    }
                    placeholder={
                      isEditing
                        ? "Enter new value to update"
                        : field.placeholder
                    }
                  />
                  {field.type === "password" && (
                    <button
                      type="button"
                      onClick={() =>
                        setShowSecrets((prev) => ({
                          ...prev,
                          [field.key]: !prev[field.key],
                        }))
                      }
                      className="absolute right-2 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                    >
                      {showSecrets[field.key] ? (
                        <EyeOffIcon className="size-3.5" />
                      ) : (
                        <EyeIcon className="size-3.5" />
                      )}
                    </button>
                  )}
                </div>
              </div>
            ))}
          </div>

          {/* Validate Button (Binance only) */}
          {venue === "Binance" && (
            <div className="space-y-2">
              <Button
                variant="outline"
                size="sm"
                onClick={handleValidate}
                disabled={!canValidate || validating}
                className="w-full"
              >
                {validating ? (
                  <>
                    <LoaderIcon className="size-3.5 animate-spin" />
                    Validating...
                  </>
                ) : (
                  "Validate Credentials"
                )}
              </Button>

              {/* Validation Result */}
              {validationResult && (
                <div
                  className={cn(
                    "rounded-md border px-3 py-2 text-xs",
                    validationResult.valid
                      ? "border-green-500/30 bg-green-900/10 text-green-400"
                      : "border-red-500/30 bg-red-900/10 text-red-400"
                  )}
                >
                  <div className="flex items-center gap-1.5">
                    {validationResult.valid ? (
                      <CheckCircle2Icon className="size-3.5" />
                    ) : (
                      <XCircleIcon className="size-3.5" />
                    )}
                    <span className="font-medium">
                      {validationResult.valid
                        ? "Credentials valid"
                        : validationResult.error ?? "Invalid credentials"}
                    </span>
                  </div>
                  {validationResult.valid && validationResult.permissions && (
                    <div className="mt-1.5 flex gap-1.5">
                      {validationResult.permissions.map((p) => (
                        <Badge key={p} variant="running" className="text-[10px]">
                          {p}
                        </Badge>
                      ))}
                    </div>
                  )}
                </div>
              )}
            </div>
          )}

          {/* Error */}
          {error && (
            <div className="rounded-md border border-red-500/30 bg-red-900/10 px-3 py-2 text-xs text-red-400">
              {error}
            </div>
          )}
        </div>

        <DialogFooter>
          <DialogClose render={<Button variant="outline" />}>Cancel</DialogClose>
          <div className="flex gap-2">
            <Button
              variant="outline"
              size="default"
              onClick={() => handleSave(false)}
              disabled={!canSave || loading}
            >
              Save without validating
            </Button>
            <Button
              onClick={() => handleSave(true)}
              disabled={!canSave || loading}
            >
              {loading ? "Saving..." : "Validate & Save"}
            </Button>
          </div>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
