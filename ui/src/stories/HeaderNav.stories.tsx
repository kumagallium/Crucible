// HeaderNav コンポーネントのストーリー
// Next.js の usePathname をモックしてアクティブ状態を再現

import type { Meta, StoryObj } from "@storybook/react";
import { HeaderNav } from "@/components/header-nav";

const meta = {
  title: "Components/HeaderNav",
  component: HeaderNav,
  parameters: {
    layout: "fullscreen",
    nextjs: {
      appDirectory: true,
    },
  },
} satisfies Meta<typeof HeaderNav>;

export default meta;
type Story = StoryObj<typeof meta>;

/** Servers ページ（ルート）がアクティブ */
export const ServersActive: Story = {
  parameters: {
    nextjs: {
      appDirectory: true,
      navigation: {
        pathname: "/",
      },
    },
  },
};

/** Guide ページがアクティブ */
export const GuideActive: Story = {
  parameters: {
    nextjs: {
      appDirectory: true,
      navigation: {
        pathname: "/guide",
      },
    },
  },
};

/** About ページがアクティブ */
export const AboutActive: Story = {
  parameters: {
    nextjs: {
      appDirectory: true,
      navigation: {
        pathname: "/about",
      },
    },
  },
};
