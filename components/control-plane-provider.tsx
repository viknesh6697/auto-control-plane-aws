"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useState,
  type ReactNode,
} from "react";
import { fetchState } from "@/lib/api";
import type { StoreSnapshot } from "@/lib/types";

type CpContextValue = {
  state: StoreSnapshot | null;
  loading: boolean;
  error: string | null;
  refresh: () => Promise<void>;
  setState: (s: StoreSnapshot) => void;
};

const CpContext = createContext<CpContextValue | null>(null);

export function ControlPlaneProvider({ children }: { children: ReactNode }) {
  const [state, setState] = useState<StoreSnapshot | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    try {
      const snap = await fetchState();
      setState(snap);
      setError(null);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to load state");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    let cancelled = false;
    const tick = async () => {
      if (cancelled) return;
      await refresh();
    };
    void tick();
    const id = setInterval(() => void tick(), 2500);
    return () => {
      cancelled = true;
      clearInterval(id);
    };
  }, [refresh]);

  return (
    <CpContext.Provider value={{ state, loading, error, refresh, setState }}>
      {children}
    </CpContext.Provider>
  );
}

export function useControlPlane() {
  const ctx = useContext(CpContext);
  if (!ctx) {
    throw new Error("useControlPlane must be used within ControlPlaneProvider");
  }
  return ctx;
}
