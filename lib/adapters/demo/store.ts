import { createSeedSnapshot } from "@/lib/adapters/demo/seed";
import type { ControlPlaneStore } from "@/lib/ports/store";
import type {
  Action,
  Approval,
  AuditEntry,
  CloudEvent,
  Incident,
  PolicyState,
  Resource,
  Role,
  SessionState,
  StoreSnapshot,
} from "@/lib/types";

declare global {
  // eslint-disable-next-line no-var
  var __awsAutoControlPlaneStore: StoreSnapshot | undefined;
}

function getState(): StoreSnapshot {
  if (!globalThis.__awsAutoControlPlaneStore) {
    globalThis.__awsAutoControlPlaneStore = createSeedSnapshot();
  }
  return globalThis.__awsAutoControlPlaneStore;
}

function bump(state: StoreSnapshot) {
  state.version += 1;
}

function uid(prefix: string) {
  return `${prefix}-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;
}

export const store: ControlPlaneStore = {
  snapshot(): StoreSnapshot {
    return structuredClone(getState());
  },

  getVersion(): number {
    return getState().version;
  },

  reset(): StoreSnapshot {
    globalThis.__awsAutoControlPlaneStore = createSeedSnapshot();
    return this.snapshot();
  },

  appendAudit(entry: Omit<AuditEntry, "id" | "timestamp"> & Partial<Pick<AuditEntry, "id" | "timestamp">>) {
    const state = getState();
    const full: AuditEntry = {
      id: entry.id ?? uid("aud"),
      timestamp: entry.timestamp ?? new Date().toISOString(),
      actor: entry.actor,
      kind: entry.kind,
      summary: entry.summary,
      incidentId: entry.incidentId,
      actionId: entry.actionId,
      accountId: entry.accountId,
      before: entry.before,
      after: entry.after,
      rollbackSnapshot: entry.rollbackSnapshot,
      rolledBack: entry.rolledBack,
    };
    state.audit.unshift(full);
    bump(state);
    return full;
  },

  addEvent(event: CloudEvent) {
    const state = getState();
    state.events.unshift(event);
    bump(state);
    return event;
  },

  addIncident(incident: Incident) {
    const state = getState();
    state.incidents.unshift(incident);
    bump(state);
    return incident;
  },

  updateIncident(id: string, patch: Partial<Incident>) {
    const state = getState();
    const idx = state.incidents.findIndex((i) => i.id === id);
    if (idx < 0) return null;
    state.incidents[idx] = {
      ...state.incidents[idx],
      ...patch,
      updatedAt: new Date().toISOString(),
    };
    bump(state);
    return state.incidents[idx];
  },

  addAction(action: Action) {
    const state = getState();
    state.actions.unshift(action);
    bump(state);
    return action;
  },

  updateAction(id: string, patch: Partial<Action>) {
    const state = getState();
    const idx = state.actions.findIndex((a) => a.id === id);
    if (idx < 0) return null;
    state.actions[idx] = {
      ...state.actions[idx],
      ...patch,
      updatedAt: new Date().toISOString(),
    };
    bump(state);
    return state.actions[idx];
  },

  addApproval(approval: Approval) {
    const state = getState();
    state.approvals.unshift(approval);
    bump(state);
    return approval;
  },

  updateApproval(id: string, patch: Partial<Approval>) {
    const state = getState();
    const idx = state.approvals.findIndex((a) => a.id === id);
    if (idx < 0) return null;
    state.approvals[idx] = { ...state.approvals[idx], ...patch };
    bump(state);
    return state.approvals[idx];
  },

  getResource(id: string): Resource | undefined {
    return getState().resources.find((r) => r.id === id);
  },

  updateResourceState(id: string, statePatch: Record<string, unknown>) {
    const state = getState();
    const idx = state.resources.findIndex((r) => r.id === id);
    if (idx < 0) return null;
    const prev = structuredClone(state.resources[idx].state);
    state.resources[idx] = {
      ...state.resources[idx],
      state: { ...state.resources[idx].state, ...statePatch },
    };
    bump(state);
    return { resource: state.resources[idx], before: prev };
  },

  setResourceState(id: string, nextState: Record<string, unknown>) {
    const state = getState();
    const idx = state.resources.findIndex((r) => r.id === id);
    if (idx < 0) return null;
    const before = structuredClone(state.resources[idx].state);
    state.resources[idx] = {
      ...state.resources[idx],
      state: structuredClone(nextState),
    };
    bump(state);
    return { resource: state.resources[idx], before };
  },

  getPolicies(): PolicyState {
    return structuredClone(getState().policies);
  },

  updatePolicies(patch: Partial<PolicyState>) {
    const state = getState();
    const before = structuredClone(state.policies);
    state.policies = {
      ...state.policies,
      ...patch,
      matrix: patch.matrix ?? state.policies.matrix,
      updatedAt: new Date().toISOString(),
    };
    bump(state);
    return { before, after: structuredClone(state.policies) };
  },

  setSession(session: Partial<SessionState>) {
    const state = getState();
    state.session = { ...state.session, ...session };
    bump(state);
    return state.session;
  },

  setRole(role: Role) {
    const names: Record<Role, string> = {
      Operator: "Operator",
      Approver: "Approver",
      Admin: "Admin",
    };
    return this.setSession({ role, displayName: names[role] });
  },

  getIncident(id: string) {
    return getState().incidents.find((i) => i.id === id);
  },

  getAction(id: string) {
    return getState().actions.find((a) => a.id === id);
  },

  getApproval(id: string) {
    return getState().approvals.find((a) => a.id === id);
  },

  getAudit(id: string) {
    return getState().audit.find((a) => a.id === id);
  },

  markAuditRolledBack(id: string) {
    const state = getState();
    const idx = state.audit.findIndex((a) => a.id === id);
    if (idx < 0) return null;
    state.audit[idx] = { ...state.audit[idx], rolledBack: true };
    bump(state);
    return state.audit[idx];
  },

  refreshAccountHealth() {
    const state = getState();
    for (const account of state.accounts) {
      const open = state.incidents.filter(
        (i) =>
          i.accountId === account.id &&
          i.status !== "resolved" &&
          i.status !== "failed",
      );
      const critical = open.some((i) => i.severity === "critical");
      const high = open.some((i) => i.severity === "high");
      account.health = critical ? "critical" : high ? "degraded" : open.length ? "degraded" : "healthy";
    }
    bump(state);
  },

  newId: uid,
};
