"use client";

import { Input } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import {
  CURRENCIES,
  CURRENCY_SYMBOLS,
  SALARY_PERIODS,
  type Currency,
  type SalaryParts,
  type SalaryPeriod,
} from "@/lib/types";

interface Props {
  value: SalaryParts;
  onChange: (next: SalaryParts) => void;
  disabled?: boolean;
}

function digitsOnly(s: string): string {
  return s.replace(/[^\d]/g, "");
}

function parseSafe(s: string): number | null {
  const t = s.trim();
  if (!t || !/^\d+$/.test(t)) return null;
  const n = parseInt(t, 10);
  return Number.isFinite(n) ? n : null;
}

function formatPreview(parts: SalaryParts): string | null {
  const minN = parseSafe(parts.min);
  const maxN = parseSafe(parts.max);
  if (minN == null && maxN == null) return null;
  const sym = CURRENCY_SYMBOLS[parts.currency];
  const fmt = (n: number) => `${sym}${n.toLocaleString("en-US")}`;
  const periodLabel = parts.period === "monthly" ? "per month" : "per year";
  if (minN != null && maxN != null) {
    if (maxN < minN) return null; // surfaced via validation, not preview
    return `${fmt(minN)} – ${fmt(maxN)} ${periodLabel}`;
  }
  if (minN != null) return `From ${fmt(minN)} ${periodLabel}`;
  return `Up to ${fmt(maxN!)} ${periodLabel}`;
}

export function SalaryInput({ value, onChange, disabled }: Props) {
  const preview = formatPreview(value);
  return (
    <div className="space-y-2">
      <div className="grid grid-cols-2 gap-2 sm:grid-cols-[100px_1fr_1fr_120px]">
        <Select
          value={value.currency}
          onChange={(e) =>
            onChange({ ...value, currency: e.target.value as Currency })
          }
          disabled={disabled}
          aria-label="Currency"
        >
          {CURRENCIES.map((c) => (
            <option key={c} value={c}>
              {c}
            </option>
          ))}
        </Select>
        <Input
          inputMode="numeric"
          pattern="[0-9]*"
          placeholder="Min"
          value={value.min}
          onChange={(e) =>
            onChange({ ...value, min: digitsOnly(e.target.value) })
          }
          disabled={disabled}
          aria-label="Minimum salary"
        />
        <Input
          inputMode="numeric"
          pattern="[0-9]*"
          placeholder="Max"
          value={value.max}
          onChange={(e) =>
            onChange({ ...value, max: digitsOnly(e.target.value) })
          }
          disabled={disabled}
          aria-label="Maximum salary"
        />
        <Select
          value={value.period}
          onChange={(e) =>
            onChange({ ...value, period: e.target.value as SalaryPeriod })
          }
          disabled={disabled}
          aria-label="Period"
        >
          {SALARY_PERIODS.map((p) => (
            <option key={p} value={p}>
              {p === "monthly" ? "Monthly" : "Yearly"}
            </option>
          ))}
        </Select>
      </div>
      {preview && (
        <p className="text-small text-muted-foreground">{preview}</p>
      )}
    </div>
  );
}
