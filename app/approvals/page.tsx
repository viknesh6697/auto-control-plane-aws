"use client";

import { useState } from "react";
import Link from "next/link";
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
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { decideApprovalRequest } from "@/lib/api";

export default function ApprovalsPage() {
  const { state, loading, error, setState } = useControlPlane();
  const [busyId, setBusyId] = useState<string | null>(null);
  const [localError, setLocalError] = useState<string | null>(null);

  if (loading && !state) return <LoadingBlock />;
  if (error && !state) return <ErrorBlock message={error} />;
  if (!state) return null;

  const pending = state.approvals.filter((a) => a.status === "pending");
  const decided = state.approvals.filter((a) => a.status !== "pending");

  async function decide(id: string, decision: "approved" | "rejected") {
    setBusyId(id);
    setLocalError(null);
    try {
      const res = await decideApprovalRequest(
        id,
        decision,
        decision === "approved"
          ? "Approved via control plane demo"
          : "Rejected via control plane demo",
      );
      setState(res.state);
    } catch (e) {
      setLocalError(e instanceof Error ? e.message : "Decision failed");
    } finally {
      setBusyId(null);
    }
  }

  return (
    <div>
      <PageHeader
        title="Approvals"
        description="L2 approve-then-act queue. Production open-SSH remediations land here; sandbox L3 skips this step."
      />

      {localError ? (
        <Alert variant="destructive" className="mb-4">
          <AlertTitle>Approval failed</AlertTitle>
          <AlertDescription>{localError}</AlertDescription>
        </Alert>
      ) : null}

      <div className="mb-3 text-xs text-slate-500">
        Signed in as{" "}
        <span className="font-medium text-slate-800">{state.session.displayName}</span>{" "}
        ({state.session.role}). Operators cannot approve.
      </div>

      {pending.length === 0 ? (
        <EmptyBlock
          title="No pending approvals"
          description="No pending L2 actions. Approvals appear here when policy requires approve-then-act."
        />
      ) : (
        <div className="grid gap-4">
          {pending.map((apr) => {
            const acct = state.accounts.find((a) => a.id === apr.accountId);
            const action = state.actions.find((a) => a.id === apr.actionId);
            return (
              <Card
                key={apr.id}
                className="border-amber-200/80 bg-white/95 shadow-none"
              >
                <CardHeader>
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <div>
                      <CardTitle className="text-base">{apr.summary}</CardTitle>
                      <CardDescription className="mt-1">
                        {apr.actionType} · {acct?.name} ({acct?.env}) ·{" "}
                        <Link
                          href={`/incidents/${apr.incidentId}`}
                          className="text-teal-800 hover:underline"
                        >
                          {apr.incidentId}
                        </Link>
                      </CardDescription>
                    </div>
                    <StatusBadge status={apr.status} />
                  </div>
                </CardHeader>
                <CardContent className="space-y-3">
                  <div className="flex flex-wrap gap-2">
                    <Badge variant="outline" className="capitalize">
                      Risk: {apr.risk}
                    </Badge>
                    <Badge variant="secondary">L{action?.autonomyApplied ?? 2}</Badge>
                  </div>
                  <p className="text-sm text-slate-600">
                    <span className="font-medium text-slate-800">Blast radius: </span>
                    {apr.blastRadius}
                  </p>
                  {action ? (
                    <pre className="overflow-x-auto rounded-lg bg-slate-50 p-3 font-mono text-[11px] text-slate-700">
                      {JSON.stringify(action.params, null, 2)}
                    </pre>
                  ) : null}
                  <div className="flex flex-wrap gap-2">
                    <Button
                      className="bg-teal-800 hover:bg-teal-900"
                      disabled={busyId === apr.id}
                      onClick={() => void decide(apr.id, "approved")}
                    >
                      Approve & execute
                    </Button>
                    <Button
                      variant="outline"
                      disabled={busyId === apr.id}
                      onClick={() => void decide(apr.id, "rejected")}
                    >
                      Reject
                    </Button>
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}

      {decided.length > 0 ? (
        <div className="mt-8">
          <h3 className="mb-3 text-sm font-semibold text-slate-800">History</h3>
          <ul className="divide-y divide-slate-100 overflow-hidden rounded-xl border border-slate-200 bg-white/90">
            {decided.map((apr) => (
              <li
                key={apr.id}
                className="flex items-center justify-between gap-3 px-4 py-3 text-sm"
              >
                <div>
                  <div className="font-medium">{apr.summary}</div>
                  <div className="text-xs text-slate-500">
                    {apr.decidedBy ?? "—"} ·{" "}
                    {apr.decidedAt
                      ? new Date(apr.decidedAt).toLocaleString()
                      : "—"}
                  </div>
                </div>
                <StatusBadge status={apr.status} />
              </li>
            ))}
          </ul>
        </div>
      ) : null}
    </div>
  );
}
