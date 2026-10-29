"use client";

import type { ReactNode } from "react";
import { Toaster } from "@/components/ui/toast";
import { SessionProvider } from "@/lib/screens/session";

export function Providers({ children }: { children: ReactNode }) {
  return (
    <SessionProvider>
      <Toaster>{children}</Toaster>
    </SessionProvider>
  );
}
