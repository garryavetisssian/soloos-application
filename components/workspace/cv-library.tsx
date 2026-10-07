"use client";
import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { blankCv, type CvRecord } from "@/lib/workspace/model";
import type { UserProfile } from "@/lib/types";
import { useWorkspaceCopy, workspaceApi } from "./shared";
export function CvLibrary({ profile }: { profile: UserProfile | null }) {
  const c = useWorkspaceCopy(), router = useRouter();
  const [items, setItems] = useState<CvRecord[]>([]), [loading, setLoading] = useState(true), [busy, setBusy] = useState(false), [error, setError] = useState(false), [confirm, setConfirm] = useState("");
  async function load() { setLoading(true); setError(false); try { setItems(await workspaceApi<CvRecord[]>("/api/workspace/cvs")); } catch { setError(true); } finally { setLoading(false); } }
  useEffect(() => { void load(); }, []);
  async function create(source?: CvRecord) { setBusy(true); setError(false); try { const document = source ? { ...source.document, title: `${source.document.title} (${c.duplicate})`.slice(0,300) } : blankCv(profile); const row = await workspaceApi<CvRecord>("/api/workspace/cvs", "POST", document); router.push(`/cvs/${row.id}`); } catch { setError(true); setBusy(false); } }
  async function remove(id: string) { setBusy(true); try { await workspaceApi(`/api/workspace/cvs/${id}`, "DELETE"); setItems(items.filter(row => row.id !== id)); setConfirm(""); } catch { setError(true); } finally { setBusy(false); } }
  return <main className="mx-auto max-w-5xl px-4 py-8 sm:px-8"><header className="flex flex-wrap items-start justify-between gap-4"><div><h1 className="text-2xl font-semibold">{c.cvs}</h1><p className="mt-2 text-muted-foreground">{c.cvIntro}</p></div><Button disabled={busy} onClick={() => void create()}>{c.newCv}</Button></header>
    {error && <div role="alert" className="mt-5 text-sm">{c.error} <Button variant="outline" onClick={() => void load()}>{c.retry}</Button></div>}
    <div className="mt-6 grid gap-4 sm:grid-cols-2">{items.map(row => <article key={row.id} className="min-w-0 rounded-xl border border-border bg-surface p-5"><Link href={`/cvs/${row.id}`} className="block break-words text-lg font-semibold hover:underline">{row.document.title}</Link><p className="mt-2 text-sm text-muted-foreground">{row.document.full_name || c.full_name} · {row.document.language.toUpperCase()}</p><div className="mt-5 flex flex-wrap gap-2"><Button variant="outline" asChild><Link href={`/cvs/${row.id}`}>{c.edit}</Link></Button><Button variant="ghost" disabled={busy} onClick={() => void create(row)}>{c.duplicate}</Button><Button variant="ghost" disabled={busy} onClick={() => confirm === row.id ? void remove(row.id) : setConfirm(row.id)}>{confirm === row.id ? c.confirm : c.remove}</Button>{confirm === row.id && <Button variant="ghost" onClick={() => setConfirm("")}>{c.cancel}</Button>}</div></article>)}</div>
    {loading ? <p role="status" className="mt-8">{c.loading}</p> : !items.length && !error && <p className="mt-8 rounded-xl border border-dashed border-border p-8 text-muted-foreground">{c.empty}</p>}
  </main>;
}
