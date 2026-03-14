// AboutTab コンポーネントのストーリー

import type { Meta, StoryObj } from "@storybook/react";
import { AboutTab } from "@/components/about-tab";

const meta = {
  title: "Components/AboutTab",
  component: AboutTab,
  parameters: {
    layout: "padded",
  },
} satisfies Meta<typeof AboutTab>;

export default meta;
type Story = StoryObj<typeof meta>;

/** Crucible の名前の由来・コンセプト紹介 */
export const Default: Story = {};
