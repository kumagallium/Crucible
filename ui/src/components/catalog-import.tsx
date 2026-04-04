"use client";

import { useState, useEffect } from "react";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Search, Loader2, ExternalLink, ArrowRight, AlertCircle } from "lucide-react";
import { fetchCatalog } from "@/lib/api";
import type { CatalogEntry, CatalogCategory, ToolType } from "@/lib/types";
import { useI18n } from "@/i18n";

// tool_type → 短いラベル
const toolTypeLabel: Record<ToolType, string> = {
  mcp_server: "MCP",
  cli_library: "CLI",
  skill: "Skill",
};

// trust_level → Badge バリアントのマッピング
const trustVariant: Record<string, "e4m" | "official" | "verified" | "community"> = {
  e4m: "e4m",
  official: "official",
  verified: "verified",
  community: "community",
};

interface CatalogImportProps {
  onSelect: (entry: CatalogEntry) => void;
  toolType: ToolType;
}

export function CatalogImport({ onSelect, toolType }: CatalogImportProps) {
  const { t } = useI18n();
  const [entries, setEntries] = useState<CatalogEntry[]>([]);
  const [categories, setCategories] = useState<CatalogCategory[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [search, setSearch] = useState("");
  const [activeCategory, setActiveCategory] = useState<string>("all");

  useEffect(() => {
    fetchCatalog()
      .then((data) => {
        setEntries(data.servers);
        setCategories(data.categories);
      })
      .catch((err) => {
        setError(err instanceof Error ? err.message : String(err));
      })
      .finally(() => setLoading(false));
  }, []);

  const filtered = entries.filter((e) => {
    // tool_types が存在しないエントリは mcp_server として扱う（後方互換）
    const types = e.tool_types?.length ? e.tool_types : ["mcp_server"];
    const matchesToolType = types.includes(toolType);
    const matchesCategory = activeCategory === "all" || e.category_slug === activeCategory;
    const q = search.toLowerCase();
    const matchesSearch =
      !q ||
      e.name.toLowerCase().includes(q) ||
      e.description.toLowerCase().includes(q) ||
      e.author.toLowerCase().includes(q) ||
      e.tags.some((tag) => tag.toLowerCase().includes(q));
    return matchesToolType && matchesCategory && matchesSearch;
  });

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12 text-muted-foreground">
        <Loader2 className="h-5 w-5 animate-spin mr-2" />
        {t("catalog.loading")}
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex items-center gap-3 p-4 rounded-xl bg-status-error-bg border border-status-error-border">
        <AlertCircle className="h-6 w-6 text-status-error shrink-0" />
        <div>
          <p className="text-sm font-semibold text-status-error">{t("catalog.error")}</p>
          <p className="text-xs text-destructive-text">{error}</p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* 検索 */}
      <div className="relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
        <Input
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder={t("catalog.searchPlaceholder")}
          className="pl-9"
        />
      </div>

      {/* カテゴリフィルタ — MASTER.md 8.4 フィルターチップパターン */}
      <div className="flex flex-wrap gap-1.5">
        <button
          onClick={() => setActiveCategory("all")}
          className={`inline-flex items-center gap-1.5 px-3.5 py-1 rounded-full text-xs font-medium border transition-all duration-200 ${
            activeCategory === "all"
              ? "bg-primary text-primary-foreground border-primary"
              : "bg-secondary text-muted-foreground border-border hover:bg-accent hover:text-foreground"
          }`}
        >
          {t("catalog.filterAll")}
        </button>
        {categories.map((cat) => (
          <button
            key={cat.slug}
            onClick={() => setActiveCategory(cat.slug)}
            className={`inline-flex items-center gap-1.5 px-3.5 py-1 rounded-full text-xs font-medium border transition-all duration-200 ${
              activeCategory === cat.slug
                ? "bg-primary text-primary-foreground border-primary"
                : "bg-secondary text-muted-foreground border-border hover:bg-accent hover:text-foreground"
            }`}
          >
            {cat.label}
          </button>
        ))}
      </div>

      {/* カタログ一覧 */}
      {filtered.length === 0 ? (
        <div className="text-center py-16 px-8 bg-muted border border-dashed rounded-xl">
          <Search className="h-9 w-9 text-muted-foreground mx-auto mb-3" />
          <h3 className="text-sm font-semibold text-foreground mb-1">{t("catalog.noResults")}</h3>
        </div>
      ) : (
        <div className="space-y-2 max-h-[420px] overflow-y-auto pr-1">
          {filtered.map((entry) => (
            <button
              key={entry.id}
              onClick={() => onSelect(entry)}
              className="w-full text-left p-3 rounded-xl border bg-card hover:shadow-md hover:border-primary/30 transition-all duration-200 group"
            >
              <div className="flex items-start justify-between gap-2">
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-1.5 mb-1">
                    <span className="text-sm font-semibold truncate">{entry.name}</span>
                    <Badge variant={trustVariant[entry.trust_level] || "community"}>
                      {entry.trust_level}
                    </Badge>
                    {entry.tool_types?.length > 1 && entry.tool_types.map((tt) => (
                      <span
                        key={tt}
                        className="inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-medium bg-muted text-muted-foreground"
                      >
                        {toolTypeLabel[tt]}
                      </span>
                    ))}
                    {entry.featured && (
                      <Badge variant="featured">
                        featured
                      </Badge>
                    )}
                  </div>
                  <p className="text-xs text-muted-foreground line-clamp-1 mb-1.5">
                    {entry.description}
                  </p>
                  <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
                    <span>{entry.author}</span>
                    <span>·</span>
                    <span>{entry.category_label}</span>
                    {entry.tool_count > 0 && (
                      <>
                        <span>·</span>
                        <span>{entry.tool_count} tools</span>
                      </>
                    )}
                    {entry.env_vars_json.length > 0 && (
                      <>
                        <span>·</span>
                        <span className="text-warning">
                          {t("catalog.requiresEnvVars")}
                        </span>
                      </>
                    )}
                  </div>
                </div>
                <ArrowRight className="h-4 w-4 text-muted-foreground opacity-0 group-hover:opacity-100 transition-opacity shrink-0 mt-1" />
              </div>
            </button>
          ))}
        </div>
      )}

      {/* e4m リンク */}
      <div className="pt-2 border-t">
        <a
          href="https://e4m.jp/mcp-catalog/"
          target="_blank"
          rel="noopener noreferrer"
          className="inline-flex items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground transition-colors"
        >
          <ExternalLink className="h-3 w-3" />
          {t("catalog.viewFullCatalog")}
        </a>
      </div>
    </div>
  );
}
