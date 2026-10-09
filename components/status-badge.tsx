import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import type { IncidentStatus, Severity } from "@/lib/types";

const severityClass: Record<Severity, string> = {
  critical: "bg-red-600/15 text-red-700 border-red-600/20",
  high: "bg-orange-500/15 text-orange-700 border-orange-500/25",
  medium: "bg-amber-500/15 text-amber-800 border-amber-500/25",
  low: "bg-sky-500/15 text-sky-800 border-sky-500/25",
  info: "bg-slate-500/10 text-slate-700 border-slate-500/20",
};

const statusClass: Record<string, string> = {
  open: "bg-slate-500/10 text-slate-700",
  investigating: "bg-sky-500/15 text-sky-800",
  awaiting_approval: "bg-amber-500/15 text-amber-800",
  remediating: "bg-teal-500/15 text-teal-800",
  resolved: "bg-emerald-500/15 text-emerald-800",
  failed: "bg-red-600/15 text-red-700",
  pending: "bg-amber-500/15 text-amber-800",
  approved: "bg-emerald-500/15 text-emerald-800",
  rejected: "bg-red-600/15 text-red-700",
  succeeded: "bg-emerald-500/15 text-emerald-800",
  dry_run: "bg-violet-500/15 text-violet-800",
  blocked: "bg-red-600/15 text-red-700",
  proposed: "bg-slate-500/10 text-slate-700",
  pending_approval: "bg-amber-500/15 text-amber-800",
  running: "bg-teal-500/15 text-teal-800",
  healthy: "bg-emerald-500/15 text-emerald-800",
  degraded: "bg-amber-500/15 text-amber-800",
  critical: "bg-red-600/15 text-red-700",
};

export function SeverityBadge({ severity }: { severity: Severity }) {
  return (
    <Badge variant="outline" className={cn("capitalize", severityClass[severity])}>
      {severity}
    </Badge>
  );
}

export function StatusBadge({ status }: { status: string }) {
  return (
    <Badge
      variant="outline"
      className={cn("capitalize", statusClass[status] ?? statusClass.open)}
    >
      {status.replaceAll("_", " ")}
    </Badge>
  );
}

export function IncidentStatusBadge({ status }: { status: IncidentStatus }) {
  return <StatusBadge status={status} />;
}
