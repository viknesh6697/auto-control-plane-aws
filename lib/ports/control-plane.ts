import type {
  Action,
  Approval,
  AuditEntry,
  CloudEvent,
  DemoRunResult,
  Incident,
  PolicyState,
  Role,
  SessionState,
  StoreSnapshot,
} from "@/lib/types";

export interface ControlPlanePort {
  mode: "demo" | "live";
  snapshot(): Promise<StoreSnapshot>;
  reset?(): Promise<StoreSnapshot>;
  runDemoScenario?(target?: "sandbox" | "prod" | "both"): Promise<{
    result: DemoRunResult;
    state: StoreSnapshot;
  }>;
  updatePolicies(patch: Record<string, unknown>): Promise<{
    policies: PolicyState;
    state: StoreSnapshot;
  }>;
  decideApproval(
    approvalId: string,
    decision: "approved" | "rejected",
    decidedBy?: string,
    rationale?: string,
  ): Promise<{
    approval: Approval;
    action: Action | null;
    state: StoreSnapshot;
  }>;
  rollbackAudit(auditId: string): Promise<{
    ok: boolean;
    message: string;
    state: StoreSnapshot;
  }>;
  setRole(role: Role): Promise<{ session: SessionState; state: StoreSnapshot }>;
  /** Live: ingest EventBridge / Config / CloudTrail-shaped events */
  ingestEvent?(event: CloudEvent | Record<string, unknown>): Promise<{
    incident?: Incident;
    state: StoreSnapshot;
  }>;
}

export type { Action, Approval, AuditEntry, CloudEvent, Incident, StoreSnapshot };
