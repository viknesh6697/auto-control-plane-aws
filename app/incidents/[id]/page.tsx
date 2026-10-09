"use client";

import Link from "next/link";
import { useParams } from "next/navigation";
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

export default function IncidentDetailPage() {
  const params = useParams<{ id: string }>();
  const { state, loading, error } = useControlPlane();

  if (loading && !state) return <LoadingBlock />;
  if (error && !state) return <ErrorBlock message={error} />;
  if (!state) return null;

  const incident = state.incidents.find((i) => i.id === params.id);
  if (!incident) {
    return (
      <EmptyBlock
        title="Incident not found"
        description="This incident is not in the current store. Return to the incidents list."
      />
    );
  }

  const acct = state.accounts.find((a) => a.id === incident.accountId);
  const actions = state.actions.filter((a) => a.incidentId === incident.id);
  const resources = state.resources.filter((r) =>
    incident.resourceIds.includes(r.id),
  );

  return (
    <div>
      <div className="mb-3">
        <Link href="/incidents" className="text-xs text-teal-800 hover:underline">
          ← Incidents
        </Link>
      </div>
      <PageHeader title={incident.title} description={incident.id} />
      <div className="mb-5 flex flex-wrap gap-2">
        <Badge variant="outline" className="capitalize">
          {acct?.name} · {acct?.env}
        </Badge>
        <SeverityBadge severity={incident.severity} />
        <StatusBadge status={incident.status} />
        <Badge variant="secondary" className="capitalize">
          {incident.category}
        </Badge>
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <Card className="border-slate-200/80 bg-white/90 shadow-none">
          <CardHeader>
            <CardTitle className="text-base">Evidence</CardTitle>
            <CardDescription>
              Log and tag text is untrusted — shown as data only
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            {incident.evidence.map((ev) => (
              <div
                key={ev.id}
                className="rounded-lg border border-slate-100 bg-slate-50/80 p-3"
              >
                <div className="flex items-center justify-between gap-2">
                  <div className="text-xs font-semibold uppercase tracking-wide text-slate-500">
                    {ev.kind} · {ev.label}
                  </div>
                  <div className="text-[11px] text-slate-400">
                    {new Date(ev.timestamp).toLocaleString()}
                  </div>
                </div>
                <pre className="mt-2 overflow-x-auto whitespace-pre-wrap font-mono text-xs text-slate-800">
                  {ev.content}
                </pre>
              </div>
            ))}
          </CardContent>
        </Card>

        <Card className="border-slate-200/80 bg-white/90 shadow-none">
          <CardHeader>
            <CardTitle className="text-base">Agent reasoning</CardTitle>
            <CardDescription>
              Specialist · confidence{" "}
              {incident.agentTrace
                ? `${Math.round(incident.agentTrace.confidence * 100)}%`
                : "—"}
            </CardDescription>
          </CardHeader>
          <CardContent>
            {!incident.agentTrace ? (
              <p className="text-sm text-slate-500">No agent plan attached yet.</p>
            ) : (
              <div className="space-y-3">
                <p className="text-sm text-slate-800">{incident.agentTrace.summary}</p>
                <ul className="list-disc space-y-1 pl-5 text-sm text-slate-600">
                  {incident.agentTrace.reasoning.map((r) => (
                    <li key={r}>{r}</li>
                  ))}
                </ul>
                <div>
                  <div className="mb-2 text-xs font-semibold uppercase tracking-wide text-slate-500">
                    Proposed plan
                  </div>
                  {incident.agentTrace.plan.length === 0 ? (
                    <p className="text-sm text-slate-500">
                      No typed action in catalog for this finding.
                    </p>
                  ) : (
                    <ol className="space-y-2">
                      {incident.agentTrace.plan.map((step) => (
                        <li
                          key={step.order}
                          className="rounded-lg border border-teal-100 bg-teal-50/50 p-3 text-sm"
                        >
                          <div className="font-medium text-teal-950">
                            {step.order}. {step.actionType}
                          </div>
                          <div className="text-teal-900/80">{step.description}</div>
                          <pre className="mt-2 overflow-x-auto font-mono text-[11px] text-slate-700">
                            {JSON.stringify(step.params, null, 2)}
                          </pre>
                        </li>
                      ))}
                    </ol>
                  )}
                </div>
              </div>
            )}
          </CardContent>
        </Card>

        <Card className="border-slate-200/80 bg-white/90 shadow-none">
          <CardHeader>
            <CardTitle className="text-base">Resources</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            {resources.map((r) => (
              <div key={r.id} className="rounded-lg border border-slate-100 p-3 text-sm">
                <div className="font-medium">{r.name}</div>
                <div className="text-xs text-slate-500">
                  {r.type} · {r.region}
                </div>
                <pre className="mt-2 max-h-40 overflow-auto font-mono text-[11px] text-slate-700">
                  {JSON.stringify(r.state, null, 2)}
                </pre>
              </div>
            ))}
          </CardContent>
        </Card>

        <Card className="border-slate-200/80 bg-white/90 shadow-none">
          <CardHeader>
            <CardTitle className="text-base">Actions</CardTitle>
          </CardHeader>
          <CardContent>
            {actions.length === 0 ? (
              <p className="text-sm text-slate-500">No actions linked yet.</p>
            ) : (
              <ul className="space-y-2">
                {actions.map((a) => (
                  <li
                    key={a.id}
                    className="flex items-center justify-between rounded-lg border border-slate-100 p-3 text-sm"
                  >
                    <div>
                      <div className="font-medium">{a.type}</div>
                      <div className="text-xs text-slate-500">
                        L{a.autonomyApplied}
                        {a.verification ? ` · ${a.verification.message}` : ""}
                      </div>
                    </div>
                    <StatusBadge status={a.status} />
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
