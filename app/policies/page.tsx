"use client";

import { useState } from "react";
import { useControlPlane } from "@/components/control-plane-provider";
import {
  ErrorBlock,
  LoadingBlock,
  PageHeader,
} from "@/components/page-states";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { updatePolicies } from "@/lib/api";
import type { ActionType, AccountEnv, AutonomyLevel } from "@/lib/types";

const LEVEL_HELP: Record<number, string> = {
  0: "L0 observe only",
  1: "L1 recommend",
  2: "L2 approve-then-act",
  3: "L3 auto-remediate",
};

export default function PoliciesPage() {
  const { state, loading, error, setState } = useControlPlane();
  const [busy, setBusy] = useState(false);
  const [localError, setLocalError] = useState<string | null>(null);

  if (loading && !state) return <LoadingBlock />;
  if (error && !state) return <ErrorBlock message={error} />;
  if (!state) return null;

  const policies = state.policies;

  async function patch(body: Record<string, unknown>) {
    setBusy(true);
    setLocalError(null);
    try {
      const res = await updatePolicies(body);
      setState(res.state);
    } catch (e) {
      setLocalError(e instanceof Error ? e.message : "Update failed");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div>
      <PageHeader
        title="Policies"
        description="Autonomy ladder per action × environment, plus dry-run and a global kill switch that blocks the executor."
      />

      {localError ? (
        <Alert variant="destructive" className="mb-4">
          <AlertTitle>Policy update failed</AlertTitle>
          <AlertDescription>{localError}</AlertDescription>
        </Alert>
      ) : null}

      <div className="mb-6 grid gap-4 md:grid-cols-2">
        <div className="flex items-center justify-between rounded-xl border border-slate-200 bg-white/90 px-4 py-4">
          <div>
            <Label htmlFor="dry-run" className="text-sm font-semibold">
              Dry-run mode
            </Label>
            <p className="mt-1 text-xs text-slate-500">
              Record would-be changes without mutating resources.
            </p>
          </div>
          <Switch
            id="dry-run"
            checked={policies.dryRun}
            disabled={busy}
            onCheckedChange={(checked) => void patch({ dryRun: checked })}
          />
        </div>
        <div className="flex items-center justify-between rounded-xl border border-red-200 bg-red-50/60 px-4 py-4">
          <div>
            <Label htmlFor="kill" className="text-sm font-semibold text-red-900">
              Global kill switch
            </Label>
            <p className="mt-1 text-xs text-red-800/70">
              Blocks all executor mutations until turned off.
            </p>
          </div>
          <Switch
            id="kill"
            checked={policies.killSwitch}
            disabled={busy}
            onCheckedChange={(checked) => void patch({ killSwitch: checked })}
          />
        </div>
      </div>

      <div className="overflow-hidden rounded-xl border border-slate-200 bg-white/90">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Action</TableHead>
              <TableHead>Environment</TableHead>
              <TableHead>Autonomy</TableHead>
              <TableHead>Meaning</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {policies.matrix.map((row) => (
              <TableRow key={`${row.actionType}-${row.env}`}>
                <TableCell className="font-mono text-xs">
                  {row.actionType}
                </TableCell>
                <TableCell className="capitalize">{row.env}</TableCell>
                <TableCell>
                  <Select
                    value={String(row.level)}
                    disabled={busy}
                    onValueChange={(v) => {
                      if (v == null) return;
                      void patch({
                        actionType: row.actionType as ActionType,
                        env: row.env as AccountEnv,
                        level: Number(v) as AutonomyLevel,
                      });
                    }}
                  >
                    <SelectTrigger className="w-28 bg-white">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {[0, 1, 2, 3].map((lvl) => (
                        <SelectItem key={lvl} value={String(lvl)}>
                          L{lvl}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </TableCell>
                <TableCell className="text-xs text-slate-500">
                  {LEVEL_HELP[row.level]}
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>

      <div className="mt-6 rounded-xl border border-slate-200 bg-white/90 p-4">
        <h3 className="text-sm font-semibold text-slate-900">Playbook catalog</h3>
        <p className="mt-1 text-xs text-slate-500">
          Typed actions only — no free-form AWS calls in v1.
        </p>
        <ul className="mt-3 space-y-2">
          {state.playbooks.map((pb) => (
            <li
              key={pb.id}
              className="rounded-lg border border-slate-100 px-3 py-2 text-sm"
            >
              <div className="font-medium">
                {pb.name}
                {pb.recommendOnly ? (
                  <span className="ml-2 text-xs font-normal text-amber-700">
                    recommend-only on trust ladder
                  </span>
                ) : null}
              </div>
              <p className="text-xs text-slate-500">{pb.description}</p>
            </li>
          ))}
        </ul>
      </div>
    </div>
  );
}
