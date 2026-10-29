import { forwardRef, type InputHTMLAttributes, type SelectHTMLAttributes, type TextareaHTMLAttributes, type LabelHTMLAttributes, type ReactNode } from "react";
import { cn } from "@/lib/utils";

const field =
  "w-full rounded-xl border-2 border-ink bg-white/90 px-3.5 text-[15px] text-ink placeholder:text-mute/70 transition-shadow focus:outline-none focus:shadow-[0_0_0_3px_var(--color-sun-2)] disabled:opacity-60 aria-[invalid=true]:border-red-ink";

export const Input = forwardRef<HTMLInputElement, InputHTMLAttributes<HTMLInputElement>>(function Input({ className, ...p }, ref) {
  return <input ref={ref} className={cn(field, "h-11", className)} {...p} />;
});

export const Textarea = forwardRef<HTMLTextAreaElement, TextareaHTMLAttributes<HTMLTextAreaElement>>(function Textarea({ className, ...p }, ref) {
  return <textarea ref={ref} className={cn(field, "min-h-24 py-2.5 leading-relaxed", className)} {...p} />;
});

export const Select = forwardRef<HTMLSelectElement, SelectHTMLAttributes<HTMLSelectElement>>(function Select({ className, children, ...p }, ref) {
  return (
    <div className="relative">
      <select ref={ref} className={cn(field, "h-11 appearance-none pr-9", className)} {...p}>
        {children}
      </select>
      <svg aria-hidden viewBox="0 0 20 20" className="pointer-events-none absolute right-3 top-1/2 size-4 -translate-y-1/2">
        <path d="M5 8l5 5 5-5" className="ink" />
      </svg>
    </div>
  );
});

export function Label({ className, ...p }: LabelHTMLAttributes<HTMLLabelElement>) {
  return <label className={cn("text-sm font-semibold", className)} {...p} />;
}

/** Label + control + hint/error, wired for screen readers. */
export function Field({ id, label, hint, error, children, className, aside }: { id: string; label: ReactNode; hint?: ReactNode; error?: string | null; children: ReactNode; className?: string; aside?: ReactNode }) {
  return (
    <div className={cn("grid gap-1.5", className)}>
      <div className="flex items-baseline justify-between gap-3">
        <Label htmlFor={id}>{label}</Label>
        {aside}
      </div>
      {children}
      {error ? (
        <p id={`${id}-error`} role="alert" className="text-[13px] font-medium text-red-ink">
          {error}
        </p>
      ) : hint ? (
        <p id={`${id}-hint`} className="text-[13px] text-mute">
          {hint}
        </p>
      ) : null}
    </div>
  );
}
