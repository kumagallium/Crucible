// ServersTab コンポーネントのストーリー
// API をモックしてデモデータ付きで表示

import type { Meta, StoryObj } from "@storybook/react";
import { ServersTab } from "@/components/servers-tab";
import { mockServers } from "./mock-data";

const meta = {
  title: "Components/ServersTab",
  component: ServersTab,
  parameters: {
    layout: "padded",
  },
  // fetch("/api/servers") をモック
  loaders: [
    async () => {
      const originalFetch = window.fetch;
      window.fetch = async (input, init) => {
        const url = typeof input === "string" ? input : (input as Request).url;

        // サーバー一覧 API をモック
        if (url.includes("/api/servers") && (!init?.method || init.method === "GET")) {
          return new Response(JSON.stringify(mockServers), {
            status: 200,
            headers: { "Content-Type": "application/json" },
          });
        }

        // サーバー操作 API（再起動・削除）をモック
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
} satisfies Meta<typeof ServersTab>;

export default meta;
type Story = StoryObj<typeof meta>;

/** デモデータ付き — 4つのサーバーを表示 */
export const Default: Story = {};

/** サーバーが0件の場合 — 空状態を表示 */
export const Empty: Story = {
  loaders: [
    async () => {
      const originalFetch = window.fetch;
      window.fetch = async (input, init) => {
        const url = typeof input === "string" ? input : (input as Request).url;

        if (url.includes("/api/servers")) {
          return new Response(JSON.stringify([]), {
            status: 200,
            headers: { "Content-Type": "application/json" },
          });
        }

        return originalFetch(input, init);
      };
      return {};
    },
  ],
};
