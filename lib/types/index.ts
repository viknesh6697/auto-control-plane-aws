export type AccountEnv = "sandbox" | "prod";
export type Role = "Operator" | "Approver" | "Admin";
export type AutonomyLevel = 0 | 1 | 2 | 3;
export type Severity = "critical" | "high" | "medium" | "low" | "info";
export type IncidentStatus =
  | "open"
  | "investigating"
  | "awaiting_approval"
  | "remediating"
  | "resolved"
  | "failed";
export type ActionType = "revoke_sg_rule" | "deactivate_access_key";
export type ActionStatus =
  | "proposed"
  | "pending_approval"
  | "approved"
  | "rejected"
  | "running"
  | "succeeded"
  | "failed"
  | "blocked"
  | "dry_run";
export type ApprovalStatus = "pending" | "approved" | "rejected";
export type ResourceType =
  | "security_group"
  | "ec2_instance"
  | "vpc"
  | "iam_access_key"
  | "ebs_volume";

export interface Account {
  id: string;
  name: string;
  env: AccountEnv;
  health: "healthy" | "degraded" | "critical";
}

export interface Resource {
  id: string;
  accountId: string;
  type: ResourceType;
  name: string;
  region: string;
  arn: string;
  tags: Record<string, string>;
  state: Record<string, unknown>;
}

export interface CloudEvent {
  id: string;
  accountId: string;
  source: "cloudtrail" | "config" | "guardduty" | "demo";
  type: string;
  time: string;
  resourceIds: string[];
  detail: Record<string, unknown>;
  rawSummary: string;
}

export interface EvidenceItem {
  id: string;
  kind: "event" | "config" | "tag" | "log" | "agent";
  label: string;
  /** Untrusted text shown as data only */
  content: string;
  timestamp: string;
}

export interface AgentPlanStep {
  order: number;
  actionType: ActionType;
  description: string;
  params: Record<string, unknown>;
}

export interface AgentTrace {
  summary: string;
  reasoning: string[];
  confidence: number;
  plan: AgentPlanStep[];
}

export interface Incident {
  id: string;
  accountId: string;
  title: string;
  severity: Severity;
  status: IncidentStatus;
  category: "security" | "cost" | "reliability";
  resourceIds: string[];
  eventIds: string[];
  evidence: EvidenceItem[];
  agentTrace?: AgentTrace;
  createdAt: string;
  updatedAt: string;
  resolvedAt?: string;
}

export interface Action {
  id: string;
  incidentId: string;
  accountId: string;
  type: ActionType;
  status: ActionStatus;
  autonomyApplied: AutonomyLevel;
  params: Record<string, unknown>;
  risk: "low" | "medium" | "high";
  blastRadius: string;
  beforeState?: Record<string, unknown>;
  afterState?: Record<string, unknown>;
  verification?: { ok: boolean; message: string };
  dryRun: boolean;
  createdAt: string;
  updatedAt: string;
  executedAt?: string;
  error?: string;
}

export interface Approval {
  id: string;
  actionId: string;
  incidentId: string;
  accountId: string;
  status: ApprovalStatus;
  requestedAt: string;
  decidedAt?: string;
  decidedBy?: string;
  rationale?: string;
  risk: "low" | "medium" | "high";
  blastRadius: string;
  actionType: ActionType;
  summary: string;
}

export interface PolicyMatrixEntry {
  actionType: ActionType;
  env: AccountEnv;
  level: AutonomyLevel;
}

export interface PolicyState {
  matrix: PolicyMatrixEntry[];
  dryRun: boolean;
  killSwitch: boolean;
  updatedAt: string;
}

export interface Playbook {
  id: string;
  actionType: ActionType;
  name: string;
  description: string;
  typedOnly: true;
  recommendOnly?: boolean;
}

export interface AuditEntry {
  id: string;
  timestamp: string;
  actor: string;
  kind:
    | "incident_created"
    | "agent_plan"
    | "policy_decision"
    | "approval"
    | "action_executed"
    | "action_blocked"
    | "verification"
    | "rollback"
    | "policy_updated"
    | "demo_run"
    | "kill_switch";
  summary: string;
  incidentId?: string;
  actionId?: string;
  accountId?: string;
  before?: Record<string, unknown>;
  after?: Record<string, unknown>;
  /** Snapshot used for rollback of resource state */
  rollbackSnapshot?: {
    resourceId: string;
    state: Record<string, unknown>;
  };
  rolledBack?: boolean;
}

export interface SessionState {
  role: Role;
  displayName: string;
}

export interface DemoRunResult {
  ok: boolean;
  message: string;
  incidentIds: string[];
  actionIds: string[];
  approvalIds: string[];
  steps: string[];
}

export interface StoreSnapshot {
  mode: "demo" | "live";
  accounts: Account[];
  resources: Resource[];
  events: CloudEvent[];
  incidents: Incident[];
  actions: Action[];
  approvals: Approval[];
  policies: PolicyState;
  playbooks: Playbook[];
  audit: AuditEntry[];
  session: SessionState;
  version: number;
  /** Present in live mode when AWS env is incomplete */
  configError?: {
    message: string;
    missing: string[];
  };
}
