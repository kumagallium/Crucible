import * as React from "react";
import { cva, type VariantProps } from "class-variance-authority";
import { cn } from "@/lib/utils";

const badgeVariants = cva(
  "inline-flex items-center gap-1.5 rounded-full border px-2.5 py-0.5 text-xs font-semibold transition-colors focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2",
  {
    variants: {
      variant: {
        default:
          "border-transparent bg-primary text-primary-foreground",
        secondary:
          "border-transparent bg-secondary text-secondary-foreground",
        destructive:
          "border-transparent bg-destructive text-destructive-foreground",
        outline: "text-foreground",
        // ステータス用
        running:
          "border-status-running-border bg-status-running-bg text-status-running",
        stopped:
          "border-status-stopped-border bg-status-stopped-bg text-status-stopped",
        error:
          "border-status-error-border bg-status-error-bg text-status-error",
        deploying:
          "border-status-deploying-border bg-status-deploying-bg text-status-deploying",
        // グループ用
        official:
          "border-success-border bg-success-bg text-success",
        community:
          "border-warning-border bg-warning-bg text-warning",
        // カタログ trust_level 用
        e4m:
          "border-info-border bg-info-bg text-info",
        verified:
          "border-success-border bg-success-bg text-success",
        featured:
          "border-warning-border bg-warning-bg text-warning",
        // ツール種別用
        mcpServer:
          "border-info-border bg-info-bg text-info",
        cliLibrary:
          "border-warning-border bg-warning-bg text-warning",
        skill:
          "border-success-border bg-success-bg text-success",
        // Dify 用
        difyOk:
          "border-success-border bg-success-bg text-success",
        difyNg:
          "border-status-stopped-border bg-status-stopped-bg text-status-stopped",
        // ポート用
        port:
          "border-status-stopped-border bg-status-stopped-bg text-status-stopped font-mono",
      },
    },
    defaultVariants: {
      variant: "default",
    },
  }
);

export interface BadgeProps
  extends React.HTMLAttributes<HTMLDivElement>,
    VariantProps<typeof badgeVariants> {}

function Badge({ className, variant, ...props }: BadgeProps) {
  return (
    <div className={cn(badgeVariants({ variant }), className)} {...props} />
  );
}

export { Badge, badgeVariants };
