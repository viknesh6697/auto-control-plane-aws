import type { ControlPlaneStore } from "@/lib/ports/store";
import type { Action, Approval } from "@/lib/types";

export interface RevokeSgParams {
  resourceId: string;
  groupId: string;
  protocol: string;
  fromPort: number;
  toPort: number;
  cidr: string;
}

export interface DeactivateKeyParams {
  resourceId: string;
  userName: string;
  accessKeyId: string;
}

export interface ActionRuntimeResult {
  beforeState: Record<string, unknown>;
  afterState: Record<string, unknown>;
  verified: boolean;
  message: string;
  /** For rollback of fixture/local inventory mirrors */
  rollbackSnapshot?: { resourceId: string; state: Record<string, unknown> };
}

/** Pluggable mutation runtime — demo fixtures or live AWS SDK. */
export interface ActionRuntime {
  revokeSgRule(
    params: RevokeSgParams,
    dryRun: boolean,
  ): Promise<ActionRuntimeResult>;
  deactivateAccessKey(
    params: DeactivateKeyParams,
    dryRun: boolean,
  ): Promise<ActionRuntimeResult>;
  restoreResource?(
    resourceId: string,
    state: Record<string, unknown>,
  ): Promise<void>;
}

export async function executeAction(
  store: ControlPlaneStore,
  runtime: ActionRuntime,
  actionId: string,
): Promise<Action | null> {
  const action = store.getAction(actionId);
  if (!action) return null;

  const policies = store.getPolicies();

  if (policies.killSwitch) {
    const blocked = store.updateAction(actionId, {
      status: "blocked",
      error: "Blocked by global kill switch",
    });
    store.appendAudit({
      actor: "system:executor",
      kind: "action_blocked",
      summary: `Action ${action.type} blocked by kill switch`,
      actionId,
      incidentId: action.incidentId,
      accountId: action.accountId,
    });
    if (blocked) {
      store.updateIncident(action.incidentId, { status: "failed" });
    }
    await store.flush?.();
    return blocked;
  }

  if (action.status !== "approved") {
    return action;
  }

  store.updateAction(actionId, { status: "running" });
  store.updateIncident(action.incidentId, { status: "remediating" });

  try {
    if (action.type === "revoke_sg_rule") {
      return await runRevoke(store, runtime, action);
    }
    if (action.type === "deactivate_access_key") {
      return await runDeactivate(store, runtime, action);
    }
    return store.updateAction(actionId, {
      status: "failed",
      error: `Unknown action type: ${action.type}`,
    });
  } catch (e) {
    const message = e instanceof Error ? e.message : String(e);
    const failed = store.updateAction(actionId, {
      status: "failed",
      error: message,
      executedAt: new Date().toISOString(),
    });
    store.updateIncident(action.incidentId, { status: "failed" });
    store.appendAudit({
      actor: "system:executor",
      kind: "action_executed",
      summary: `Action failed: ${message}`,
      actionId,
      incidentId: action.incidentId,
      accountId: action.accountId,
    });
    await store.flush?.();
    return failed;
  }
}

async function runRevoke(
  store: ControlPlaneStore,
  runtime: ActionRuntime,
  action: Action,
): Promise<Action | null> {
  const dryRun = action.dryRun || store.getPolicies().dryRun;
  const params: RevokeSgParams = {
    resourceId: String(action.params.resourceId ?? ""),
    groupId: String(action.params.groupId ?? ""),
    protocol: String(action.params.protocol ?? "tcp"),
    fromPort: Number(action.params.fromPort ?? 22),
    toPort: Number(action.params.toPort ?? 22),
    cidr: String(action.params.cidr ?? "0.0.0.0/0"),
  };

  const result = await runtime.revokeSgRule(params, dryRun);

  const updated = store.updateAction(action.id, {
    status: dryRun ? "dry_run" : result.verified ? "succeeded" : "failed",
    beforeState: result.beforeState,
    afterState: result.afterState,
    dryRun,
    executedAt: new Date().toISOString(),
    verification: { ok: result.verified, message: result.message },
    error: result.verified || dryRun ? undefined : result.message,
  });

  store.appendAudit({
    actor: "system:executor",
    kind: "action_executed",
    summary: dryRun
      ? `Dry-run revoke_sg_rule on ${params.groupId}`
      : `Revoked ingress on ${params.groupId}`,
    actionId: action.id,
    incidentId: action.incidentId,
    accountId: action.accountId,
    before: result.beforeState,
    after: result.afterState,
    rollbackSnapshot: result.rollbackSnapshot,
  });

  store.appendAudit({
    actor: "system:executor",
    kind: "verification",
    summary: result.message,
    actionId: action.id,
    incidentId: action.incidentId,
    accountId: action.accountId,
    after: { ok: result.verified },
  });

  store.updateIncident(action.incidentId, {
    status: dryRun || result.verified ? "resolved" : "failed",
    resolvedAt: dryRun || result.verified ? new Date().toISOString() : undefined,
  });
  store.refreshAccountHealth();
  await store.flush?.();
  return updated;
}

