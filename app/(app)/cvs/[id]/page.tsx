import { Button } from "@/components/ui/button";

const SECTIONS = [
  "Personal Info",
  "Summary",
  "Experience",
  "Education",
  "Skills",
  "Projects",
] as const;

export default async function CvEditorPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;

  return (
    <div className="grid h-screen grid-cols-[220px_minmax(0,1fr)_minmax(0,1fr)] divide-x divide-border">
      {/* Section list */}
      <aside className="overflow-y-auto bg-surface px-3 py-4">
        <div className="px-2 pb-3 text-small uppercase tracking-wide text-muted-foreground">
          Sections
        </div>
        <ul className="space-y-0.5">
          {SECTIONS.map((s) => (
            <li key={s}>
              <button className="w-full rounded-md px-2.5 py-1.5 text-left text-small text-secondary-foreground hover:bg-surface-elevated hover:text-foreground">
                {s}
              </button>
            </li>
          ))}
        </ul>
      </aside>

      {/* Editor */}
      <section className="overflow-y-auto p-8">
        <div className="flex items-center justify-between pb-6">
          <h1 className="text-h2 tracking-tight">Editing CV</h1>
          <div className="flex gap-2">
            <Button variant="outline" size="sm">
              Improve with AI
            </Button>
            <Button size="sm">Download PDF</Button>
          </div>
        </div>
        <div className="text-small text-muted-foreground">
          CV id: {id}
        </div>
        <div className="pt-8 text-muted-foreground">
          Section editor goes here.
        </div>
      </section>

      {/* Live preview */}
      <section className="overflow-y-auto bg-surface p-8">
        <div className="pb-3 text-small uppercase tracking-wide text-muted-foreground">
          Preview
        </div>
        <div className="aspect-[1/1.414] w-full rounded-md border border-border bg-white text-black shadow-sm" />
      </section>
    </div>
  );
}
