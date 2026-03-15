"use client";

import { useState } from "react";
import type { User, Role } from "@/types";
import { UserTable } from "@/components/accounts/UserTable";
import { UserForm } from "@/components/accounts/UserForm";
import { UserEditForm } from "@/components/accounts/UserEditForm";
import { Button } from "@/components/ui/button";
import { PageHeader } from "@/components/ui/page-header";

interface Props {
  initialUsers: (User & { tenant?: { name: string } })[];
}

export function UsersClient({ initialUsers }: Props) {
  const [users, setUsers] = useState(initialUsers);
  const [showCreate, setShowCreate] = useState(false);
  const [editingUser, setEditingUser] = useState<User | null>(null);
  const [error, setError] = useState<string | null>(null);

  const fetchUsers = async () => {
    try {
      const res = await fetch("/api/users");
      if (res.ok) setUsers(await res.json());
    } catch {
      // Polling failures are expected when offline
    }
  };

  const handleCreate = async (data: {
    username: string;
    email: string;
    role: Role;
    tenantId: string;
  }) => {
    try {
      const res = await fetch("/api/users", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({ error: "Unknown error" }));
        setError(err.error ?? "Failed to create user");
        return;
      }
    } catch {
      setError("Failed to create user. Please try again.");
      return;
    }
    setShowCreate(false);
    fetchUsers();
  };

  const handleUpdate = async (data: {
    id: string;
    username: string;
    role: Role;
    active: boolean;
  }) => {
    try {
      const res = await fetch("/api/users", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({ error: "Unknown error" }));
        setError(err.error ?? "Failed to update user");
        return;
      }
    } catch {
      setError("Failed to update user. Please try again.");
      return;
    }
    setEditingUser(null);
    fetchUsers();
  };

  return (
    <>
      {/* Error Banner */}
      {error && (
        <div className="flex items-center justify-between rounded-lg border border-red-500/30 bg-red-900/20 px-4 py-3 text-sm text-red-400">
          <span>{error}</span>
          <button
            onClick={() => setError(null)}
            className="text-xs text-red-400/70 hover:text-red-400"
          >
            Dismiss
          </button>
        </div>
      )}

      <PageHeader
        title="Users"
        actions={
          <Button onClick={() => setShowCreate(true)}>
            Invite User
          </Button>
        }
      />
      <UserTable users={users} onEdit={setEditingUser} />
      {showCreate && (
        <UserForm onSave={handleCreate} onClose={() => setShowCreate(false)} />
      )}
      {editingUser && (
        <UserEditForm
          user={editingUser}
          onSave={handleUpdate}
          onClose={() => setEditingUser(null)}
        />
      )}
    </>
  );
}
