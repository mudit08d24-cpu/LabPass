import { LoadingBlock } from "@/components/shared";

export default function Loading() {
  return (
    <div className="grid gap-6">
      <div className="h-12 w-64 animate-pulse rounded-xl bg-ink/10" aria-hidden />
      <LoadingBlock rows={3} />
    </div>
  );
}
