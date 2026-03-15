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
import { Rocket, ChevronDown, ChevronRight, CheckCircle2, XCircle, Plus } from "lucide-react";
import { registerServer, fetchJobLogs } from "@/lib/api";
import type { RegisterRequest } from "@/lib/types";
import { useI18n } from "@/i18n";

export function RegisterTab() {
  const { t } = useI18n();
  const [deploying, setDeploying] = useState(false);
  const [deployStatus, setDeployStatus] = useState<"success" | "error" | null>(null);
  const [logs, setLogs] = useState<string[]>([]);
  const [showAdvanced, setShowAdvanced] = useState(false);
  const logRef = useRef<HTMLDivElement>(null);
  const formRef = useRef<HTMLFormElement>(null);

  function handleReset() {
    setDeployStatus(null);
    setLogs([]);
    setDeploying(false);
    setShowAdvanced(false);
    formRef.current?.reset();
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

    const data: RegisterRequest = {
      github_url: (fd.get("github_url") as string).trim(),
      branch: (fd.get("branch") as string).trim() || "main",
      subdir: (fd.get("subdir") as string).trim(),
      github_token: (fd.get("github_token") as string).trim(),
      name: (fd.get("name") as string)?.trim() || null,
      display_name: (fd.get("display_name") as string)?.trim() || null,
      description: (fd.get("description") as string)?.trim() || "",
      icon: (fd.get("icon") as string)?.trim() || "🔧",
      group: (fd.get("group") as "default" | "user") || "user",
      dify_auto_register: fd.get("dify_auto") === "on",
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

  if (deployStatus !== null) {
    const isSuccess = deployStatus === "success";
    return (
      <div>
        <h2 className="text-lg font-semibold mb-1">{t("register.title")}</h2>
        <p className="text-sm text-muted-foreground mb-6">
          {t("register.description")}
        </p>

        {isSuccess ? (
          <div className="flex items-center gap-3 p-4 rounded-xl bg-[#e8f5e9] border border-[#a5d6a7] mb-6">
            <CheckCircle2 className="h-6 w-6 text-[#2e7d32] shrink-0" />
            <div>
              <p className="text-sm font-semibold text-[#1b5e20]">{t("register.deploySuccess")}</p>
              <p className="text-xs text-[#2e7d32]">{t("register.deploySuccessHint")}</p>
            </div>
          </div>
        ) : (
          <div className="flex items-center gap-3 p-4 rounded-xl bg-red-50 border border-red-200 mb-6">
            <XCircle className="h-6 w-6 text-red-600 shrink-0" />
            <div>
              <p className="text-sm font-semibold text-red-800">{t("register.deployFailed")}</p>
              <p className="text-xs text-red-600">{t("register.deployFailedHint")}</p>
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

  return (
    <div>
      <h2 className="text-lg font-semibold mb-1">{t("register.title")}</h2>
      <p className="text-sm text-muted-foreground mb-6">
        {t("register.description")}
      </p>

      <form ref={formRef} onSubmit={handleSubmit} className="space-y-6">
        <div>
          <h3 className="text-sm font-medium mb-3">{t("register.githubRepo")}</h3>
          <div className="grid grid-cols-4 gap-3">
            <div className="col-span-3">
              <Label htmlFor="github_url">{t("register.githubUrl")}</Label>
              <Input
                id="github_url"
                name="github_url"
                placeholder="https://github.com/your-org/your-mcp-server"
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
                  <Input id="name" name="name" placeholder="my-server" pattern="[a-z0-9][a-z0-9\-]{1,48}[a-z0-9]" />
                  <p className="text-xs text-muted-foreground mt-1">{t("register.serverNameHint")}</p>
                </div>
                <div>
                  <Label htmlFor="display_name">{t("register.displayName")}</Label>
                  <Input
                    id="display_name"
                    name="display_name"
                    placeholder="My MCP Server"
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
                  <Select name="group" defaultValue="user">
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
            rows={3}
          />
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
    </div>
  );
}
