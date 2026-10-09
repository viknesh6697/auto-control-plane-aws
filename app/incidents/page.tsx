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
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";

export default function IncidentsPage() {
  const { state, loading, error } = useControlPlane();

  if (loading && !state) return <LoadingBlock />;
  if (error && !state) return <ErrorBlock message={error} />;
  if (!state) return null;

  return (
    <div>
      <PageHeader
        title="Incidents"
        description="Timeline of detections with evidence, agent reasoning, and proposed typed remediation plans."
      />

      {state.incidents.length === 0 ? (
        <EmptyBlock
          title="No incidents"
          description="No incidents yet. Security and cost findings appear here when detectors open them."
        />
      ) : (
        <div className="overflow-hidden rounded-xl border border-slate-200 bg-white/90">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Incident</TableHead>
                <TableHead>Account</TableHead>
                <TableHead>Severity</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Updated</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {state.incidents.map((inc) => {
                const acct = state.accounts.find((a) => a.id === inc.accountId);
                return (
                  <TableRow key={inc.id}>
                    <TableCell>
                      <Link
                        href={`/incidents/${inc.id}`}
                        className="font-medium text-slate-900 hover:text-teal-800"
                      >
                        {inc.title}
                      </Link>
                      <div className="text-xs text-slate-500">{inc.id}</div>
                    </TableCell>
                    <TableCell>
                      <Badge variant="outline" className="capitalize">
                        {acct?.env ?? "—"}
                      </Badge>
                    </TableCell>
                    <TableCell>
                      <SeverityBadge severity={inc.severity} />
                    </TableCell>
                    <TableCell>
                      <StatusBadge status={inc.status} />
                    </TableCell>
                    <TableCell className="text-xs text-slate-500">
                      {new Date(inc.updatedAt).toLocaleString()}
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        </div>
      )}
    </div>
  );
}
