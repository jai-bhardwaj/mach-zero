"use client";

import { useState, useCallback } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  DropdownMenu,
  DropdownMenuTrigger,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuLabel,
} from "@/components/ui/dropdown-menu";
import { Bookmark, Plus, Trash2, Check, Star } from "lucide-react";
import { cn } from "@/lib/utils";
import type { SavedView } from "@/hooks/useTableViews";

interface Props {
  views: SavedView[];
  activeViewId?: string;
  onLoad: (viewId: string) => void;
  onSave: (name: string) => void;
  onDelete: (viewId: string) => void;
  onSetDefault: (viewId: string) => void;
}

export function DataTableViewSwitcher({
  views,
  activeViewId,
  onLoad,
  onSave,
  onDelete,
  onSetDefault,
}: Props) {
  const [showNameInput, setShowNameInput] = useState(false);
  const [newViewName, setNewViewName] = useState("");
  const [hoveredViewId, setHoveredViewId] = useState<string | null>(null);

  const handleSave = useCallback(() => {
    const trimmed = newViewName.trim();
    if (!trimmed) return;
    onSave(trimmed);
    setNewViewName("");
    setShowNameInput(false);
  }, [newViewName, onSave]);

  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent<HTMLInputElement>) => {
      if (e.key === "Enter") {
        e.preventDefault();
        handleSave();
      }
      if (e.key === "Escape") {
        setShowNameInput(false);
        setNewViewName("");
      }
    },
    [handleSave]
  );

  return (
    <DropdownMenu>
      <DropdownMenuTrigger
        render={
          <Button variant="outline" size="sm">
            <Bookmark className="size-3.5" />
            Views
            {views.length > 0 && (
              <span className="ml-1 rounded-full bg-muted px-1.5 py-0.5 text-[10px] font-medium text-muted-foreground">
                {views.length}
              </span>
            )}
          </Button>
        }
      />
      <DropdownMenuContent align="end" className="w-[220px]">
        {views.length > 0 && (
          <>
            <DropdownMenuLabel>Saved Views</DropdownMenuLabel>
            {views.map((view) => (
              <DropdownMenuItem
                key={view.id}
                className="group flex items-center justify-between gap-2"
                onMouseEnter={() => setHoveredViewId(view.id)}
                onMouseLeave={() => setHoveredViewId(null)}
                onClick={() => onLoad(view.id)}
              >
                <span className="flex items-center gap-1.5 truncate">
                  {activeViewId === view.id && (
                    <Check className="size-3 text-accent shrink-0" />
                  )}
                  <span
                    className={cn(
                      "truncate",
                      activeViewId !== view.id && "ml-[18px]"
                    )}
                  >
                    {view.name}
                  </span>
                </span>
                <span className="flex items-center gap-0.5 shrink-0">
                  {view.isDefault && hoveredViewId !== view.id && (
                    <Star className="size-3 text-yellow-500 fill-yellow-500" />
                  )}
                  {hoveredViewId === view.id && (
                    <>
                      <button
                        className={cn(
                          "rounded p-0.5 hover:bg-muted",
                          view.isDefault
                            ? "text-yellow-500"
                            : "text-muted-foreground"
                        )}
                        onClick={(e) => {
                          e.stopPropagation();
                          onSetDefault(view.id);
                        }}
                        title={
                          view.isDefault
                            ? "Default view"
                            : "Set as default"
                        }
                      >
                        <Star
                          className={cn(
                            "size-3",
                            view.isDefault && "fill-yellow-500"
                          )}
                        />
                      </button>
                      <button
                        className="rounded p-0.5 text-muted-foreground hover:bg-destructive/10 hover:text-destructive"
                        onClick={(e) => {
                          e.stopPropagation();
                          onDelete(view.id);
                        }}
                        title="Delete view"
                      >
                        <Trash2 className="size-3" />
                      </button>
                    </>
                  )}
                </span>
              </DropdownMenuItem>
            ))}
            <DropdownMenuSeparator />
          </>
        )}

        {showNameInput ? (
          <div className="px-1.5 py-1.5">
            <div className="flex items-center gap-1.5">
              <Input
                value={newViewName}
                onChange={(e) => setNewViewName(e.target.value)}
                onKeyDown={handleKeyDown}
                placeholder="View name..."
                className="h-6 text-xs"
                autoFocus
              />
              <Button
                variant="default"
                size="xs"
                onClick={handleSave}
                disabled={!newViewName.trim()}
              >
                Save
              </Button>
            </div>
          </div>
        ) : (
          <DropdownMenuItem closeOnClick={false} onClick={() => setShowNameInput(true)}>
            <Plus className="size-3.5" />
            Save current view
          </DropdownMenuItem>
        )}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
