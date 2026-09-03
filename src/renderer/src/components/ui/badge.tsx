import { mergeProps } from "@base-ui/react/merge-props"
import { useRender } from "@base-ui/react/use-render"
import { cva, type VariantProps } from "class-variance-authority"

import { cn } from "@/lib/utils"

const badgeVariants = cva(
  "group/badge inline-flex h-6 w-fit shrink-0 items-center justify-center gap-1 overflow-hidden rounded-md px-2 text-xs font-medium whitespace-nowrap ring-1 ring-inset transition-all focus-visible:ring-2 focus-visible:ring-ring/50 [&>svg]:pointer-events-none [&>svg]:size-3.5",
  {
    variants: {
      variant: {
        default: "bg-secondary text-secondary-foreground ring-border [a]:hover:bg-muted",
        zinc: "bg-secondary text-secondary-foreground ring-border [a]:hover:bg-muted",
        orange: "bg-orange-500/15 text-orange-700 ring-orange-500/30 [a]:hover:bg-orange-500/25 dark:text-orange-300",
        amber: "bg-warning/15 text-warning-foreground ring-warning/30 [a]:hover:bg-warning/25",
        blue: "bg-info/15 text-info-foreground ring-info/30 [a]:hover:bg-info/25",
        emerald: "bg-success/15 text-success-foreground ring-success/30 [a]:hover:bg-success/25",
        secondary: "bg-secondary text-secondary-foreground ring-border [a]:hover:bg-muted",
        destructive:
          "bg-destructive/15 text-destructive-foreground ring-destructive/30 [a]:hover:bg-destructive/25",
        outline:
          "bg-background text-foreground ring-border [a]:hover:bg-muted",
        ghost:
          "hover:bg-muted hover:text-muted-foreground dark:hover:bg-muted/50",
        link: "text-primary underline-offset-4 hover:underline",
      },
    },
    defaultVariants: {
      variant: "default",
    },
  }
)

function Badge({
  className,
  variant = "default",
  render,
  ...props
}: useRender.ComponentProps<"span"> & VariantProps<typeof badgeVariants>) {
  return useRender({
    defaultTagName: "span",
    props: mergeProps<"span">(
      {
        className: cn(badgeVariants({ variant }), className),
      },
      props
    ),
    render,
    state: {
      slot: "badge",
      variant,
    },
  })
}

export { Badge, badgeVariants }
