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

export default function SecurityPage() {
  const { state, loading, error } = useControlPlane();

  if (loading && !state) return <LoadingBlock />;
  if (error && !state) return <ErrorBlock message={error} />;
  if (!state) return null;

  const findings = state.incidents.filter((i) => i.category === "security");
  const sgResources = state.resources.filter((r) => r.type === "security_group");
  const iamKeys = state.resources.filter((r) => r.type === "iam_access_key");

  return (
    <div>
      <PageHeader
        title="Security"
        description="IAM and security-group findings feeding the incident pipeline."
      />

      <div className="mb-6 grid gap-4 md:grid-cols-3">
        <Card className="border-slate-200/80 bg-white/90 shadow-none">
          <CardHeader className="pb-2">
            <CardDescription>Security incidents</CardDescription>
            <CardTitle className="text-2xl">{findings.length}</CardTitle>
          </CardHeader>
        </Card>
        <Card className="border-slate-200/80 bg-white/90 shadow-none">
          <CardHeader className="pb-2">
            <CardDescription>Security groups tracked</CardDescription>
            <CardTitle className="text-2xl">{sgResources.length}</CardTitle>
          </CardHeader>
        </Card>
        <Card className="border-slate-200/80 bg-white/90 shadow-none">
          <CardHeader className="pb-2">
            <CardDescription>IAM access keys</CardDescription>
            <CardTitle className="text-2xl">{iamKeys.length}</CardTitle>
          </CardHeader>
        </Card>
      </div>

      <h3 className="mb-3 text-sm font-semibold text-slate-800">Findings</h3>
      {findings.length === 0 ? (
        <EmptyBlock
          title="No security findings"
          description="Seed data includes an unused IAM key; run the demo for open-SSH SG findings."
        />
      ) : (
        <ul className="space-y-3">
          {findings.map((f) => {
            const acct = state.accounts.find((a) => a.id === f.accountId);
            return (
              <li
                key={f.id}
                className="rounded-xl border border-slate-200 bg-white/90 p-4"
              >
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div>
                    <Link
                      href={`/incidents/${f.id}`}
                      className="text-sm font-semibold text-slate-900 hover:text-teal-800"
                    >
                      {f.title}
                    </Link>
                    <div className="mt-2 flex flex-wrap gap-1.5">
                      <Badge variant="outline" className="capitalize">
                        {acct?.env}
                      </Badge>
                      <SeverityBadge severity={f.severity} />
                      <StatusBadge status={f.status} />
                    </div>
                  </div>
                  <Link
                    href={`/incidents/${f.id}`}
                    className="text-xs text-teal-800 hover:underline"
                  >
                    Open incident →
                  </Link>
                </div>
              </li>
            );
          })}
        </ul>
      )}

      <h3 className="mb-3 mt-8 text-sm font-semibold text-slate-800">
        Security group inventory
      </h3>
      <div className="grid gap-3 md:grid-cols-2">
        {sgResources.map((sg) => {
          const rules =
            (sg.state.inboundRules as Array<Record<string, unknown>>) ?? [];
          const openSsh = rules.some(
            (r) =>
              Number(r.fromPort) === 22 &&
              Number(r.toPort) === 22 &&
              (r.cidr === "0.0.0.0/0" || r.cidr === "::/0"),
          );
          return (
            <Card
              key={sg.id}
              className={
                openSsh
                  ? "border-red-200 bg-red-50/40 shadow-none"
                  : "border-slate-200/80 bg-white/90 shadow-none"
              }
            >
              <CardHeader className="pb-2">
                <CardTitle className="text-base">{sg.name}</CardTitle>
                <CardDescription>
                  {sg.accountId} · {String(sg.state.groupId)}
                </CardDescription>
              </CardHeader>
              <CardContent>
                {openSsh ? (
                  <Badge
                    variant="outline"
                    className="mb-2 border-red-300 bg-red-100 text-red-800"
                  >
                    World-open SSH present
                  </Badge>
                ) : (
                  <Badge variant="outline" className="mb-2">
                    No world-open SSH
                  </Badge>
                )}
                <pre className="max-h-36 overflow-auto rounded-lg bg-white/80 p-2 font-mono text-[11px] text-slate-700">
                  {JSON.stringify(rules, null, 2)}
                </pre>
              </CardContent>
            </Card>
          );
        })}
      </div>
    </div>
  );
}
