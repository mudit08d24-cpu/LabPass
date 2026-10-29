import { cva, type VariantProps } from "class-variance-authority";
import { forwardRef, type ButtonHTMLAttributes } from "react";
import { cn } from "@/lib/utils";

export const buttonVariants = cva(
  "inline-flex items-center justify-center gap-2 whitespace-nowrap rounded-full font-semibold transition-[transform,box-shadow,background] duration-150 disabled:pointer-events-none disabled:opacity-50 active:translate-y-px [&_svg]:size-4 [&_svg]:shrink-0",
  {
    variants: {
      variant: {
        default: "bg-ink text-paper hover:bg-ink-2 shadow-[0_2px_0_0_rgb(0_0_0/0.25)]",
        outline: "border-2 border-ink bg-paper text-ink hover:bg-white",
        sun: "border-2 border-ink bg-sun text-ink hover:bg-sun-2",
        ghost: "text-ink hover:bg-ink/8",
        danger: "border-2 border-red-ink bg-paper text-red-ink hover:bg-coral/60",
        link: "text-ink underline underline-offset-4 decoration-2 hover:decoration-[3px] rounded-none px-0",
      },
      size: {
        sm: "h-8 px-3.5 text-[13px]",
        default: "h-10 px-5 text-sm",
        lg: "h-12 px-7 text-base",
        icon: "size-10",
        "icon-sm": "size-8",
      },
    },
    defaultVariants: { variant: "default", size: "default" },
  },
);

export interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement>, VariantProps<typeof buttonVariants> {
  loading?: boolean;
}

export const Button = forwardRef<HTMLButtonElement, ButtonProps>(function Button(
  { className, variant, size, loading, children, disabled, ...props },
  ref,
) {
  return (
    <button ref={ref} className={cn(buttonVariants({ variant, size }), className)} disabled={disabled || loading} aria-busy={loading || undefined} {...props}>
      {loading && <span className="size-3.5 animate-spin rounded-full border-2 border-current border-r-transparent" aria-hidden />}
      {children}
    </button>
  );
});
