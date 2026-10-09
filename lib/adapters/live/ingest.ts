import { attachOpenSshPlan } from "@/lib/domain/agent";
import { runDetectors } from "@/lib/domain/detectors";
import {
  executeAction,
  queueApproval,
} from "@/lib/domain/executor";
import { createActionFromPlan } from "@/lib/domain/policy";
import { liveActionRuntime } from "@/lib/adapters/live/runtime";
import { liveStore, upsertLiveResource } from "@/lib/adapters/live/dynamo-store";
import type { CloudEvent, Incident } from "@/lib/types";
import { getLiveAwsConfig } from "@/lib/config";

/** Normalize EventBridge / CloudTrail / Config payloads into CloudEvent. */
export function normalizeIncomingEvent(
  raw: Record<string, unknown>,
): CloudEvent {
  // Already a CloudEvent
  if (raw.id && raw.accountId && raw.type && raw.detail) {
    return raw as unknown as CloudEvent;
  }

  const detail = (raw.detail as Record<string, unknown>) ?? raw;
  const requestParams =
    (detail.requestParameters as Record<string, unknown>) ?? detail;

  const groupId = String(
    requestParams.groupId ??
      detail.groupId ??
      detail.resourceId ??
      "unknown",
  );
  const ipPermissions =
    (requestParams.ipPermissions as Array<Record<string, unknown>>) ?? [];
  const first = ipPermissions[0] ?? {};
  const ipRanges =
    (first.ipRanges as Array<Record<string, unknown>>) ??
    (first.Ipv4Ranges as Array<Record<string, unknown>>) ??
    [];
  const cidr = String(
    ipRanges[0]?.cidrIp ??
      ipRanges[0]?.CidrIp ??
      detail.cidr ??
      "0.0.0.0/0",
  );
  const fromPort = Number(first.fromPort ?? first.FromPort ?? detail.fromPort ?? 22);
  const toPort = Number(first.toPort ?? first.ToPort ?? detail.toPort ?? 22);
  const protocol = String(first.ipProtocol ?? first.IpProtocol ?? "tcp");

  const identityAccount =
    typeof detail.userIdentity === "object" && detail.userIdentity
      ? (detail.userIdentity as { accountId?: string }).accountId
      : undefined;
  const accountId = String(
    raw.account ??
      identityAccount ??
      liveStore.snapshot().accounts[0]?.id ??
      "live-account",
  );

  const eventName = String(
    detail.eventName ?? raw["detail-type"] ?? "AuthorizeSecurityGroupIngress",
  );

  return {
    id: liveStore.newId("evt"),
    accountId,
    source:
      String(raw.source ?? "").includes("config")
        ? "config"
        : String(raw.source ?? "").includes("guardduty")
          ? "guardduty"
          : "cloudtrail",
    type: `aws.cloudtrail.${eventName}`,
    time: String(raw.time ?? detail.eventTime ?? new Date().toISOString()),
    resourceIds: [groupId],
    detail: {
      eventName,
      groupId,
      groupName: String(requestParams.groupName ?? groupId),
      protocol,
      fromPort,
      toPort,
      cidr,
      userIdentity: detail.userIdentity ?? raw.userIdentity,
      principal:
        typeof detail.userIdentity === "object"
          ? JSON.stringify(detail.userIdentity)
          : String(detail.userIdentity ?? "unknown"),
    },
    rawSummary: `${eventName}: ${groupId} ${protocol}/${fromPort} from ${cidr}`,
  };
}

export async function ingestAndRemediate(
  raw: Record<string, unknown>,
): Promise<{ incident?: Incident }> {
  const event = normalizeIncomingEvent(raw);

  // Seed inventory mirror for the SG id if missing
  if (!liveStore.getResource(event.resourceIds[0])) {
    upsertLiveResource({
      id: event.resourceIds[0],
      accountId: event.accountId,
      type: "security_group",
      name: String(event.detail.groupName ?? event.resourceIds[0]),
      region: getLiveAwsConfig().region,
      arn: `arn:aws:ec2:${getLiveAwsConfig().region}:security-group/${event.resourceIds[0]}`,
      tags: {},
      state: {
        groupId: event.detail.groupId,
        inboundRules: [
          {
            protocol: event.detail.protocol,
            fromPort: event.detail.fromPort,
            toPort: event.detail.toPort,
            cidr: event.detail.cidr,
          },
        ],
      },
    });
  }

  const detection = runDetectors(liveStore, event);
  if (!detection.matched || !detection.incident) {
    await liveStore.flush?.();
    return {};
  }

  const withPlan = attachOpenSshPlan(liveStore, detection.incident);
  const created = createActionFromPlan(liveStore, withPlan);
  if (!created) {
    await liveStore.flush?.();
    return { incident: withPlan };
  }

  const { action, decision } = created;
  if (decision.outcome === "needs_approval") {
    queueApproval(liveStore, action);
  } else if (decision.outcome === "auto") {
    await executeAction(liveStore, liveActionRuntime, action.id);
  } else if (decision.outcome === "blocked") {
    liveStore.updateIncident(withPlan.id, { status: "failed" });
  }

  await liveStore.flush?.();
  return { incident: liveStore.getIncident(withPlan.id) };
}
