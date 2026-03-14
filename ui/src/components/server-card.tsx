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
import { RotateCw, Trash2, ExternalLink, Copy, Check } from "lucide-react";
import { restartServer, deleteServer, fetchJobLogs } from "@/lib/api";

// ステータスごとのバナー色
// テーマグリーンに合わせたバナー色
const bannerStyles: Record<string, string> = {
  running: "bg-gradient-to-br from-[#e8f5e9] to-[#c8e6c9]",
  stopped: "bg-gradient-to-br from-stone-100 to-stone-200",
  error: "bg-gradient-to-br from-red-100 to-red-200",
  deploying: "bg-gradient-to-br from-sky-100 to-sky-200",
};

const iconBg: Record<string, string> = {
  running: "bg-[#c8e6c9]",
  stopped: "bg-stone-100",
  error: "bg-red-100",
  deploying: "bg-sky-100",
};

interface ServerCardProps {
  server: Server;
  baseUrl: string;
  onAction: () => void;
}

export function ServerCard({ server, baseUrl, onAction }: ServerCardProps) {
  const [loading, setLoading] = useState(false);
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [copied, setCopied] = useState(false);

  // SSE エンドポイント URL（ベース URL は API settings から取得）
  const sse = `${baseUrl}:${server.port}/sse`;
  const repoShort = server.github_url.replace("https://github.com/", "");
  const subdir = server.subdir ? ` / ${server.subdir}` : "";

  // ジョブ完了待ち
  async function waitForJob(jobId: string) {
    const poll = async (): Promise<string> => {
      const data = await fetchJobLogs(jobId, 0);
      if (data.status === "success" || data.status === "error") return data.status;
      await new Promise((r) => setTimeout(r, 2000));
      return poll();
    };
    return poll();
  }

  async function handleRestart() {
    setLoading(true);
    try {
      const result = await restartServer(server.name);
      await waitForJob(result.job_id);
      onAction();
    } catch {
      // エラーは静かに処理
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
      // エラーは静かに処理
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="group rounded-xl border bg-card shadow-sm transition-all duration-200 hover:shadow-md hover:border-primary/30 overflow-hidden">
      {/* バナー */}
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

      {/* ボディ */}
      <div className="px-4 pt-2.5 pb-2.5">
        <h3 className="text-sm font-semibold text-foreground truncate">
          {server.display_name}
        </h3>
        <p className="text-xs font-mono text-muted-foreground mb-1.5">
          {server.name}
        </p>
        <p className="text-sm text-muted-foreground leading-relaxed line-clamp-2 min-h-[38px] mb-2">
          {server.description}
        </p>

        {/* エラーメッセージ */}
        {server.status === "error" && server.error_message && (
          <p className="text-xs text-red-600 mb-1.5">
            {server.error_message}
          </p>
        )}

        {/* バッジ群 */}
        <div className="flex flex-wrap gap-1.5 mb-2">
          <Badge variant={server.group === "default" ? "official" : "community"}>
            {server.group === "default" ? "Official" : "Community"}
          </Badge>
          <Badge variant={server.dify_registered ? "difyOk" : "difyNg"}>
            {server.dify_registered ? "✓ Dify" : "Dify"}
          </Badge>
          <Badge variant="port">:{server.port}</Badge>
        </div>

        {/* SSE エンドポイント */}
        <div className="flex items-center gap-1 mb-1.5">
          <div className="flex-1 text-xs font-mono text-muted-foreground bg-muted border rounded-lg px-2 py-1 truncate">
            {sse}
          </div>
          <Button
            variant="ghost"
            size="sm"
            className="h-7 w-7 p-0 shrink-0 text-muted-foreground"
            onClick={() => {
              // HTTP 環境では navigator.clipboard が使えないため fallback
              const textarea = document.createElement("textarea");
              textarea.value = sse;
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
            {copied ? <Check className="h-3 w-3 text-green-600" /> : <Copy className="h-3 w-3" />}
          </Button>
        </div>

        {/* リポジトリリンク */}
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

      {/* フッター */}
      <div className="flex justify-end gap-1 px-3.5 py-2 border-t bg-muted/50">
        <Button
          variant="ghost"
          size="sm"
          className="h-7 text-xs text-muted-foreground"
          onClick={handleRestart}
          disabled={loading}
        >
          <RotateCw className={`h-3 w-3 ${loading ? "animate-spin" : ""}`} />
          再起動
        </Button>

        <Dialog open={deleteOpen} onOpenChange={setDeleteOpen}>
          <DialogTrigger asChild>
            <Button
              variant="ghost"
              size="sm"
              className="h-7 text-xs text-muted-foreground hover:text-red-500 hover:bg-red-50"
              disabled={loading}
            >
              <Trash2 className="h-3 w-3" />
              削除
            </Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>サーバーを削除</DialogTitle>
              <DialogDescription>
                「{server.name}」を削除しますか？この操作は取り消せません。
              </DialogDescription>
            </DialogHeader>
            <DialogFooter>
              <Button variant="outline" onClick={() => setDeleteOpen(false)}>
                キャンセル
              </Button>
              <Button variant="destructive" onClick={handleDelete}>
                削除する
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
