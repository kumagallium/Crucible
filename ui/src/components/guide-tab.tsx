"use client";

import { Copy, Check, Monitor, Terminal, MousePointerClick, Plug } from "lucide-react";
import { useState } from "react";

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
          <Check className="h-3.5 w-3.5 text-green-600" />
        ) : (
          <Copy className="h-3.5 w-3.5" />
        )}
      </button>
    </div>
  );
}

export function GuideTab() {
  return (
    <div className="max-w-3xl mx-auto">
      <h2 className="text-lg font-semibold mb-1">Guide</h2>
      <p className="text-sm text-muted-foreground mb-6">
        Crucible に登録された MCP サーバーへの接続方法を説明します。
      </p>

      <div className="space-y-4">
        {/* 概要 */}
        <section className="rounded-xl border bg-card p-6">
          <h3 className="text-sm font-semibold mb-3 flex items-center gap-2">
            <Plug className="h-4 w-4 text-muted-foreground" />
            接続の流れ
          </h3>
          <p className="text-sm text-muted-foreground leading-relaxed mb-4">
            Crucible の MCP サーバーは SSE（Server-Sent
            Events）エンドポイント経由で利用できます。MCP
            対応の任意のクライアントから接続可能です。
          </p>
          <div className="flex flex-col sm:flex-row gap-2">
            {["1. エンドポイントを確認", "2. クライアントに登録"].map(
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

        {/* Step 1 */}
        <section className="rounded-xl border bg-card p-6">
          <h3 className="text-sm font-semibold mb-3 flex items-center gap-2">
            <MousePointerClick className="h-4 w-4 text-muted-foreground" />
            Step 1 — SSE エンドポイントを確認する
          </h3>
          <div className="space-y-3 text-sm text-muted-foreground leading-relaxed">
            <p>
              <span className="font-medium text-foreground">Servers</span>{" "}
              ページで利用したいサーバーのエンドポイント URL
              を確認し、コピーボタンでコピーします。
            </p>
            <div className="text-xs font-mono bg-muted border rounded-lg px-4 py-3">
              http://localhost:&lt;ポート番号&gt;/sse
            </div>
          </div>
        </section>

        {/* Step 2 */}
        <section className="rounded-xl border bg-card p-6">
          <h3 className="text-sm font-semibold mb-3 flex items-center gap-2">
            <Terminal className="h-4 w-4 text-muted-foreground" />
            Step 2 — MCP クライアントに登録する
          </h3>
          <p className="text-sm text-muted-foreground leading-relaxed mb-4">
            お使いの MCP 対応クライアントの設定に、コピーした SSE
            エンドポイントを追加します。以下に代表的なクライアントの設定例を示します。
          </p>

          {/* Claude Desktop */}
          <div className="mb-5">
            <h4 className="text-xs font-semibold mb-2 flex items-center gap-1.5">
              <Monitor className="h-3.5 w-3.5 text-muted-foreground" />
              Claude Desktop
            </h4>
            <p className="text-xs text-muted-foreground mb-2">
              Claude Desktop は SSE 直接接続に対応していないため、
              <span className="font-medium text-foreground"> mcp-remote </span>
              を使って stdio → SSE 変換を行います。
            </p>

            <div className="rounded-lg bg-amber-50 border border-amber-200 px-3 py-2 mb-3">
              <p className="text-xs text-amber-800 leading-relaxed">
                <span className="font-semibold">前提条件:</span>{" "}
                Node.js v20 以上が必要です。事前に{" "}
                <code className="font-mono bg-amber-100 px-1 rounded">npm install -g mcp-remote</code>{" "}
                を実行してください。
              </p>
            </div>

            <p className="text-xs text-muted-foreground mb-1">
              <span className="font-medium text-foreground">1.</span>{" "}
              Node.js と mcp-remote のパスを確認します。
            </p>
            <CopyBlock
              code={`# Node.js v20+ のパスを確認
which node
# → 例: /Users/you/.nvm/versions/node/v22.14.0/bin/node

# mcp-remote の proxy.js パスを確認
npm root -g
# → 例: /Users/you/.npm-global/lib/node_modules
# proxy.js は上記パス/mcp-remote/dist/proxy.js`}
            />

            <p className="text-xs text-muted-foreground mt-3 mb-1">
              <span className="font-medium text-foreground">2.</span>{" "}
              設定ファイルに追加します。
            </p>
            <p className="text-xs text-muted-foreground mb-2 font-mono">
              ~/Library/Application Support/Claude/claude_desktop_config.json
            </p>
            <CopyBlock
              code={`{
  "mcpServers": {
    "サーバー名": {
      "command": "/Users/you/.nvm/versions/node/v22.14.0/bin/node",
      "args": [
        "/Users/you/.npm-global/lib/node_modules/mcp-remote/dist/proxy.js",
        "http://localhost:<ポート>/sse",
        "--allow-http"
      ]
    }
  }
}`}
            />

            <div className="rounded-lg bg-muted border px-3 py-2 mt-3">
              <p className="text-xs text-muted-foreground leading-relaxed">
                <span className="font-semibold text-foreground">⚠ 注意:</span>{" "}
                <code className="font-mono">npx mcp-remote</code> ではなく、
                <code className="font-mono">node</code> と{" "}
                <code className="font-mono">proxy.js</code>{" "}
                のフルパスを直接指定してください。nvm 環境では npx が古い Node.js を使用し、エラーになる場合があります。
                また、HTTP 接続には{" "}
                <code className="font-mono">--allow-http</code>{" "}
                フラグが必須です。
              </p>
            </div>
          </div>

          {/* Claude Code */}
          <div className="mb-5">
            <h4 className="text-xs font-semibold mb-2 flex items-center gap-1.5">
              <Terminal className="h-3.5 w-3.5 text-muted-foreground" />
              Claude Code（CLI）
            </h4>
            <p className="text-xs text-muted-foreground mb-2">
              SSE に直接対応しているため、ワンコマンドで追加できます。
            </p>
            <CopyBlock code="claude mcp add --transport sse サーバー名 http://localhost:<ポート>/sse" />
          </div>

          {/* Cursor */}
          <div className="mb-5">
            <h4 className="text-xs font-semibold mb-2 flex items-center gap-1.5">
              <Monitor className="h-3.5 w-3.5 text-muted-foreground" />
              Cursor
            </h4>
            <p className="text-xs text-muted-foreground mb-2">
              SSE に直接対応しています。Settings → MCP Servers から追加してください。
            </p>
            <CopyBlock
              code={`{
  "mcpServers": {
    "サーバー名": {
      "url": "http://localhost:<ポート>/sse"
    }
  }
}`}
            />
          </div>

          {/* Windsurf */}
          <div className="mb-5">
            <h4 className="text-xs font-semibold mb-2 flex items-center gap-1.5">
              <Monitor className="h-3.5 w-3.5 text-muted-foreground" />
              Windsurf / Continue.dev
            </h4>
            <p className="text-xs text-muted-foreground">
              SSE に直接対応しています。設定画面から SSE エンドポイント URL を追加してください。
            </p>
          </div>

          {/* その他 */}
          <div className="rounded-lg bg-muted border px-4 py-3">
            <p className="text-xs text-muted-foreground leading-relaxed">
              <span className="font-medium text-foreground">
                その他の MCP クライアント
              </span>
              {" — "}
              SSE トランスポートに対応した MCP
              クライアントであれば、エンドポイント URL
              を指定するだけで接続できます。
            </p>
          </div>
        </section>

        {/* トラブルシューティング */}
        <section className="rounded-xl border bg-card p-6">
          <h3 className="text-sm font-semibold mb-3 flex items-center gap-2">
            <Plug className="h-4 w-4 text-muted-foreground" />
            トラブルシューティング
          </h3>
          <div className="space-y-3">
            <div className="rounded-lg bg-muted border px-4 py-3">
              <p className="text-xs font-semibold text-foreground mb-1">
                Cannot find module &apos;node:path&apos;
              </p>
              <p className="text-xs text-muted-foreground leading-relaxed">
                Node.js のバージョンが古い可能性があります。
                <code className="font-mono bg-background px-1 rounded">node --version</code>{" "}
                で v20 以上であることを確認してください。nvm 環境では{" "}
                <code className="font-mono bg-background px-1 rounded">npx</code>{" "}
                が意図しないバージョンの Node を使うことがあるため、フルパス指定を推奨します。
              </p>
            </div>
            <div className="rounded-lg bg-muted border px-4 py-3">
              <p className="text-xs font-semibold text-foreground mb-1">
                Non-HTTPS URLs are only allowed for localhost
              </p>
              <p className="text-xs text-muted-foreground leading-relaxed">
                mcp-remote の引数に{" "}
                <code className="font-mono bg-background px-1 rounded">--allow-http</code>{" "}
                を追加してください。localhost 以外の HTTP 接続にはこのフラグが必須です。
              </p>
            </div>
            <div className="rounded-lg bg-muted border px-4 py-3">
              <p className="text-xs font-semibold text-foreground mb-1">
                Server disconnected / 接続できない
              </p>
              <p className="text-xs text-muted-foreground leading-relaxed">
                Crucible が起動しているか確認してください。
                ターミナルから{" "}
                <code className="font-mono bg-background px-1 rounded">curl http://localhost:&lt;ポート&gt;/sse</code>{" "}
                でエンドポイントに到達できるかテストできます。
              </p>
            </div>
          </div>
        </section>
      </div>
    </div>
  );
}
