import { runOpenSshDemo } from "@/lib/adapters/demo/scenario";
import { demoActionRuntime } from "@/lib/adapters/demo/runtime";
import { store } from "@/lib/adapters/demo/store";
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
} from "@/lib/types";

export const demoControlPlane: ControlPlanePort = {
  mode: "demo",

  async snapshot() {
    return store.snapshot();
  },

  async reset() {
    return store.reset!();
  },

  async runDemoScenario(target = "both") {
    const result = await runOpenSshDemo(target);
    return { result, state: store.snapshot() };
  },

  async updatePolicies(body) {
    const policies = store.getPolicies();
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

    const patch: Parameters<typeof store.updatePolicies>[0] = { matrix };
    if (typeof body?.dryRun === "boolean") patch.dryRun = body.dryRun;
    if (typeof body?.killSwitch === "boolean") patch.killSwitch = body.killSwitch;

    const { before, after } = store.updatePolicies(patch);
    const kind =
      typeof body?.killSwitch === "boolean" &&
      body.killSwitch !== before.killSwitch
        ? "kill_switch"
        : "policy_updated";

    store.appendAudit({
      actor: store.snapshot().session.displayName,
      kind,
      summary:
        kind === "kill_switch"
          ? `Kill switch ${after.killSwitch ? "ENABLED" : "disabled"}`
          : `Policies updated (dryRun=${after.dryRun})`,
      before: before as unknown as Record<string, unknown>,
      after: after as unknown as Record<string, unknown>,
    });

    return { policies: after, state: store.snapshot() };
  },

  async decideApproval(approvalId, decision, decidedBy, rationale) {
    const result = await decideApproval(
      store,
      demoActionRuntime,
      approvalId,
      decision,
      decidedBy,
      rationale,
    );
    if (!result) {
      throw new Error("Approval not found or already decided");
    }
    return { ...result, state: store.snapshot() };
  },

  async rollbackAudit(auditId) {
    const result = await rollbackAudit(store, demoActionRuntime, auditId);
    return { ...result, state: store.snapshot() };
  },

  async setRole(role: Role) {
    const session = store.setRole(role);
    return { session, state: store.snapshot() };
  },
};
