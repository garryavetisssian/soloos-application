"use client";
import { useContext } from "react";
import { I18nContext } from "@/lib/i18n/provider";
import { workspaceCopy } from "@/lib/workspace/copy";
export function useWorkspaceCopy() { return workspaceCopy[useContext(I18nContext)?.locale || "en"]; }
export async function workspaceApi<T>(path: string, method = "GET", data?: unknown): Promise<T> {
  const response = await fetch(path, { method, cache: "no-store", headers: data ? { "Content-Type": "application/json" } : undefined, body: data ? JSON.stringify(data) : undefined });
  if (!response.ok) throw new Error(response.status === 400 ? "invalid" : "error");
  return response.json();
}
export const control = "w-full min-w-0 rounded-lg border border-border bg-surface px-3 py-2 text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-primary";
export function Field({ label, children }: { label: string; children: React.ReactNode }) { return <label className="flex min-w-0 flex-col gap-1.5 text-sm text-muted-foreground">{label}{children}</label>; }
