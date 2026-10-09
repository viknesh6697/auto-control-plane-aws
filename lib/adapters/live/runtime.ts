import {
  AuthorizeSecurityGroupIngressCommand,
  DescribeSecurityGroupsCommand,
  RevokeSecurityGroupIngressCommand,
} from "@aws-sdk/client-ec2";
import {
  GetAccessKeyLastUsedCommand,
  UpdateAccessKeyCommand,
} from "@aws-sdk/client-iam";
import { getEc2Client, getIamClient } from "@/lib/adapters/live/clients";
import { liveStore, upsertLiveResource } from "@/lib/adapters/live/dynamo-store";
import type {
  ActionRuntime,
  ActionRuntimeResult,
  DeactivateKeyParams,
  RevokeSgParams,
} from "@/lib/domain/executor";
import { getLiveAwsConfig } from "@/lib/config";

async function describeGroup(groupId: string) {
  const ec2 = getEc2Client();
  const res = await ec2.send(
    new DescribeSecurityGroupsCommand({ GroupIds: [groupId] }),
  );
  const sg = res.SecurityGroups?.[0];
  if (!sg) throw new Error(`Security group ${groupId} not found in AWS`);
  return sg;
}

function inboundFromAws(
  sg: Awaited<ReturnType<typeof describeGroup>>,
): Array<Record<string, unknown>> {
  const rules: Array<Record<string, unknown>> = [];
  for (const perm of sg.IpPermissions ?? []) {
    for (const range of perm.IpRanges ?? []) {
      rules.push({
        protocol: perm.IpProtocol ?? "tcp",
        fromPort: perm.FromPort ?? 0,
        toPort: perm.ToPort ?? 0,
        cidr: range.CidrIp ?? "",
        description: range.Description,
      });
    }
  }
  return rules;
}

export const liveActionRuntime: ActionRuntime = {
  async revokeSgRule(params: RevokeSgParams, dryRun: boolean): Promise<ActionRuntimeResult> {
    const sg = await describeGroup(params.groupId);
    const beforeState = {
      groupId: sg.GroupId,
      groupName: sg.GroupName,
      inboundRules: inboundFromAws(sg),
      vpcId: sg.VpcId,
    };

    // Mirror into inventory cache
    upsertLiveResource({
      id: params.resourceId || params.groupId,
      accountId: "live",
      type: "security_group",
      name: sg.GroupName ?? params.groupId,
      region: getLiveAwsConfig().region,
      arn: `arn:aws:ec2:${getLiveAwsConfig().region}:security-group/${params.groupId}`,
      tags: Object.fromEntries(
        (sg.Tags ?? []).map((t) => [t.Key ?? "", t.Value ?? ""]),
      ),
      state: beforeState,
    });

    if (dryRun) {
      const afterRules = (beforeState.inboundRules as Array<Record<string, unknown>>).filter(
        (r) =>
          !(
            r.protocol === params.protocol &&
            Number(r.fromPort) === params.fromPort &&
            Number(r.toPort) === params.toPort &&
            r.cidr === params.cidr
          ),
      );
      return {
        beforeState,
        afterState: { ...beforeState, inboundRules: afterRules },
        verified: true,
        message: "Dry-run: would call EC2 RevokeSecurityGroupIngress; no AWS mutation",
      };
    }

    const ec2 = getEc2Client();
    await ec2.send(
      new RevokeSecurityGroupIngressCommand({
        GroupId: params.groupId,
        IpPermissions: [
          {
            IpProtocol: params.protocol,
            FromPort: params.fromPort,
            ToPort: params.toPort,
            IpRanges: [{ CidrIp: params.cidr }],
          },
        ],
      }),
    );

    const afterSg = await describeGroup(params.groupId);
    const afterState = {
      groupId: afterSg.GroupId,
      groupName: afterSg.GroupName,
      inboundRules: inboundFromAws(afterSg),
      vpcId: afterSg.VpcId,
    };

    liveStore.setResourceState(params.resourceId || params.groupId, afterState);

    const stillOpen = (afterState.inboundRules as Array<Record<string, unknown>>).some(
      (r) =>
        r.protocol === params.protocol &&
        Number(r.fromPort) === params.fromPort &&
        Number(r.toPort) === params.toPort &&
        r.cidr === params.cidr,
    );

    return {
      beforeState,
      afterState,
      verified: !stillOpen,
      message: stillOpen
        ? "Verification failed: offending rule still present in AWS"
        : `Verified via DescribeSecurityGroups: no tcp/${params.fromPort} from ${params.cidr}`,
      rollbackSnapshot: {
        resourceId: params.resourceId || params.groupId,
        state: beforeState,
      },
    };
  },

  async deactivateAccessKey(
    params: DeactivateKeyParams,
    dryRun: boolean,
  ): Promise<ActionRuntimeResult> {
    const iam = getIamClient();
    let lastUsed: Record<string, unknown> = {};
    try {
      const lu = await iam.send(
        new GetAccessKeyLastUsedCommand({ AccessKeyId: params.accessKeyId }),
      );
      lastUsed = {
        userName: lu.UserName,
        lastUsedDate: lu.AccessKeyLastUsed?.LastUsedDate?.toISOString() ?? null,
      };
    } catch {
      lastUsed = { note: "Could not read last-used metadata" };
    }

    const beforeState = {
      userName: params.userName,
      accessKeyId: params.accessKeyId,
      status: "Active",
      ...lastUsed,
    };
    const afterState = { ...beforeState, status: "Inactive" };

    if (dryRun) {
      return {
        beforeState,
        afterState,
        verified: true,
        message: "Dry-run: would call IAM UpdateAccessKey Status=Inactive",
      };
    }

    await iam.send(
      new UpdateAccessKeyCommand({
        UserName: params.userName,
        AccessKeyId: params.accessKeyId,
        Status: "Inactive",
      }),
    );

    if (params.resourceId) {
      liveStore.setResourceState(params.resourceId, afterState);
    }

    return {
      beforeState,
      afterState,
      verified: true,
      message: "IAM UpdateAccessKey set Status=Inactive",
      rollbackSnapshot: params.resourceId
        ? { resourceId: params.resourceId, state: beforeState }
        : undefined,
    };
  },

  async restoreResource(resourceId, state) {
    // Best-effort: re-authorize the prior SG rule if present in snapshot
    const inbound = (state.inboundRules as Array<Record<string, unknown>>) ?? [];
    const groupId = String(state.groupId ?? resourceId);
    const openSsh = inbound.find(
      (r) =>
        Number(r.fromPort) === 22 &&
        Number(r.toPort) === 22 &&
        (r.cidr === "0.0.0.0/0" || r.cidr === "::/0"),
    );
    if (openSsh) {
      const ec2 = getEc2Client();
      await ec2.send(
        new AuthorizeSecurityGroupIngressCommand({
          GroupId: groupId,
          IpPermissions: [
            {
              IpProtocol: String(openSsh.protocol ?? "tcp"),
              FromPort: Number(openSsh.fromPort),
              ToPort: Number(openSsh.toPort),
              IpRanges: [{ CidrIp: String(openSsh.cidr) }],
            },
          ],
        }),
      );
    }
    liveStore.setResourceState(resourceId, state);
  },
};
