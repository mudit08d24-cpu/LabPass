"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { api } from "./index";

/** Loads data; re-runs when deps change and when data changes (writes, Realtime). */
export function useQuery<T>(fn: () => Promise<T>, deps: unknown[]) {
  const [data, setData] = useState<T | undefined>(undefined);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const fnRef = useRef(fn);
  fnRef.current = fn;

  const run = useCallback(async (quiet = false) => {
    if (!quiet) setLoading(true);
    try {
      setData(await fnRef.current());
      setError(null);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Something went wrong. Please try again.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    run();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, deps);

  useEffect(() => api.onChange(() => run(true)), [run]);

  return { data, error, loading, reload: () => run() };
}

/** Rule values from A's labpass_config() (via B's getRules), cached for the session. */
export function useRules() {
  return useQuery(() => api.getRules(), []).data ?? null;
}
