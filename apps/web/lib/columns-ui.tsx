"use client";

import { type ColumnDef } from "@tanstack/react-table";
import type { Trade, Order, RiskEvent, SymbolState, User } from "@/types";
import {
  getSymbolName,
  getSideName,
  formatPrice,
  formatQuantity,
  formatTimestamp,
  formatPnl,
  pnlColor,
  cn,
} from "@/lib/utils";
import { Badge, type badgeVariants } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { DataTableSortHeader } from "@/components/ui/data-table-sort-header";
import { Pencil } from "lucide-react";
import type { VariantProps } from "class-variance-authority";

type BadgeVariant = NonNullable<VariantProps<typeof badgeVariants>["variant"]>;

// ── Trade Column Defs ───────────────────────────────────────────────

export function getTradeColumns(): ColumnDef<Trade, unknown>[] {
  return [
    {
      accessorKey: "timestamp",
      header: ({ column }) => <DataTableSortHeader column={column} title="Time" />,
      cell: ({ getValue }) => (
        <span className="text-muted-foreground font-mono tabular-nums text-xs">
          {formatTimestamp(getValue<string>())}
        </span>
      ),
      enableSorting: true,
    },
    {
      accessorKey: "account_name",
      header: "Account",
      cell: ({ getValue }) => {
        const name = getValue<string | undefined>();
        return name
          ? <span className="text-muted-foreground">{name}</span>
          : <span className="text-muted-foreground/50">—</span>;
      },
      enableSorting: false,
    },
    {
      accessorKey: "symbol_id",
      header: ({ column }) => <DataTableSortHeader column={column} title="Market" />,
      cell: ({ getValue }) => (
        <span className="font-semibold">{getSymbolName(getValue<number>())}</span>
      ),
      enableSorting: true,
    },
    {
      accessorKey: "strategy_name",
      header: "Strategy",
      cell: ({ getValue }) => {
        const name = getValue<string | undefined>();
        return name
          ? <span>{name}</span>
          : <span className="text-muted-foreground/50">—</span>;
      },
      enableSorting: false,
    },
    {
      accessorKey: "side",
      header: ({ column }) => <DataTableSortHeader column={column} title="Side" />,
      cell: ({ getValue }) => {
        const side = getValue<number>();
        return (
          <span
            className={cn(
              "font-semibold",
              side === 1
                ? "text-green-600 dark:text-green-400"
                : side === 2
                  ? "text-red-600 dark:text-red-400"
                  : "text-muted-foreground"
            )}
          >
            {getSideName(side)}
          </span>
        );
      },
      enableSorting: true,
    },
    {
      accessorKey: "price",
      header: ({ column }) => (
        <DataTableSortHeader column={column} title="Price" className="justify-end" />
      ),
      cell: ({ getValue }) => (
        <span className="font-mono tabular-nums">
          {formatPrice(getValue<number>())}
        </span>
      ),
      meta: { align: "right" },
      enableSorting: true,
    },
    {
      accessorKey: "quantity",
      header: ({ column }) => (
        <DataTableSortHeader column={column} title="Quantity" className="justify-end" />
      ),
      cell: ({ getValue }) => (
        <span className="font-mono tabular-nums text-muted-foreground">
          {formatQuantity(getValue<number>())}
        </span>
      ),
      meta: { align: "right" },
      enableSorting: true,
    },
    {
      accessorKey: "trading_mode",
      header: "Mode",
      cell: ({ getValue }) => {
        const mode = getValue<string>();
        return (
          <Badge variant={mode === "LIVE" ? "live" : "mock"} className="text-[10px]">
            {mode === "LIVE" ? "Live" : mode === "MOCK" ? "Paper" : mode ?? "—"}
          </Badge>
        );
      },
      enableSorting: false,
    },
  ];
}

// ── Order Column Defs ───────────────────────────────────────────────

const STATUS_VARIANT: Record<string, BadgeVariant> = {
  NEW: "pending",
  ACKED: "pending",
  FILLED: "running",
  PARTIALLY_FILLED: "warning",
  REJECTED: "destructive",
  CANCELLED: "stopped",
};

