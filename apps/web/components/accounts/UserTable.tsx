"use client";

import { useState, useMemo } from "react";
import type { User, SortingState } from "@/types";
import { DataTable } from "@/components/ui/data-table";
import { getUserColumns } from "@/lib/columns-ui";

interface Props {
  users: (User & { tenant?: { name: string } })[];
  onEdit: (user: User) => void;
}

export function UserTable({ users, onEdit }: Props) {
  const columns = useMemo(() => getUserColumns(onEdit), [onEdit]);
  const [sorting, setSorting] = useState<SortingState[]>([]);

  return (
    <DataTable
      columns={columns}
      data={users}
      sorting={sorting}
      onSortingChange={setSorting}
      manualSorting={false}
      emptyMessage="No users found."
      getRowId={(row) => row.id}
    />
  );
}
