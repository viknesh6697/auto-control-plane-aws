import { attachOpenSshPlan } from "@/lib/domain/agent";
import { runDetectors } from "@/lib/domain/detectors";
import {
  executeAction,
  queueApproval,
} from "@/lib/domain/executor";
import { createActionFromPlan } from "@/lib/domain/policy";
import { demoActionRuntime } from "@/lib/adapters/demo/runtime";
import { store } from "@/lib/adapters/demo/store";
import type { CloudEvent, DemoRunResult } from "@/lib/types";

export type DemoTarget = "sandbox" | "prod" | "both";

function buildOpenSshEvent(
  accountId: string,
  resourceId: string,
  groupId: string,
  groupName: string,
): CloudEvent {
  const now = new Date().toISOString();
  return {
    id: store.newId("evt"),
    accountId,
    source: "demo",
    type: "demo.open_ssh",
    time: now,
    resourceIds: [resourceId],
    detail: {
      eventName: "AuthorizeSecurityGroupIngress",
      groupId,
      groupName,
      protocol: "tcp",
      fromPort: 22,
      toPort: 22,
      cidr: "0.0.0.0/0",
      userIdentity:
        "arn:aws:iam::demo:user/reckless-dev (untrusted display text)",
      principal: "reckless-dev",
    },
    rawSummary: `AuthorizeSecurityGroupIngress: ${groupName} (${groupId}) tcp/22 from 0.0.0.0/0`,
  };
}

async function injectOpenSshOnAccount(
  accountId: string,
  steps: string[],
): Promise<{ incidentId?: string; actionId?: string; approvalId?: string }> {
  const snap = store.snapshot();
  const account = snap.accounts.find((a) => a.id === accountId);
  if (!account) {
    steps.push(`Skip unknown account ${accountId}`);
    return {};
  }

  const sg = snap.resources.find(
    (r) => r.accountId === accountId && r.type === "security_group",
  );
  if (!sg) {
    steps.push(`No security group in ${account.env}`);
    return {};
  }

  const inbound = (
    (sg.state.inboundRules as Array<Record<string, unknown>>) ?? []
  ).slice();
  const alreadyOpen = inbound.some(
    (r) =>
      Number(r.fromPort) === 22 &&
      Number(r.toPort) === 22 &&
      r.cidr === "0.0.0.0/0",
  );
  if (!alreadyOpen) {
    inbound.push({
      protocol: "tcp",
      fromPort: 22,
      toPort: 22,
      cidr: "0.0.0.0/0",
      description: "DEMO open SSH — injected",
    });
    store.setResourceState(sg.id, { ...sg.state, inboundRules: inbound });
    steps.push(`Injected open SSH rule onto ${sg.name} (${account.env})`);
  } else {
    steps.push(`Open SSH rule already present on ${sg.name}`);
  }

  const refreshed = store.getResource(sg.id)!;
  const groupId = String(refreshed.state.groupId ?? sg.id);
  const event = buildOpenSshEvent(accountId, sg.id, groupId, sg.name);
  steps.push(`Emitted demo event ${event.id}`);

  const detection = runDetectors(store, event);
  if (!detection.matched || !detection.incident) {
    steps.push(`Detector miss: ${detection.reason ?? "unknown"}`);
    return {};
  }
  steps.push(`Incident ${detection.incident.id} opened`);

  const withPlan = attachOpenSshPlan(store, detection.incident);
  steps.push("Specialist attached revoke_sg_rule plan");

  const created = createActionFromPlan(store, withPlan);
  if (!created) {
    steps.push("No action created from plan");
    return { incidentId: withPlan.id };
  }

  const { action, decision } = created;
  steps.push(`Policy: ${decision.reason}`);

  if (decision.outcome === "blocked") {
    store.updateIncident(withPlan.id, { status: "failed" });
    steps.push("Executor blocked by kill switch");
    return { incidentId: withPlan.id, actionId: action.id };
  }

  if (decision.outcome === "deny" || decision.outcome === "recommend") {
    steps.push(`Action left as ${action.status} (${decision.outcome})`);
    return { incidentId: withPlan.id, actionId: action.id };
  }

  if (decision.outcome === "needs_approval") {
    const approval = queueApproval(store, action);
    steps.push(`Queued approval ${approval.id} (L2)`);
    return {
      incidentId: withPlan.id,
      actionId: action.id,
      approvalId: approval.id,
    };
  }

  const executed = await executeAction(store, demoActionRuntime, action.id);
  steps.push(
    `Auto-executed revoke → ${executed?.status ?? "missing"} (${decision.dryRun ? "dry-run" : "applied"})`,
  );
  return { incidentId: withPlan.id, actionId: action.id };
}

export async function runOpenSshDemo(
  target: DemoTarget = "both",
): Promise<DemoRunResult> {
  const steps: string[] = [];
  const incidentIds: string[] = [];
  const actionIds: string[] = [];
  const approvalIds: string[] = [];

  store.appendAudit({
    actor: store.snapshot().session.displayName,
    kind: "demo_run",
    summary: `Open-SSH scenario run (${target})`,
    after: { target },
  });

  const targets =
    target === "both"
      ? (["acct-sandbox", "acct-prod"] as const)
      : target === "sandbox"
        ? (["acct-sandbox"] as const)
        : (["acct-prod"] as const);

  for (const accountId of targets) {
    const result = await injectOpenSshOnAccount(accountId, steps);
    if (result.incidentId) incidentIds.push(result.incidentId);
    if (result.actionId) actionIds.push(result.actionId);
    if (result.approvalId) approvalIds.push(result.approvalId);
  }

  store.refreshAccountHealth();

  const message =
    target === "both"
      ? "Sandbox auto-remediated (L3); prod awaiting approval (L2)."
      : target === "sandbox"
        ? "Sandbox open-SSH scenario complete."
        : "Prod open-SSH scenario queued for approval.";

  return {
    ok: incidentIds.length > 0,
    message,
    incidentIds,
    actionIds,
    approvalIds,
    steps,
  };
}
