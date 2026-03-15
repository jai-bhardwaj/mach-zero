"use client";

import { Download } from "lucide-react";
import { Button } from "@/components/ui/button";

interface Props {
  data: Record<string, unknown>[];
  filename?: string;
  columns: { key: string; label: string }[];
}

export function DataTableExport({ data, filename = "export", columns }: Props) {
  const handleExport = () => {
    const header = columns.map((c) => c.label).join(",");
    const rows = data.map((row) =>
      columns
        .map((c) => {
          const val = row[c.key];
          const str = String(val ?? "");
          // Escape values containing commas, quotes, or newlines
          if (str.includes(",") || str.includes('"') || str.includes("\n")) {
            return `"${str.replace(/"/g, '""')}"`;
          }
          return str;
        })
        .join(",")
    );
    const csv = [header, ...rows].join("\n");
    const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `${filename}-${new Date().toISOString().slice(0, 10)}.csv`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  };

  return (
    <Button variant="outline" size="sm" onClick={handleExport}>
      <Download className="size-3.5 mr-1" />
      Export
    </Button>
  );
}