async function runDeactivate(
  store: ControlPlaneStore,
  runtime: ActionRuntime,
  action: Action,
): Promise<Action | null> {
  const dryRun = action.dryRun || store.getPolicies().dryRun;
  const params: DeactivateKeyParams = {
    resourceId: String(action.params.resourceId ?? ""),
    userName: String(action.params.userName ?? ""),
    accessKeyId: String(action.params.accessKeyId ?? ""),
  };

  const result = await runtime.deactivateAccessKey(params, dryRun);

  const updated = store.updateAction(action.id, {
    status: dryRun ? "dry_run" : result.verified ? "succeeded" : "failed",
    beforeState: result.beforeState,
    afterState: result.afterState,
    dryRun,
    executedAt: new Date().toISOString(),
    verification: { ok: result.verified, message: result.message },
  });

  store.appendAudit({
    actor: "system:executor",
    kind: "action_executed",
    summary: `${dryRun ? "Dry-run " : ""}Deactivate access key`,
    actionId: action.id,
    incidentId: action.incidentId,
    accountId: action.accountId,
    before: result.beforeState,
    after: result.afterState,
    rollbackSnapshot: result.rollbackSnapshot,
  });

  store.updateIncident(action.incidentId, {
    status: "resolved",
    resolvedAt: new Date().toISOString(),
  });
  store.refreshAccountHealth();
  await store.flush?.();
  return updated;
}

export function queueApproval(
  store: ControlPlaneStore,
  action: Action,
): Approval {
  const approval: Approval = {
    id: store.newId("apr"),
    actionId: action.id,
    incidentId: action.incidentId,
    accountId: action.accountId,
    status: "pending",
    requestedAt: new Date().toISOString(),
    risk: action.risk,
    blastRadius: action.blastRadius,
    actionType: action.type,
    summary: `Approve ${action.type} for incident ${action.incidentId}`,
  };
  store.addApproval(approval);
  store.updateIncident(action.incidentId, { status: "awaiting_approval" });
  store.appendAudit({
    actor: "system:policy",
    kind: "approval",
    summary: `Pending approval created for ${action.type}`,
    actionId: action.id,
    incidentId: action.incidentId,
    accountId: action.accountId,
    after: { approvalId: approval.id },
  });
  return approval;
}

export async function decideApproval(
  store: ControlPlaneStore,
  runtime: ActionRuntime,
  approvalId: string,
  decision: "approved" | "rejected",
  decidedBy?: string,
  rationale?: string,
): Promise<{ approval: Approval; action: Action | null } | null> {
  const approval = store.getApproval(approvalId);
  if (!approval || approval.status !== "pending") return null;

  const session = store.snapshot().session;
  const actor = decidedBy ?? session.displayName;

  const updatedApproval = store.updateApproval(approvalId, {
    status: decision,
    decidedAt: new Date().toISOString(),
    decidedBy: actor,
    rationale,
  });

  store.appendAudit({
    actor,
    kind: "approval",
    summary: `Approval ${decision} for action ${approval.actionId}`,
    actionId: approval.actionId,
    incidentId: approval.incidentId,
    accountId: approval.accountId,
    after: { decision, rationale },
  });

  if (decision === "rejected") {
    const action = store.updateAction(approval.actionId, {
      status: "rejected",
    });
    store.updateIncident(approval.incidentId, { status: "open" });
    await store.flush?.();
    return { approval: updatedApproval!, action };
  }

  store.updateAction(approval.actionId, { status: "approved" });
  const action = await executeAction(store, runtime, approval.actionId);
  return { approval: updatedApproval!, action };
}

export async function rollbackAudit(
  store: ControlPlaneStore,
  runtime: ActionRuntime,
  auditId: string,
): Promise<{ ok: boolean; message: string }> {
  const entry = store.getAudit(auditId);
  if (!entry) return { ok: false, message: "Audit entry not found" };
  if (entry.rolledBack) return { ok: false, message: "Already rolled back" };
  if (!entry.rollbackSnapshot) {
    return { ok: false, message: "No rollback snapshot on this entry" };
  }

  const { resourceId, state } = entry.rollbackSnapshot;
  if (runtime.restoreResource) {
    await runtime.restoreResource(resourceId, state);
  } else {
    const result = store.setResourceState(resourceId, state);
    if (!result) return { ok: false, message: "Resource missing" };
  }

  const before = store.getResource(resourceId)?.state;
  store.markAuditRolledBack(auditId);
  store.appendAudit({
    actor: store.snapshot().session.displayName,
    kind: "rollback",
    summary: `Rolled back resource ${resourceId} to pre-action state`,
    actionId: entry.actionId,
    incidentId: entry.incidentId,
    accountId: entry.accountId,
    before: before as Record<string, unknown> | undefined,
    after: state,
  });
  await store.flush?.();

  return { ok: true, message: `Restored ${resourceId} from audit snapshot` };
}
