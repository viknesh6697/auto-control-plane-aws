import type {
  Account,
  Action,
  Approval,
  AuditEntry,
  CloudEvent,
  Incident,
  Playbook,
  PolicyState,
  Resource,
  SessionState,
  StoreSnapshot,
} from "@/lib/types";

export const SEED_ACCOUNTS: Account[] = [
  {
    id: "acct-sandbox",
    name: "Sandbox",
    env: "sandbox",
    health: "healthy",
  },
  {
    id: "acct-prod",
    name: "Production",
    env: "prod",
    health: "healthy",
  },
];

export const SEED_RESOURCES: Resource[] = [
  {
    id: "sg-sandbox-web",
    accountId: "acct-sandbox",
    type: "security_group",
    name: "sandbox-web-sg",
    region: "us-east-1",
    arn: "arn:aws:ec2:us-east-1:111111111111:security-group/sg-sandbox-web",
    tags: { Environment: "sandbox", App: "demo-api" },
    state: {
      groupId: "sg-0sandweb01",
      inboundRules: [
        {
          protocol: "tcp",
          fromPort: 443,
          toPort: 443,
          cidr: "0.0.0.0/0",
          description: "HTTPS",
        },
        {
          protocol: "tcp",
          fromPort: 80,
          toPort: 80,
          cidr: "10.0.0.0/8",
          description: "HTTP internal",
        },
      ],
    },
  },
  {
    id: "sg-prod-web",
    accountId: "acct-prod",
    type: "security_group",
    name: "prod-web-sg",
    region: "us-east-1",
    arn: "arn:aws:ec2:us-east-1:222222222222:security-group/sg-prod-web",
    tags: { Environment: "prod", App: "checkout" },
    state: {
      groupId: "sg-0prodweb01",
      inboundRules: [
        {
          protocol: "tcp",
          fromPort: 443,
          toPort: 443,
          cidr: "0.0.0.0/0",
          description: "HTTPS",
        },
      ],
    },
  },
  {
    id: "i-sandbox-api",
    accountId: "acct-sandbox",
    type: "ec2_instance",
    name: "sandbox-api-1",
    region: "us-east-1",
    arn: "arn:aws:ec2:us-east-1:111111111111:instance/i-0sandapi01",
    tags: { Environment: "sandbox", Name: "sandbox-api-1" },
    state: {
      instanceId: "i-0sandapi01",
      instanceType: "t3.small",
      securityGroups: ["sg-sandbox-web"],
      state: "running",
    },
  },
  {
    id: "i-prod-checkout",
    accountId: "acct-prod",
    type: "ec2_instance",
    name: "prod-checkout-1",
    region: "us-east-1",
    arn: "arn:aws:ec2:us-east-1:222222222222:instance/i-0prodchk01",
    tags: { Environment: "prod", Name: "prod-checkout-1" },
    state: {
      instanceId: "i-0prodchk01",
      instanceType: "m5.large",
      securityGroups: ["sg-prod-web"],
      state: "running",
    },
  },
  {
    id: "vpc-sandbox",
    accountId: "acct-sandbox",
    type: "vpc",
    name: "sandbox-vpc",
    region: "us-east-1",
    arn: "arn:aws:ec2:us-east-1:111111111111:vpc/vpc-0sand01",
    tags: { Environment: "sandbox" },
    state: { cidr: "10.10.0.0/16", vpcId: "vpc-0sand01" },
  },
  {
    id: "vpc-prod",
    accountId: "acct-prod",
    type: "vpc",
    name: "prod-vpc",
    region: "us-east-1",
    arn: "arn:aws:ec2:us-east-1:222222222222:vpc/vpc-0prod01",
    tags: { Environment: "prod" },
    state: { cidr: "10.20.0.0/16", vpcId: "vpc-0prod01" },
  },
  {
    id: "ak-unused-ci",
    accountId: "acct-prod",
    type: "iam_access_key",
    name: "ci-bot / AKIA…UNUSED",
    region: "global",
    arn: "arn:aws:iam::222222222222:user/ci-bot",
    tags: { Owner: "platform" },
    state: {
      userName: "ci-bot",
      accessKeyId: "AKIAEXAMPLEUNUSED01",
      status: "Active",
      lastUsed: null,
      createdDaysAgo: 120,
    },
  },
  {
    id: "vol-idle-ebs",
    accountId: "acct-sandbox",
    type: "ebs_volume",
    name: "orphan-snapshot-source",
    region: "us-east-1",
    arn: "arn:aws:ec2:us-east-1:111111111111:volume/vol-0idle01",
    tags: { Environment: "sandbox", Note: "detached leftover" },
    state: {
      volumeId: "vol-0idle01",
      sizeGiB: 100,
      state: "available",
      attached: false,
      idleDays: 45,
      estimatedMonthlyUsd: 10,
    },
  },
];

export const SEED_PLAYBOOKS: Playbook[] = [
  {
    id: "pb-revoke-sg",
    actionType: "revoke_sg_rule",
    name: "Revoke security group ingress rule",
    description:
      "Removes a typed inbound rule from a security group. Parameters are constrained to protocol, ports, and CIDR.",
    typedOnly: true,
  },
  {
    id: "pb-deactivate-key",
    actionType: "deactivate_access_key",
    name: "Deactivate IAM access key",
    description:
      "Sets an IAM user access key to Inactive. Shown as recommend-only on the trust ladder.",
    typedOnly: true,
    recommendOnly: true,
  },
];

