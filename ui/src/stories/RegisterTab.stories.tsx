// RegisterTab コンポーネントのストーリー
// カタログモード（デフォルト）と手動モードの両方を表示

import type { Meta, StoryObj } from "@storybook/react";
import { RegisterTab } from "@/components/register-tab";

// カタログ + 登録 API をモック
function createMockLoader() {
  return async () => {
    const originalFetch = window.fetch;
    window.fetch = async (input, init) => {
      const url = typeof input === "string" ? input : (input as Request).url;

      // カタログ API をモック
      if (url.includes("/api/catalog")) {
        return new Response(
          JSON.stringify({
            servers: [
              {
                id: 1,
                name: "E4M Utils",
                description: "汎用ユーティリティ — 単位変換・DOI文献フォーマット",
                author: "E4M",
                repo: "https://github.com/kumagallium/e4m-mcp",
                category_slug: "materials",
                category_label: "材料科学",
                tags: ["単位変換", "DOI"],
                install_command: "cd e4m-utils && uv sync",
                tool_count: 4,
                trust_level: "e4m",
                featured: true,
                tools_json: [],
                env_vars_json: [],
                config_json: {},
              },
              {
                id: 3,
                name: "E4M Data",
                description: "外部データベース連携 — Materials Project・Starrydata",
                author: "E4M",
                repo: "https://github.com/kumagallium/e4m-mcp",
                category_slug: "data",
                category_label: "データ・DB",
                tags: ["Materials Project", "Starrydata"],
                install_command: "cd e4m-data && uv sync",
                tool_count: 5,
                trust_level: "e4m",
                featured: true,
                tools_json: [],
                env_vars_json: [
                  { name: "MP_API_KEY", description: "Materials Project API キー", required: true },
                ],
                config_json: {},
              },
              {
                id: 5,
                name: "GitHub MCP Server",
                description: "GitHub API — リポジトリ操作・Issue/PR 管理・コード検索",
                author: "GitHub",
                repo: "https://github.com/modelcontextprotocol/servers",
                category_slug: "dev",
                category_label: "開発ツール",
                tags: ["GitHub", "リポジトリ"],
                install_command: "npx -y @modelcontextprotocol/server-github",
                tool_count: 20,
                trust_level: "official",
                featured: false,
                tools_json: [],
                env_vars_json: [
                  { name: "GITHUB_PERSONAL_ACCESS_TOKEN", description: "GitHub PAT", required: true },
                ],
                config_json: {},
              },
            ],
            categories: [
              { id: 1, slug: "materials", label: "材料科学" },
              { id: 4, slug: "data", label: "データ・DB" },
              { id: 8, slug: "dev", label: "開発ツール" },
            ],
          }),
          { status: 200, headers: { "Content-Type": "application/json" } },
        );
      }

      // サーバー登録 API をモック
      if (url.includes("/api/servers") && init?.method === "POST") {
        return new Response(
          JSON.stringify({
            job_id: "mock-job-001",
            server_name: "mock-server",
            status: "pending",
          }),
          { status: 200, headers: { "Content-Type": "application/json" } },
        );
      }

      // ジョブログ API をモック
      if (url.includes("/api/jobs/")) {
        return new Response(
          JSON.stringify({
            job_id: "mock-job-001",
            status: "success",
            logs: [
              "リポジトリをクローン中...",
              "ビルドを実行中...",
              "コンテナを起動中...",
              "デプロイ完了！",
            ],
            total: 4,
          }),
          { status: 200, headers: { "Content-Type": "application/json" } },
        );
      }

      return originalFetch(input, init);
    };
    return {};
  };
}

const meta = {
  title: "Components/RegisterTab",
  component: RegisterTab,
  parameters: {
    layout: "padded",
  },
  loaders: [createMockLoader()],
} satisfies Meta<typeof RegisterTab>;

export default meta;
type Story = StoryObj<typeof meta>;

/** デフォルト状態 — カタログモードで表示 */
export const Default: Story = {};
