// RegisterTab コンポーネントのストーリー
// フォームのデフォルト状態を表示

import type { Meta, StoryObj } from "@storybook/react";
import { RegisterTab } from "@/components/register-tab";

const meta = {
  title: "Components/RegisterTab",
  component: RegisterTab,
  parameters: {
    layout: "padded",
  },
  // API コールをモック（registerServer / fetchJobLogs）
  loaders: [
    async () => {
      const originalFetch = window.fetch;
      window.fetch = async (input, init) => {
        const url = typeof input === "string" ? input : (input as Request).url;

        // サーバー登録 API をモック
        if (url.includes("/api/servers") && init?.method === "POST") {
          return new Response(
            JSON.stringify({
              job_id: "mock-job-001",
              server_name: "mock-server",
              status: "pending",
            }),
            { status: 200, headers: { "Content-Type": "application/json" } }
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
            { status: 200, headers: { "Content-Type": "application/json" } }
          );
        }

        return originalFetch(input, init);
      };
      return {};
    },
  ],
} satisfies Meta<typeof RegisterTab>;

export default meta;
type Story = StoryObj<typeof meta>;

/** デフォルト状態 — 入力前のフォーム */
export const Default: Story = {};
