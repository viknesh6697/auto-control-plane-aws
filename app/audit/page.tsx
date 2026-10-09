"use client";

import { useState } from "react";
import { useControlPlane } from "@/components/control-plane-provider";
import {
  EmptyBlock,
  ErrorBlock,
  LoadingBlock,
  PageHeader,
} from "@/components/page-states";
import { StatusBadge } from "@/components/status-badge";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { rollbackAuditEntry } from "@/lib/api";

export default function AuditPage() {
  const { state, loading, error, setState } = useControlPlane();
  const [busyId, setBusyId] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [localError, setLocalError] = useState<string | null>(null);

  if (loading && !state) return <LoadingBlock />;
  if (error && !state) return <ErrorBlock message={error} />;
  if (!state) return null;

  async function onRollback(id: string) {
    setBusyId(id);
    setLocalError(null);
    setMessage(null);
    try {
      const res = await rollbackAuditEntry(id);
      setState(res.state);
      setMessage(res.message);
      if (!res.ok) setLocalError(res.message);
    } catch (e) {
      setLocalError(e instanceof Error ? e.message : "Rollback failed");
    } finally {
      setBusyId(null);
    }
  }

  return (
    <div>
      <PageHeader
        title="Audit"
        description="Append-only history with before/after snapshots. Entries that mutated resources expose a rollback control."
      />

      {localError ? (
        <Alert variant="destructive" className="mb-4">
          <AlertTitle>Rollback issue</AlertTitle>
          <AlertDescription>{localError}</AlertDescription>
        </Alert>
      ) : null}
      {message && !localError ? (
        <Alert className="mb-4">
          <AlertTitle>Rollback</AlertTitle>
          <AlertDescription>{message}</AlertDescription>
        </Alert>
      ) : null}

      {state.audit.length === 0 ? (
        <EmptyBlock
          title="Audit log empty"
          description="Detector, policy, executor, and approval events appear here."
        />
      ) : (
        <ol className="space-y-3">
          {state.audit.map((entry) => (
            <li
              key={entry.id}
              className="rounded-xl border border-slate-200 bg-white/90 p-4"
            >
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div>
                  <div className="flex flex-wrap items-center gap-2">
                    <Badge variant="outline">{entry.kind}</Badge>
                    {entry.rolledBack ? (
                      <StatusBadge status="resolved" />
                    ) : null}
                    <span className="text-[11px] text-slate-400">
                      {new Date(entry.timestamp).toLocaleString()}
                    </span>
                  </div>
                  <div className="mt-1 text-sm font-medium text-slate-900">
                    {entry.summary}
                  </div>
                  <div className="mt-1 text-xs text-slate-500">
                    {entry.actor}
                    {entry.incidentId ? ` · ${entry.incidentId}` : ""}
                    {entry.actionId ? ` · ${entry.actionId}` : ""}
                  </div>
                </div>
                {entry.rollbackSnapshot && !entry.rolledBack ? (
                  <Button
                    variant="outline"
                    size="sm"
                    disabled={busyId === entry.id}
                    onClick={() => void onRollback(entry.id)}
                  >
                    Rollback resource
                  </Button>
                ) : null}
              </div>
              {(entry.before || entry.after) && (
                <div className="mt-3 grid gap-2 md:grid-cols-2">
                  {entry.before ? (
                    <div>
                      <div className="text-[11px] font-semibold uppercase tracking-wide text-slate-500">
                        Before
                      </div>
                      <pre className="mt-1 max-h-40 overflow-auto rounded-lg bg-slate-50 p-2 font-mono text-[11px] text-slate-700">
                        {JSON.stringify(entry.before, null, 2)}
                      </pre>
                    </div>
                  ) : null}
                  {entry.after ? (
                    <div>
                      <div className="text-[11px] font-semibold uppercase tracking-wide text-slate-500">
                        After
                      </div>
                      <pre className="mt-1 max-h-40 overflow-auto rounded-lg bg-slate-50 p-2 font-mono text-[11px] text-slate-700">
                        {JSON.stringify(entry.after, null, 2)}
                      </pre>
                    </div>
                  ) : null}
                </div>
              )}
            </li>
          ))}
        </ol>
      )}
    </div>
  );
}
