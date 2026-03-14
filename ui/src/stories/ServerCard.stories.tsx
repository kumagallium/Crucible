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

/** Running 状態 — 正常稼働中 */
export const Running: Story = {
  args: {
    server: mockServerRunning,
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
