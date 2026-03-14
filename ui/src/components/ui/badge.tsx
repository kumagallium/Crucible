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
        // ステータス用（明るいグリーン）
        running:
          "border-[#a5d6a7] bg-[#e8f5e9] text-[#2e7d32]",
        stopped:
          "border-stone-200 bg-stone-100 text-stone-500",
        error:
          "border-red-200 bg-red-50 text-red-600",
        deploying:
          "border-sky-200 bg-sky-50 text-sky-700",
        // グループ用
        official:
          "border-[#a5d6a7] bg-[#e8f5e9] text-[#2e7d32]",
        community:
          "border-amber-200 bg-amber-50 text-amber-700",
        // Dify 用
        difyOk:
          "border-[#a5d6a7] bg-[#e8f5e9] text-[#2e7d32]",
        difyNg:
          "border-stone-200 bg-stone-100 text-stone-400",
        // ポート用
        port:
          "border-stone-200 bg-stone-100 text-stone-500 font-mono",
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
