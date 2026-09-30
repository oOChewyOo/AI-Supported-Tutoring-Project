"use client";

import { createContext, useContext, useEffect, useRef, useState, type ReactNode } from "react";
import { listResourceSessionSelections } from "@/lib/resource-studio/selection-actions";
import type { ResourceSelectionState } from "@/lib/resource-studio/selection-types";
import type { ResourceSessionOption } from "@/lib/resource-studio/session-options";

const failure = "Could not update session selections. Please try again.";
type SelectionContext = {
  planId: string;
  sessions: ResourceSessionOption[];
  fictional: boolean;
  confirm: (value: boolean) => void;
  records: Record<string, ResourceSelectionState>;
  pending: boolean;
  notice: { text: string; error?: boolean } | null;
  retry: () => void;
  mutate: (operation: () => Promise<ResourceSelectionState>, sessionId: string, message: string) => Promise<void>;
};
const Context = createContext<SelectionContext | null>(null);

export function usePlanSelections() {
  const value = useContext(Context);
  if (!value) throw new Error("Session selections require the weekly plan provider.");
  return value;
}

/** Shares planning metadata only. Legacy cards and reports remain server-rendered children. */
export function PlanPageSessions({ planId, sessions, children }: {
  planId: string; sessions: ResourceSessionOption[]; children: ReactNode;
}) {
  const [fictional, setFictional] = useState(false);
  const [records, setRecords] = useState<Record<string, ResourceSelectionState>>({});
  const [pending, setPending] = useState(false);
  const [notice, setNotice] = useState<SelectionContext["notice"]>(null);
  const [reload, setReload] = useState(0);
  const busy = useRef(false);
  const generation = useRef(0);

  useEffect(() => {
    const current = ++generation.current;
    if (fictional) {
      for (const session of sessions) {
        listResourceSessionSelections(planId, session.id, true).catch(
          () => ({ error: "Could not load selections. Please try again." }),
        ).then(result => {
          if (generation.current === current) setRecords(previous => ({ ...previous, [session.id]: result }));
        });
      }
    }
    return () => { generation.current = current + 1; };
  }, [planId, sessions, fictional, reload]);

  function confirm(value: boolean) {
    generation.current++; // Ignore outstanding reads immediately, including before effect cleanup.
    setRecords({}); setNotice(null); setFictional(value);
  }

  function retry() {
    generation.current++;
    setRecords({}); setNotice(null); setReload(value => value + 1);
  }

  async function mutate(operation: () => Promise<ResourceSelectionState>, sessionId: string, message: string) {
    if (!fictional || busy.current) return;
    const current = generation.current;
    busy.current = true; setPending(true); setNotice(null);
    try {
      const result = await operation();
      if (generation.current !== current) return;
      if (result.error || !result.selections) setNotice({ text: result.error || failure, error: true });
      else {
        setRecords(previous => ({ ...previous, [sessionId]: result }));
        setNotice({ text: message });
      }
    } catch {
      if (generation.current === current) setNotice({ text: failure, error: true });
    } finally {
      busy.current = false;
      setPending(false);
    }
  }

  return <Context.Provider value={{ planId, sessions, fictional, confirm, records, pending, notice, retry, mutate }}>
    {children}
  </Context.Provider>;
}
