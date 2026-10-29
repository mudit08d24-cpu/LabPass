import { Suspense, type ReactNode } from "react";
import { AppShell } from "@/components/layout/app-shell";

// cacheComponents (next.config.ts) needs URL hooks (usePathname, useParams) inside <Suspense>,
// so every signed-in page streams in after the static shell.
function ShellFallback() {
  return (
    <div className="grid min-h-screen place-items-center">
      <span className="size-8 animate-spin rounded-full border-[3px] border-ink border-r-transparent" aria-label="Loading" />
    </div>
  );
}

export default function AppLayout({ children }: { children: ReactNode }) {
  return (
    <Suspense fallback={<ShellFallback />}>
      <AppShell>{children}</AppShell>
    </Suspense>
  );
}
