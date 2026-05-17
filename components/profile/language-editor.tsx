"use client";

import { Plus, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import {
  SELECTABLE_LANGUAGE_LEVELS,
  type LanguageEntry,
  type LanguageLevel,
} from "@/lib/types";

interface Props {
  value: LanguageEntry[];
  onChange: (next: LanguageEntry[]) => void;
  disabled?: boolean;
}

export function LanguageEditor({ value, onChange, disabled }: Props) {
  function update(i: number, patch: Partial<LanguageEntry>) {
    onChange(
      value.map((entry, idx) => (idx === i ? { ...entry, ...patch } : entry)),
    );
  }
  function remove(i: number) {
    onChange(value.filter((_, idx) => idx !== i));
  }
  function add() {
    onChange([...value, { name: "", level: "Intermediate" }]);
  }

  return (
    <div className="space-y-2">
      {value.length === 0 && (
        <p className="text-small text-muted-foreground">
          No languages added yet. Add at least one.
        </p>
      )}
      {value.map((entry, i) => {
        const isLegacyUnknown = entry.level === "Unknown";
        return (
          <div
            key={i}
            className="flex items-center gap-2 rounded-md border border-border bg-surface px-2 py-1.5"
          >
            <Input
              value={entry.name}
              onChange={(e) => update(i, { name: e.target.value })}
              placeholder="Language (e.g. English)"
              disabled={disabled}
              className="flex-1 border-0 bg-transparent shadow-none focus-visible:ring-0"
            />
            <Select
              value={entry.level}
              onChange={(e) =>
                update(i, { level: e.target.value as LanguageLevel })
              }
              disabled={disabled}
              className="w-44 border-0 bg-transparent shadow-none focus-visible:ring-0"
            >
              {/* Show "Unknown" only when the current value is Unknown — for
                  legacy rows imported from the old plain-text languages
                  format. As soon as the user picks a real level the option
                  disappears. */}
              {isLegacyUnknown && (
                <option value="Unknown">Unknown — set a level</option>
              )}
              {SELECTABLE_LANGUAGE_LEVELS.map((lvl) => (
                <option key={lvl} value={lvl}>
                  {lvl}
                </option>
              ))}
            </Select>
            <button
              type="button"
              onClick={() => remove(i)}
              disabled={disabled}
              className="shrink-0 rounded-md p-1.5 text-muted-foreground hover:bg-surface-elevated hover:text-foreground"
              aria-label="Remove language"
            >
              <X className="h-4 w-4" />
            </button>
          </div>
        );
      })}
      <Button
        type="button"
        variant="outline"
        size="sm"
        onClick={add}
        disabled={disabled}
      >
        <Plus className="h-4 w-4" />
        Add language
      </Button>
    </div>
  );
}