export const SEED_POLICIES: PolicyState = {
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

export const SEED_SESSION: SessionState = {
  role: "Approver",
  displayName: "Approver",
};

/** Companion findings so Overview/Security are not empty before the demo run */
export function buildCompanionSeeds(now = new Date()): {
  events: CloudEvent[];
  incidents: Incident[];
  actions: Action[];
  approvals: Approval[];
  audit: AuditEntry[];
} {
  const t1 = new Date(now.getTime() - 3 * 60 * 60 * 1000).toISOString();
  const t2 = new Date(now.getTime() - 6 * 60 * 60 * 1000).toISOString();

  const events: CloudEvent[] = [
    {
      id: "evt-iam-unused",
      accountId: "acct-prod",
      source: "config",
      type: "Config.IAM.UnusedAccessKey",
      time: t1,
      resourceIds: ["ak-unused-ci"],
      detail: {
        accessKeyId: "AKIAEXAMPLEUNUSED01",
        lastUsed: null,
        ageDays: 120,
      },
      rawSummary: "IAM access key AKIAEXAMPLEUNUSED01 has never been used",
    },
    {
      id: "evt-ebs-idle",
      accountId: "acct-sandbox",
      source: "config",
      type: "Config.EBS.IdleVolume",
      time: t2,
      resourceIds: ["vol-idle-ebs"],
      detail: { volumeId: "vol-0idle01", idleDays: 45, sizeGiB: 100 },
      rawSummary: "EBS volume vol-0idle01 detached and idle for 45 days",
    },
  ];

  const incidents: Incident[] = [
    {
      id: "inc-iam-unused",
      accountId: "acct-prod",
      title: "Unused IAM access key on ci-bot",
      severity: "medium",
      status: "open",
      category: "security",
      resourceIds: ["ak-unused-ci"],
      eventIds: ["evt-iam-unused"],
      evidence: [
        {
          id: "ev-iam-1",
          kind: "config",
          label: "AWS Config finding",
          content:
            "AccessKeyId=AKIAEXAMPLEUNUSED01 Status=Active LastUsed=never AgeDays=120",
          timestamp: t1,
        },
        {
          id: "ev-iam-2",
          kind: "tag",
          label: "Resource tags (untrusted)",
          content: 'Owner=platform Note="legacy CI — do not delete yet"',
          timestamp: t1,
        },
      ],
      agentTrace: {
        summary:
          "Active access key with no recorded use for 120 days. Recommend deactivation after owner confirmation.",
        reasoning: [
          "Key status is Active with null last-used timestamp.",
          "Age exceeds org idle-key threshold (90 days).",
          "Playbook deactivate_access_key is recommend-only at current trust ladder.",
        ],
        confidence: 0.86,
        plan: [
          {
            order: 1,
            actionType: "deactivate_access_key",
            description: "Deactivate AKIAEXAMPLEUNUSED01 on user ci-bot",
            params: {
              userName: "ci-bot",
              accessKeyId: "AKIAEXAMPLEUNUSED01",
            },
          },
        ],
      },
      createdAt: t1,
      updatedAt: t1,
    },
    {
      id: "inc-ebs-idle",
      accountId: "acct-sandbox",
      title: "Idle unattached EBS volume (100 GiB)",
      severity: "low",
      status: "open",
      category: "cost",
      resourceIds: ["vol-idle-ebs"],
      eventIds: ["evt-ebs-idle"],
      evidence: [
        {
          id: "ev-ebs-1",
          kind: "config",
          label: "Volume state",
          content: "vol-0idle01 state=available attached=false idleDays=45",
          timestamp: t2,
        },
      ],
      agentTrace: {
        summary:
          "Detached volume accruing ~$10/mo. Read-only finding — no typed delete playbook in v1.",
        reasoning: [
          "Volume is available and unattached for 45 days.",
          "Estimated monthly cost ~$10 at gp3 rates.",
          "No destructive delete action is registered in the typed catalog for this finding.",
        ],
        confidence: 0.92,
        plan: [],
      },
      createdAt: t2,
      updatedAt: t2,
    },
  ];

  const audit: AuditEntry[] = [
    {
      id: "aud-seed-1",
      timestamp: t2,
      actor: "system:detector",
      kind: "incident_created",
      summary: "Opened incident for idle EBS volume vol-0idle01",
      incidentId: "inc-ebs-idle",
      accountId: "acct-sandbox",
    },
    {
      id: "aud-seed-2",
      timestamp: t1,
      actor: "system:detector",
      kind: "incident_created",
      summary: "Opened incident for unused IAM access key",
      incidentId: "inc-iam-unused",
      accountId: "acct-prod",
    },
  ];

  return {
    events,
    incidents,
    actions: [],
    approvals: [],
    audit,
  };
}

export function createSeedSnapshot(): StoreSnapshot {
  const companion = buildCompanionSeeds();
  return {
    mode: "demo",
    accounts: structuredClone(SEED_ACCOUNTS),
    resources: structuredClone(SEED_RESOURCES),
    events: companion.events,
    incidents: companion.incidents,
    actions: companion.actions,
    approvals: companion.approvals,
    policies: structuredClone(SEED_POLICIES),
    playbooks: structuredClone(SEED_PLAYBOOKS),
    audit: companion.audit,
    session: structuredClone(SEED_SESSION),
    version: 1,
  };
}
