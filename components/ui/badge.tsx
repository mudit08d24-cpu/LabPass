import { cva, type VariantProps } from "class-variance-authority";
import type { HTMLAttributes, ReactNode } from "react";
import { cn } from "@/lib/utils";

export const badgeVariants = cva(
  "inline-flex items-center gap-1.5 rounded-full border-[1.5px] border-ink px-2.5 py-0.5 text-xs font-semibold leading-5 whitespace-nowrap [&_svg]:size-3.5",
  {
    variants: {
      tone: {
        paper: "bg-paper",
        ink: "bg-ink text-sun border-ink",
        sun: "bg-sun",
        mint: "bg-mint",
        sky: "bg-sky",
        lilac: "bg-lilac",
        peach: "bg-peach",
        coral: "bg-coral",
        muted: "bg-paper-2 text-mute border-mute/50",
      },
    },
    defaultVariants: { tone: "paper" },
  },
);

export function Badge({ className, tone, ...p }: HTMLAttributes<HTMLSpanElement> & VariantProps<typeof badgeVariants>) {
  return <span className={cn(badgeVariants({ tone }), className)} {...p} />;
}

/** Black pill section label, e.g. "HOW IT WORKS" */
export function Eyebrow({ className, children, icon }: { className?: string; children: ReactNode; icon?: ReactNode }) {
  return (
    <span className={cn("inline-flex items-center gap-2 rounded-full bg-ink py-1 pl-1 pr-3 text-[11px] font-bold uppercase tracking-[0.08em] text-sun", className)}>
      <span className="grid size-5 place-items-center rounded-full bg-sun text-ink [&_svg]:size-3">{icon ?? "●"}</span>
      {children}
    </span>
  );
}
