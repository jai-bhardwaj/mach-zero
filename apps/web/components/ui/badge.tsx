import { mergeProps } from "@base-ui/react/merge-props"
import { useRender } from "@base-ui/react/use-render"
import { cva, type VariantProps } from "class-variance-authority"

import { cn } from "@/lib/utils"

const badgeVariants = cva(
  "group/badge inline-flex h-[18px] w-fit shrink-0 items-center justify-center gap-1 overflow-hidden rounded-4xl border border-transparent px-1.5 py-0.5 text-xs font-medium whitespace-nowrap transition-all focus-visible:border-ring focus-visible:ring-[3px] focus-visible:ring-ring/50 has-data-[icon=inline-end]:pr-1.5 has-data-[icon=inline-start]:pl-1.5 aria-invalid:border-destructive aria-invalid:ring-destructive/20 dark:aria-invalid:ring-destructive/40 [&>svg]:pointer-events-none [&>svg]:size-3!",
  {
    variants: {
      variant: {
        default: "bg-primary text-primary-foreground [a]:hover:bg-primary/80",
        secondary:
          "bg-secondary text-secondary-foreground [a]:hover:bg-secondary/80",
        destructive:
          "bg-destructive/10 text-destructive focus-visible:ring-destructive/20 dark:bg-destructive/20 dark:focus-visible:ring-destructive/40 [a]:hover:bg-destructive/20",
        outline:
          "border-border text-foreground [a]:hover:bg-muted [a]:hover:text-muted-foreground",
        ghost:
          "hover:bg-muted hover:text-muted-foreground dark:hover:bg-muted/50",
        link: "text-primary underline-offset-4 hover:underline",
        // Dot variant: 6px colored circle + text, no background fill (Linear/Attio status pattern)
        // Pass dot color via dotColor prop
        dot: "bg-transparent h-auto px-0 border-none text-foreground text-xs gap-1.5",
        // Trading status variants
        running: "bg-green-500/10 text-green-400 border-green-500/20",
        paused: "bg-yellow-500/10 text-yellow-400 border-yellow-500/20",
        stopped: "bg-zinc-500/10 text-zinc-500 border-zinc-500/20",
        pending: "bg-blue-500/10 text-blue-400 border-blue-500/20",
        live: "bg-red-500/10 text-red-400 border-red-500/20",
        mock: "bg-blue-500/10 text-blue-400 border-blue-500/20",
        warning: "bg-amber-500/10 text-amber-400 border-amber-500/20",
      },
    },
    defaultVariants: {
      variant: "default",
    },
  }
)

/** Dot color presets for the dot variant */
const DOT_COLORS = {
  green: "bg-green-400",
  yellow: "bg-yellow-400",
  red: "bg-red-400",
  blue: "bg-blue-400",
  zinc: "bg-zinc-400",
  amber: "bg-amber-400",
} as const

type DotColor = keyof typeof DOT_COLORS

interface BadgeProps
  extends useRender.ComponentProps<"span">,
    VariantProps<typeof badgeVariants> {
  /** Color of the dot indicator (only used with variant="dot") */
  dotColor?: DotColor
}

function Badge({
  className,
  variant = "default",
  dotColor,
  render,
  children,
  ...props
}: BadgeProps) {
  const isDot = variant === "dot"

  return useRender({
    defaultTagName: "span",
    props: mergeProps<"span">(
      {
        className: cn(badgeVariants({ variant }), className),
        children: isDot ? (
          <>
            <span
              className={cn(
                "inline-block size-1.5 rounded-full shrink-0",
                dotColor ? DOT_COLORS[dotColor] : "bg-current"
              )}
            />
            {children}
          </>
        ) : (
          children
        ),
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

export { Badge, badgeVariants, DOT_COLORS }
export type { DotColor }
