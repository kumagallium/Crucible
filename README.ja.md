[English](README.md)

# Crucible

> **あなたの MCP サーバーを、あなたのインフラで、あなたの管理下に。**

**Crucible** は MCP (Model Context Protocol) サーバーの登録・デプロイ・管理を行うセルフホスト型レジストリです。GitHub リポジトリを登録するだけで、MCP サーバーを自動ビルド・デプロイし、Claude Desktop、Claude Code、Cursor などの MCP クライアントからすぐに利用できます。

## 特徴

- **GitHub URL からビルド** — GitHub リポジトリの URL を貼るだけで、MCP サーバーを自動ビルド＆デプロイ。ビルド済みイメージやパッケージレジストリは不要
- **プライベートリポジトリ対応** — プライベート GitHub リポジトリにも対応。独自の MCP サーバーを公開レジストリに公開する必要なし
- **stdio → SSE 自動変換** — stdio サーバーも mcp-proxy で自動的に SSE エンドポイントとして公開。リモートからすぐ接続可能
- **管理 UI** — サーバーの状態確認・再起動・削除をブラウザから操作
- **セキュア** — Docker Socket Proxy 経由で Docker 操作を最小権限に制限
- **完全セルフホスト** — 外部サービスへの依存なし。すべてあなたのマシン、あなたのネットワーク内で完結

## こんな方に

- **個人開発者** — Claude Code、Cursor など複数クライアントで MCP サーバーを使っていて、個別管理に疲れている方
- **小規模チーム** — MCP ツールを社内で共有したいが、外部 SaaS は使えない方
- **セキュリティ重視の組織** — AI ツールアクセスを自組織のインフラ上に留めたい方

> [詳しいユースケースとシナリオはウェブサイトをご覧ください](https://kumagallium.github.io/Crucible/)

## アーキテクチャ

```
┌─────────────────────────────────────┐
│            Crucible                  │
│  ┌─────────┐      ┌──────────────┐  │
│  │   UI    │◄────►│   API        │  │
│  │ Next.js │      │  FastAPI     │  │
│  └─────────┘      └──────┬───────┘  │
│                          │          │
│              ┌───────────▼────────┐ │
│              │  Socket Proxy      │ │
│              │  (Docker 操作)     │ │
│              └───────────┬────────┘ │
│                          │          │
│  ┌──────┐ ┌──────┐ ┌──────┐       │
│  │MCP-A │ │MCP-B │ │MCP-C │ ...   │
│  └──────┘ └──────┘ └──────┘       │
└─────────────────────────────────────┘
```

<!-- TODO: Add demo GIF showing: paste GitHub URL → auto build → deploy → connect from Claude Code via SSE -->

## クイックスタート

### 前提条件

- Docker & Docker Compose
- Git

### セットアップ

```bash
# 1. クローン
git clone https://github.com/kumagallium/Crucible.git
cd Crucible

# 2. 環境変数を設定
cp .env.example .env
chmod 600 .env
# .env を編集して必要な値を設定

# 3. 起動
docker compose up -d
```

### アクセス

- **UI**: http://127.0.0.1:8081
- **API**: http://127.0.0.1:8080

## 環境変数

| 変数名 | デフォルト | 説明 |
|--------|-----------|------|
| `CRUCIBLE_HOST` | `127.0.0.1` | ポートバインド先 IP |
| `CRUCIBLE_API_PORT` | `8080` | API 公開ポート |
| `CRUCIBLE_UI_PORT` | `8081` | UI 公開ポート |
| `CRUCIBLE_BASE_URL` | `http://127.0.0.1` | MCP サーバーの SSE ベース URL |
| `CRUCIBLE_CORS_ORIGINS` | *(localhost)* | CORS 許可オリジン（カンマ区切り） |
| `REGISTRY_API_KEY` | *(なし)* | API 認証キー |
| `TOKEN_ENCRYPTION_KEY` | *(なし)* | GitHub Token 暗号化キー |

詳細は [.env.example](.env.example) を参照してください。

## リモートアクセス（オプション）

別のマシンから Crucible にアクセスしたい場合は、環境変数でバインド先 IP を変更してください。

```env
# 例: VPN 経由でアクセスする場合
CRUCIBLE_HOST=10.0.0.1
CRUCIBLE_BASE_URL=http://10.0.0.1
CRUCIBLE_CORS_ORIGINS=http://10.0.0.1:8081,http://localhost:8081
```

ローカルで利用する場合（デフォルト）は設定不要です。

## MCP クライアントからの接続

Crucible にデプロイした MCP サーバーは SSE エンドポイント経由で接続できます。

### Claude Code

```bash
claude mcp add --transport sse <サーバー名> http://<host>:<port>/sse
```

### Cursor / Windsurf

設定画面から SSE URL を追加するだけで接続できます。

### Claude Desktop

Claude Desktop は SSE に直接対応していないため、[mcp-remote](https://www.npmjs.com/package/mcp-remote) を使って stdio-SSE 変換を行います。詳しくは UI の **Guide** タブを参照してください。

## Integrations（オプション）

### Dify

Crucible はデプロイした MCP サーバーを Dify にツールとして自動登録できます。
`.env` に `DIFY_EMAIL` と `DIFY_PASSWORD` を設定して有効化してください。

## 技術スタック

| 要素 | 技術 |
|------|------|
| API | Python / FastAPI |
| UI | TypeScript / Next.js / shadcn/ui |
| コンテナ管理 | Docker / Docker Socket Proxy |
| MCP SDK | `@modelcontextprotocol/sdk` / `mcp` (Python) |

## ドキュメント & ウェブサイト

- [ウェブサイト（詳細なユースケース）](https://kumagallium.github.io/Crucible/)

## ライセンス

[MIT License](LICENSE)