export function getOrderColumns(): ColumnDef<Order, unknown>[] {
  return [
    {
      accessorKey: "timestamp",
      header: ({ column }) => <DataTableSortHeader column={column} title="Time" />,
      cell: ({ getValue }) => (
        <span className="text-muted-foreground font-mono tabular-nums text-xs">
          {formatTimestamp(getValue<string>())}
        </span>
      ),
      enableSorting: true,
    },
    {
      accessorKey: "order_id",
      header: ({ column }) => <DataTableSortHeader column={column} title="Order ID" />,
      cell: ({ getValue }) => (
        <span className="font-mono text-xs">{getValue<number>()}</span>
      ),
      enableSorting: true,
    },
    {
      accessorKey: "symbol_id",
      header: ({ column }) => <DataTableSortHeader column={column} title="Market" />,
      cell: ({ getValue }) => (
        <span className="font-semibold">{getSymbolName(getValue<number>())}</span>
      ),
      enableSorting: true,
    },
    {
      accessorKey: "strategy_name",
      header: "Strategy",
      cell: ({ getValue }) => {
        const name = getValue<string | undefined>();
        return name
          ? <span>{name}</span>
          : <span className="text-muted-foreground/50">—</span>;
      },
      enableSorting: false,
    },
    {
      accessorKey: "side",
      header: ({ column }) => <DataTableSortHeader column={column} title="Side" />,
      cell: ({ getValue }) => {
        const side = getValue<number>();
        return (
          <span
            className={cn(
              "font-semibold",
              side === 1
                ? "text-green-600 dark:text-green-400"
                : side === 2
                  ? "text-red-600 dark:text-red-400"
                  : "text-muted-foreground"
            )}
          >
            {getSideName(side)}
          </span>
        );
      },
      enableSorting: true,
    },
    {
      accessorKey: "price",
      header: ({ column }) => (
        <DataTableSortHeader column={column} title="Price" className="justify-end" />
      ),
      cell: ({ getValue }) => (
        <span className="font-mono tabular-nums">
          {formatPrice(getValue<number>())}
        </span>
      ),
      meta: { align: "right" },
      enableSorting: true,
    },
    {
      accessorKey: "quantity",
      header: ({ column }) => (
        <DataTableSortHeader column={column} title="Quantity" className="justify-end" />
      ),
      cell: ({ getValue }) => (
        <span className="font-mono tabular-nums text-muted-foreground">
          {formatQuantity(getValue<number>())}
        </span>
      ),
      meta: { align: "right" },
      enableSorting: true,
    },
    {
      accessorKey: "status",
      header: ({ column }) => <DataTableSortHeader column={column} title="Status" />,
      cell: ({ getValue }) => {
        const status = getValue<string>();
        const variant: BadgeVariant = STATUS_VARIANT[status] ?? "secondary";
        return <Badge variant={variant}>{status}</Badge>;
      },
      enableSorting: true,
    },
    {
      accessorKey: "trading_mode",
      header: "Mode",
      cell: ({ getValue }) => {
        const mode = getValue<string>();
        return (
          <Badge variant={mode === "LIVE" ? "live" : "mock"} className="text-[10px]">
            {mode === "LIVE" ? "Live" : mode === "MOCK" ? "Paper" : mode ?? "—"}
          </Badge>
        );
      },
      enableSorting: false,
    },
  ];
}

// ── Risk Event Column Defs ──────────────────────────────────────────

