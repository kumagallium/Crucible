"use client";

import { useState, useRef, useEffect } from "react";
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
import { Rocket, ChevronDown, ChevronRight, CheckCircle2, XCircle, Plus, BookOpen, GitBranch, Upload, FileText } from "lucide-react";
import { registerServer, fetchJobLogs, fetchServer } from "@/lib/api";
import type { RegisterRequest, CatalogEntry, ToolType, Server } from "@/lib/types";
import { useI18n } from "@/i18n";
import { useSearchParams } from "next/navigation";
import { CatalogImport } from "./catalog-import";

type Mode = "catalog" | "manual";

export function RegisterTab() {
  const { t } = useI18n();
  const searchParams = useSearchParams();
  const [mode, setMode] = useState<Mode>("catalog");
  const [deploying, setDeploying] = useState(false);
  const [deployStatus, setDeployStatus] = useState<"success" | "error" | null>(null);
  const [logs, setLogs] = useState<string[]>([]);
  const [showAdvanced, setShowAdvanced] = useState(false);
  const [selectedEntry, setSelectedEntry] = useState<CatalogEntry | null>(null);
  const [toolType, setToolType] = useState<ToolType>("mcp_server");
  const [skillContent, setSkillContent] = useState("");
  const [editServer, setEditServer] = useState<Server | null>(null);
  const logRef = useRef<HTMLDivElement>(null);
  const formRef = useRef<HTMLFormElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // ?edit=name パラメータがあれば既存サーバー情報をロード
  useEffect(() => {
    const editName = searchParams.get("edit");
    if (!editName) return;
    fetchServer(editName)
      .then((srv) => {
        setEditServer(srv);
        setToolType((srv.tool_type as ToolType) || "mcp_server");
        setMode("manual");
        setShowAdvanced(true);
        if (srv.tool_type === "skill" && srv.content) {
          setSkillContent(srv.content);
        }
      })
      .catch(() => {
        // サーバーが見つからない場合は通常の登録画面
      });
  }, [searchParams]);

  // 編集モード用: editServer があればそこからデフォルト値を取る
  const isEdit = !!editServer;
  const defaults = {
    name: editServer?.name ?? "",
    displayName: editServer?.display_name ?? "",
    description: editServer?.description ?? "",
    icon: editServer?.icon ?? "",
    group: editServer?.group ?? "user",
    githubUrl: editServer?.github_url ?? "",
    branch: editServer?.branch ?? "main",
    subdir: editServer?.subdir ?? "",
    installCommand: editServer?.install_command ?? "",
  };

  function handleReset() {
    setDeployStatus(null);
    setLogs([]);
    setDeploying(false);
    setShowAdvanced(false);
    setSelectedEntry(null);
    setEditServer(null);
    setSkillContent("");
    formRef.current?.reset();
    // URL パラメータをクリア
    if (typeof window !== "undefined" && window.location.search) {
      window.history.replaceState({}, "", window.location.pathname);
    }
  }

  // .md ファイルアップロード → skillContent に読み込む
  function handleFileUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => {
      if (typeof reader.result === "string") {
        setSkillContent(reader.result);
      }
    };
    reader.readAsText(file);
    // input をリセットして同じファイルの再選択を許可
    e.target.value = "";
  }

  // カタログエントリからスキルテンプレートを生成
  function buildSkillTemplate(entry: CatalogEntry): string {
    const lines: string[] = [];
    lines.push(`${entry.description}`);
    lines.push("");
    if (entry.tools_json.length > 0) {
      lines.push("## Tools");
      lines.push("");
      for (const tool of entry.tools_json) {
        lines.push(`- **${tool.name}** — ${tool.description}`);
      }
      lines.push("");
    }
    if (entry.repo) {
      lines.push(`## Reference`);
      lines.push("");
      lines.push(`- Repository: ${entry.repo}`);
      lines.push("");
    }
    return lines.join("\n");
  }

  function handleCatalogSelect(entry: CatalogEntry) {
    setSelectedEntry(entry);
    setShowAdvanced(true);

    // tool_types に基づいて toolType を自動セット
    const types = entry.tool_types?.length ? entry.tool_types : ["mcp_server" as ToolType];
    if (types.length === 1) {
      setToolType(types[0]);
    }
    // 複数の場合は現在の選択を維持（ユーザーに選ばせる）

    // skill モードの場合、skill_content を流し込む（なければテンプレート生成）
    if (toolType === "skill" || (types.length === 1 && types[0] === "skill")) {
      setSkillContent(entry.skill_content || buildSkillTemplate(entry));
    }

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

    const currentToolType = (fd.get("tool_type") as ToolType) || "mcp_server";

    const data: RegisterRequest = {
      tool_type: currentToolType,
      name: (fd.get("name") as string)?.trim() || null,
      display_name: (fd.get("display_name") as string)?.trim() || null,
      description: (fd.get("description") as string)?.trim() || "",
      icon: (fd.get("icon") as string)?.trim() || "🔧",
      github_url: "",
      branch: "main",
      group: (fd.get("group") as "default" | "user") || "user",
      dify_auto_register: false,
      env_vars: {},
    };

    if (currentToolType === "skill") {
      // skill: マークダウン本文を送信
      data.content = skillContent;
      // カタログから選択した場合、元の GitHub URL を保持
      if (selectedEntry?.repo) {
        data.github_url = selectedEntry.repo;
      }
    } else {
      // mcp_server / cli_library: GitHub ベースの登録
      data.github_url = (fd.get("github_url") as string).trim();
      data.branch = (fd.get("branch") as string).trim() || "main";
      data.subdir = (fd.get("subdir") as string)?.trim() || "";
      data.install_command = (fd.get("install_command") as string)?.trim() || "";
      data.github_token = (fd.get("github_token") as string)?.trim() || "";
      data.dify_auto_register = currentToolType === "mcp_server" && fd.get("dify_auto") === "on";
      data.env_vars = envVars;

      // cli_library: カタログから cli_execution を引き継ぐ
      if (currentToolType === "cli_library" && selectedEntry?.cli_execution && "run_command" in selectedEntry.cli_execution) {
        data.cli_execution = selectedEntry.cli_execution as import("@/lib/types").CliExecution;
      }
    }

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

  // --- デプロイ成功画面（成功時のみ画面切り替え） ---
  if (deployStatus === "success") {
    return (
      <div>
        <h2 className="text-lg font-semibold mb-1">{t("register.title")}</h2>
        <p className="text-sm text-muted-foreground mb-6">
          {t("register.description")}
        </p>

        <div className="flex items-center gap-3 p-4 rounded-xl bg-success-bg border border-success-border mb-6">
          <CheckCircle2 className="h-6 w-6 text-status-running shrink-0" />
          <div>
            <p className="text-sm font-semibold text-success">{t("register.deploySuccess")}</p>
            <p className="text-xs text-status-running">{t("register.deploySuccessHint")}</p>
          </div>
        </div>

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

      {/* Tool Type 選択（常に表示） */}
      <div className="mb-6">
        <Label htmlFor="tool_type">Tool Type</Label>
        <div className="flex gap-1.5 mt-1.5">
          {(["mcp_server", "cli_library", "skill"] as const).map((tt) => (
            <button
              key={tt}
              type="button"
              onClick={() => setToolType(tt)}
              className={`px-3.5 py-1 rounded-full text-xs font-medium border transition-all duration-200 ${
                toolType === tt
                  ? "bg-primary text-primary-foreground border-primary"
                  : "bg-secondary text-muted-foreground border-border hover:bg-accent hover:text-foreground"
              }`}
            >
              {tt === "mcp_server" ? "Server" : tt === "cli_library" ? "CLI / Library" : "Skill"}
            </button>
          ))}
        </div>
      </div>

      {/* デプロイエラー時のインラインバナー */}
      {deployStatus === "error" && (
        <div className="mb-6 space-y-4">
          <div className="flex items-center gap-3 p-4 rounded-xl bg-status-error-bg border border-status-error-border">
            <XCircle className="h-6 w-6 text-status-error shrink-0" />
            <div className="flex-1 min-w-0">
              <p className="text-sm font-semibold text-status-error">{t("register.deployFailed")}</p>
              <p className="text-xs text-destructive-text">{t("register.deployFailedHint")}</p>
            </div>
            <button
              onClick={() => { setDeployStatus(null); setLogs([]); }}
              className="text-xs text-muted-foreground hover:text-foreground shrink-0"
            >
              ✕
            </button>
          </div>
          {logs.length > 0 && (
            <div>
              <h3 className="text-sm font-medium mb-2">{t("register.deployLog")}</h3>
              <div
                ref={logRef}
                className="h-56 overflow-y-auto rounded-lg border bg-stone-900 text-stone-400 font-mono text-xs leading-relaxed p-3 whitespace-pre-wrap break-all"
              >
                {logs.join("\n")}
              </div>
            </div>
          )}
        </div>
      )}

      {/* 編集モード時のバナー */}
      {isEdit && (
        <div className="flex items-center gap-3 p-4 rounded-xl border bg-info-bg border-info-border mb-6">
          <BookOpen className="h-4 w-4 text-info shrink-0" />
          <div className="flex-1 min-w-0">
            <p className="text-sm font-semibold text-info">
              {t("register.editMode", { name: editServer!.display_name })}
            </p>
            <p className="text-xs text-muted-foreground">
              {t("register.editModeHint")}
            </p>
          </div>
        </div>
      )}

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
          {toolType === "skill" ? t("register.modeSkillManual") : t("register.modeManual")}
        </button>
      </div>

      {/* カタログモード */}
      {mode === "catalog" && (
        <CatalogImport onSelect={handleCatalogSelect} toolType={toolType} />
      )}

      {/* 手動モード（カタログ選択後も含む） */}
      {mode === "manual" && (
        <>
          {/* カタログから選択された場合のバナー */}
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

          {/* ===== Skill 登録フォーム ===== */}
          {toolType === "skill" && (
            <form ref={formRef} onSubmit={handleSubmit} className="space-y-6">
              <input type="hidden" name="tool_type" value="skill" />

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <Label htmlFor="name">{t("register.skillName")} *</Label>
                  <Input
                    id="name"
                    name="name"
                    placeholder="my-skill"
                    required
                    pattern="[a-z0-9][a-z0-9\-]{1,48}[a-z0-9]"
                    defaultValue={defaults.name || (selectedEntry ? selectedEntry.name.toLowerCase().replace(/\s+/g, "-").replace(/[^a-z0-9-]/g, "") : "")}
                  />
                  <p className="text-xs text-muted-foreground mt-1">{t("register.serverNameHint")}</p>
                </div>
                <div>
                  <Label htmlFor="display_name">{t("register.displayName")}</Label>
                  <Input
                    id="display_name"
                    name="display_name"
                    placeholder="My Skill"
                    defaultValue={defaults.displayName || selectedEntry?.name || ""}
                  />
                </div>
              </div>

              <div>
                <Label htmlFor="description">{t("register.descriptionLabel")}</Label>
                <Input
                  id="description"
                  name="description"
                  placeholder={t("register.skillDescriptionPlaceholder")}
                  defaultValue={defaults.description || selectedEntry?.description || ""}
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <Label htmlFor="icon">{t("register.icon")}</Label>
                  <Input
                    id="icon"
                    name="icon"
                    placeholder="📝"
                    defaultValue={defaults.icon}
                    maxLength={4}
                  />
                </div>
                <div>
                  <Label htmlFor="group">{t("register.group")}</Label>
                  <Select name="group" defaultValue={defaults.group || (selectedEntry?.trust_level === "e4m" || selectedEntry?.trust_level === "official" ? "default" : "user")}>
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

              <Separator />

              {/* マークダウンエディタ */}
              <div>
                <div className="flex items-center justify-between mb-2">
                  <Label htmlFor="skill_content">{t("register.skillContent")} *</Label>
                  <button
                    type="button"
                    onClick={() => fileInputRef.current?.click()}
                    className="flex items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground transition-colors"
                  >
                    <Upload className="h-3.5 w-3.5" />
                    {t("register.skillUpload")}
                  </button>
                  <input
                    ref={fileInputRef}
                    type="file"
                    accept=".md,.markdown,.txt"
                    onChange={handleFileUpload}
                    className="hidden"
                  />
                </div>
                <Textarea
                  id="skill_content"
                  value={skillContent}
                  onChange={(e) => setSkillContent(e.target.value)}
                  placeholder={t("register.skillContentPlaceholder")}
                  rows={12}
                  className="font-mono text-sm"
                  required
                />
                {skillContent && (
                  <p className="text-xs text-muted-foreground mt-1.5 flex items-center gap-1">
                    <FileText className="h-3 w-3" />
                    {skillContent.length.toLocaleString()} {t("register.skillChars")}
                  </p>
                )}
              </div>

              <Button
                type="submit"
                className="w-full"
                size="lg"
                disabled={deploying}
              >
                <Rocket className="h-4 w-4" />
                {deploying ? t("register.deploying") : t("register.skillRegister")}
              </Button>
            </form>
          )}

          {/* ===== Server / CLI Library 登録フォーム ===== */}
          {toolType !== "skill" && (
            <form ref={formRef} onSubmit={handleSubmit} className="space-y-6">
              <input type="hidden" name="tool_type" value={toolType} />

              <div>
                <h3 className="text-sm font-medium mb-3">{t("register.githubRepo")}</h3>
                <div className="grid grid-cols-4 gap-3">
                  <div className="col-span-3">
                    <Label htmlFor="github_url">{t("register.githubUrl")}</Label>
                    <Input
                      id="github_url"
                      name="github_url"
                      placeholder="https://github.com/your-org/your-mcp-server"
                      defaultValue={defaults.githubUrl || selectedEntry?.repo || ""}
                      required
                    />
                  </div>
                  <div>
                    <Label htmlFor="branch">{t("register.branch")}</Label>
                    <Input id="branch" name="branch" defaultValue={defaults.branch || "main"} />
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-3 mt-3">
                  {toolType === "mcp_server" && (
                    <div>
                      <Label htmlFor="subdir">{t("register.subdir")}</Label>
                      <Input
                        id="subdir"
                        name="subdir"
                        placeholder={t("register.subdirPlaceholder")}
                        defaultValue={defaults.subdir || (selectedEntry ? extractSubdir(selectedEntry) : "")}
                      />
                    </div>
                  )}
                  {toolType === "cli_library" && (
                    <div>
                      <Label htmlFor="install_command">Install Command</Label>
                      <Input
                        id="install_command"
                        name="install_command"
                        placeholder="pip install package-name"
                        defaultValue={defaults.installCommand || selectedEntry?.install_command || ""}
                      />
                    </div>
                  )}
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
                          defaultValue={defaults.name || (selectedEntry ? selectedEntry.name.toLowerCase().replace(/\s+/g, "-").replace(/[^a-z0-9-]/g, "") : "")}
                          pattern="[a-z0-9][a-z0-9\-]{1,48}[a-z0-9]"
                        />
                        <p className="text-xs text-muted-foreground mt-1">{t("register.serverNameHint")}</p>
                      </div>
                      <div>
                        <Label htmlFor="display_name">{t("register.displayName")}</Label>
                        <Input
                          id="display_name"
                          name="display_name"
                          placeholder="My Server"
                          defaultValue={defaults.displayName || selectedEntry?.name || ""}
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
                          defaultValue={defaults.icon}
                          maxLength={4}
                        />
                      </div>
                      <div>
                        <Label htmlFor="group">{t("register.group")}</Label>
                        <Select name="group" defaultValue={defaults.group || (selectedEntry?.trust_level === "e4m" || selectedEntry?.trust_level === "official" ? "default" : "user")}>
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
                        defaultValue={defaults.description || selectedEntry?.description || ""}
                        rows={2}
                      />
                    </div>
                  </div>
                )}
              </div>

              <Separator />

              {toolType === "mcp_server" && (
                <>
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
                </>
              )}

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
          )}
        </>
      )}

      {/* デプロイ中のログ */}
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
    </div>
  );
}
