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
            "inline-flex h-9 items-center gap-1.5 rounded-lg px-2.5",
            "bg-surface border border-border",
            "transition-colors duration-150",
            "hover:bg-surface-elevated",
            "data-[state=open]:bg-surface-elevated data-[state=open]:border-primary/40",
            "focus-visible:outline-none focus-visible:border-primary",
          )}
        >
          <Globe className="h-4 w-4 text-muted-foreground" />
          <span className="text-small font-medium text-foreground">
            {CODE_LABEL[locale]}
          </span>
          <ChevronDown className="h-3 w-3 text-muted-foreground" />
        </button>
      </DropdownMenu.Trigger>
      <DropdownMenu.Portal>
        <DropdownMenu.Content
          align="end"
          sideOffset={6}
          className={cn(
            "z-50 min-w-[180px] overflow-hidden rounded-xl border border-border bg-surface p-1 shadow-lg",
            "data-[state=open]:animate-dropdown-in",
          )}
        >
          {SUPPORTED_LOCALES.map((option) => {
            const active = locale === option;
            return (
              <DropdownMenu.Item
                key={option}
                onSelect={() => setLocale(option)}
                className={cn(
                  "relative flex cursor-pointer items-center justify-between gap-3 rounded-lg px-3 py-2 outline-none text-small",
                  "transition-colors duration-150",
                  "focus:bg-surface-elevated focus:text-foreground",
                  active ? "text-primary" : "text-secondary-foreground",
                )}
              >
                <span className="flex items-center gap-2.5">
                  <span className="w-6 text-label uppercase tabular text-muted-foreground">
                    {CODE_LABEL[option]}
                  </span>
                  <span className="font-medium">{t(LABEL_KEY[option])}</span>
                </span>
                {active && <Check className="h-4 w-4 text-primary" />}
              </DropdownMenu.Item>
            );
          })}
        </DropdownMenu.Content>
      </DropdownMenu.Portal>
    </DropdownMenu.Root>
  );
}
