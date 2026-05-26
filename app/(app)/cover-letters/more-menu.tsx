"use client";

import * as DropdownMenu from "@radix-ui/react-dropdown-menu";
import { ChevronDown, Loader2, MoreHorizontal } from "lucide-react";
import { cn } from "@/lib/utils";

export type ToneVariant = "confident" | "friendly" | "formal" | "startup";

interface ToneItem {
  key: ToneVariant;
  label: string;
  description: string;
}

interface Props {
  onSelect: (variant: ToneVariant) => void;
  disabled?: boolean;
  busyVariant?: ToneVariant | null;
  label: string;
  items: ToneItem[];
}

export function MoreMenu({
  onSelect,
  disabled,
  busyVariant,
  label,
  items,
}: Props) {
  const isBusy = busyVariant != null;
  return (
    <DropdownMenu.Root>
      <DropdownMenu.Trigger asChild>
        <button
          type="button"
          disabled={disabled}
          className={cn(
            "inline-flex h-9 items-center gap-2 rounded-md border border-border bg-surface-elevated px-3 text-small text-foreground transition-colors",
            "hover:border-primary/40 hover:bg-surface-elevated/80",
            "data-[state=open]:border-primary/40",
            "disabled:cursor-not-allowed disabled:opacity-50",
          )}
        >
          {isBusy ? (
            <Loader2 className="h-4 w-4 animate-spin" />
          ) : (
            <MoreHorizontal className="h-4 w-4" />
          )}
          {label}
          <ChevronDown className="h-3 w-3 text-muted-foreground" />
        </button>
      </DropdownMenu.Trigger>
      <DropdownMenu.Portal>
        <DropdownMenu.Content
          align="end"
          sideOffset={6}
          className={cn(
            "z-50 min-w-[260px] overflow-hidden rounded-lg border border-border bg-surface p-1 shadow-md",
            "data-[state=open]:animate-in data-[state=open]:fade-in-0 data-[state=open]:slide-in-from-top-1",
          )}
        >
          {items.map((item) => {
            const isItemBusy = busyVariant === item.key;
            return (
              <DropdownMenu.Item
                key={item.key}
                onSelect={() => onSelect(item.key)}
                disabled={isBusy}
                className={cn(
                  "flex cursor-pointer items-start gap-3 rounded-md px-3 py-2 outline-none transition-colors",
                  "focus:bg-surface-elevated focus:text-foreground",
                  "data-[disabled]:pointer-events-none data-[disabled]:opacity-50",
                )}
              >
                <span className="mt-0.5 inline-flex h-4 w-4 shrink-0 items-center justify-center text-muted-foreground">
                  {isItemBusy ? (
                    <Loader2 className="h-3.5 w-3.5 animate-spin" />
                  ) : null}
                </span>
                <div className="min-w-0">
                  <div className="text-small font-medium text-foreground">
                    {item.label}
                  </div>
                  <p className="text-small text-muted-foreground">
                    {item.description}
                  </p>
                </div>
              </DropdownMenu.Item>
            );
          })}
        </DropdownMenu.Content>
      </DropdownMenu.Portal>
    </DropdownMenu.Root>
  );
}
