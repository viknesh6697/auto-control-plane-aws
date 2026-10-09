import type { ControlPlaneStore } from "@/lib/ports/store";
import type { AgentTrace, Incident } from "@/lib/types";

/** Specialist plan attachment — fixture reasoning in demo; same structure for live. */
export function attachOpenSshPlan(
  store: ControlPlaneStore,
  incident: Incident,
): Incident {
  const event = store
    .snapshot()
    .events.find((e) => incident.eventIds.includes(e.id));
  const detail = event?.detail ?? {};
  const groupId = String(detail.groupId ?? "unknown");
  const cidr = String(detail.cidr ?? "0.0.0.0/0");
  const fromPort = Number(detail.fromPort ?? 22);
  const toPort = Number(detail.toPort ?? 22);

  const trace: AgentTrace = {
    summary:
      "Port 22 is exposed to the internet. Propose typed revoke of the offending ingress rule, then verify the rule is gone.",
    reasoning: [
      "Ingress authorizes tcp/22 from a world CIDR (0.0.0.0/0 or ::/0).",
      "SSH exposure on public CIDRs is a high-confidence security finding.",
      "Typed playbook revoke_sg_rule matches protocol/ports/CIDR exactly — no free-form AWS calls.",
      "Verification will re-read security group inbound rules after revoke.",
    ],
    confidence: 0.94,
    plan: [
      {
        order: 1,
        actionType: "revoke_sg_rule",
        description: `Revoke tcp/${fromPort}-${toPort} from ${cidr} on ${groupId}`,
        params: {
          resourceId: incident.resourceIds[0],
          groupId,
          protocol: "tcp",
          fromPort,
          toPort,
          cidr,
        },
      },
    ],
  };

  const evidence = [
    ...incident.evidence,
    {
      id: store.newId("ev"),
      kind: "agent" as const,
      label: "Specialist plan",
      content: trace.summary,
      timestamp: new Date().toISOString(),
    },
  ];

  const updated = store.updateIncident(incident.id, {
    agentTrace: trace,
    evidence,
    status: "investigating",
  });

  store.appendAudit({
    actor: "system:agent",
    kind: "agent_plan",
    summary: `Attached remediation plan: revoke_sg_rule on ${groupId}`,
    incidentId: incident.id,
    accountId: incident.accountId,
    after: { confidence: trace.confidence, steps: trace.plan.length },
  });

  return updated ?? { ...incident, agentTrace: trace, evidence };
}
