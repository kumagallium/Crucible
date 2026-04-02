"use client";

import { useState, useEffect, useCallback } from "react";
import type { Server, ServerStatus, ToolType } from "@/lib/types";
import { ServerCard } from "./server-card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { RefreshCw, Search, Plug, SearchX } from "lucide-react";
import { useI18n } from "@/i18n";

type FilterValue = "all" | ServerStatus;

export function ServersTab() {
  const { t } = useI18n();
  const [servers, setServers] = useState<Server[]>([]);
  const [loading, setLoading] = useState(true);
  const [query, setQuery] = useState("");
  const [filter, setFilter] = useState<FilterValue>("all");
  const [typeFilter, setTypeFilter] = useState<"all" | ToolType>("all");
  const [baseUrl, setBaseUrl] = useState("http://127.0.0.1");

  const FILTERS: { value: FilterValue; label: string }[] = [
    { value: "all", label: t("servers.filterAll") },
    { value: "running", label: "Running" },
    { value: "stopped", label: "Stopped" },
    { value: "error", label: "Error" },
    { value: "deploying", label: "Deploying" },
    { value: "registered", label: "Registered" },
  ];

  const TYPE_FILTERS: { value: "all" | ToolType; label: string }[] = [
    { value: "all", label: t("servers.filterAll") },
    { value: "mcp_server", label: "MCP Server" },
    { value: "cli_library", label: "CLI / Library" },
    { value: "skill", label: "Skill" },
  ];

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

  const total = servers.length;
  const running = servers.filter((s) => s.status === "running").length;
  const stopped = servers.filter((s) => s.status === "stopped").length;
  const deploying = servers.filter((s) => s.status === "deploying").length;

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
  if (typeFilter !== "all") {
    filtered = filtered.filter((s) => (s.tool_type || "mcp_server") === typeFilter);
  }

  return (
    <div>
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

      <div className="flex gap-2 mb-4">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder={t("servers.searchPlaceholder")}
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            className="pl-9"
          />
        </div>
        <Button variant="outline" onClick={load} disabled={loading}>
          <RefreshCw className={`h-4 w-4 ${loading ? "animate-spin" : ""}`} />
          {t("servers.refresh")}
        </Button>
      </div>

      <div className="flex flex-wrap gap-1.5 mb-3">
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

      <div className="flex flex-wrap gap-1.5 mb-6">
        {TYPE_FILTERS.map((f) => (
          <button
            key={f.value}
            onClick={() => setTypeFilter(f.value)}
            className={`inline-flex items-center gap-1.5 px-3.5 py-1 rounded-full text-xs font-medium border transition-all duration-200 ${
              typeFilter === f.value
                ? "bg-primary text-primary-foreground border-primary"
                : "bg-secondary text-muted-foreground border-border hover:bg-accent hover:text-foreground"
            }`}
          >
            {f.label}
          </button>
        ))}
      </div>

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
      return "bg-status-running";
    case "stopped":
      return "bg-status-stopped";
    case "error":
      return "bg-status-error";
    case "deploying":
      return "bg-status-deploying";
    default:
      return "bg-status-stopped";
  }
}

function EmptyState({ hasServers }: { hasServers: boolean }) {
  const { t } = useI18n();

  if (hasServers) {
    return (
      <div className="text-center py-16 px-8 bg-muted border border-dashed rounded-xl">
        <SearchX className="h-9 w-9 text-muted-foreground mx-auto mb-3" />
        <h3 className="text-sm font-semibold text-foreground mb-1">
          {t("servers.noResults")}
        </h3>
        <p className="text-xs text-muted-foreground">
          {t("servers.noResultsHint")}
        </p>
      </div>
    );
  }
  return (
    <div className="text-center py-16 px-8 bg-muted border border-dashed rounded-xl">
      <Plug className="h-9 w-9 text-muted-foreground mx-auto mb-3" />
      <h3 className="text-sm font-semibold text-foreground mb-1">
        {t("servers.noServers")}
      </h3>
      <p className="text-xs text-muted-foreground">
        {t("servers.noServersHint")}
      </p>
    </div>
  );
}
