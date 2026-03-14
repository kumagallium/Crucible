// ReleaseNotesTab コンポーネントのストーリー
// fetch をモックしてデモデータを表示

import type { Meta, StoryObj } from "@storybook/react";
import { ReleaseNotesTab } from "@/components/release-notes-tab";
import { mockReleaseNotes } from "./mock-data";

const meta = {
  title: "Components/ReleaseNotesTab",
  component: ReleaseNotesTab,
  parameters: {
    layout: "padded",
  },
  // fetch("/release_notes.json") をモックしてデモデータを返す
  loaders: [
    async () => {
      const originalFetch = window.fetch;
      window.fetch = async (input, init) => {
        const url = typeof input === "string" ? input : (input as Request).url;

        if (url.includes("/release_notes.json")) {
          return new Response(JSON.stringify(mockReleaseNotes), {
            status: 200,
            headers: { "Content-Type": "application/json" },
          });
        }

        return originalFetch(input, init);
      };
      return {};
    },
  ],
} satisfies Meta<typeof ReleaseNotesTab>;

export default meta;
type Story = StoryObj<typeof meta>;

/** デモデータ付きのリリースノート */
export const Default: Story = {};

/** リリースノートが空の場合 */
export const Empty: Story = {
  loaders: [
    async () => {
      const originalFetch = window.fetch;
      window.fetch = async (input, init) => {
        const url = typeof input === "string" ? input : (input as Request).url;

        if (url.includes("/release_notes.json")) {
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
