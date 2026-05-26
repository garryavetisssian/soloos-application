import { Button } from "@/components/ui/button";
import { getServerT } from "@/lib/i18n/server";

const SECTIONS = [
  { key: "personal_info" },
  { key: "summary" },
  { key: "experience" },
  { key: "education" },
  { key: "skills" },
  { key: "projects" },
] as const;

export default async function CvEditorPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const { t } = await getServerT();

  return (
    <div className="grid h-screen grid-cols-[220px_minmax(0,1fr)_minmax(0,1fr)] divide-x divide-border">
      {/* Section list */}
      <aside className="overflow-y-auto bg-bg-subtle px-3 py-4">
        <div className="px-2 pb-3 text-label font-medium uppercase tracking-wide text-muted-foreground">
          {t("pages.cvs.editor.sections")}
        </div>
        <ul className="space-y-0.5">
          {SECTIONS.map((s) => (
            <li key={s.key}>
              <button className="w-full rounded-md px-2.5 py-1.5 text-left text-small text-muted-foreground hover:bg-surface-elevated hover:text-foreground">
                {t(`pages.cvs.editor.section.${s.key}`)}
              </button>
            </li>
          ))}
        </ul>
      </aside>

      {/* Editor */}
      <section className="overflow-y-auto bg-bg-subtle p-8">
        <div className="flex items-center justify-between pb-6">
          <h1 className="text-h2 font-semibold text-foreground">
            {t("pages.cvs.editor.heading")}
          </h1>
          <div className="flex gap-2">
            <Button variant="outline" size="sm">
              {t("pages.cvs.editor.improve_ai")}
            </Button>
            <Button size="sm">{t("pages.cvs.editor.download_pdf")}</Button>
          </div>
        </div>
        <div className="text-small text-muted-foreground">
          {t("pages.cvs.editor.cv_id", { id })}
        </div>
        <div className="pt-8 text-muted-foreground">
          {t("pages.cvs.editor.placeholder")}
        </div>
      </section>

      {/* Live preview */}
      <section className="overflow-y-auto bg-surface p-8">
        <div className="pb-3 text-label font-medium uppercase tracking-wide text-muted-foreground">
          {t("pages.cvs.editor.preview")}
        </div>
        <div className="aspect-[1/1.414] w-full rounded-lg border border-border bg-surface-elevated shadow-sm" />
      </section>
    </div>
  );
}
