"use client";

import { BookOpen, Target, Palette } from "lucide-react";
import { useI18n } from "@/i18n";

export function AboutTab() {
  const { t } = useI18n();

  return (
    <div className="max-w-3xl mx-auto">
      <h2 className="text-lg font-semibold mb-1">{t("about.title")}</h2>
      <p className="text-sm text-muted-foreground mb-6">
        {t("about.subtitle")}
      </p>

      <div className="space-y-4">
        <section className="rounded-xl border bg-card p-6">
          <h3 className="text-sm font-semibold mb-3 flex items-center gap-2">
            <BookOpen className="h-4 w-4 text-muted-foreground" />
            {t("about.originTitle")}
          </h3>
          <div className="space-y-3 text-sm text-muted-foreground leading-relaxed">
            <p>{t("about.originDesc1")}</p>
            <p>
              {t("about.originDesc2")}
            </p>
          </div>
        </section>

        <section className="rounded-xl border bg-card p-6">
          <h3 className="text-sm font-semibold mb-3 flex items-center gap-2">
            <Target className="h-4 w-4 text-muted-foreground" />
            {t("about.approachTitle")}
          </h3>
          <div className="space-y-3 text-sm text-muted-foreground leading-relaxed">
            <p>{t("about.approachDesc1")}</p>
            <p>{t("about.approachDesc2")}</p>
          </div>
        </section>

        <section className="rounded-xl border bg-card p-6">
          <h3 className="text-sm font-semibold mb-3 flex items-center gap-2">
            <Palette className="h-4 w-4 text-muted-foreground" />
            {t("about.logoTitle")}
          </h3>
          <p className="text-sm text-muted-foreground leading-relaxed">
            {t("about.logoDesc")}
          </p>
        </section>
      </div>
    </div>
  );
}
