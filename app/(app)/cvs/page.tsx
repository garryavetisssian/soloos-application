import Link from "next/link";
import { FileText, Sparkles } from "lucide-react";
import { Button } from "@/components/ui/button";
import { getServerT } from "@/lib/i18n/server";

export default async function CvsPage() {
  const { t } = await getServerT();
  return (
    <div className="mx-auto flex max-w-[1080px] flex-col px-6 py-10 sm:px-10">
      <header className="flex flex-wrap items-end justify-between gap-3 animate-fade-in">
        <div>
          <h1 className="text-h1 font-semibold text-foreground">
            {t("pages.cvs.title")}
          </h1>
          <p className="mt-2 max-w-[58ch] text-body text-muted-foreground">
            {t("pages.cvs.subtitle")}
          </p>
        </div>
        <Button disabled>{t("pages.cvs.new_cv")}</Button>
      </header>

      <section className="mt-8 flex flex-col items-center rounded-xl border border-border bg-surface px-6 py-16 text-center shadow-sm animate-fade-in sm:px-12">
        <span className="flex h-14 w-14 items-center justify-center rounded-xl bg-accent-soft text-primary">
          <FileText className="h-6 w-6" />
        </span>
        <h2 className="mt-5 text-h2 font-semibold text-foreground">
          {t("pages.cvs.coming_title")}
        </h2>
        <p className="mx-auto mt-2 max-w-[52ch] text-small text-muted-foreground">
          {t("pages.cvs.coming_body_lead")}{" "}
          <span className="rounded-md bg-surface-elevated px-1.5 py-0.5 font-mono text-label text-foreground">
            {t("pages.cvs.filename_example")}
          </span>{" "}
          {t("pages.cvs.coming_body_tail")}
        </p>

        <div className="mt-7 flex flex-wrap items-center justify-center gap-2">
          <Button asChild size="lg">
            <Link href="/cover-letters/new">
              <Sparkles className="h-4 w-4" />
              {t("pages.cvs.cta_try_letters")}
            </Link>
          </Button>
          <Button asChild variant="outline" size="lg">
            <Link href="/settings/profile">
              {t("pages.cvs.cta_polish_profile")}
            </Link>
          </Button>
        </div>
      </section>
    </div>
  );
}
