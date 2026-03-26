"use client";

import { Copy, Check, Monitor, Terminal, MousePointerClick, Plug } from "lucide-react";
import { useState } from "react";
import { useI18n } from "@/i18n";

function CopyBlock({ code }: { code: string }) {
  const [copied, setCopied] = useState(false);

  function handleCopy() {
    const textarea = document.createElement("textarea");
    textarea.value = code;
    textarea.style.position = "fixed";
    textarea.style.opacity = "0";
    document.body.appendChild(textarea);
    textarea.select();
    document.execCommand("copy");
    document.body.removeChild(textarea);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }

  return (
    <div className="relative group">
      <pre className="text-xs font-mono bg-muted border rounded-lg px-4 py-3 overflow-x-auto leading-relaxed">
        {code}
      </pre>
      <button
        onClick={handleCopy}
        className="absolute top-2 right-2 p-1 rounded-md bg-background border text-muted-foreground opacity-0 group-hover:opacity-100 transition-opacity hover:text-foreground"
      >
        {copied ? (
          <Check className="h-3.5 w-3.5 text-status-running" />
        ) : (
          <Copy className="h-3.5 w-3.5" />
        )}
      </button>
    </div>
  );
}

export function GuideTab() {
  const { t } = useI18n();

  return (
    <div className="max-w-3xl mx-auto">
      <h2 className="text-lg font-semibold mb-1">{t("guide.title")}</h2>
      <p className="text-sm text-muted-foreground mb-6">
        {t("guide.description")}
      </p>

      <div className="space-y-4">
        <section className="rounded-xl border bg-card p-6">
          <h3 className="text-sm font-semibold mb-3 flex items-center gap-2">
            <Plug className="h-4 w-4 text-muted-foreground" />
            {t("guide.connectionFlow")}
          </h3>
          <p className="text-sm text-muted-foreground leading-relaxed mb-4">
            {t("guide.connectionFlowDesc")}
          </p>
          <div className="flex flex-col sm:flex-row gap-2">
            {[t("guide.step1Label"), t("guide.step2Label")].map(
              (step) => (
                <div
                  key={step}
                  className="flex-1 text-center text-xs font-medium text-muted-foreground bg-muted rounded-lg px-3 py-2 border"
                >
                  {step}
                </div>
              )
            )}
          </div>
        </section>

        <section className="rounded-xl border bg-card p-6">
          <h3 className="text-sm font-semibold mb-3 flex items-center gap-2">
            <MousePointerClick className="h-4 w-4 text-muted-foreground" />
            {t("guide.step1Title")}
          </h3>
          <div className="space-y-3 text-sm text-muted-foreground leading-relaxed">
            <p>{t("guide.step1Desc")}</p>
            <div className="text-xs font-mono bg-muted border rounded-lg px-4 py-3">
              http://localhost:&lt;{t("guide.portNumber")}&gt;/mcp{" "}
              <span className="text-muted-foreground">({t("guide.orSse")})</span>
            </div>
          </div>
        </section>

        <section className="rounded-xl border bg-card p-6">
          <h3 className="text-sm font-semibold mb-3 flex items-center gap-2">
            <Terminal className="h-4 w-4 text-muted-foreground" />
            {t("guide.step2Title")}
          </h3>
          <p className="text-sm text-muted-foreground leading-relaxed mb-4">
            {t("guide.step2Desc")}
          </p>

          <div className="mb-5">
            <h4 className="text-xs font-semibold mb-2 flex items-center gap-1.5">
              <Monitor className="h-3.5 w-3.5 text-muted-foreground" />
              Claude Desktop
            </h4>
            <p className="text-xs text-muted-foreground mb-2">
              {t("guide.claudeDesktopDesc")}
            </p>

            <div className="rounded-lg bg-warning-bg border border-warning-border px-3 py-2 mb-3">
              <p className="text-xs text-warning leading-relaxed">
                <span className="font-semibold">{t("guide.prerequisite")}</span>{" "}
                {t("guide.prerequisiteDesc")}{" "}
                <code className="font-mono bg-warning-bg/80 px-1 rounded">npm install -g mcp-remote</code>{" "}
                {t("guide.prerequisiteDesc2")}
              </p>
            </div>

            <p className="text-xs text-muted-foreground mb-1">
              <span className="font-medium text-foreground">1.</span>{" "}
              {t("guide.checkPaths")}
            </p>
            <CopyBlock
              code={`${t("guide.nodePathComment")}
which node
# → e.g.: /Users/you/.nvm/versions/node/v22.14.0/bin/node

${t("guide.mcpRemoteComment")}
npm root -g
# → e.g.: /Users/you/.npm-global/lib/node_modules
# proxy.js is at the above path/mcp-remote/dist/proxy.js`}
            />

            <p className="text-xs text-muted-foreground mt-3 mb-1">
              <span className="font-medium text-foreground">2.</span>{" "}
              {t("guide.addConfig")}
            </p>
            <p className="text-xs text-muted-foreground mb-2 font-mono">
              ~/Library/Application Support/Claude/claude_desktop_config.json
            </p>
            <CopyBlock
              code={`{
  "mcpServers": {
    "${t("guide.serverName")}": {
      "command": "/Users/you/.nvm/versions/node/v22.14.0/bin/node",
      "args": [
        "/Users/you/.npm-global/lib/node_modules/mcp-remote/dist/proxy.js",
        "http://localhost:<${t("guide.port")}>/mcp",
        "--allow-http"
      ]
    }
  }
}`}
            />
            <p className="text-xs text-muted-foreground mt-2">
              {t("guide.endpointNote")}
            </p>

            <div className="rounded-lg bg-muted border px-3 py-2 mt-3">
              <p className="text-xs text-muted-foreground leading-relaxed">
                <span className="font-semibold text-foreground">⚠ {t("guide.warning")}</span>{" "}
                {t("guide.warningDesc")}
              </p>
            </div>
          </div>

          <div className="mb-5">
            <h4 className="text-xs font-semibold mb-2 flex items-center gap-1.5">
              <Terminal className="h-3.5 w-3.5 text-muted-foreground" />
              Claude Code（CLI）
            </h4>
            <p className="text-xs text-muted-foreground mb-2">
              {t("guide.claudeCodeDesc")}
            </p>
            <CopyBlock code={`claude mcp add --transport sse ${t("guide.serverName")} http://localhost:<${t("guide.port")}>/mcp`} />
            <p className="text-xs text-muted-foreground mt-2">
              {t("guide.endpointNote")}
            </p>
          </div>

          <div className="mb-5">
            <h4 className="text-xs font-semibold mb-2 flex items-center gap-1.5">
              <Monitor className="h-3.5 w-3.5 text-muted-foreground" />
              Cursor
            </h4>
            <p className="text-xs text-muted-foreground mb-2">
              {t("guide.cursorDesc")}
            </p>
            <CopyBlock
              code={`{
  "mcpServers": {
    "${t("guide.serverName")}": {
      "url": "http://localhost:<${t("guide.port")}>/mcp"
    }
  }
}`}
            />
            <p className="text-xs text-muted-foreground mt-2">
              {t("guide.endpointNote")}
            </p>
          </div>

          <div className="mb-5">
            <h4 className="text-xs font-semibold mb-2 flex items-center gap-1.5">
              <Monitor className="h-3.5 w-3.5 text-muted-foreground" />
              Windsurf / Continue.dev
            </h4>
            <p className="text-xs text-muted-foreground">
              {t("guide.windsurfDesc")}
            </p>
          </div>

          <div className="rounded-lg bg-muted border px-4 py-3">
            <p className="text-xs text-muted-foreground leading-relaxed">
              <span className="font-medium text-foreground">
                {t("guide.otherClients")}
              </span>
              {" — "}
              {t("guide.otherClientsDesc")}
            </p>
          </div>
        </section>

        <section className="rounded-xl border bg-card p-6">
          <h3 className="text-sm font-semibold mb-3 flex items-center gap-2">
            <Plug className="h-4 w-4 text-muted-foreground" />
            {t("guide.troubleshooting")}
          </h3>
          <div className="space-y-3">
            <div className="rounded-lg bg-muted border px-4 py-3">
              <p className="text-xs font-semibold text-foreground mb-1">
                Cannot find module &apos;node:path&apos;
              </p>
              <p className="text-xs text-muted-foreground leading-relaxed">
                {t("guide.troubleNode")}
              </p>
            </div>
            <div className="rounded-lg bg-muted border px-4 py-3">
              <p className="text-xs font-semibold text-foreground mb-1">
                Non-HTTPS URLs are only allowed for localhost
              </p>
              <p className="text-xs text-muted-foreground leading-relaxed">
                {t("guide.troubleHttp")}
              </p>
            </div>
            <div className="rounded-lg bg-muted border px-4 py-3">
              <p className="text-xs font-semibold text-foreground mb-1">
                Server disconnected
              </p>
              <p className="text-xs text-muted-foreground leading-relaxed">
                {t("guide.troubleDisconnect")}
              </p>
            </div>
          </div>
        </section>
      </div>
    </div>
  );
}
