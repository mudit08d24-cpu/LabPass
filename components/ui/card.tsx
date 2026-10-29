import type { HTMLAttributes } from "react";
import { cn } from "@/lib/utils";

export function Card({ className, ...p }: HTMLAttributes<HTMLDivElement>) {
  return <div className={cn("paper p-5 sm:p-6", className)} {...p} />;
}
export function CardInset({ className, ...p }: HTMLAttributes<HTMLDivElement>) {
  return <div className={cn("paper-inset p-4", className)} {...p} />;
}
export function CardTitle({ className, ...p }: HTMLAttributes<HTMLHeadingElement>) {
  return <h3 className={cn("font-display text-lg font-bold leading-tight", className)} {...p} />;
}
export function CardHint({ className, ...p }: HTMLAttributes<HTMLParagraphElement>) {
  return <p className={cn("text-sm text-mute", className)} {...p} />;
}
