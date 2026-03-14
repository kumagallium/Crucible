// GuideTab コンポーネントのストーリー

import type { Meta, StoryObj } from "@storybook/react";
import { GuideTab } from "@/components/guide-tab";

const meta = {
  title: "Components/GuideTab",
  component: GuideTab,
  parameters: {
    layout: "padded",
  },
} satisfies Meta<typeof GuideTab>;

export default meta;
type Story = StoryObj<typeof meta>;

/** MCP サーバー接続ガイド */
export const Default: Story = {};
