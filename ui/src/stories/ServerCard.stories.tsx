// ServerCard コンポーネントのストーリー
// 各ステータス (running, stopped, error, deploying) をデモデータで表示

import type { Meta, StoryObj } from "@storybook/react";
import { ServerCard } from "@/components/server-card";
import {
  mockServerRunning,
  mockServerStopped,
  mockServerError,
  mockServerDeploying,
} from "./mock-data";

const meta = {
  title: "Components/ServerCard",
  component: ServerCard,
  parameters: {
    layout: "centered",
  },
  decorators: [
    // カード幅を制限して見やすくする
    (Story) => (
      <div style={{ width: 380 }}>
        <Story />
      </div>
    ),
  ],
  args: {
    baseUrl: "http://127.0.0.1",
    onAction: () => console.log("onAction called"),
  },
  // API コールをモック（fetch をインターセプト）
  loaders: [
    async () => {
      // restartServer / deleteServer が呼ばれても実際の API には飛ばない
      const originalFetch = window.fetch;
      window.fetch = async (input, init) => {
        const url = typeof input === "string" ? input : (input as Request).url;
        // サーバー操作 API をモック
        if (url.includes("/api/servers/") || url.includes("/api/jobs/")) {
          return new Response(
            JSON.stringify({
              job_id: "mock-job-001",
              server_name: "mock-server",
              status: "success",
              logs: ["完了"],
              total: 1,
            }),
            { status: 200, headers: { "Content-Type": "application/json" } }
          );
        }
        return originalFetch(input, init);
      };
      return {};
    },
  ],
} satisfies Meta<typeof ServerCard>;

export default meta;
type Story = StoryObj<typeof meta>;

/** Running 状態 — 正常稼働中 (Dify 接続済み: ボタン 4 個) */
export const Running: Story = {
  args: {
    server: mockServerRunning,
  },
};

/** Running 状態 — Dify 未接続 (ボタン最多 5 個。フッターのはみ出し/一貫性検証用) */
export const RunningDifyDisconnected: Story = {
  args: {
    server: {
      ...mockServerRunning,
      dify_registered: false,
      // 再デプロイ後を想定した更新日時
      last_deployed_at: "2025-06-15T08:42:00Z",
    },
  },
};

/** Stopped 状態 — 停止中 */
export const Stopped: Story = {
  args: {
    server: mockServerStopped,
  },
};

/** Error 状態 — エラーメッセージ付き */
export const Error: Story = {
  args: {
    server: mockServerError,
  },
};

/** Deploying 状態 — デプロイ中 */
export const Deploying: Story = {
  args: {
    server: mockServerDeploying,
  },
};
