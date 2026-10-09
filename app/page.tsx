"use client";

import Link from "next/link";
import { useControlPlane } from "@/components/control-plane-provider";
import {
  EmptyBlock,
  ErrorBlock,
  LoadingBlock,
  PageHeader,
} from "@/components/page-states";
import { SeverityBadge, StatusBadge } from "@/components/status-badge";
import { Badge } from "@/components/ui/badge";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";

export default function OverviewPage() {
  const { state, loading, error } = useControlPlane();

  if (loading && !state) return <LoadingBlock />;
  if (error && !state) return <ErrorBlock message={error} />;
  if (!state) {
    return (
      <EmptyBlock
        title="No control-plane state"
        description="Control-plane state is unavailable. Check the server and try again."
      />
    );
  }

  const active = state.incidents.filter(
    (i) => i.status !== "resolved" && i.status !== "failed",
  );
  const dayAgo = Date.now() - 24 * 60 * 60 * 1000;
  const actions24h = state.actions.filter(
    (a) => new Date(a.updatedAt).getTime() >= dayAgo,
  );
  const pendingApprovals = state.approvals.filter((a) => a.status === "pending");

  return (
    <div>
      <PageHeader
        title="Overview"
        description="Account health, active incidents, and actions in the last 24 hours across sandbox and production accounts."
      />

      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        {state.accounts.map((acct) => {
          const openCount = active.filter((i) => i.accountId === acct.id).length;
          return (
            <Card key={acct.id} className="border-slate-200/80 bg-white/90 shadow-none">
              <CardHeader className="pb-2">
                <CardDescription className="uppercase tracking-wide text-[11px]">
                  {acct.env}
                </CardDescription>
                <CardTitle className="flex items-center justify-between text-base">
                  {acct.name}
                  <StatusBadge status={acct.health} />
                </CardTitle>
              </CardHeader>
              <CardContent className="text-sm text-slate-600">
                <div>
                  Active incidents:{" "}
                  <span className="font-semibold text-slate-900">{openCount}</span>
                </div>
                <div className="mt-1 text-xs text-slate-500">
                  SG revoke autonomy:{" "}
                  {state.policies.matrix.find(
                    (m) =>
                      m.actionType === "revoke_sg_rule" && m.env === acct.env,
                  )?.level === 3
                    ? "L3 auto"
                    : "L2 approve"}
                </div>
              </CardContent>
            </Card>
          );
        })}
        <Card className="border-slate-200/80 bg-white/90 shadow-none">
          <CardHeader className="pb-2">
            <CardDescription className="uppercase tracking-wide text-[11px]">
              Last 24h
            </CardDescription>
            <CardTitle className="text-base">Actions</CardTitle>
          </CardHeader>
          <CardContent className="text-sm text-slate-600">
            <div className="text-2xl font-semibold text-slate-900">
              {actions24h.length}
            </div>
            <p className="text-xs text-slate-500">
              Including dry-runs, blocks, and remediations
            </p>
          </CardContent>
        </Card>
        <Card className="border-slate-200/80 bg-white/90 shadow-none">
          <CardHeader className="pb-2">
            <CardDescription className="uppercase tracking-wide text-[11px]">
              Queue
            </CardDescription>
            <CardTitle className="text-base">Pending approvals</CardTitle>
          </CardHeader>
          <CardContent className="text-sm text-slate-600">
            <div className="text-2xl font-semibold text-slate-900">
              {pendingApprovals.length}
            </div>
            <Link href="/approvals" className="text-xs text-teal-800 underline-offset-2 hover:underline">
              Review Approvals →
            </Link>
          </CardContent>
        </Card>
      </div>

      <div className="mt-6 grid gap-4 lg:grid-cols-2">
        <Card className="border-slate-200/80 bg-white/90 shadow-none">
          <CardHeader>
            <CardTitle className="text-base">Active incidents</CardTitle>
            <CardDescription>
              Open, investigating, or awaiting approval
            </CardDescription>
          </CardHeader>
          <CardContent>
            {active.length === 0 ? (
              <EmptyBlock
                title="No active incidents"
                description="No open incidents right now. New findings appear here when detectors fire."
              />
            ) : (
              <ul className="divide-y divide-slate-100">
                {active.map((inc) => {
                  const acct = state.accounts.find((a) => a.id === inc.accountId);
                  return (
                    <li key={inc.id} className="flex items-start justify-between gap-3 py-3">
                      <div>
                        <Link
                          href={`/incidents/${inc.id}`}
                          className="text-sm font-medium text-slate-900 hover:text-teal-800"
                        >
                          {inc.title}
                        </Link>
                        <div className="mt-1 flex flex-wrap gap-1.5">
                          <Badge variant="outline" className="capitalize">
                            {acct?.env}
                          </Badge>
                          <SeverityBadge severity={inc.severity} />
                          <StatusBadge status={inc.status} />
                        </div>
                      </div>
                    </li>
                  );
                })}
              </ul>
            )}
          </CardContent>
        </Card>

        <Card className="border-slate-200/80 bg-white/90 shadow-none">
          <CardHeader>
            <CardTitle className="text-base">Recent actions</CardTitle>
            <CardDescription>Typed catalog executions only</CardDescription>
          </CardHeader>
          <CardContent>
            {actions24h.length === 0 ? (
              <EmptyBlock
                title="No actions yet"
                description="Typed catalog executions appear here after remediation runs."
              />
            ) : (
              <ul className="divide-y divide-slate-100">
                {actions24h.slice(0, 8).map((act) => (
                  <li key={act.id} className="flex items-center justify-between gap-3 py-3 text-sm">
                    <div>
                      <div className="font-medium text-slate-900">
                        {act.type.replaceAll("_", " ")}
                      </div>
                      <div className="text-xs text-slate-500">
                        L{act.autonomyApplied}
                        {act.dryRun ? " · dry-run" : ""} · {act.id}
                      </div>
                    </div>
                    <StatusBadge status={act.status} />
                  </li>
                ))}
              </ul>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
