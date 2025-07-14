import * as React from "react"
import { cva, type VariantProps } from "class-variance-authority"

import { cn } from "@/lib/utils"

const badgeVariants = cva(
  "inline-flex items-center rounded-full border px-2.5 py-0.5 text-xs font-semibold transition-colors focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2",
  {
    variants: {
      variant: {
        default:
          "border-transparent bg-primary text-primary-foreground hover:bg-primary/80",
        secondary:
          "border-transparent bg-secondary text-secondary-foreground hover:bg-secondary/80",
        destructive:
          "border-transparent bg-destructive text-destructive-foreground hover:bg-destructive/80",
        outline: "text-foreground",
        // Status-specific variants for drone delivery
        pending:
          "border-transparent bg-status-pending/10 text-status-pending border-status-pending/20",
        scheduled:
          "border-transparent bg-status-scheduled/10 text-status-scheduled border-status-scheduled/20",
        "in_flight":
          "border-transparent bg-status-in-flight/10 text-status-in-flight border-status-in-flight/20",
        completed:
          "border-transparent bg-status-completed/10 text-status-completed border-status-completed/20",
        failed:
          "border-transparent bg-status-failed/10 text-status-failed border-status-failed/20",
      },
    },
    defaultVariants: {
      variant: "default",
    },
  }
)

export interface BadgeProps
  extends React.HTMLAttributes<HTMLDivElement>,
    VariantProps<typeof badgeVariants> {}

function Badge({ className, variant, ...props }: BadgeProps) {
  return (
    <div className={cn(badgeVariants({ variant }), className)} {...props} />
  )
}

export { Badge, badgeVariants }
