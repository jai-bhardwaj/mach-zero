"use client";

import { useState } from "react";
import type { User, Role } from "@/types";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
  DialogClose,
} from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";

interface Props {
  user: User;
  onSave: (data: { id: string; username: string; role: Role; active: boolean }) => void;
  onClose: () => void;
}

const ROLES: Role[] = ["SUPER_ADMIN", "ADMIN", "RISK_MANAGER", "TRADER", "VIEWER"];

export function UserEditForm({ user, onSave, onClose }: Props) {
  const [username, setUsername] = useState(user.username);
  const [role, setRole] = useState<Role>(user.role as Role);
  const [active, setActive] = useState(user.active);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    onSave({ id: user.id, username, role, active });
  };

  return (
    <Dialog open onOpenChange={() => onClose()}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Edit User</DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4">
          {/* Email (read-only) */}
          <div>
            <Label className="mb-1">Email</Label>
            <div className="flex h-9 items-center rounded-md border border-input bg-muted/50 px-3 text-sm text-muted-foreground">
              {user.email}
            </div>
          </div>

          {/* Username */}
          <div>
            <Label className="mb-1">Username</Label>
            <Input
              type="text"
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              required
            />
          </div>

          {/* Role */}
          <div>
            <Label className="mb-1">Role</Label>
            <select
              value={role}
              onChange={(e) => setRole(e.target.value as Role)}
              className="flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm shadow-xs outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50"
            >
              {ROLES.map((r) => (
                <option key={r} value={r}>
                  {r}
                </option>
              ))}
            </select>
          </div>

          {/* Active toggle */}
          <div className="flex items-center justify-between">
            <Label>Status</Label>
            <button
              type="button"
              onClick={() => setActive(!active)}
              className="flex items-center gap-2"
            >
              <Badge variant={active ? "running" : "stopped"}>
                {active ? "Active" : "Inactive"}
              </Badge>
              <span className="text-xs text-muted-foreground">
                Click to toggle
              </span>
            </button>
          </div>

          <DialogFooter>
            <DialogClose render={<Button variant="ghost" />}>
              Cancel
            </DialogClose>
            <Button type="submit">Save Changes</Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
