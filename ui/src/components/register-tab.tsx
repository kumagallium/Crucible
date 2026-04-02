"use client";

import { useState, useRef } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Checkbox } from "@/components/ui/checkbox";
import { Separator } from "@/components/ui/separator";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Rocket, ChevronDown, ChevronRight, CheckCircle2, XCircle, Plus, BookOpen, GitBranch } from "lucide-react";
import { registerServer, fetchJobLogs } from "@/lib/api";
import type { RegisterRequest, CatalogEntry } from "@/lib/types";
import { useI18n } from "@/i18n";
import { CatalogImport } from "./catalog-import";

type Mode = "catalog" | "manual";

export function RegisterTab() {
  const { t } = useI18n();
  const [mode, setMode] = useState<Mode>("catalog");
  const [deploying, setDeploying] = useState(false);
  const [deployStatus, setDeployStatus] = useState<"success" | "error" | null>(null);
  const [logs, setLogs] = useState<string[]>([]);
  const [showAdvanced, setShowAdvanced] = useState(false);
  const [selectedEntry, setSelectedEntry] = useState<CatalogEntry | null>(null);
  const logRef = useRef<HTMLDivElement>(null);
  const formRef = useRef<HTMLFormElement>(null);

  function handleReset() {
    setDeployStatus(null);
    setLogs([]);
    setDeploying(false);
    setShowAdvanced(false);
    setSelectedEntry(null);
    formRef.current?.reset();
  }

  function handleCatalogSelect(entry: CatalogEntry) {
    setSelectedEntry(entry);
    setShowAdvanced(true);
    // モードを手動に切り替え、フォームにカタログデータを流し込む
    setMode("manual");
  }

  // install_command からサブディレクトリを抽出（例: "cd e4m-data && uv sync" → "e4m-data"）
  function extractSubdir(entry: CatalogEntry): string {
    const match = entry.install_command?.match(/^cd\s+([^\s&|;]+)/);
    return match ? match[1] : "";
  }

  // カタログエントリから環境変数テンプレートを生成
  function buildEnvTemplate(entry: CatalogEntry): string {
    return entry.env_vars_json
      .map((v) => `${v.name}=`)
      .join("\n");
  }

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setDeploying(true);
    setDeployStatus(null);
    setLogs([]);

    const fd = new FormData(e.currentTarget);

    const envVars: Record<string, string> = {};
    const envText = (fd.get("env_vars") as string) || "";
    for (const line of envText.split("\n")) {
      const idx = line.indexOf("=");
      if (idx > 0) {
        envVars[line.slice(0, idx).trim()] = line.slice(idx + 1).trim();
      }
    }

    const toolType = (fd.get("tool_type") as string) || "mcp_server";

    const data: RegisterRequest = {
      github_url: (fd.get("github_url") as string).trim(),
      branch: (fd.get("branch") as string).trim() || "main",
      subdir: (fd.get("subdir") as string).trim(),
      tool_type: toolType as "mcp_server" | "cli_library" | "skill",
      install_command: (fd.get("install_command") as string)?.trim() || "",
      github_token: (fd.get("github_token") as string).trim(),
      name: (fd.get("name") as string)?.trim() || null,
      display_name: (fd.get("display_name") as string)?.trim() || null,
      description: (fd.get("description") as string)?.trim() || "",
      icon: (fd.get("icon") as string)?.trim() || "🔧",
      group: (fd.get("group") as "default" | "user") || "user",
      dify_auto_register: toolType === "mcp_server" && fd.get("dify_auto") === "on",
      env_vars: envVars,
    };

    try {
      const result = await registerServer(data);
      await streamLogs(result.job_id);
    } catch (err) {
      setDeployStatus("error");
      setLogs((prev) => [...prev, `${t("register.error")}${err instanceof Error ? err.message : String(err)}`]);
    } finally {
      setDeploying(false);
    }
  }

  async function streamLogs(jobId: string) {
    let offset = 0;
    const allLines: string[] = [];

    while (true) {
      try {
        const data = await fetchJobLogs(jobId, offset);
        if (data.logs.length > 0) {
          allLines.push(...data.logs);
          offset = data.total;
          setLogs([...allLines]);
          setTimeout(() => {
            logRef.current?.scrollTo(0, logRef.current.scrollHeight);
          }, 50);
        }
        if (data.status === "success" || data.status === "error") {
          setDeployStatus(data.status);
          return;
        }
      } catch {
        // continue polling
      }
      await new Promise((r) => setTimeout(r, 2000));
    }
  }

  // --- デプロイ結果画面 ---
  if (deployStatus !== null) {
    const isSuccess = deployStatus === "success";
    return (
      <div>
        <h2 className="text-lg font-semibold mb-1">{t("register.title")}</h2>
        <p className="text-sm text-muted-foreground mb-6">
          {t("register.description")}
        </p>

        {isSuccess ? (
          <div className="flex items-center gap-3 p-4 rounded-xl bg-success-bg border border-success-border mb-6">
            <CheckCircle2 className="h-6 w-6 text-status-running shrink-0" />
            <div>
              <p className="text-sm font-semibold text-success">{t("register.deploySuccess")}</p>
              <p className="text-xs text-status-running">{t("register.deploySuccessHint")}</p>
            </div>
          </div>
        ) : (
          <div className="flex items-center gap-3 p-4 rounded-xl bg-status-error-bg border border-status-error-border mb-6">
            <XCircle className="h-6 w-6 text-status-error shrink-0" />
            <div>
              <p className="text-sm font-semibold text-status-error">{t("register.deployFailed")}</p>
              <p className="text-xs text-destructive-text">{t("register.deployFailedHint")}</p>
            </div>
          </div>
        )}

        {logs.length > 0 && (
          <div className="mb-6">
            <h3 className="text-sm font-medium mb-2">{t("register.deployLog")}</h3>
            <div
              ref={logRef}
              className="h-56 overflow-y-auto rounded-lg border bg-stone-900 text-stone-400 font-mono text-xs leading-relaxed p-3 whitespace-pre-wrap break-all"
            >
              {logs.join("\n")}
            </div>
          </div>
        )}

        <Button onClick={handleReset} className="w-full" size="lg">
          <Plus className="h-4 w-4" />
          {t("register.registerAnother")}
        </Button>
      </div>
    );
  }

  // --- メイン登録画面 ---
  return (
    <div>
      <h2 className="text-lg font-semibold mb-1">{t("register.title")}</h2>
      <p className="text-sm text-muted-foreground mb-6">
        {t("register.description")}
      </p>

      {/* モード切替タブ */}
      <div className="flex gap-1 p-1 rounded-lg bg-muted mb-6">
        <button
          onClick={() => { setMode("catalog"); setSelectedEntry(null); }}
          className={`flex-1 flex items-center justify-center gap-1.5 px-3 py-2 rounded-lg text-sm font-medium transition-colors ${
            mode === "catalog"
              ? "bg-background text-foreground shadow-sm"
              : "text-muted-foreground hover:text-foreground"
          }`}
        >
          <BookOpen className="h-4 w-4" />
          {t("register.modeCatalog")}
        </button>
        <button
          onClick={() => setMode("manual")}
          className={`flex-1 flex items-center justify-center gap-1.5 px-3 py-2 rounded-lg text-sm font-medium transition-colors ${
            mode === "manual"
              ? "bg-background text-foreground shadow-sm"
              : "text-muted-foreground hover:text-foreground"
          }`}
        >
          <GitBranch className="h-4 w-4" />
          {t("register.modeManual")}
        </button>
      </div>

      {/* カタログモード */}
      {mode === "catalog" && (
        <CatalogImport onSelect={handleCatalogSelect} />
      )}

      {/* 手動モード（カタログ選択後も含む） */}
      {mode === "manual" && (
        <>
          {/* カタログから選択された場合のバナー — MASTER.md 8.5 Info アラート */}
          {selectedEntry && (
            <div className="flex items-center gap-3 p-4 rounded-xl border bg-info-bg border-info-border mb-6">
              <BookOpen className="h-4 w-4 text-info shrink-0" />
              <div className="flex-1 min-w-0">
                <p className="text-sm font-semibold text-info">
                  {t("register.catalogSelected", { name: selectedEntry.name })}
                </p>
                <p className="text-xs text-muted-foreground">
                  {t("register.catalogSelectedHint")}
                </p>
              </div>
              <button
                onClick={() => { setSelectedEntry(null); setMode("catalog"); }}
                className="text-xs text-info hover:underline shrink-0"
              >
                {t("register.catalogChange")}
              </button>
            </div>
          )}

          <form ref={formRef} onSubmit={handleSubmit} className="space-y-6">
            <div>
              <Label htmlFor="tool_type">Tool Type</Label>
              <div className="flex gap-1.5 mt-1.5 mb-4">
                {(["mcp_server", "cli_library", "skill"] as const).map((tt) => (
                  <label key={tt} className="flex items-center gap-1.5 px-3.5 py-1 rounded-full text-xs font-medium border cursor-pointer transition-all duration-200 has-[:checked]:bg-primary has-[:checked]:text-primary-foreground has-[:checked]:border-primary bg-secondary text-muted-foreground border-border hover:bg-accent hover:text-foreground">
                    <input type="radio" name="tool_type" value={tt} defaultChecked={tt === "mcp_server"} className="sr-only" />
                    {tt === "mcp_server" ? "MCP Server" : tt === "cli_library" ? "CLI / Library" : "Skill"}
                  </label>
                ))}
              </div>
            </div>

            <div>
              <h3 className="text-sm font-medium mb-3">{t("register.githubRepo")}</h3>
              <div className="grid grid-cols-4 gap-3">
                <div className="col-span-3">
                  <Label htmlFor="github_url">{t("register.githubUrl")}</Label>
                  <Input
                    id="github_url"
                    name="github_url"
                    placeholder="https://github.com/your-org/your-mcp-server"
                    defaultValue={selectedEntry?.repo ?? ""}
                    required
                  />
                </div>
                <div>
                  <Label htmlFor="branch">{t("register.branch")}</Label>
                  <Input id="branch" name="branch" defaultValue="main" />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-3 mt-3">
                <div>
                  <Label htmlFor="subdir">{t("register.subdir")}</Label>
                  <Input
                    id="subdir"
                    name="subdir"
                    placeholder={t("register.subdirPlaceholder")}
                    defaultValue={selectedEntry ? extractSubdir(selectedEntry) : ""}
                  />
                </div>
                <div>
                  <Label htmlFor="github_token">{t("register.githubToken")}</Label>
                  <Input
                    id="github_token"
                    name="github_token"
                    type="password"
                    placeholder={t("register.githubTokenPlaceholder")}
                  />
                </div>
              </div>
              <div className="mt-3">
                <Label htmlFor="install_command">Install Command</Label>
                <Input
                  id="install_command"
                  name="install_command"
                  placeholder="pip install arxiv-latex-mcp"
                  defaultValue={selectedEntry?.install_command ?? ""}
                />
              </div>
            </div>

            <Separator />

            <div>
              <button
                type="button"
                onClick={() => setShowAdvanced(!showAdvanced)}
                className="flex items-center gap-1.5 text-sm font-medium text-muted-foreground hover:text-foreground transition-colors"
              >
                {showAdvanced ? (
                  <ChevronDown className="h-4 w-4" />
                ) : (
                  <ChevronRight className="h-4 w-4" />
                )}
                {t("register.advancedToggle")}
              </button>

              {showAdvanced && (
                <div className="mt-3 space-y-3 pl-1">
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <Label htmlFor="name">{t("register.serverName")}</Label>
                      <Input
                        id="name"
                        name="name"
                        placeholder="my-server"
                        defaultValue={selectedEntry ? selectedEntry.name.toLowerCase().replace(/\s+/g, "-").replace(/[^a-z0-9-]/g, "") : ""}
                        pattern="[a-z0-9][a-z0-9\-]{1,48}[a-z0-9]"
                      />
                      <p className="text-xs text-muted-foreground mt-1">{t("register.serverNameHint")}</p>
                    </div>
                    <div>
                      <Label htmlFor="display_name">{t("register.displayName")}</Label>
                      <Input
                        id="display_name"
                        name="display_name"
                        placeholder="My MCP Server"
                        defaultValue={selectedEntry?.name ?? ""}
                      />
                    </div>
                  </div>
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <Label htmlFor="icon">{t("register.icon")}</Label>
                      <Input
                        id="icon"
                        name="icon"
                        placeholder="🔧"
                        maxLength={4}
                      />
                    </div>
                    <div>
                      <Label htmlFor="group">{t("register.group")}</Label>
                      <Select name="group" defaultValue={selectedEntry?.trust_level === "e4m" || selectedEntry?.trust_level === "official" ? "default" : "user"}>
                        <SelectTrigger>
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="user">
                            {t("register.groupCommunity")}
                          </SelectItem>
                          <SelectItem value="default">
                            {t("register.groupOfficial")}
                          </SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                  </div>
                  <div>
                    <Label htmlFor="description">{t("register.descriptionLabel")}</Label>
                    <Textarea
                      id="description"
                      name="description"
                      placeholder={t("register.descriptionPlaceholder")}
                      defaultValue={selectedEntry?.description ?? ""}
                      rows={2}
                    />
                  </div>
                </div>
              )}
            </div>

            <Separator />

            <div className="flex items-center gap-2">
              <Checkbox id="dify_auto" name="dify_auto" defaultChecked />
              <Label htmlFor="dify_auto" className="cursor-pointer">
                {t("register.difyAutoRegister")}
              </Label>
            </div>

            <div>
              <Label htmlFor="env_vars">{t("register.envVars")}</Label>
              <Textarea
                id="env_vars"
                name="env_vars"
                placeholder="MP_API_KEY=your_key"
                defaultValue={selectedEntry ? buildEnvTemplate(selectedEntry) : ""}
                rows={3}
              />
              {selectedEntry && selectedEntry.env_vars_json.length > 0 && (
                <div className="mt-2 space-y-1">
                  {selectedEntry.env_vars_json.map((v) => (
                    <p key={v.name} className="text-xs text-muted-foreground">
                      <span className="font-mono font-medium">{v.name}</span>
                      {v.required && <span className="text-amber-600 dark:text-amber-400 ml-1">*</span>}
                      {" — "}{v.description}
                    </p>
                  ))}
                </div>
              )}
            </div>

            <Button
              type="submit"
              className="w-full"
              size="lg"
              disabled={deploying}
            >
              <Rocket className="h-4 w-4" />
              {deploying ? t("register.deploying") : t("register.deployStart")}
            </Button>
          </form>

          {deploying && logs.length > 0 && (
            <div className="mt-6">
              <h3 className="text-sm font-medium mb-2">{t("register.deployLog")}</h3>
              <div
                ref={logRef}
                className="h-56 overflow-y-auto rounded-lg border bg-stone-900 text-stone-400 font-mono text-xs leading-relaxed p-3 whitespace-pre-wrap break-all"
              >
                {logs.join("\n")}
              </div>
            </div>
          )}
        </>
      )}
    </div>
  );
}
