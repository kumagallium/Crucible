// Storybook 用デモデータ

import type { Server, ReleaseNote } from "@/lib/types";

// --- ServerCard / ServersTab 用 ---

/** Running 状態のサーバー */
export const mockServerRunning: Server = {
  name: "web-search",
  display_name: "Web Search MCP",
  description: "Web 検索をツールとして提供するサーバー。Google Custom Search API を使用。",
  icon: "🔍",
  github_url: "https://github.com/example-org/web-search-mcp",
  branch: "main",
  subdir: "",
  tool_type: "mcp_server",
  group: "default",
  port: 8001,
  static_ip: "192.168.0.10",
  status: "running",
  created_at: "2025-06-01T10:00:00Z",
  updated_at: "2025-06-10T08:30:00Z",
  error_message: null,
  dify_registered: true,
};

/** Stopped 状態のサーバー */
export const mockServerStopped: Server = {
  name: "pdf-reader",
  display_name: "PDF Reader",
  description: "PDF ファイルを読み取ってテキストを返すツール。",
  icon: "📄",
  github_url: "https://github.com/example-org/pdf-reader-mcp",
  branch: "main",
  subdir: "",
  tool_type: "cli_library",
  group: "user",
  port: 8100,
  static_ip: "192.168.0.11",
  status: "stopped",
  created_at: "2025-05-20T14:00:00Z",
  updated_at: "2025-06-05T12:00:00Z",
  error_message: null,
  dify_registered: false,
};

/** Error 状態のサーバー */
export const mockServerError: Server = {
  name: "slack-notifier",
  display_name: "Slack Notifier",
  description: "Slack チャンネルにメッセージを送信するツール。Webhook URL を設定して使用。",
  icon: "💬",
  github_url: "https://github.com/example-org/slack-notifier-mcp",
  branch: "develop",
  subdir: "packages/slack",
  tool_type: "skill",
  group: "user",
  port: 8101,
  static_ip: "192.168.0.12",
  status: "error",
  created_at: "2025-06-02T09:00:00Z",
  updated_at: "2025-06-10T15:45:00Z",
  error_message: "Container exited with code 1: SLACK_WEBHOOK_URL is not set",
  dify_registered: false,
};

/** Deploying 状態のサーバー */
export const mockServerDeploying: Server = {
  name: "github-tools",
  display_name: "GitHub Tools",
  description: "GitHub API を使った Issue 作成・PR レビューなどの操作を提供するツール。",
  icon: "🐙",
  github_url: "https://github.com/example-org/github-tools-mcp",
  branch: "main",
  subdir: "",
  tool_type: "cli_library",
  group: "default",
  port: 8002,
  static_ip: "192.168.0.13",
  status: "deploying",
  created_at: "2025-06-10T16:00:00Z",
  updated_at: "2025-06-10T16:00:00Z",
  error_message: null,
  dify_registered: false,
};

/** すべてのモックサーバー一覧 */
export const mockServers: Server[] = [
  mockServerRunning,
  mockServerStopped,
  mockServerError,
  mockServerDeploying,
];

// --- ReleaseNotesTab 用 ---

export const mockReleaseNotes: ReleaseNote[] = [
  {
    sha: "abc1234",
    message: "[feat] サーバー自動デプロイ機能を追加",
    date: "2025-06-10",
  },
  {
    sha: "def5678",
    message: "[fix] Registry UI のタイトルを修正",
    date: "2025-06-10",
  },
  {
    sha: "ghi9012",
    message: "[infra] Docker Compose の設定を最適化",
    date: "2025-06-09",
  },
  {
    sha: "jkl3456",
    message: "[feat] サーバーカードに Dify 登録バッジを追加",
    date: "2025-06-09",
  },
  {
    sha: "mno7890",
    message: "[docs] アーキテクチャドキュメントを更新",
    date: "2025-06-08",
  },
  {
    sha: "pqr1234",
    message: "[fix] サーバー削除時のエラーハンドリングを改善",
    date: "2025-06-08",
  },
  {
    sha: "stu5678",
    message: "[mcp] Web Search MCP の検索精度を向上",
    date: "2025-06-07",
  },
  {
    sha: "vwx9012",
    message: "[refactor] API クライアントのコードを整理",
    date: "2025-06-07",
  },
];
