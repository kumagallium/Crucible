[English](README.md)

[![Tests & Coverage](https://github.com/kumagallium/Crucible/actions/workflows/test.yml/badge.svg)](https://github.com/kumagallium/Crucible/actions/workflows/test.yml)

# Crucible

> **チームの AI ツール棚 — MCP サーバーをデプロイ、CLI ライブラリやスキルを登録・管理。**
> ビルド、デプロイ、管理をすべて一箇所で。

**Crucible** は 3 種類の AI ツールを管理するセルフホスト型プラットフォームです：

- **MCP Servers** — GitHub URL からビルド・デプロイ。Docker で自動コンテナ化し、SSE エンドポイントとして公開
- **CLI / Libraries** — pip/npm パッケージを Docker なしで登録。インストールコマンドとメタデータを MCP サーバーと一緒に管理
- **Skills** — マークダウンベースの手順書やプロンプトテンプレートを登録。デプロイ不要の軽量エントリ

チームの共有ツール棚としても、個人のサンドボックスとしても使えます。Crucible はリポジトリの依存関係（pyproject.toml の `mcp` や package.json の `@modelcontextprotocol/sdk`）を自動検査し、MCP サーバーか CLI ライブラリかを判別して適切な登録パスに振り分けます。

## 特徴

- **3 層ツールモデル** — MCP サーバー、CLI ライブラリ、スキルを一箇所で管理。種別ごとのフィルタリングと表示
- **GitHub URL からビルド** — リポジトリ URL を貼るだけで MCP サーバーを自動ビルド＆デプロイ。Dockerfile がなくても自動生成
- **軽量登録** — CLI ライブラリとスキルは Docker デプロイなしで即座に登録。メタデータとインストールコマンドのみ
- **プライベートリポジトリ対応** — プライベート GitHub リポジトリに対応。非公開のまま開発・デプロイ可能
- **ツール種別の自動検出** — 依存関係を検査して MCP サーバーか CLI ライブラリかを自動分類
- **即座にイテレーション** — GitHub に push して再デプロイするだけ。コードから動作確認までのフィードバックループが最短に
- **自動更新** — `auto_update` を有効にすると、GitHub の新しいコミットを定期チェックして自動再デプロイ
- **stdio → SSE 自動変換** — stdio MCP サーバーも自動的に SSE エンドポイントとして公開
- **管理 UI** — 全ツールをダッシュボードで一覧管理。ステータス・種別でフィルタリング
- **セキュア＆セルフホスト** — すべてあなたのインフラ上で動作。Docker Socket Proxy で最小権限に制限

## こんな方に

- **MCP サーバー開発者** — `git push` から数秒でサーバーを動かしたい方。パッケージ公開や Dockerfile 作成は不要
- **研究チーム・組織** — AI ツールの共有ライブラリを構築したい環境に。MCP サーバーで重い自動化、CLI ツールで軽いユーティリティ、スキルで再利用可能なプロンプトを管理
- **GitHub で AI ツールを探している方** — MCP サーバーでも pip パッケージでも、URL を貼るだけで登録・管理できる

> [詳しいユースケースとシナリオはウェブサイトをご覧ください](https://kumagallium.github.io/Crucible/)

## アーキテクチャ

```mermaid
graph TB
    subgraph Crucible [" "]
        UI["🖥️ UI<br/><i>Next.js</i>"]
        API["⚡ API<br/><i>FastAPI</i>"]
        Proxy["🔒 Socket Proxy<br/><i>Docker 操作</i>"]
        subgraph MCP ["MCP Servers (Docker)"]
            MCP_A["MCP-A"]
            MCP_B["MCP-B"]
        end
        subgraph Light ["CLI/Lib & Skills (メタデータのみ)"]
            CLI_A["📦 CLI-A"]
            Skill_A["📝 Skill-A"]
        end
    end

    UI <--> API
    API --> Proxy
    API --> Light
    Proxy --> MCP_A
    Proxy --> MCP_B

    style Crucible fill:transparent,stroke:#4B7A52,stroke-width:2px,color:#2d4a32
    style UI fill:#e8f0f8,stroke:#5b8fb9,color:#2d4a6e
    style API fill:#edf5ee,stroke:#4B7A52,color:#2d4a32
    style Proxy fill:#f5f0e8,stroke:#c08b3e,color:#6b5a2e
    style MCP fill:transparent,stroke:#b8d4bb,stroke-width:1px,color:#3d6844
    style Light fill:transparent,stroke:#c4b8d4,stroke-width:1px,color:#5a4a6e
    style MCP_A fill:#f0f5ef,stroke:#b8d4bb,color:#3d6844
    style MCP_B fill:#f0f5ef,stroke:#b8d4bb,color:#3d6844
    style CLI_A fill:#f5f0e8,stroke:#c08b3e,color:#6b5a2e
    style Skill_A fill:#ede8f5,stroke:#8b7ab5,color:#4a3d6e
```

## クイックスタート

### 前提条件

- Docker & Docker Compose
- Git

### セットアップ

```bash
# 1. クローン
git clone https://github.com/kumagallium/Crucible.git
cd Crucible

# 2. セットアップスクリプトを実行（.env 自動生成 + git hooks 設定）
./setup.sh

# 3. 起動
docker compose up -d
```

#### Dify 連携を使う場合

同じホストで Dify を動かしている場合、自動ツール登録を有効にできます:

```bash
docker compose -f docker-compose.yml -f docker-compose.dify.yml up -d
```

### アクセス

- **UI**: http://127.0.0.1:8081
- **API**: http://127.0.0.1:8080

## サーバーデプロイ

**Ubuntu 22.04 LTS** でテスト済み。セットアップスクリプトが Docker のインストール、セキュリティ強化、Crucible の起動を一括で行います。

```bash
git clone https://github.com/kumagallium/Crucible.git
cd Crucible
sudo bash setup-server.sh
```

### `setup-server.sh` が行うこと

| ステップ | 内容 |
|---------|------|
| Docker | Docker CE + Compose plugin をインストール |
| SSH | 鍵認証のみ、root ログイン禁止 |
| ファイアウォール (UFW) | インバウンド deny（SSH / 8080 / 8081 のみ許可） |
| fail2ban | SSH 5回失敗で24時間 BAN |
| Docker iptables | Socket Proxy への外部アクセスをブロック、UDP フラッド対策 |
| 自動更新 | セキュリティパッチを自動適用 |

### オプション

```bash
# SSH ポートを変更（本番環境では推奨）
SSH_PORT=<your-port> sudo bash setup-server.sh
```

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
| `AUTO_UPDATE_INTERVAL` | `3600` | 自動更新チェック間隔（秒、0 で無効化） |

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

Crucible にデプロイした MCP サーバーは SSE エンドポイント経由で接続できます。CLI/Library と Skill はメタデータのみの登録で、エンドポイントは公開されません。

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

## 関連プロジェクト

Crucible はエコシステムの一部として機能します：

```mermaid
graph LR
    Registry["🔧 <b>Crucible</b><br/><i>AI ツール管理<br/>& デプロイ</i>"]
    Agent["🤖 Crucible<br/><b>Agent</b><br/><i>AI エージェント<br/>ランタイム</i>"]
    Graphium["📝 <b>Graphium</b><br/><i>プロヴェナンス<br/>追跡エディタ</i>"]

    Registry -- "ツール自動検出" --> Agent
    Agent -- "POST /agent/run" --> Graphium

    style Registry fill:#edf5ee,stroke:#4B7A52,stroke-width:2px,color:#2d4a32
    style Agent fill:#ede8f5,stroke:#8b7ab5,stroke-width:2px,color:#4a3d6e
    style Graphium fill:#e8f0f8,stroke:#5b8fb9,stroke-width:2px,color:#2d4a6e
```

| リポジトリ | 役割 | リンク |
|-----------|------|--------|
| **Crucible** | AI ツール管理 & デプロイ（MCP サーバー、CLI/Lib、Skills） | *(このリポジトリ)* |
| **Crucible Agent** | MCP ツール対応 AI エージェントランタイム | [kumagallium/Crucible-Agent](https://github.com/kumagallium/Crucible-Agent) |
| **Graphium** | PROV-DM プロヴェナンス追跡エディタ | [kumagallium/Graphium](https://github.com/kumagallium/Graphium) |

各プロジェクトは単体でも使えます。組み合わせると、Crucible が AI ツール（MCP サーバー、CLI ライブラリ、スキル）を管理 → Agent が LLM と接続 → Graphium がプロヴェナンス付きの UI を提供、というパイプラインになります。

## ライセンス

[MIT License](LICENSE)