export function getRiskEventColumns(): ColumnDef<RiskEvent, unknown>[] {
  return [
    {
      accessorKey: "timestamp",
      header: ({ column }) => <DataTableSortHeader column={column} title="Time" />,
      cell: ({ getValue }) => (
        <span className="text-muted-foreground font-mono tabular-nums text-xs">
          {formatTimestamp(getValue<string>())}
        </span>
      ),
      enableSorting: true,
    },
    {
      accessorKey: "order_id",
      header: ({ column }) => <DataTableSortHeader column={column} title="Order ID" />,
      cell: ({ getValue }) => (
        <span className="font-mono text-xs">{getValue<number>()}</span>
      ),
      enableSorting: true,
    },
    {
      accessorKey: "symbol_id",
      header: ({ column }) => <DataTableSortHeader column={column} title="Symbol" />,
      cell: ({ getValue }) => (
        <span className="font-semibold">{getSymbolName(getValue<number>())}</span>
      ),
      enableSorting: true,
    },
    {
      accessorKey: "reason",
      header: ({ column }) => <DataTableSortHeader column={column} title="Reason" />,
      cell: ({ getValue }) => {
        // Persistence stores a stable snake_case reject reason (price_band,
        // position_limit, …); render it as readable Title Case.
        const raw = getValue<string>();
        const label = raw
          ? raw.replace(/_/g, " ").replace(/\b\w/g, (c) => c.toUpperCase())
          : "—";
        return <span className="text-negative">{label}</span>;
      },
      enableSorting: true,
    },
    {
      accessorKey: "trading_mode",
      header: "Mode",
      cell: ({ getValue }) => {
        const mode = getValue<string>();
        return (
          <Badge variant={mode === "LIVE" ? "live" : "mock"} className="text-[10px]">
            {mode === "LIVE" ? "Live" : mode === "MOCK" ? "Paper" : mode ?? "—"}
          </Badge>
        );
      },
      enableSorting: false,
    },
  ];
}

// ── Position Column Defs ────────────────────────────────────────────

export function getPositionColumns(): ColumnDef<SymbolState, unknown>[] {
  return [
    {
      accessorKey: "name",
      header: ({ column }) => <DataTableSortHeader column={column} title="Symbol" />,
      cell: ({ getValue }) => (
        <span className="font-semibold">{getValue<string>()}</span>
      ),
      enableSorting: true,
    },
    {
      accessorKey: "venue",
      header: ({ column }) => <DataTableSortHeader column={column} title="Venue" />,
      cell: ({ getValue }) => (
        <span className="text-muted-foreground">{getValue<string>()}</span>
      ),
      enableSorting: true,
    },
    {
      accessorKey: "lastPrice",
      header: ({ column }) => (
        <DataTableSortHeader column={column} title="Last" className="justify-end" />
      ),
      cell: ({ getValue }) => (
        <span className="font-mono tabular-nums">
          {formatPrice(getValue<number>())}
        </span>
      ),
      meta: { align: "right" },
      enableSorting: true,
    },
    {
      accessorKey: "bidPrice",
      header: ({ column }) => (
        <DataTableSortHeader column={column} title="Bid" className="justify-end" />
      ),
      cell: ({ getValue }) => (
        <span className="font-mono tabular-nums text-green-600 dark:text-green-400">
          {formatPrice(getValue<number>())}
        </span>
      ),
      meta: { align: "right" },
      enableSorting: true,
    },
    {
      accessorKey: "askPrice",
      header: ({ column }) => (
        <DataTableSortHeader column={column} title="Ask" className="justify-end" />
      ),
      cell: ({ getValue }) => (
        <span className="font-mono tabular-nums text-red-600 dark:text-red-400">
          {formatPrice(getValue<number>())}
        </span>
      ),
      meta: { align: "right" },
      enableSorting: true,
    },
    {
      accessorKey: "spread",
      header: ({ column }) => (
        <DataTableSortHeader column={column} title="Spread" className="justify-end" />
      ),
      cell: ({ getValue }) => (
        <span className="font-mono tabular-nums text-muted-foreground">
          {formatPrice(getValue<number>(), 4)}
        </span>
      ),
      meta: { align: "right" },
      enableSorting: true,
    },
    {
      accessorKey: "position",
      header: ({ column }) => (
        <DataTableSortHeader column={column} title="Position" className="justify-end" />
      ),
      cell: ({ getValue }) => {
        const pos = getValue<number>();
        return (
          <span className={cn("font-mono tabular-nums", pnlColor(pos))}>
            {formatQuantity(pos)}
          </span>
        );
      },
      meta: { align: "right" },
      enableSorting: true,
    },
    {
      accessorKey: "unrealizedPnl",
      header: ({ column }) => (
        <DataTableSortHeader column={column} title="Unrealized" className="justify-end" />
      ),
      cell: ({ getValue }) => {
        const pnl = getValue<number>();
        return (
          <span className={cn("font-mono tabular-nums", pnlColor(pnl))}>
            {formatPnl(pnl)}
          </span>
        );
      },
      meta: { align: "right" },
      enableSorting: true,
    },
    {
      accessorKey: "realizedPnl",
      header: ({ column }) => (
        <DataTableSortHeader column={column} title="Realized" className="justify-end" />
      ),
      cell: ({ getValue }) => {
        const pnl = getValue<number>();
        return (
          <span className={cn("font-mono tabular-nums", pnlColor(pnl))}>
            {formatPnl(pnl)}
          </span>
        );
      },
      meta: { align: "right" },
      enableSorting: true,
    },
    {
      accessorKey: "orderCount",
      header: ({ column }) => (
        <DataTableSortHeader column={column} title="Orders" className="justify-end" />
      ),
      cell: ({ getValue }) => (
        <span className="font-mono tabular-nums text-muted-foreground">
          {getValue<number>()}
        </span>
      ),
      meta: { align: "right" },
      enableSorting: true,
    },
    {
      accessorKey: "fillCount",
      header: ({ column }) => (
        <DataTableSortHeader column={column} title="Fills" className="justify-end" />
      ),
      cell: ({ getValue }) => (
        <span className="font-mono tabular-nums text-muted-foreground">
          {getValue<number>()}
        </span>
      ),
      meta: { align: "right" },
      enableSorting: true,
    },
  ];
}

