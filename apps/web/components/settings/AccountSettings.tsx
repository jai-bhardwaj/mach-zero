"use client";

import { useSession, signOut } from "next-auth/react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { LogOut } from "lucide-react";

const ROLE_LABELS: Record<string, { label: string; variant: "default" | "secondary" | "destructive" | "outline" }> = {
  SUPER_ADMIN: { label: "Super Admin", variant: "destructive" },
  ADMIN: { label: "Admin", variant: "default" },
  RISK_MANAGER: { label: "Risk Manager", variant: "secondary" },
  TRADER: { label: "Trader", variant: "secondary" },
  VIEWER: { label: "Viewer", variant: "outline" },
};

export function AccountSettings() {
  const { data: session } = useSession();
  const user = session?.user as Record<string, unknown> | undefined;

  if (!user) return null;

  const role = (user.role as string) ?? "VIEWER";
  const roleInfo = ROLE_LABELS[role] ?? ROLE_LABELS.VIEWER;

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">Account</CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Profile info */}
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium">{user.name as string}</p>
              <p className="text-xs text-muted-foreground">
                {user.email as string}
              </p>
            </div>
            <Badge variant={roleInfo.variant}>{roleInfo.label}</Badge>
          </div>

          <div className="rounded-lg border border-border bg-muted/30 p-3">
            <div className="grid grid-cols-2 gap-3 text-sm">
              <div>
                <p className="text-xs text-muted-foreground">Workspace</p>
                <p className="font-medium">
                  {(user.tenantName as string) ?? "—"}
                </p>
              </div>
              <div>
                <p className="text-xs text-muted-foreground">User ID</p>
                <p className="font-mono text-xs">
                  {((user.id as string) ?? "").slice(0, 8)}...
                </p>
              </div>
            </div>
          </div>
        </div>

        {/* Sign out */}
        <div className="border-t border-border pt-4">
          <Button
            variant="outline"
            className="w-full gap-2"
            onClick={() => signOut({ callbackUrl: "/login" })}
          >
            <LogOut className="h-4 w-4" />
            Sign out
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}
