import type { ControlPlaneStore } from "@/lib/ports/store";
import type {
  Action,
  ActionType,
  AutonomyLevel,
  Incident,
  AccountEnv,
} from "@/lib/types";

export interface PolicyDecision {
  level: AutonomyLevel;
  outcome: "auto" | "needs_approval" | "recommend" | "deny" | "blocked";
  reason: string;
  dryRun: boolean;
  killSwitch: boolean;
}

export function getAutonomy(
  store: ControlPlaneStore,
  actionType: ActionType,
  env: AccountEnv,
): AutonomyLevel {
  const policies = store.getPolicies();
  const entry = policies.matrix.find(
    (m) => m.actionType === actionType && m.env === env,
  );
  return entry?.level ?? 0;
}

export function decidePolicy(
  store: ControlPlaneStore,
  actionType: ActionType,
  accountId: string,
): PolicyDecision {
  const snap = store.snapshot();
  const account = snap.accounts.find((a) => a.id === accountId);
  const env = account?.env ?? "prod";
  const policies = store.getPolicies();
  const level = getAutonomy(store, actionType, env);

  if (policies.killSwitch) {
    return {
      level,
      outcome: "blocked",
      reason: "Global kill switch is ON — executor will not mutate resources",
      dryRun: policies.dryRun,
      killSwitch: true,
    };
  }

  let outcome: PolicyDecision["outcome"];
  let reason: string;
  if (level === 0) {
    outcome = "deny";
    reason = `Autonomy L0 in ${env}: observe only — action not proposed for execution`;
  } else if (level === 1) {
    outcome = "recommend";
    reason = `Autonomy L1 in ${env}: recommend only — human must act outside auto path`;
  } else if (level === 2) {
    outcome = "needs_approval";
    reason = `Autonomy L2 in ${env}: approve-then-act required`;
  } else {
    outcome = "auto";
    reason = `Autonomy L3 in ${env}: auto-remediate permitted`;
  }

  return {
    level,
    outcome,
    reason,
    dryRun: policies.dryRun,
    killSwitch: false,
  };
}

export function createActionFromPlan(
  store: ControlPlaneStore,
  incident: Incident,
  planIndex = 0,
): { action: Action; decision: PolicyDecision } | null {
  const step = incident.agentTrace?.plan[planIndex];
  if (!step) return null;

  const decision = decidePolicy(store, step.actionType, incident.accountId);
  const now = new Date().toISOString();

  let status: Action["status"] = "proposed";
  if (decision.outcome === "blocked") status = "blocked";
  else if (decision.outcome === "deny" || decision.outcome === "recommend")
    status = "proposed";
  else if (decision.outcome === "needs_approval") status = "pending_approval";
  else if (decision.outcome === "auto") status = "approved";

  const action: Action = {
    id: store.newId("act"),
    incidentId: incident.id,
    accountId: incident.accountId,
    type: step.actionType,
    status,
    autonomyApplied: decision.level,
    params: step.params,
    risk: "high",
    blastRadius:
      step.actionType === "revoke_sg_rule"
        ? "Single security group ingress rule; may break SSH for operators relying on public access"
        : "Single IAM access key deactivated",
    dryRun: decision.dryRun,
    createdAt: now,
    updatedAt: now,
  };

  store.addAction(action);
  store.appendAudit({
    actor: "system:policy",
    kind: "policy_decision",
    summary: decision.reason,
    incidentId: incident.id,
    actionId: action.id,
    accountId: incident.accountId,
    after: {
      level: decision.level,
      outcome: decision.outcome,
      dryRun: decision.dryRun,
      killSwitch: decision.killSwitch,
    },
  });

  return { action, decision };
}
