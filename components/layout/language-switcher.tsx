"use client";

import * as DropdownMenu from "@radix-ui/react-dropdown-menu";
import { Check, ChevronDown, Globe } from "lucide-react";
import { useT } from "@/lib/i18n/hooks";
import { useI18n } from "@/lib/i18n/hooks";
import { SUPPORTED_LOCALES, type Locale } from "@/lib/i18n/types";
import { cn } from "@/lib/utils";

const LABEL_KEY: Record<Locale, string> = {
  en: "common.language.english",
  ru: "common.language.russian",
  hy: "common.language.armenian",
};

const CODE_LABEL: Record<Locale, string> = {
  en: "EN",
  ru: "RU",
  hy: "HY",
};

export function LanguageSwitcher() {
  const t = useT();
  const { locale, setLocale } = useI18n();

  return (
    <DropdownMenu.Root>
      <DropdownMenu.Trigger asChild>
        <button
          type="button"
          title={t("common.language.tooltip")}
          aria-label={t("common.language.label")}
          className={cn(
            "inline-flex h-8 items-center gap-1.5 rounded-md px-2.5 text-small text-foreground",
            "bg-surface/55 backdrop-blur-xl border border-white/[0.08]",
            "shadow-[inset_0_1px_0_0_hsl(0_0%_100%/0.04)]",
            "transition-[border-color,background-color,box-shadow] duration-fast ease-out-quint",
            "hover:bg-surface-elevated/70 hover:border-white/[0.14]",
            "data-[state=open]:bg-surface-elevated/80 data-[state=open]:border-primary/40 data-[state=open]:shadow-[inset_0_1px_0_0_hsl(0_0%_100%/0.06),0_0_0_2px_hsl(var(--primary)/0.18)]",
            "focus-visible:outline-none focus-visible:border-primary/45",
          )}
        >
          <Globe className="h-3.5 w-3.5 text-muted-foreground" />
          <span className="font-medium">{CODE_LABEL[locale]}</span>
          <ChevronDown className="h-3 w-3 text-muted-foreground" />
        </button>
      </DropdownMenu.Trigger>
      <DropdownMenu.Portal>
        <DropdownMenu.Content
          align="end"
          sideOffset={6}
          className={cn(
            "z-50 min-w-[180px] overflow-hidden p-1",
            "glass-popover",
            "data-[state=open]:animate-in data-[state=open]:fade-in-0 data-[state=open]:slide-in-from-top-1",
          )}
        >
          {SUPPORTED_LOCALES.map((option) => {
            const active = locale === option;
            return (
              <DropdownMenu.Item
                key={option}
                onSelect={() => setLocale(option)}
                className={cn(
                  "relative flex cursor-pointer items-center justify-between gap-3 rounded-md px-3 py-2 outline-none",
                  "transition-colors duration-fast",
                  // Hover / focus — left-edge indigo bar + surface fill.
                  "focus:bg-surface-elevated/70 focus:text-foreground",
                  "focus:before:absolute focus:before:inset-y-1.5 focus:before:left-0 focus:before:w-[2px] focus:before:rounded-r-full focus:before:bg-primary",
                  active && "bg-gradient-to-r from-primary/12 to-transparent text-foreground",
                )}
              >
                <span className="text-small">{t(LABEL_KEY[option])}</span>
                {active && (
                  <Check className="h-3.5 w-3.5 text-primary" />
                )}
              </DropdownMenu.Item>
            );
          })}
        </DropdownMenu.Content>
      </DropdownMenu.Portal>
    </DropdownMenu.Root>
  );
}
