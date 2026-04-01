"use client";

import { useState } from "react";
import type { Server } from "@/lib/types";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { RotateCw, Square, RefreshCw, Link, Trash2, ExternalLink, Copy, Check } from "lucide-react";
import { stopServer, restartServer, difyConnectServer, deleteServer, fetchJobLogs } from "@/lib/api";
import { useI18n } from "@/i18n";

const bannerStyles: Record<string, string> = {
  running: "bg-gradient-to-br from-status-running-bg to-status-running-bg-deep",
  stopped: "bg-gradient-to-br from-status-stopped-bg to-status-stopped-bg-deep",
  error: "bg-gradient-to-br from-status-error-bg to-status-error-bg-deep",
  deploying: "bg-gradient-to-br from-status-deploying-bg to-status-deploying-bg-deep",
};

const iconBg: Record<string, string> = {
  running: "bg-status-running-bg-deep",
  stopped: "bg-status-stopped-bg",
  error: "bg-status-error-bg",
  deploying: "bg-status-deploying-bg",
};

interface ServerCardProps {
  server: Server;
  baseUrl: string;
  onAction: () => void;
}

export function ServerCard({ server, baseUrl, onAction }: ServerCardProps) {
  const { t } = useI18n();
  const [loading, setLoading] = useState(false);
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [copied, setCopied] = useState(false);

  const endpoint = `${baseUrl}:${server.port}${server.endpoint_path ?? "/sse"}`;
  const repoShort = server.github_url.replace("https://github.com/", "");
  const subdir = server.subdir ? ` / ${server.subdir}` : "";

  async function waitForJob(jobId: string) {
    const poll = async (): Promise<string> => {
      const data = await fetchJobLogs(jobId, 0);
      if (data.status === "success" || data.status === "error") return data.status;
      await new Promise((r) => setTimeout(r, 2000));
      return poll();
    };
    return poll();
  }

  async function handleStop() {
    setLoading(true);
    try {
      const result = await stopServer(server.name);
      await waitForJob(result.job_id);
      onAction();
    } catch {
      // silently handle
    } finally {
      setLoading(false);
    }
  }

  async function handleRestart() {
    setLoading(true);
    try {
      const result = await restartServer(server.name);
      await waitForJob(result.job_id);
      onAction();
    } catch {
      // silently handle
    } finally {
      setLoading(false);
    }
  }

  async function handleDifyConnect() {
    setLoading(true);
    try {
      const result = await difyConnectServer(server.name);
      await waitForJob(result.job_id);
      onAction();
    } catch {
      // silently handle
    } finally {
      setLoading(false);
    }
  }

  async function handleDelete() {
    setLoading(true);
    setDeleteOpen(false);
    try {
      const result = await deleteServer(server.name);
      await waitForJob(result.job_id);
      onAction();
    } catch {
      // silently handle
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="group flex flex-col rounded-xl border bg-card shadow-sm transition-all duration-200 hover:shadow-md hover:border-primary/30 overflow-hidden">
      <div
        className={`relative flex items-end h-13 px-3.5 pb-2 ${bannerStyles[server.status] || bannerStyles.stopped}`}
      >
        <div
          className={`flex items-center justify-center w-9 h-9 rounded-lg text-lg border-2 border-white/70 shadow-sm ${iconBg[server.status] || iconBg.stopped}`}
        >
          {server.icon}
        </div>
        <div className="absolute top-2 right-2.5">
          <StatusBadge status={server.status} />
        </div>
      </div>

      <div className="flex-1 px-4 pt-2.5 pb-2.5">
        <h3 className="text-sm font-semibold text-foreground truncate">
          {server.display_name}
        </h3>
        <p className="text-xs font-mono text-muted-foreground mb-1.5">
          {server.name}
        </p>
        <p className="text-sm text-muted-foreground leading-relaxed line-clamp-2 min-h-[38px] mb-2">
          {server.description}
        </p>

        {server.status === "error" && server.error_message && (
          <p className="text-xs text-status-error mb-1.5">
            {server.error_message}
          </p>
        )}

        <div className="flex flex-wrap gap-1.5 mb-2">
          <Badge variant={server.group === "default" ? "official" : "community"}>
            {server.group === "default" ? "Official" : "Community"}
          </Badge>
          <Badge variant={server.dify_registered ? "difyOk" : "difyNg"}>
            {server.dify_registered ? "✓ Dify" : "Dify"}
          </Badge>
          <Badge variant="port">:{server.port}</Badge>
        </div>

        <div className="flex items-center gap-1 mb-1.5">
          <div className="flex-1 text-xs font-mono text-muted-foreground bg-muted border rounded-lg px-2 py-1 truncate">
            {endpoint}
          </div>
          <Button
            variant="ghost"
            size="sm"
            className="h-7 w-7 p-0 shrink-0 text-muted-foreground"
            onClick={() => {
              const textarea = document.createElement("textarea");
              textarea.value = endpoint;
              textarea.style.position = "fixed";
              textarea.style.opacity = "0";
              document.body.appendChild(textarea);
              textarea.select();
              document.execCommand("copy");
              document.body.removeChild(textarea);
              setCopied(true);
              setTimeout(() => setCopied(false), 2000);
            }}
          >
            {copied ? <Check className="h-3 w-3 text-status-running" /> : <Copy className="h-3 w-3" />}
          </Button>
        </div>

        <div className="text-xs text-muted-foreground">
          <a
            href={server.github_url}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-1 text-foreground font-medium hover:underline"
          >
            <ExternalLink className="h-3 w-3" />
            {repoShort}
          </a>
          <span className="ml-1">
            · {server.branch}
            {subdir}
          </span>
        </div>
      </div>

      <div className="flex justify-end gap-1 px-3.5 py-2 border-t bg-muted/50">
        {/* 停止ボタン: running 時のみ */}
        {server.status === "running" && (
          <Button
            variant="ghost"
            size="sm"
            className="h-7 text-xs text-muted-foreground"
            onClick={handleStop}
            disabled={loading}
          >
            <Square className="h-3 w-3" />
            {t("serverCard.stop")}
          </Button>
        )}

        {/* 再起動ボタン: running / stopped 時 */}
        {(server.status === "running" || server.status === "stopped") && (
          <Button
            variant="ghost"
            size="sm"
            className="h-7 text-xs text-muted-foreground"
            onClick={handleRestart}
            disabled={loading}
          >
            <RotateCw className={`h-3 w-3 ${loading ? "animate-spin" : ""}`} />
            {t("serverCard.restart")}
          </Button>
        )}

        {/* リトライボタン: error 時 */}
        {server.status === "error" && (
          <Button
            variant="ghost"
            size="sm"
            className="h-7 text-xs text-muted-foreground"
            onClick={handleRestart}
            disabled={loading}
          >
            <RefreshCw className={`h-3 w-3 ${loading ? "animate-spin" : ""}`} />
            {t("serverCard.retry")}
          </Button>
        )}

        {/* Dify 接続ボタン: running かつ Dify 未登録時 */}
        {server.status === "running" && !server.dify_registered && (
          <Button
            variant="ghost"
            size="sm"
            className="h-7 text-xs text-muted-foreground"
            onClick={handleDifyConnect}
            disabled={loading}
          >
            <Link className="h-3 w-3" />
            {t("serverCard.difyConnect")}
          </Button>
        )}

        <Dialog open={deleteOpen} onOpenChange={setDeleteOpen}>
          <DialogTrigger asChild>
            <Button
              variant="ghost"
              size="sm"
              className="h-7 text-xs text-muted-foreground hover:text-destructive hover:bg-status-error-bg"
              disabled={loading}
            >
              <Trash2 className="h-3 w-3" />
              {t("serverCard.delete")}
            </Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>{t("serverCard.deleteTitle")}</DialogTitle>
              <DialogDescription>
                {t("serverCard.deleteConfirm", { name: server.name })}
              </DialogDescription>
            </DialogHeader>
            <DialogFooter>
              <Button variant="outline" onClick={() => setDeleteOpen(false)}>
                {t("serverCard.cancel")}
              </Button>
              <Button variant="destructive" onClick={handleDelete}>
                {t("serverCard.deleteButton")}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>
    </div>
  );
}

function StatusBadge({ status }: { status: string }) {
  const dotClass =
    status === "running" || status === "deploying"
      ? "animate-pulse"
      : "";

  return (
    <Badge variant={status as "running" | "stopped" | "error" | "deploying"}>
      <span
        className={`inline-block w-1.5 h-1.5 rounded-full bg-current ${dotClass}`}
      />
      {status.charAt(0).toUpperCase() + status.slice(1)}
    </Badge>
  );
}
