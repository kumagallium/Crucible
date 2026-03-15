"use client";

import { useState, useEffect } from "react";
import { Badge } from "@/components/ui/badge";
import { Sparkles } from "lucide-react";
import type { ReleaseNote } from "@/lib/types";
import { useI18n } from "@/i18n";

const COMMIT_RE = /^\[(\w+)\]\s*([\s\S]+)/;
const TAG_LABELS: Record<string, string> = {
  feat: "NEW",
  fix: "FIX",
  mcp: "MCP",
  infra: "INFRA",
  docs: "DOCS",
  refactor: "OTHER",
  chore: "OTHER",
  port: "OTHER",
};

const TAG_COLORS: Record<string, string> = {
  feat: "bg-[#e8f5e9] text-[#2e7d32] border-[#a5d6a7]",
  fix: "bg-amber-50 text-amber-700 border-amber-200",
  mcp: "bg-violet-50 text-violet-700 border-violet-200",
  infra: "bg-sky-50 text-sky-700 border-sky-200",
  docs: "bg-stone-100 text-stone-600 border-stone-200",
};

interface ParsedCommit {
  tag: string;
  tagRaw: string;
  body: string;
  sha: string;
  date: string;
}

function parseCommit(commit: ReleaseNote): ParsedCommit {
  const m = COMMIT_RE.exec(commit.message);
  if (m) {
    const tagRaw = m[1].toLowerCase();
    return {
      tag: TAG_LABELS[tagRaw] || "OTHER",
      tagRaw,
      body: m[2].trim(),
      sha: commit.sha,
      date: commit.date,
    };
  }
  return {
    tag: "OTHER",
    tagRaw: "other",
    body: commit.message.trim(),
    sha: commit.sha,
    date: commit.date,
  };
}

type FilterType = "all" | "NEW" | "FIX";

export function ReleaseNotesTab() {
  const { t } = useI18n();
  const [commits, setCommits] = useState<ParsedCommit[]>([]);
  const [filter, setFilter] = useState<FilterType>("all");
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch("/release_notes.json")
      .then((r) => r.json())
      .then((data: ReleaseNote[]) => {
        setCommits(data.map(parseCommit));
      })
      .catch(() => setCommits([]))
      .finally(() => setLoading(false));
  }, []);

  if (loading) return null;

  if (commits.length === 0) {
    return (
      <div className="text-center py-16 px-8 bg-muted border border-dashed rounded-xl">
        <div className="text-4xl mb-3">📋</div>
        <h3 className="text-sm font-semibold text-foreground mb-1">
          {t("releaseNotes.empty")}
        </h3>
        <p className="text-xs text-muted-foreground">
          {t("releaseNotes.emptyHint")}
        </p>
      </div>
    );
  }

  const featItems = commits.filter((c) => c.tag === "NEW");

  const grouped = new Map<string, ParsedCommit[]>();
  for (const c of commits) {
    const list = grouped.get(c.date) || [];
    list.push(c);
    grouped.set(c.date, list);
  }

  return (
    <div>
      <h2 className="text-lg font-semibold mb-1">{t("releaseNotes.title")}</h2>
      <p className="text-sm text-muted-foreground mb-6">
        {t("releaseNotes.description")}
      </p>

      {featItems.length > 0 && (
        <div className="mb-6">
          <h3 className="text-sm font-semibold mb-3 flex items-center gap-1.5"><Sparkles className="h-4 w-4 text-[#2e7d32]" />{t("releaseNotes.highlights")}</h3>
          <div className="space-y-2">
            {featItems.map((item) => (
              <div
                key={item.sha}
                className="flex items-center gap-3 p-3 rounded-xl bg-[#e8f5e9] border border-[#a5d6a7]"
              >
                <span className="shrink-0 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-[#c8e6c9] text-[#2e7d32] border border-[#a5d6a7]">
                  {item.tag}
                </span>
                <span className="text-sm font-semibold text-foreground flex-1">
                  {item.body}
                </span>
                <span className="text-xs font-mono text-muted-foreground shrink-0">
                  {item.sha}
                </span>
              </div>
            ))}
          </div>
        </div>
      )}

      <div className="flex gap-2 mb-4">
        {(
          [
            ["all", t("releaseNotes.filterAll")],
            ["NEW", t("releaseNotes.filterNew")],
            ["FIX", t("releaseNotes.filterFix")],
          ] as const
        ).map(([value, label]) => (
          <button
            key={value}
            onClick={() => setFilter(value)}
            className={`px-3 py-1 rounded-full text-xs font-medium border transition-colors ${
              filter === value
                ? "bg-primary text-primary-foreground border-primary"
                : "bg-secondary text-muted-foreground border-border hover:bg-accent"
            }`}
          >
            {label}
          </button>
        ))}
      </div>

      <hr className="border-border mb-6" />

      {Array.from(grouped.entries()).map(([date, items]) => {
        const filteredItems =
          filter === "all" ? items : items.filter((i) => i.tag === filter);
        if (filteredItems.length === 0) return null;

        return (
          <div key={date} className="mb-7">
            <div className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-2.5 pb-1.5 border-b">
              {date}
            </div>
            <div className="space-y-1">
              {filteredItems.map((item) => (
                <div
                  key={item.sha}
                  className="flex items-start gap-2.5 px-3.5 py-2.5 rounded-lg transition-colors hover:bg-accent"
                >
                  <Badge
                    className={`shrink-0 text-xs min-w-[52px] justify-center ${
                      TAG_COLORS[item.tagRaw] || "bg-stone-100 text-stone-500 border-stone-200"
                    }`}
                  >
                    {item.tag}
                  </Badge>
                  <span className="text-sm text-foreground leading-relaxed flex-1">
                    {item.body}
                  </span>
                  <span className="text-xs font-mono text-muted-foreground shrink-0 pt-0.5">
                    {item.sha}
                  </span>
                </div>
              ))}
            </div>
          </div>
        );
      })}
    </div>
  );
}