// ── User Column Defs ────────────────────────────────────────────────

const ROLE_COLORS: Record<string, string> = {
  SUPER_ADMIN: "text-purple-600 dark:text-purple-400",
  ADMIN: "text-blue-600 dark:text-blue-400",
  RISK_MANAGER: "text-orange-600 dark:text-orange-400",
  TRADER: "text-positive",
  VIEWER: "text-muted-foreground",
};

export function getUserColumns(
  onEdit: (user: User) => void
): ColumnDef<User & { tenant?: { name: string } }, unknown>[] {
  return [
    {
      accessorKey: "username",
      header: ({ column }) => <DataTableSortHeader column={column} title="Username" />,
      cell: ({ getValue }) => (
        <span className="font-semibold">{getValue<string>()}</span>
      ),
      enableSorting: true,
    },
    {
      accessorKey: "email",
      header: ({ column }) => <DataTableSortHeader column={column} title="Email" />,
      cell: ({ getValue }) => (
        <span className="text-muted-foreground">{getValue<string>()}</span>
      ),
      enableSorting: true,
    },
    {
      accessorKey: "role",
      header: ({ column }) => <DataTableSortHeader column={column} title="Role" />,
      cell: ({ getValue }) => {
        const role = getValue<string>();
        return (
          <span className={cn("text-xs font-medium", ROLE_COLORS[role] ?? "text-muted-foreground")}>
            {role}
          </span>
        );
      },
      enableSorting: true,
    },
    {
      id: "tenant",
      accessorFn: (row) => row.tenant?.name ?? "\u2014",
      header: "Tenant",
      cell: ({ getValue }) => (
        <span className="text-muted-foreground">{getValue<string>()}</span>
      ),
      enableSorting: false,
    },
    {
      accessorKey: "active",
      header: "Status",
      cell: ({ getValue }) => {
        const active = getValue<boolean>();
        return (
          <Badge variant={active ? "running" : "stopped"}>
            {active ? "Active" : "Inactive"}
          </Badge>
        );
      },
      enableSorting: false,
    },
    {
      id: "actions",
      header: "",
      cell: ({ row }) => (
        <Button
          variant="ghost"
          size="xs"
          onClick={(e) => {
            e.stopPropagation();
            onEdit(row.original);
          }}
        >
          <Pencil className="size-3" />
        </Button>
      ),
      enableSorting: false,
      enableHiding: false,
    },
  ];
}
