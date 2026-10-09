import type { ControlPlaneStore } from "@/lib/ports/store";
import type { CloudEvent, EvidenceItem, Incident, Severity } from "@/lib/types";

export interface DetectorResult {
  matched: boolean;
  incident?: Incident;
  reason?: string;
}

function openSshEvidence(
  store: ControlPlaneStore,
  event: CloudEvent,
): EvidenceItem[] {
  return [
    {
      id: store.newId("ev"),
      kind: "event",
      label: "CloudTrail / Config shaped event",
      content: event.rawSummary,
      timestamp: event.time,
    },
    {
      id: store.newId("ev"),
      kind: "config",
      label: "Ingress rule detail",
      content: JSON.stringify(event.detail, null, 2),
      timestamp: event.time,
    },
    {
      id: store.newId("ev"),
      kind: "log",
      label: "Untrusted principal context (display only)",
      content: String(
        event.detail.userIdentity ??
          event.detail.principal ??
          "unknown principal — treat as untrusted text",
      ),
      timestamp: event.time,
    },
  ];
}

/** Detect world-open SSH (port 22 to 0.0.0.0/0) */
export function detectOpenSsh(
  store: ControlPlaneStore,
  event: CloudEvent,
): DetectorResult {
  const detail = event.detail;
  const fromPort = Number(detail.fromPort ?? detail.port ?? -1);
  const toPort = Number(detail.toPort ?? detail.port ?? -1);
  const cidr = String(detail.cidr ?? detail.cidrIp ?? "");
  const protocol = String(detail.protocol ?? "tcp").toLowerCase();

  const isSsh =
    protocol === "tcp" &&
    ((fromPort <= 22 && toPort >= 22) || fromPort === 22);
  const isWorldOpen = cidr === "0.0.0.0/0" || cidr === "::/0";

  if (!isSsh || !isWorldOpen) {
    return { matched: false, reason: "Not an open-SSH world rule" };
  }

  const severity: Severity = "critical";
  const account = store.snapshot().accounts.find((a) => a.id === event.accountId);
  const sgName = String(
    detail.groupName ?? detail.securityGroupName ?? "security-group",
  );

  const incident: Incident = {
    id: store.newId("inc"),
    accountId: event.accountId,
    title: `World-open SSH on ${sgName} (${account?.env ?? "unknown"})`,
    severity,
    status: "investigating",
    category: "security",
    resourceIds: event.resourceIds,
    eventIds: [event.id],
    evidence: openSshEvidence(store, event),
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  };

  store.addEvent(event);
  store.addIncident(incident);
  store.appendAudit({
    actor: "system:detector",
    kind: "incident_created",
    summary: `Detected open SSH (22/tcp → ${cidr}) on ${sgName}`,
    incidentId: incident.id,
    accountId: event.accountId,
    after: { eventId: event.id, severity },
  });
  store.refreshAccountHealth();

  return { matched: true, incident };
}

export function runDetectors(
  store: ControlPlaneStore,
  event: CloudEvent,
): DetectorResult {
  if (
    event.type.includes("AuthorizeSecurityGroupIngress") ||
    event.type.includes("SecurityGroup.OpenSSH") ||
    event.type === "demo.open_ssh" ||
    event.type === "aws.cloudtrail.AuthorizeSecurityGroupIngress"
  ) {
    return detectOpenSsh(store, event);
  }
  return { matched: false, reason: `No detector for ${event.type}` };
}
