import {
  ensureLiveStoreLoaded,
  liveStore,
} from "@/lib/adapters/live/dynamo-store";
import { ingestAndRemediate } from "@/lib/adapters/live/ingest";
import { liveActionRuntime } from "@/lib/adapters/live/runtime";
import { ConfigError, liveConfigReady } from "@/lib/config";
import {
  decideApproval,
  rollbackAudit,
} from "@/lib/domain/executor";
import type { ControlPlanePort } from "@/lib/ports/control-plane";
import type {
  ActionType,
  AccountEnv,
  AutonomyLevel,
  PolicyMatrixEntry,
  Role,
  StoreSnapshot,
} from "@/lib/types";

function configErrorSnapshot(): StoreSnapshot {
  const check = liveConfigReady();
  const missing = !check.ok ? check.missing : [];
  const message = !check.ok
    ? check.hint
    : "Live mode configuration incomplete";
  return {
    mode: "live",
    accounts: [],
    resources: [],
    events: [],
    incidents: [],
    actions: [],
    approvals: [],
    policies: {
      matrix: [],
      dryRun: false,
      killSwitch: false,
      updatedAt: new Date().toISOString(),
    },
    playbooks: [],
    audit: [],
    session: { role: "Approver", displayName: "Live Approver" },
    version: 0,
    configError: { message, missing },
  };
}

async function requireLive(): Promise<void> {
  const check = liveConfigReady();
  if (!check.ok) {
    throw new ConfigError(
      `Live mode requires: ${check.missing.join(", ")}. ${check.hint}`,
      check.missing,
    );
  }
  await ensureLiveStoreLoaded();
}

export const liveControlPlane: ControlPlanePort = {
  mode: "live",

  async snapshot() {
    const check = liveConfigReady();
    if (!check.ok) return configErrorSnapshot();
    try {
      await ensureLiveStoreLoaded();
      return liveStore.snapshot();
    } catch (e) {
      const message = e instanceof Error ? e.message : String(e);
      return {
        ...configErrorSnapshot(),
        configError: {
          message: `Failed to load control-plane state from DynamoDB: ${message}`,
          missing: [],
        },
      };
    }
  },

  async updatePolicies(body) {
    await requireLive();
    const policies = liveStore.getPolicies();
    let matrix = policies.matrix;

    if (body?.actionType && body?.env && body?.level !== undefined) {
      const actionType = body.actionType as ActionType;
      const env = body.env as AccountEnv;
      const level = Number(body.level) as AutonomyLevel;
      matrix = matrix.map((m: PolicyMatrixEntry) =>
        m.actionType === actionType && m.env === env ? { ...m, level } : m,
      );
      if (!matrix.some((m) => m.actionType === actionType && m.env === env)) {
        matrix.push({ actionType, env, level });
      }
    }
    if (Array.isArray(body?.matrix)) {
      matrix = body.matrix as PolicyMatrixEntry[];
    }

    const patch: Parameters<typeof liveStore.updatePolicies>[0] = { matrix };
    if (typeof body?.dryRun === "boolean") patch.dryRun = body.dryRun;
    if (typeof body?.killSwitch === "boolean") patch.killSwitch = body.killSwitch;

    const { before, after } = liveStore.updatePolicies(patch);
    const kind =
      typeof body?.killSwitch === "boolean" &&
      body.killSwitch !== before.killSwitch
        ? "kill_switch"
        : "policy_updated";

    liveStore.appendAudit({
      actor: liveStore.snapshot().session.displayName,
      kind,
      summary:
        kind === "kill_switch"
          ? `Kill switch ${after.killSwitch ? "ENABLED" : "disabled"}`
          : `Policies updated (dryRun=${after.dryRun})`,
      before: before as unknown as Record<string, unknown>,
      after: after as unknown as Record<string, unknown>,
    });
    await liveStore.flush?.();
    return { policies: after, state: liveStore.snapshot() };
  },

  async decideApproval(approvalId, decision, decidedBy, rationale) {
    await requireLive();
    const result = await decideApproval(
      liveStore,
      liveActionRuntime,
      approvalId,
      decision,
      decidedBy,
      rationale,
    );
    if (!result) {
      throw new Error("Approval not found or already decided");
    }
    await liveStore.flush?.();
    return { ...result, state: liveStore.snapshot() };
  },

  async rollbackAudit(auditId) {
    await requireLive();
    const result = await rollbackAudit(liveStore, liveActionRuntime, auditId);
    await liveStore.flush?.();
    return { ...result, state: liveStore.snapshot() };
  },

  async setRole(role: Role) {
    await requireLive();
    const session = liveStore.setRole(role);
    await liveStore.flush?.();
    return { session, state: liveStore.snapshot() };
  },

  async ingestEvent(raw) {
    await requireLive();
    const result = await ingestAndRemediate(
      raw as Record<string, unknown>,
    );
    return { incident: result.incident, state: liveStore.snapshot() };
  },
};
