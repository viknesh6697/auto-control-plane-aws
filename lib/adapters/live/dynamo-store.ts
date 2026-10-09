import { GetCommand, PutCommand } from "@aws-sdk/lib-dynamodb";
import { parseAccounts, toAccountRecords } from "@/lib/adapters/live/accounts";
import { getDynamoDocClient } from "@/lib/adapters/live/clients";
import { getLiveAwsConfig } from "@/lib/config";
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

const PK = "CONTROL_PLANE";
const SK = "SNAPSHOT";

const DEFAULT_POLICIES: PolicyState = {
  matrix: [
    { actionType: "revoke_sg_rule", env: "sandbox", level: 3 },
    { actionType: "revoke_sg_rule", env: "prod", level: 2 },
    { actionType: "deactivate_access_key", env: "sandbox", level: 1 },
    { actionType: "deactivate_access_key", env: "prod", level: 0 },
  ],
  dryRun: false,
  killSwitch: false,
  updatedAt: new Date().toISOString(),
};

function emptySnapshot(): StoreSnapshot {
  const accounts = toAccountRecords(parseAccounts());
  return {
    mode: "live",
    accounts,
    resources: [],
    events: [],
    incidents: [],
    actions: [],
    approvals: [],
    policies: structuredClone(DEFAULT_POLICIES),
    playbooks: [
      {
        id: "pb-revoke-sg",
        actionType: "revoke_sg_rule",
        name: "Revoke security group ingress rule",
        description:
          "Removes a typed inbound rule from a security group via EC2 RevokeSecurityGroupIngress.",
        typedOnly: true,
      },
      {
        id: "pb-deactivate-key",
        actionType: "deactivate_access_key",
        name: "Deactivate IAM access key",
        description:
          "Sets an IAM user access key to Inactive via IAM UpdateAccessKey.",
        typedOnly: true,
        recommendOnly: true,
      },
    ],
    audit: [],
    session: { role: "Approver", displayName: "Live Approver" },
    version: 1,
  };
}

declare global {
  // eslint-disable-next-line no-var
  var __liveControlPlaneCache: StoreSnapshot | undefined;
  // eslint-disable-next-line no-var
  var __liveControlPlaneLoaded: boolean | undefined;
}

function uid(prefix: string) {
  return `${prefix}-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;
}

function bump(state: StoreSnapshot) {
  state.version += 1;
  state.mode = "live";
}

async function loadFromDynamo(): Promise<StoreSnapshot> {
  const { tableName } = getLiveAwsConfig();
  const doc = getDynamoDocClient();
  const res = await doc.send(
    new GetCommand({
      TableName: tableName,
      Key: { pk: PK, sk: SK },
    }),
  );
  if (res.Item?.snapshot) {
    const snap = res.Item.snapshot as StoreSnapshot;
    snap.mode = "live";
    return snap;
  }
  return emptySnapshot();
}

async function saveToDynamo(state: StoreSnapshot): Promise<void> {
  const { tableName } = getLiveAwsConfig();
  const doc = getDynamoDocClient();
  await doc.send(
    new PutCommand({
      TableName: tableName,
      Item: {
        pk: PK,
        sk: SK,
        snapshot: { ...state, mode: "live" },
        updatedAt: new Date().toISOString(),
      },
    }),
  );
}

export async function ensureLiveStoreLoaded(): Promise<void> {
  if (globalThis.__liveControlPlaneLoaded && globalThis.__liveControlPlaneCache) {
    return;
  }
  globalThis.__liveControlPlaneCache = await loadFromDynamo();
  globalThis.__liveControlPlaneLoaded = true;
}

function getState(): StoreSnapshot {
  if (!globalThis.__liveControlPlaneCache) {
    throw new Error("Live store not loaded — call ensureLiveStoreLoaded() first");
  }
  return globalThis.__liveControlPlaneCache;
}

export const liveStore: ControlPlaneStore = {
  snapshot() {
    return structuredClone(getState());
  },

  getVersion() {
    return getState().version;
  },

  async flush() {
    await saveToDynamo(getState());
  },

  appendAudit(entry) {
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

  updateIncident(id, patch) {
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

  updateAction(id, patch) {
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

  updateApproval(id, patch) {
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

  updateResourceState(id, statePatch) {
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

  setResourceState(id, nextState) {
    const state = getState();
    const idx = state.resources.findIndex((r) => r.id === id);
    if (idx < 0) {
      // Upsert mirror of AWS resource into inventory cache
      const resource: Resource = {
        id,
        accountId: "unknown",
        type: "security_group",
        name: id,
        region: getLiveAwsConfig().region,
        arn: id,
        tags: {},
        state: structuredClone(nextState),
      };
      state.resources.push(resource);
      bump(state);
      return { resource, before: {} };
    }
    const before = structuredClone(state.resources[idx].state);
    state.resources[idx] = {
      ...state.resources[idx],
      state: structuredClone(nextState),
    };
    bump(state);
    return { resource: state.resources[idx], before };
  },

  getPolicies() {
    return structuredClone(getState().policies);
  },

  updatePolicies(patch) {
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

  setSession(session) {
    const state = getState();
    state.session = { ...state.session, ...session };
    bump(state);
    return state.session;
  },

  setRole(role: Role) {
    const names: Record<Role, string> = {
      Operator: "Live Operator",
      Approver: "Live Approver",
      Admin: "Live Admin",
    };
    return this.setSession({ role, displayName: names[role] });
  },

  getIncident(id) {
    return getState().incidents.find((i) => i.id === id);
  },

  getAction(id) {
    return getState().actions.find((a) => a.id === id);
  },

  getApproval(id) {
    return getState().approvals.find((a) => a.id === id);
  },

  getAudit(id) {
    return getState().audit.find((a) => a.id === id);
  },

  markAuditRolledBack(id) {
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
      account.health = critical
        ? "critical"
        : high || open.length
          ? "degraded"
          : "healthy";
    }
    bump(state);
  },

  newId: uid,
};

export function upsertLiveResource(resource: Resource) {
  const state = getState();
  const idx = state.resources.findIndex((r) => r.id === resource.id);
  if (idx >= 0) state.resources[idx] = resource;
  else state.resources.push(resource);
  bump(state);
}
