"use client";

import { useState, useEffect, useCallback } from "react";
import type { Server, ServerStatus } from "@/lib/types";
import { ServerCard } from "./server-card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { RefreshCw, Search, Plug, SearchX } from "lucide-react";

type FilterValue = "all" | ServerStatus;

const FILTERS: { value: FilterValue; label: string }[] = [
  { value: "all", label: "すべて" },
  { value: "running", label: "Running" },
  { value: "stopped", label: "Stopped" },
  { value: "error", label: "Error" },
  { value: "deploying", label: "Deploying" },
];

export function ServersTab() {
  const [servers, setServers] = useState<Server[]>([]);
  const [loading, setLoading] = useState(true);
  const [query, setQuery] = useState("");
  const [filter, setFilter] = useState<FilterValue>("all");
  const [baseUrl, setBaseUrl] = useState("http://127.0.0.1");

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const [serversRes, settingsRes] = await Promise.all([
        fetch("/api/servers"),
        fetch("/api/settings"),
      ]);
      if (serversRes.ok) setServers(await serversRes.json());
      if (settingsRes.ok) {
        const settings = await settingsRes.json();
        if (settings.base_url) setBaseUrl(settings.base_url);
      }
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  // 集計
  const total = servers.length;
  const running = servers.filter((s) => s.status === "running").length;
  const stopped = servers.filter((s) => s.status === "stopped").length;
  const deploying = servers.filter((s) => s.status === "deploying").length;

  // フィルタリング
  let filtered = servers;
  if (query) {
    const q = query.toLowerCase();
    filtered = filtered.filter(
      (s) =>
        s.name.toLowerCase().includes(q) ||
        s.display_name.toLowerCase().includes(q) ||
        s.description.toLowerCase().includes(q)
    );
  }
  if (filter !== "all") {
    filtered = filtered.filter((s) => s.status === filter);
  }

  return (
    <div>
      {/* ステータスバッジ */}
      <div className="flex flex-wrap gap-2 mb-4">
        <Badge variant="outline">{total} servers</Badge>
        <Badge variant="running">
          <span className="inline-block w-1.5 h-1.5 rounded-full bg-current animate-pulse" />
          {running} running
        </Badge>
        <Badge variant="stopped">
          <span className="inline-block w-1.5 h-1.5 rounded-full bg-current" />
          {stopped} stopped
        </Badge>
        {deploying > 0 && (
          <Badge variant="deploying">
            <span className="inline-block w-1.5 h-1.5 rounded-full bg-current animate-pulse" />
            {deploying} deploying
          </Badge>
        )}
      </div>

      {/* 検索 + 更新 */}
      <div className="flex gap-2 mb-4">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="サーバー名・説明で検索..."
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            className="pl-9"
          />
        </div>
        <Button variant="outline" onClick={load} disabled={loading}>
          <RefreshCw className={`h-4 w-4 ${loading ? "animate-spin" : ""}`} />
          更新
        </Button>
      </div>

      {/* フィルターピル */}
      <div className="flex flex-wrap gap-1.5 mb-6">
        {FILTERS.map((f) => (
          <button
            key={f.value}
            onClick={() => setFilter(f.value)}
            className={`inline-flex items-center gap-1.5 px-3.5 py-1 rounded-full text-xs font-medium border transition-all duration-200 ${
              filter === f.value
                ? "bg-primary text-primary-foreground border-primary"
                : "bg-secondary text-muted-foreground border-border hover:bg-accent hover:text-foreground"
            }`}
          >
            {f.value !== "all" && (
              <span
                className={`inline-block w-1.5 h-1.5 rounded-full ${
                  filter === f.value ? "bg-current" : statusDotColor(f.value)
                }`}
              />
            )}
            {f.label}
          </button>
        ))}
      </div>

      {/* カードグリッド or 空状態 */}
      {filtered.length === 0 ? (
        <EmptyState hasServers={servers.length > 0} />
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {filtered.map((srv) => (
            <ServerCard key={srv.name} server={srv} baseUrl={baseUrl} onAction={load} />
          ))}
        </div>
      )}
    </div>
  );
}

function statusDotColor(status: string): string {
  switch (status) {
    case "running":
      return "bg-[#4B7A52]";
    case "stopped":
      return "bg-stone-400";
    case "error":
      return "bg-red-500";
    case "deploying":
      return "bg-sky-500";
    default:
      return "bg-stone-400";
  }
}

function EmptyState({ hasServers }: { hasServers: boolean }) {
  if (hasServers) {
    return (
      <div className="text-center py-16 px-8 bg-muted border border-dashed rounded-xl">
        <SearchX className="h-9 w-9 text-muted-foreground mx-auto mb-3" />
        <h3 className="text-sm font-semibold text-foreground mb-1">
          検索結果がありません
        </h3>
        <p className="text-xs text-muted-foreground">
          検索条件を変更してみてください
        </p>
      </div>
    );
  }
  return (
    <div className="text-center py-16 px-8 bg-muted border border-dashed rounded-xl">
      <Plug className="h-9 w-9 text-muted-foreground mx-auto mb-3" />
      <h3 className="text-sm font-semibold text-foreground mb-1">
        サーバーが登録されていません
      </h3>
      <p className="text-xs text-muted-foreground">
        「Register」タブから追加してください
      </p>
    </div>
  );
}
