"use client";

import { useState } from "react";
import useSWR from "swr";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  DropdownMenu,
  DropdownMenuTrigger,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
} from "@/components/ui/dropdown-menu";
import { AccountStatusBadge } from "@/components/accounts/AccountStatus";
import { AccountDialog } from "@/components/accounts/AccountDialog";
import { DeleteAccountDialog } from "@/components/accounts/DeleteAccountDialog";
import {
  SEGMENT_LABELS,
  type TradingAccountWithRelations,
  type AccountStatus,
} from "@/types";
import { cn } from "@/lib/utils";
import {
  PlusIcon,
  MoreVerticalIcon,
  PencilIcon,
  ShieldCheckIcon,
  TrashIcon,
  ToggleLeftIcon,
  ToggleRightIcon,
} from "lucide-react";

const fetcher = (url: string) => fetch(url).then((r) => r.json());

interface Props {
  initialAccounts: TradingAccountWithRelations[];
}

export function AccountsClient({ initialAccounts }: Props) {
  const { data: accounts, mutate } = useSWR<TradingAccountWithRelations[]>(
    "/api/accounts",
    fetcher,
    { fallbackData: initialAccounts, refreshInterval: 30000 }
  );

  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingAccount, setEditingAccount] =
    useState<TradingAccountWithRelations | null>(null);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [deletingAccount, setDeletingAccount] =
    useState<TradingAccountWithRelations | null>(null);

  function handleEdit(account: TradingAccountWithRelations) {
    setEditingAccount(account);
    setDialogOpen(true);
  }

  function handleAdd() {
    setEditingAccount(null);
    setDialogOpen(true);
  }

  function handleDelete(account: TradingAccountWithRelations) {
    setDeletingAccount(account);
    setDeleteDialogOpen(true);
  }

  async function handleValidate(account: TradingAccountWithRelations) {
    handleEdit(account);
  }

  async function handleToggleActive(account: TradingAccountWithRelations) {
    await fetch("/api/accounts", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id: account.id, active: !account.active }),
    });
    mutate();
  }

  function hasCredentials(config: Record<string, unknown> | null): boolean {
    if (!config || typeof config !== "object") return false;
    const c = config as Record<string, unknown>;
    if (!c.credentials || typeof c.credentials !== "object") return false;
    const creds = c.credentials as Record<string, string>;
    return Object.values(creds).some(
      (v) => typeof v === "string" && v.length > 0
    );
  }

  function getDisplayStatus(account: TradingAccountWithRelations): AccountStatus {
    if (account.status && account.status !== "disconnected") {
      return account.status;
    }
    return hasCredentials(account.config) ? "disconnected" : "disconnected";
  }

  const list = accounts ?? initialAccounts;

  return (
    <>
      <div className="flex items-center justify-between mb-4">
        <Button size="sm" onClick={handleAdd}>
          <PlusIcon className="size-3.5" />
          Add Account
        </Button>
      </div>

      {list.length === 0 ? (
        <div className="flex flex-col items-center justify-center rounded-lg border border-dashed border-border/60 bg-card/50 py-12 px-6">
          <div className="mb-4 flex h-12 w-12 items-center justify-center rounded-full bg-muted text-muted-foreground">
            <PlusIcon className="size-5" />
          </div>
          <h3 className="text-sm font-medium text-foreground mb-1">
            Connect Your Exchange
          </h3>
          <p className="text-xs text-muted-foreground text-center max-w-md mb-1">
            Link your Binance account to start trading. You can use testnet credentials to practice with paper money first.
          </p>
          <ol className="text-[11px] text-muted-foreground text-left mb-4 space-y-1 max-w-sm">
            <li>1. Click &quot;Add Account&quot; below</li>
            <li>2. Enter your API Key and Secret from Binance</li>
            <li>3. Validate to confirm the connection</li>
          </ol>
          <Button size="sm" onClick={handleAdd}>
            <PlusIcon className="size-3.5" />
            Add Your First Account
          </Button>
          <a
            href="https://testnet.binance.vision"
            target="_blank"
            rel="noopener noreferrer"
            className="mt-3 text-[10px] text-muted-foreground hover:text-foreground underline"
          >
            Need testnet keys? Create them on Binance Testnet
          </a>
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-3 lg:grid-cols-2">
          {list.map((acct) => (
            <div
              key={acct.id}
              className={cn(
                "rounded-lg border border-border/50 p-4 space-y-3 transition-colors",
                !acct.active && "opacity-60"
              )}
            >
              {/* Header */}
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <h3 className="font-semibold text-sm">{acct.name}</h3>
                  <Badge variant="secondary" className="text-[10px]">
                    {acct.venue}
                  </Badge>
                  {acct.testnet && (
                    <Badge variant="mock" className="text-[10px]">
                      Testnet
                    </Badge>
                  )}
                </div>
                <DropdownMenu>
                  <DropdownMenuTrigger
                    render={
                      <Button variant="ghost" size="icon-xs" />
                    }
                  >
                    <MoreVerticalIcon className="size-3.5" />
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="end">
                    <DropdownMenuItem onClick={() => handleEdit(acct)}>
                      <PencilIcon />
                      Edit Credentials
                    </DropdownMenuItem>
                    <DropdownMenuItem onClick={() => handleValidate(acct)}>
                      <ShieldCheckIcon />
                      Validate
                    </DropdownMenuItem>
                    <DropdownMenuItem onClick={() => handleToggleActive(acct)}>
                      {acct.active ? (
                        <>
                          <ToggleLeftIcon />
                          Deactivate
                        </>
                      ) : (
                        <>
                          <ToggleRightIcon />
                          Activate
                        </>
                      )}
                    </DropdownMenuItem>
                    <DropdownMenuSeparator />
                    <DropdownMenuItem
                      variant="destructive"
                      onClick={() => handleDelete(acct)}
                    >
                      <TrashIcon />
                      Delete
                    </DropdownMenuItem>
                  </DropdownMenuContent>
                </DropdownMenu>
              </div>

              {/* Segments */}
              <div className="flex flex-wrap gap-1.5">
                {acct.segments.length === 0 ? (
                  <span className="text-[11px] text-muted-foreground italic">
                    No segments configured
                  </span>
                ) : (
                  acct.segments.map((seg) => (
                    <span
                      key={seg}
                      className="rounded-md border border-border/50 px-2 py-0.5 text-[11px] text-muted-foreground"
                    >
                      {SEGMENT_LABELS[seg] ?? seg}
                    </span>
                  ))
                )}
              </div>

              {/* Status + Permissions + Strategy count */}
              <div className="flex items-center justify-between text-xs text-muted-foreground">
                <div className="flex items-center gap-3">
                  <AccountStatusBadge
                    status={getDisplayStatus(acct)}
                    statusMessage={acct.statusMessage}
                  />
                  {acct.permissions?.length > 0 && (
                    <div className="flex gap-1">
                      {acct.permissions.map((p) => (
                        <Badge
                          key={p}
                          variant="running"
                          className="text-[10px]"
                        >
                          {p}
                        </Badge>
                      ))}
                    </div>
                  )}
                </div>
                <div className="flex items-center gap-3">
                  {acct._count && acct._count.strategies > 0 && (
                    <span>
                      {acct._count.strategies}{" "}
                      {acct._count.strategies === 1
                        ? "strategy"
                        : "strategies"}
                    </span>
                  )}
                  {acct.lastCheckedAt && (
                    <span className="text-[10px]">
                      Checked{" "}
                      {new Date(acct.lastCheckedAt).toLocaleDateString()}
                    </span>
                  )}
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Add/Edit Dialog */}
      <AccountDialog
        open={dialogOpen}
        onOpenChange={setDialogOpen}
        account={editingAccount}
        onSaved={() => mutate()}
      />

      {/* Delete Dialog */}
      {deletingAccount && (
        <DeleteAccountDialog
          account={deletingAccount}
          open={deleteDialogOpen}
          onOpenChange={setDeleteDialogOpen}
          onDeleted={() => mutate()}
        />
      )}
    </>
  );
}
