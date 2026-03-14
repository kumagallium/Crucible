// Badge コンポーネントのストーリー
// 全 variant を一覧で表示

import type { Meta, StoryObj } from "@storybook/react";
import { Badge } from "@/components/ui/badge";

const meta = {
  title: "UI/Badge",
  component: Badge,
  parameters: {
    layout: "centered",
  },
} satisfies Meta<typeof Badge>;

export default meta;
type Story = StoryObj<typeof meta>;

/** デフォルト */
export const Default: Story = {
  args: { variant: "default", children: "Default" },
};

/** セカンダリー */
export const Secondary: Story = {
  args: { variant: "secondary", children: "Secondary" },
};

/** 破壊的 */
export const Destructive: Story = {
  args: { variant: "destructive", children: "Destructive" },
};

/** アウトライン */
export const Outline: Story = {
  args: { variant: "outline", children: "Outline" },
};

/** Running ステータス */
export const Running: Story = {
  args: { variant: "running", children: "Running" },
};

/** Stopped ステータス */
export const Stopped: Story = {
  args: { variant: "stopped", children: "Stopped" },
};

/** Error ステータス */
export const ErrorVariant: Story = {
  args: { variant: "error", children: "Error" },
};

/** Deploying ステータス */
export const Deploying: Story = {
  args: { variant: "deploying", children: "Deploying" },
};

/** Official グループ */
export const Official: Story = {
  args: { variant: "official", children: "Official" },
};

/** Community グループ */
export const Community: Story = {
  args: { variant: "community", children: "Community" },
};

/** Dify 登録済み */
export const DifyOk: Story = {
  args: { variant: "difyOk", children: "✓ Dify" },
};

/** Dify 未登録 */
export const DifyNg: Story = {
  args: { variant: "difyNg", children: "Dify" },
};

/** ポート番号 */
export const Port: Story = {
  args: { variant: "port", children: ":8001" },
};

/**
 * 全 variant を一覧表示するストーリー
 */
export const AllVariants: Story = {
  render: () => (
    <div className="flex flex-wrap gap-2">
      <Badge variant="default">Default</Badge>
      <Badge variant="secondary">Secondary</Badge>
      <Badge variant="destructive">Destructive</Badge>
      <Badge variant="outline">Outline</Badge>
      <Badge variant="running">Running</Badge>
      <Badge variant="stopped">Stopped</Badge>
      <Badge variant="error">Error</Badge>
      <Badge variant="deploying">Deploying</Badge>
      <Badge variant="official">Official</Badge>
      <Badge variant="community">Community</Badge>
      <Badge variant="difyOk">✓ Dify</Badge>
      <Badge variant="difyNg">Dify</Badge>
      <Badge variant="port">:8001</Badge>
    </div>
  ),
};
