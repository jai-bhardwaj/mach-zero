"use client";

import { useNavTransition, type NavTransition } from "@/hooks/useNavTransition";
import { useMounted } from "@/hooks/useMounted";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { cn } from "@/lib/utils";
import { ArrowLeftRight, Sparkles, Ban, Wand2 } from "lucide-react";

const OPTIONS: {
  value: NavTransition;
  label: string;
  icon: typeof ArrowLeftRight;
  description: string;
}[] = [
  { value: "slide", label: "Slide", icon: ArrowLeftRight, description: "Nav slides in" },
  { value: "fade", label: "Fade", icon: Sparkles, description: "Soft cross-fade" },
  { value: "none", label: "None", icon: Ban, description: "Instant, no motion" },
  { value: "native", label: "Native", icon: Wand2, description: "Browser view transitions" },
];

export function TransitionSettings() {
  const { transition, setTransition } = useNavTransition();
  const mounted = useMounted();

  return (
    <Card>
      <CardHeader>
        <CardTitle>Navigation Transition</CardTitle>
        <CardDescription>
          How the sidebar and content animate when entering or leaving Settings
        </CardDescription>
      </CardHeader>
      <CardContent>
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
          {OPTIONS.map(({ value, label, icon: Icon, description }) => {
            const active = mounted && transition === value;
            return (
              <button
                key={value}
                onClick={() => setTransition(value)}
                aria-pressed={active}
                className={cn(
                  "flex flex-col items-center gap-2 rounded-lg border p-3 text-sm transition-colors",
                  active
                    ? "border-primary bg-primary/5 text-foreground"
                    : "border-border text-muted-foreground hover:border-foreground/20 hover:text-foreground"
                )}
              >
                <Icon className="h-5 w-5" />
                <span className="font-medium">{label}</span>
                <span className="text-center text-[11px] text-muted-foreground">
                  {description}
                </span>
              </button>
            );
          })}
        </div>
        {mounted && transition === "native" && (
          <p className="mt-3 text-[11px] text-orange-400">
            Native view transitions are experimental and require a dev-server
            restart to fully take effect.
          </p>
        )}
      </CardContent>
    </Card>
  );
}
